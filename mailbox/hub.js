/**
 * Mailbox Hub v2 - Webhook Callback Mode
 * 
 * Features:
 * - HTTP Server (port 18888)
 * - Callback Dispatcher with retry logic
 * - Message Queue Management
 * - Agent Registration with callbackUrl
 * - Message Routing via Webhook
 * - Message Persistence
 * 
 * @version 2.0.0
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { MessageStore } = require('./message-store');
const { CallbackDispatcher } = require('./callback-dispatcher');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  port: process.env.MAILBOX_PORT || 18888,
  host: process.env.MAILBOX_HOST || '0.0.0.0',
  heartbeatInterval: 30000,
  heartbeatTimeout: 90000,
  messageRetention: 3600000,
  maxQueueSize: 1000,
  persistMessages: true,
  callbackTimeout: 10000,
  maxRetries: 3,
};

// Initialize stores
const messageStore = CONFIG.persistMessages ? new MessageStore() : null;

// ============================================================================
// Logger
// ============================================================================

const logger = {
  info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, ...args),
  debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [DEBUG] ${msg}`, ...args)
};

// ============================================================================
// Agent Registry (with callbackUrl support)
// ============================================================================

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.byRole = new Map();
  }

  register(agentInfo) {
    const { id, role, callbackUrl } = agentInfo;
    
    if (!id || !role) {
      throw new Error('Agent id and role are required');
    }
    
    if (this.agents.has(id)) {
      const oldAgent = this.agents.get(id);
      this.byRole.get(oldAgent.role)?.delete(id);
    }
    
    const agent = {
      ...agentInfo,
      id,
      role,
      callbackUrl: callbackUrl || null,
      registeredAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
      status: agentInfo.status || 'idle'
    };
    
    this.agents.set(id, agent);
    
    if (!this.byRole.has(role)) {
      this.byRole.set(role, new Set());
    }
    this.byRole.get(role).add(id);
    
    logger.info(`Agent registered: ${id} (role: ${role}, callback: ${callbackUrl || 'none'})`);
    return agent;
  }

  unregister(agentId) {
    if (!this.agents.has(agentId)) return false;
    
    const agent = this.agents.get(agentId);
    this.byRole.get(agent.role)?.delete(agentId);
    this.agents.delete(agentId);
    
    logger.info(`Agent unregistered: ${agentId}`);
    return true;
  }

  get(agentId) {
    return this.agents.get(agentId);
  }

  getAll() {
    return Array.from(this.agents.values());
  }

  getByRole(role) {
    const agentIds = this.byRole.get(role);
    if (!agentIds) return [];
    return Array.from(agentIds).map(id => this.agents.get(id));
  }

  updateHeartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      agent.status = 'online';
    }
  }

  updateStatus(agentId, status) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
    }
  }

  count() {
    return this.agents.size;
  }
}

// ============================================================================
// Message Queue (Simple in-memory)
// ============================================================================

class MessageQueue {
  constructor() {
    this.queues = new Map();
  }

  enqueue(agentId, message) {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    
    const queue = this.queues.get(agentId);
    const queuedMessage = {
      ...message,
      _id: crypto.randomUUID(),
      _enqueuedAt: Date.now()
    };
    
    queue.push(queuedMessage);
    
    if (queue.length > 1000) {
      queue.shift();
    }
    
    return queuedMessage._id;
  }

  dequeue(agentId, limit = 100) {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return [];
    
    const messages = queue.splice(0, limit);
    return messages;
  }

  getAll(agentId) {
    return this.queues.get(agentId) || [];
  }

  clear(agentId) {
    if (this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
  }

  getTotalSize() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
}

// ============================================================================
// Schema Validator
// ============================================================================

class SchemaValidator {
  validateEnvelope(message) {
    const errors = [];
    
    const required = ['id', 'type', 'version', 'timestamp', 'sender', 'payload'];
    for (const field of required) {
      if (!message[field]) {
        errors.push({ field, message: `Missing required field: ${field}` });
      }
    }
    
    if (message.type && !/^(task|message|status|handshake)\.(assign|update|complete|fail|direct|broadcast|heartbeat|sync|register|ack)$/.test(message.type)) {
      errors.push({ field: 'type', message: 'Invalid message type format' });
    }
    
    if (message.version && !/^\d+\.\d+\.\d+$/.test(message.version)) {
      errors.push({ field: 'version', message: 'Invalid version format (expected x.y.z)' });
    }
    
    if (message.sender && (!message.sender.id || !message.sender.role)) {
      errors.push({ field: 'sender', message: 'Sender must have id and role' });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null
    };
  }

  validateAgent(agent) {
    const errors = [];
    
    if (!agent.id) {
      errors.push({ field: 'id', message: 'Agent id is required' });
    }
    
    const validRoles = ['manager', 'coordinator', 'developer', 'reviewer', 'tester'];
    if (!agent.role || !validRoles.includes(agent.role)) {
      errors.push({ field: 'role', message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null
    };
  }
}

// ============================================================================
// Message Router (with CallbackDispatcher)
// ============================================================================

class MessageRouter {
  constructor(registry, queue, dispatcher) {
    this.registry = registry;
    this.queue = queue;
    this.dispatcher = dispatcher;
    this.handlers = new Map();
  }

  async route(message) {
    const { type, recipient } = message;
    
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (err) {
        logger.error(`Handler error for ${type}: ${err.message}`);
      }
    }
    
    switch (type) {
      case 'handshake.register':
        return this.handleRegister(message);
      
      case 'status.heartbeat':
        return this.handleHeartbeat(message);
      
      case 'task.assign':
      case 'task.update':
      case 'task.complete':
      case 'task.fail':
        return this.handleTaskMessage(message);
      
      case 'message.direct':
        return this.handleDirectMessage(message);
      
      case 'message.broadcast':
        return this.handleBroadcast(message);
      
      case 'status.sync':
        return this.handleStatusSync(message);
      
      default:
        return { success: false, error: `Unknown message type: ${type}` };
    }
  }

  async handleDirectMessage(message) {
    const { recipient } = message;

    if (!recipient) {
      return { success: false, error: 'Recipient required for direct message' };
    }

    if (recipient.id) {
      if (this.dispatcher) {
        const result = await this.dispatcher.push(recipient.id, message);
        return { success: true, ...result };
      }
      const msgId = this.queue.enqueue(recipient.id, message);
      return { success: true, messageId: msgId };
    }

    if (recipient.type === 'role' && recipient.target) {
      const agents = this.registry.getByRole(recipient.target);
      const results = [];
      for (const agent of agents) {
        if (this.dispatcher) {
          const result = await this.dispatcher.push(agent.id, message);
          results.push({ agentId: agent.id, ...result });
        } else {
          const msgId = this.queue.enqueue(agent.id, message);
          results.push({ agentId: agent.id, messageId: msgId });
        }
      }
      return { success: true, delivered: results };
    }

    return { success: false, error: 'Invalid recipient specification' };
  }

  async handleTaskMessage(message) {
    const { recipient, type } = message;

    if (recipient && recipient.id) {
      if (this.dispatcher) {
        const result = await this.dispatcher.push(recipient.id, message);
        return { success: true, type, ...result };
      }
      const msgId = this.queue.enqueue(recipient.id, message);
      return { success: true, messageId: msgId, delivered: recipient.id };
    }

    if (recipient && recipient.type === 'role' && recipient.target) {
      const agents = this.registry.getByRole(recipient.target);
      const results = [];
      for (const agent of agents) {
        if (this.dispatcher) {
          const result = await this.dispatcher.push(agent.id, message);
          results.push({ agentId: agent.id, ...result });
        } else {
          results.push({
            agentId: agent.id,
            messageId: this.queue.enqueue(agent.id, message)
          });
        }
      }
      return { success: true, delivered: results };
    }

    return { success: false, error: 'No valid recipient' };
  }

  async handleBroadcast(message) {
    if (this.dispatcher) {
      const senderId = message.sender?.id;
      const results = await this.dispatcher.pushBroadcast(message, senderId);
      return {
        success: true,
        broadcast: true,
        delivered: results.filter(r => r.delivered).length,
        results
      };
    }

    const agents = this.registry.getAll().filter(a => a.status !== 'offline');
    const results = agents.map(agent => ({
      agentId: agent.id,
      messageId: this.queue.enqueue(agent.id, message)
    }));
    return { success: true, broadcast: true, delivered: results.length, results };
  }

  handleRegister(message) {
    return { success: true, message: 'Registration acknowledged' };
  }

  handleHeartbeat(message) {
    return { success: true, message: 'Heartbeat received' };
  }

  handleStatusSync(message) {
    return this.handleBroadcast(message);
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }
}

// ============================================================================
// Mailbox Hub (Main Server)
// ============================================================================

class MailboxHub {
  constructor() {
    this.registry = new AgentRegistry();
    this.queue = new MessageQueue();
    this.validator = new SchemaValidator();
    this.messageStore = messageStore;
    
    this.dispatcher = new CallbackDispatcher(this.registry, this.queue, {
      maxRetries: CONFIG.maxRetries,
      retryBaseDelay: CONFIG.callbackTimeout / 5,
      callbackTimeout: CONFIG.callbackTimeout,
    });
    
    this.router = new MessageRouter(this.registry, this.queue, this.dispatcher);

    this.server = null;
    this.heartbeatChecker = null;
    this.cleanupInterval = null;
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
    
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(CONFIG.port, CONFIG.host, () => {
      logger.info(`Mailbox Hub v2.0 listening on http://${CONFIG.host}:${CONFIG.port}`);
    });
    
    this.heartbeatChecker = setInterval(() => this.checkHeartbeats(), CONFIG.heartbeatInterval);
    
    this.cleanupInterval = setInterval(() => this.cleanupOldMessages(), 60000);
    
    return this;
  }

  stop() {
    if (this.heartbeatChecker) clearInterval(this.heartbeatChecker);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.server) {
      this.server.close(() => {
        logger.info('Mailbox Hub stopped');
      });
    }
  }

  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;
    const method = req.method;
    const startTime = Date.now();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const result = await this.routePath(method, pathname, req, query);
      
      if (result === null) {
        this.sendJson(res, 404, { success: false, error: 'Not Found' });
        return;
      }
      
      this.sendJson(res, result.status || 200, result.body);
      
      logger.debug(`${method} ${pathname} - ${result.status || 200} (${Date.now() - startTime}ms)`);
      
    } catch (error) {
      logger.error(`Request error: ${error.message}`);
      this.sendJson(res, 500, { success: false, error: error.message });
    }
  }

  async routePath(method, pathname, req, query) {
    if (method === 'POST' && pathname === '/register') {
      const body = await this.parseBody(req);
      return this.handleRegister(body);
    }
    
    if (method === 'POST' && pathname === '/message') {
      const body = await this.parseBody(req);
      return this.handleMessage(body);
    }
    
    if (method === 'POST' && pathname === '/broadcast') {
      const body = await this.parseBody(req);
      return this.handleBroadcast(body);
    }
    
    if (method === 'POST' && pathname === '/heartbeat') {
      const body = await this.parseBody(req);
      return this.handleHeartbeat(body);
    }
    
    if (method === 'GET' && pathname === '/health') {
      return {
        status: 200,
        body: {
          success: true,
          status: 'healthy',
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
          agents: this.registry.count(),
          messages: this.queue.getTotalSize()
        }
      };
    }
    
    if (method === 'GET' && pathname === '/agents') {
      return {
        status: 200,
        body: {
          success: true,
          count: this.registry.count(),
          agents: this.registry.getAll()
        }
      };
    }
    
    if (method === 'GET' && pathname === '/messages') {
      const agentId = query.agentId;
      if (!agentId) {
        return { status: 400, body: { success: false, error: 'agentId required' } };
      }
      const messages = this.queue.dequeue(agentId);
      return {
        status: 200,
        body: { success: true, agentId, count: messages.length, messages }
      };
    }
    
    if (method === 'GET' && pathname === '/messages/history') {
      const agentId = query.agentId || null;
      const limit = parseInt(query.limit) || 100;

      if (!this.messageStore) {
        return { status: 501, body: { success: false, error: 'MessageStore not enabled' } };
      }

      const messages = this.messageStore.getAll(agentId, limit);
      return {
        status: 200,
        body: { success: true, count: messages.length, messages }
      };
    }
    
    if (method === 'GET' && pathname === '/messages/search') {
      const q = query.q;
      if (!q) {
        return { status: 400, body: { success: false, error: 'q parameter required' } };
      }

      const results = this.messageStore.search(q, parseInt(query.limit) || 50);
      return {
        status: 200,
        body: { success: true, count: results.length, messages: results }
      };
    }
    
    return null;
  }

  handleRegister(body) {
    const { agent, token } = body;

    if (!agent) {
      return { status: 400, body: { success: false, error: 'Agent info required' } };
    }

    const validation = this.validator.validateAgent(agent);
    if (!validation.valid) {
      return { status: 400, body: { success: false, errors: validation.errors } };
    }

    try {
      this.registry.register(agent);

      return {
        status: 200,
        body: {
          success: true,
          agentId: agent.id,
          callbackEnabled: !!agent.callbackUrl,
          message: 'Registration successful',
          config: {
            heartbeatInterval: CONFIG.heartbeatInterval / 1000,
            messageTimeout: 30
          }
        }
      };
    } catch (err) {
      return { status: 400, body: { success: false, error: err.message } };
    }
  }

  async handleMessage(body) {
    const validation = this.validator.validateEnvelope(body);
    if (!validation.valid) {
      return { status: 400, body: { success: false, errors: validation.errors } };
    }
    
    // Check for message loop
    const turn = body.metadata?.turn || 0;
    if (turn > 20) {
      logger.error(`Message loop detected: ${body.id} (turn ${turn})`);
      return {
        status: 429,
        body: {
          success: false,
          error: 'Message loop detected: exceeded max conversation turns'
        }
      };
    }

    // Persist message
    if (this.messageStore) {
      try {
        this.messageStore.save(body);
      } catch (err) {
        logger.error(`Message persistence failed: ${err.message}`);
      }
    }

    const result = await this.router.route(body);
    return { status: 200, body: result };
  }

  async handleBroadcast(body) {
    const message = {
      id: body.id || `msg-broadcast-${Date.now()}`,
      type: 'message.broadcast',
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      sender: body.sender || { id: 'unknown' },
      payload: {
        subject: body.subject,
        content: body.content,
        urgent: body.urgent || false
      },
      metadata: body.metadata || {}
    };

    const result = await this.router.handleBroadcast(message);
    return { status: 200, body: result };
  }

  handleHeartbeat(body) {
    const { agentId, status } = body;

    if (!agentId) {
      return { status: 400, body: { success: false, error: 'agentId required' } };
    }

    const agent = this.registry.get(agentId);
    if (!agent) {
      return { status: 404, body: { success: false, error: 'Agent not found' } };
    }

    this.registry.updateHeartbeat(agentId);
    
    if (status) {
      this.registry.updateStatus(agentId, status);
    }

    return { status: 200, body: { success: true, agentId, status: agent.status } };
  }

  checkHeartbeats() {
    const now = Date.now();
    const timeout = CONFIG.heartbeatTimeout;
    
    for (const agent of this.registry.getAll()) {
      if (now - agent.lastHeartbeat > timeout) {
        const oldStatus = agent.status;
        agent.status = 'offline';
        
        if (oldStatus !== 'offline') {
          logger.info(`Agent ${agent.id} went offline (no heartbeat for ${Math.floor((now - agent.lastHeartbeat) / 1000)}s)`);
        }
      }
    }
  }

  cleanupOldMessages() {
    if (!this.messageStore) return;
    
    const cleaned = this.messageStore.cleanup(30);
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old messages`);
    }
  }

  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}

// ============================================================================
// Startup
// ============================================================================

if (require.main === module) {
  const hub = new MailboxHub();
  hub.start();
  
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    hub.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    hub.stop();
    process.exit(0);
  });
}

module.exports = {
  MailboxHub,
  AgentRegistry,
  MessageQueue,
  SchemaValidator,
  MessageRouter,
  CONFIG
};
