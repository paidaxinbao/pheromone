/**
 * Mailbox Agent SDK
 * 
 * Agent 客户端 SDK，用于连接 Mailbox Hub
 * 
 * Features:
 * - AgentClient class
 * - Registration
 * - Send/Receive messages
 * - Heartbeat keep-alive
 * - Auto-reconnect
 * 
 * @version 1.0.0
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  hubUrl: 'http://localhost:18888',
  heartbeatInterval: 30000,      // 30 seconds
  reconnectDelay: 5000,          // 5 seconds
  maxReconnectAttempts: 10,
  messagePollInterval: 5000,     // 5 seconds
  timeout: 30000,                // 30 seconds request timeout
};

// ============================================================================
// Logger
// ============================================================================

const createLogger = (name, debug = false) => ({
  info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [${name}] [INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[${new Date().toISOString()}] [${name}] [ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[${new Date().toISOString()}] [${name}] [WARN] ${msg}`, ...args),
  debug: (msg, ...args) => debug && console.log(`[${new Date().toISOString()}] [${name}] [DEBUG] ${msg}`, ...args),
});

// ============================================================================
// HTTP Client
// ============================================================================

class HttpClient {
  constructor(baseUrl, timeout = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.httpModule = baseUrl.startsWith('https') ? https : http;
  }

  request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: this.timeout
      };

      const req = this.httpModule.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}

// ============================================================================
// Message Builder
// ============================================================================

class MessageBuilder {
  static create(type, sender, payload, options = {}) {
    return {
      id: options.id || crypto.randomUUID(),
      type,
      version: options.version || '1.0.0',
      timestamp: options.timestamp || new Date().toISOString(),
      sender,
      recipient: options.recipient,
      payload,
      metadata: options.metadata
    };
  }

  static taskAssign(sender, task, recipient, options = {}) {
    return this.create('task.assign', sender, { task, ...options }, { recipient });
  }

  static taskUpdate(sender, taskId, status, progress, message) {
    return this.create('task.update', sender, { taskId, status, progress, message });
  }

  static taskComplete(sender, taskId, result, summary) {
    return this.create('task.complete', sender, { taskId, result, summary });
  }

  static taskFail(sender, taskId, error, partialResult) {
    return this.create('task.fail', sender, { taskId, error, partialResult });
  }

  static heartbeat(agentId, status, currentTask, metrics) {
    return this.create('status.heartbeat', { id: agentId, role: 'agent' }, {
      agentId,
      status,
      currentTask,
      metrics
    });
  }

  static directMessage(sender, recipient, content, contentType = 'text') {
    return this.create('message.direct', sender, { content, contentType }, { recipient });
  }

  static broadcast(sender, subject, content, urgent = false) {
    return this.create('message.broadcast', sender, { subject, content, urgent });
  }

  static handshakeRegister(agent, token) {
    return this.create('handshake.register', agent, { agent, token });
  }

  static statusSync(sender) {
    return this.create('status.sync', sender, {});
  }
}

// ============================================================================
// Agent Client
// ============================================================================

class AgentClient extends EventEmitter {
  constructor(agentInfo, options = {}) {
    super();
    
    this.agentInfo = agentInfo;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.logger = createLogger(agentInfo.id, options.debug);
    
    this.httpClient = new HttpClient(this.config.hubUrl, this.config.timeout);
    
    this.registered = false;
    this.connected = false;
    this.status = 'offline';
    this.currentTask = null;
    
    this.heartbeatTimer = null;
    this.pollTimer = null;
    this.reconnectAttempts = 0;
    
    this.messageHandlers = new Map();
    this.taskHandlers = new Map();
  }

  // ===== Lifecycle =====

  async start() {
    this.logger.info('Starting agent client...');
    
    try {
      await this.register();
      this.startHeartbeat();
      this.startPolling();
      this.emit('started');
      this.logger.info('Agent client started successfully');
    } catch (error) {
      this.logger.error('Failed to start:', error.message);
      this.scheduleReconnect();
      throw error;
    }
  }

  async stop() {
    this.logger.info('Stopping agent client...');
    
    this.stopHeartbeat();
    this.stopPolling();
    
    this.registered = false;
    this.connected = false;
    this.status = 'offline';
    
    this.emit('stopped');
    this.logger.info('Agent client stopped');
  }

  // ===== Registration =====

  async register() {
    this.logger.debug('Registering with Mailbox Hub...');
    
    try {
      const message = MessageBuilder.handshakeRegister(this.agentInfo, this.config.token);
      const response = await this.httpClient.post('/register', { agent: this.agentInfo });
      
      if (response.data.success) {
        this.registered = true;
        this.connected = true;
        this.status = 'idle';
        this.reconnectAttempts = 0;
        
        this.emit('registered', response.data);
        this.logger.info('Registered successfully');
        
        return response.data;
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error) {
      this.registered = false;
      this.connected = false;
      throw error;
    }
  }

  async unregister() {
    this.logger.debug('Unregistering from Mailbox Hub...');
    
    try {
      const response = await this.httpClient.delete(`/agents/${this.agentInfo.id}`);
      this.registered = false;
      this.connected = false;
      this.emit('unregistered');
      this.logger.info('Unregistered successfully');
      return response.data;
    } catch (error) {
      this.logger.error('Unregister failed:', error.message);
      throw error;
    }
  }

  // ===== Heartbeat =====

  startHeartbeat() {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.config.heartbeatInterval);
    
    this.logger.debug('Heartbeat started');
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.logger.debug('Heartbeat stopped');
    }
  }

  async sendHeartbeat() {
    if (!this.registered) return;
    
    try {
      const response = await this.httpClient.post('/heartbeat', {
        agentId: this.agentInfo.id,
        status: this.status,
        currentTask: this.currentTask,
        metrics: {
          memory: process.memoryUsage().heapUsed,
          uptime: process.uptime()
        }
      });
      
      if (response.data.success) {
        this.connected = true;
        
        // Process pending messages
        if (response.data.messages && response.data.messages.length > 0) {
          for (const message of response.data.messages) {
            await this.handleMessage(message);
          }
        }
      }
    } catch (error) {
      this.logger.error('Heartbeat failed:', error.message);
      this.connected = false;
      this.emit('error', error);
    }
  }

  // ===== Message Polling =====

  startPolling() {
    if (this.pollTimer) return;
    
    this.pollTimer = setInterval(async () => {
      await this.pollMessages();
    }, this.config.messagePollInterval);
    
    this.logger.debug('Message polling started');
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.logger.debug('Message polling stopped');
    }
  }

  async pollMessages() {
    if (!this.registered) return;
    
    try {
      const response = await this.httpClient.get(`/messages?agentId=${this.agentInfo.id}`);
      
      if (response.data.success && response.data.messages?.length > 0) {
        for (const message of response.data.messages) {
          await this.handleMessage(message);
        }
      }
    } catch (error) {
      this.logger.error('Poll failed:', error.message);
    }
  }

  // ===== Message Handling =====

  async handleMessage(message) {
    const { type, payload } = message;
    
    this.logger.debug(`Received message: ${type}`);
    this.emit('message', message);
    
    // Find handler for message type
    const handler = this.messageHandlers.get(type);
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        this.logger.error(`Handler error for ${type}:`, error.message);
        this.emit('error', error);
      }
    }
    
    // Handle specific message types
    switch (type) {
      case 'task.assign':
        await this.handleTaskAssign(message);
        break;
      case 'task.update':
        this.emit('task:update', payload);
        break;
      case 'message.direct':
        this.emit('message:direct', payload);
        break;
      case 'message.broadcast':
        this.emit('message:broadcast', payload);
        break;
      case 'status.sync':
        this.emit('status:sync', payload);
        break;
    }
  }

  async handleTaskAssign(message) {
    const { payload } = message;
    const { task } = payload;
    
    this.currentTask = task.id;
    this.status = 'busy';
    
    this.logger.info(`Task assigned: ${task.id} - ${task.title}`);
    this.emit('task:assigned', task);
    
    // Find task handler
    const handler = this.taskHandlers.get(task.type);
    if (handler) {
      try {
        const result = await handler(task);
        await this.completeTask(task.id, result);
      } catch (error) {
        await this.failTask(task.id, error);
      }
    }
  }

  // ===== Sending Messages =====

  async sendMessage(message) {
    if (!this.registered) {
      throw new Error('Agent not registered');
    }
    
    try {
      const response = await this.httpClient.post('/message', message);
      
      if (response.data.success) {
        this.logger.debug(`Message sent: ${message.type}`);
        return response.data;
      } else {
        throw new Error(response.data.error || 'Send failed');
      }
    } catch (error) {
      this.logger.error('Send message failed:', error.message);
      throw error;
    }
  }

  async assignTask(task, recipient) {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const message = MessageBuilder.taskAssign(sender, task, recipient);
    return this.sendMessage(message);
  }

  async updateTask(taskId, status, progress, msg) {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const message = MessageBuilder.taskUpdate(sender, taskId, status, progress, msg);
    return this.sendMessage(message);
  }

  async completeTask(taskId, result) {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const message = MessageBuilder.taskComplete(sender, taskId, result);
    
    this.currentTask = null;
    this.status = 'idle';
    
    this.emit('task:completed', { taskId, result });
    this.logger.info(`Task completed: ${taskId}`);
    
    return this.sendMessage(message);
  }

  async failTask(taskId, error) {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const errorInfo = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      retryable: error.retryable || false
    };
    const message = MessageBuilder.taskFail(sender, taskId, errorInfo);
    
    this.currentTask = null;
    this.status = 'idle';
    
    this.emit('task:failed', { taskId, error });
    this.logger.error(`Task failed: ${taskId} - ${error.message}`);
    
    return this.sendMessage(message);
  }

  async sendDirectMessage(recipientId, content, contentType = 'text') {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const recipient = { id: recipientId };
    const message = MessageBuilder.directMessage(sender, recipient, content, contentType);
    return this.sendMessage(message);
  }

  async broadcast(subject, content, urgent = false) {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const message = MessageBuilder.broadcast(sender, subject, content, urgent);
    return this.sendMessage(message);
  }

  async syncStatus() {
    const sender = { id: this.agentInfo.id, role: this.agentInfo.role };
    const message = MessageBuilder.statusSync(sender);
    return this.sendMessage(message);
  }

  // ===== Handler Registration =====

  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  onTask(taskType, handler) {
    this.taskHandlers.set(taskType, handler);
  }

  // ===== Auto Reconnect =====

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      this.emit('reconnect:failed');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * this.reconnectAttempts;
    
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(async () => {
      try {
        await this.register();
        this.startHeartbeat();
        this.startPolling();
        this.emit('reconnected');
        this.logger.info('Reconnected successfully');
      } catch (error) {
        this.logger.error('Reconnect failed:', error.message);
        this.scheduleReconnect();
      }
    }, delay);
  }

  // ===== Utility Methods =====

  setStatus(status) {
    this.status = status;
    this.logger.debug(`Status changed to: ${status}`);
  }

  isRegistered() {
    return this.registered;
  }

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      agentId: this.agentInfo.id,
      registered: this.registered,
      connected: this.connected,
      status: this.status,
      currentTask: this.currentTask,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // ===== Static Factory Methods =====

  static createDeveloper(id, options = {}) {
    return new AgentClient({
      id,
      role: 'developer',
      name: options.name || `Developer ${id}`,
      capabilities: ['code.read', 'code.write', 'git.read', 'git.write', 'test.run']
    }, options);
  }

  static createReviewer(id, options = {}) {
    return new AgentClient({
      id,
      role: 'reviewer',
      name: options.name || `Reviewer ${id}`,
      capabilities: ['code.read', 'review.code']
    }, options);
  }

  static createTester(id, options = {}) {
    return new AgentClient({
      id,
      role: 'tester',
      name: options.name || `Tester ${id}`,
      capabilities: ['code.read', 'test.run', 'test.write']
    }, options);
  }

  static createCoordinator(id, options = {}) {
    return new AgentClient({
      id,
      role: 'coordinator',
      name: options.name || `Coordinator ${id}`,
      capabilities: ['code.read', 'git.read']
    }, options);
  }

  static createManager(id, options = {}) {
    return new AgentClient({
      id,
      role: 'manager',
      name: options.name || `Manager ${id}`,
      capabilities: ['git.read', 'deploy']
    }, options);
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  AgentClient,
  MessageBuilder,
  HttpClient,
  DEFAULT_CONFIG
};