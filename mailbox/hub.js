/**
 * Mailbox Hub - Message Communication Center
 * 
 * Features:
 * - HTTP Server (port 18888)
 * - Message Queue Management
 * - Agent Registration & Discovery
 * - Message Routing
 * - Heartbeat Detection
 * 
 * @version 1.0.0
 * @author Agent Swarm Team
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { MessageStore } = require('./message-store');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  port: process.env.MAILBOX_PORT || 18888,
  host: process.env.MAILBOX_HOST || '0.0.0.0',
  heartbeatInterval: 30000,      // 30 seconds
  heartbeatTimeout: 90000,       // 90 seconds = offline
  messageRetention: 3600000,     // 1 hour
  maxQueueSize: 1000,            // Max messages per agent
  persistMessages: true,         // Enable message persistence
};

// Initialize message store
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
// Agent Registry
// ============================================================================

class AgentRegistry {
  constructor() {
    this.agents = new Map();        // agentId -> AgentInfo
    this.byRole = new Map();        // role -> Set<agentId>
  }

  register(agentInfo) {
    const { id, role } = agentInfo;
    
    if (!id || !role) {
      throw new Error('Agent id and role are required');
    }
    
    // Remove old role index if exists
    if (this.agents.has(id)) {
      const oldAgent = this.agents.get(id);
      this.byRole.get(oldAgent.role)?.delete(id);
    }
    
    // Store agent info
    const agent = {
      ...agentInfo,
      id,
      role,
      registeredAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
      status: agentInfo.status || 'idle'
    };
    
    this.agents.set(id, agent);
    
    // Update role index
    if (!this.byRole.has(role)) {
      this.byRole.set(role, new Set());
    }
    this.byRole.get(role).add(id);
    
    logger.info(`Agent registered: ${id} (role: ${role})`);
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

  getByRole(role) {
    const ids = this.byRole.get(role);
    if (!ids) return [];
    return Array.from(ids).map(id => this.agents.get(id)).filter(Boolean);
  }

  getAll() {
    return Array.from(this.agents.values());
  }

  updateHeartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      return true;
    }
    return false;
  }

  updateStatus(agentId, status) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      logger.debug(`Agent ${agentId} status: ${status}`);
      return true;
    }
    return false;
  }

  checkTimeouts(timeoutMs) {
    const now = Date.now();
    const timedOut = [];
    
    for (const [id, agent] of this.agents) {
      if (now - agent.lastHeartbeat > timeoutMs && agent.status !== 'offline') {
        agent.status = 'offline';
        timedOut.push(id);
        logger.info(`Agent timed out: ${id}`);
      }
    }
    
    return timedOut;
  }

  count() {
    return this.agents.size;
  }
}

// ============================================================================
// Message Queue
// ============================================================================

class MessageQueue {
  constructor(maxSize = CONFIG.maxQueueSize) {
    this.queues = new Map();        // agentId -> Message[]
    this.maxSize = maxSize;
    this.totalEnqueued = 0;
  }

  enqueue(agentId, message) {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    
    const queue = this.queues.get(agentId);
    
    // Remove oldest if at capacity
    if (queue.length >= this.maxSize) {
      queue.shift();
      logger.debug(`Queue overflow for ${agentId}, dropped oldest message`);
    }
    
    const msgWithMeta = {
      ...message,
      _id: crypto.randomUUID(),
      _enqueuedAt: Date.now()
    };
    
    queue.push(msgWithMeta);
    this.totalEnqueued++;
    
    return msgWithMeta._id;
  }

  dequeue(agentId) {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return null;
    return queue.shift();
  }

  getAll(agentId) {
    return this.queues.get(agentId) || [];
  }

  clear(agentId) {
    const count = this.queues.get(agentId)?.length || 0;
    this.queues.delete(agentId);
    return count;
  }

  cleanup(maxAgeMs) {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [agentId, queue] of this.queues) {
      const before = queue.length;
      
      const filtered = queue.filter(msg => {
        const ttl = msg.metadata?.ttl || 0;
        if (ttl === 0) return true;
        return (now - msg._enqueuedAt) < (ttl * 1000);
      });
      
      this.queues.set(agentId, filtered);
      cleaned += before - filtered.length;
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired messages`);
    }
    
    return cleaned;
  }

  totalMessages() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
}

// ============================================================================
// Schema Validator (Simple Implementation)
// ============================================================================

class SchemaValidator {
  validateEnvelope(message) {
    const errors = [];
    
    // Required fields
    const required = ['id', 'type', 'version', 'timestamp', 'sender', 'payload'];
    for (const field of required) {
      if (!message[field]) {
        errors.push({ field, message: `Missing required field: ${field}` });
      }
    }
    
    // Validate type format
    if (message.type && !/^(task|message|status|handshake)\.(assign|update|complete|fail|direct|broadcast|heartbeat|sync|register|ack)$/.test(message.type)) {
      errors.push({ field: 'type', message: 'Invalid message type format' });
    }
    
    // Validate version format
    if (message.version && !/^\d+\.\d+\.\d+$/.test(message.version)) {
      errors.push({ field: 'version', message: 'Invalid version format (expected x.y.z)' });
    }
    
    // Validate sender
    if (message.sender) {
      if (!message.sender.id || !message.sender.role) {
        errors.push({ field: 'sender', message: 'Sender must have id and role' });
      }
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
    
    const validRoles = ['manager', 'developer', 'reviewer', 'tester', 'coordinator'];
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
// Message Router
// ============================================================================

class MessageRouter {
  constructor(registry, queue) {
    this.registry = registry;
    this.queue = queue;
    this.handlers = new Map();
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  async route(message) {
    const { type, recipient, payload } = message;
    
    // Trigger registered handlers
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (err) {
        logger.error(`Handler error for ${type}:`, err.message);
      }
    }
    
    // Route by message type
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
        return this.handleSync(message);
      
      default:
        return { success: false, error: `Unknown message type: ${type}` };
    }
  }

  handleRegister(message) {
    const { payload } = message;
    const { agent } = payload;
    
    if (!agent) {
      return { success: false, error: 'Agent info required' };
    }
    
    try {
      this.registry.register(agent);
      
      return {
        success: true,
        type: 'handshake.ack',
        payload: {
          success: true,
          agentId: agent.id,
          message: 'Registration successful',
          config: {
            heartbeatInterval: CONFIG.heartbeatInterval,
            messageTimeout: 30000
          }
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  handleHeartbeat(message) {
    const { payload } = message;
    const { agentId, status, currentTask } = payload;
    
    if (!agentId) {
      return { success: false, error: 'agentId required' };
    }
    
    this.registry.updateHeartbeat(agentId);
    
    if (status) {
      this.registry.updateStatus(agentId, status);
    }
    
    const pending = this.queue.getAll(agentId);
    
    return {
      success: true,
      acknowledged: true,
      pendingMessages: pending.length,
      messages: pending
    };
  }

  handleTaskMessage(message) {
    const { recipient, type } = message;
    
    if (recipient && recipient.id) {
      const msgId = this.queue.enqueue(recipient.id, message);
      logger.debug(`Task ${type} delivered to ${recipient.id}`);
      return { success: true, messageId: msgId, delivered: recipient.id };
    }
    
    if (recipient && recipient.type === 'role' && recipient.target) {
      const agents = this.registry.getByRole(recipient.target);
      const results = agents.map(agent => ({
        agentId: agent.id,
        messageId: this.queue.enqueue(agent.id, message)
      }));
      return { success: true, delivered: results };
    }
    
    return { success: false, error: 'No valid recipient' };
  }

  handleDirectMessage(message) {
    const { recipient } = message;
    
    if (!recipient) {
      return { success: false, error: 'Recipient required for direct message' };
    }
    
    if (recipient.id) {
      const msgId = this.queue.enqueue(recipient.id, message);
      return { success: true, messageId: msgId };
    }
    
    if (recipient.type === 'role' && recipient.target) {
      const agents = this.registry.getByRole(recipient.target);
      const results = agents.map(agent => ({
        agentId: agent.id,
        messageId: this.queue.enqueue(agent.id, message)
      }));
      return { success: true, delivered: results };
    }
    
    return { success: false, error: 'Invalid recipient specification' };
  }

  handleBroadcast(message) {
    const agents = this.registry.getAll().filter(a => a.status !== 'offline');
    
    const results = agents.map(agent => ({
      agentId: agent.id,
      messageId: this.queue.enqueue(agent.id, message)
    }));
    
    logger.info(`Broadcast to ${results.length} agents`);
    return { success: true, broadcast: true, delivered: results.length, results };
  }

  handleSync(message) {
    const agents = this.registry.getAll().map(a => ({
      id: a.id,
      role: a.role,
      name: a.name,
      status: a.status,
      capabilities: a.capabilities
    }));
    
    return {
      success: true,
      type: 'status.sync',
      payload: {
        agents,
        syncToken: Date.now().toString(36)
      }
    };
  }
}

// ============================================================================
// Mailbox Hub HTTP Server
// ============================================================================

class MailboxHub {
  constructor() {
    this.registry = new AgentRegistry();
    this.queue = new MessageQueue();
    this.validator = new SchemaValidator();
    this.router = new MessageRouter(this.registry, this.queue);
    
    this.server = null;
    this.heartbeatChecker = null;
    this.cleanupInterval = null;
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
    
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    
    this.server.listen(CONFIG.port, CONFIG.host, () => {
      logger.info(`Mailbox Hub started on http://${CONFIG.host}:${CONFIG.port}`);
    });
    
    // Heartbeat checker
    this.heartbeatChecker = setInterval(() => {
      const timedOut = this.registry.checkTimeouts(CONFIG.heartbeatTimeout);
      if (timedOut.length > 0) {
        logger.info(`Heartbeat timeout: ${timedOut.length} agents marked offline`);
      }
    }, CONFIG.heartbeatInterval);
    
    // Message cleanup
    this.cleanupInterval = setInterval(() => {
      this.queue.cleanup(CONFIG.messageRetention);
    }, 60000);
    
    return this;
  }

  stop() {
    if (this.heartbeatChecker) clearInterval(this.heartbeatChecker);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.server) this.server.close();
    logger.info('Mailbox Hub stopped');
  }

  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;
    const method = req.method;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    const startTime = Date.now();
    
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
    // ===== POST /register - Register Agent =====
    if (method === 'POST' && pathname === '/register') {
      const body = await this.parseBody(req);
      return this.handleRegister(body);
    }
    
    // ===== POST /message - Send Message =====
    if (method === 'POST' && pathname === '/message') {
      const body = await this.parseBody(req);
      return this.handleMessage(body);
    }
    
    // ===== GET /messages - Get Messages for Agent =====
    if (method === 'GET' && pathname === '/messages') {
      const agentId = query.agentId;
      if (!agentId) {
        return { status: 400, body: { success: false, error: 'agentId query parameter required' } };
      }
      
      const messages = this.queue.getAll(agentId);
      return {
        status: 200,
        body: {
          success: true,
          agentId,
          count: messages.length,
          messages
        }
      };
    }
    
    // ===== DELETE /messages - Clear Messages =====
    if (method === 'DELETE' && pathname === '/messages') {
      const agentId = query.agentId;
      if (!agentId) {
        return { status: 400, body: { success: false, error: 'agentId query parameter required' } };
      }
      
      const count = this.queue.clear(agentId);
      return {
        status: 200,
        body: { success: true, cleared: count }
      };
    }
    
    // ===== GET /agents - List All Agents =====
    if (method === 'GET' && pathname === '/agents') {
      const role = query.role;
      const agents = role ? this.registry.getByRole(role) : this.registry.getAll();
      
      return {
        status: 200,
        body: {
          success: true,
          count: agents.length,
          agents
        }
      };
    }
    
    // ===== GET /agents/:id - Get Agent by ID =====
    const agentByIdMatch = pathname.match(/^\/agents\/(agent-[a-z0-9-]+)$/);
    if (method === 'GET' && agentByIdMatch) {
      const agent = this.registry.get(agentByIdMatch[1]);
      if (!agent) {
        return { status: 404, body: { success: false, error: 'Agent not found' } };
      }
      return { status: 200, body: { success: true, agent } };
    }
    
    // ===== DELETE /agents/:id - Unregister Agent =====
    if (method === 'DELETE' && agentByIdMatch) {
      const removed = this.registry.unregister(agentByIdMatch[1]);
      return {
        status: removed ? 200 : 404,
        body: { success: removed }
      };
    }
    
    // ===== POST /heartbeat - Agent Heartbeat =====
    if (method === 'POST' && pathname === '/heartbeat') {
      const body = await this.parseBody(req);
      return this.handleHeartbeat(body);
    }
    
    // ===== GET /health - Health Check =====
    if (method === 'GET' && pathname === '/health') {
      return {
        status: 200,
        body: {
          success: true,
          status: 'healthy',
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
          agents: this.registry.count(),
          messages: this.queue.totalMessages()
        }
      };
    }
    
    // ===== GET /stats - Statistics =====
    if (method === 'GET' && pathname === '/stats') {
      const agents = this.registry.getAll();
      return {
        status: 200,
        body: {
          success: true,
          stats: {
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            agents: {
              total: agents.length,
              byStatus: this.groupBy(agents, 'status'),
              byRole: this.groupBy(agents, 'role')
            },
            messages: {
              total: this.queue.totalMessages(),
              totalEnqueued: this.queue.totalEnqueued
            }
          }
        }
      };
    }
    
    // ===== POST /broadcast - Broadcast Message =====
    if (method === 'POST' && pathname === '/broadcast') {
      const body = await this.parseBody(req);
      return this.handleBroadcast(body);
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

  handleMessage(body) {
    const validation = this.validator.validateEnvelope(body);
    if (!validation.valid) {
      return { status: 400, body: { success: false, errors: validation.errors } };
    }
    
    const result = this.router.route(body);
    return { status: 200, body: result };
  }

  handleHeartbeat(body) {
    const { agentId, status, currentTask, metrics } = body;
    
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
    
    const messages = this.queue.getAll(agentId);
    
    return {
      status: 200,
      body: {
        success: true,
        acknowledged: true,
        pendingMessages: messages.length,
        messages
      }
    };
  }

  handleBroadcast(body) {
    const { subject, content, urgent } = body;
    
    const message = {
      id: crypto.randomUUID(),
      type: 'message.broadcast',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      sender: { id: 'mailbox-hub', role: 'manager' },
      payload: {
        subject,
        content,
        urgent: urgent || false
      }
    };
    
    const agents = this.registry.getAll().filter(a => a.status !== 'offline');
    const results = agents.map(agent => ({
      agentId: agent.id,
      messageId: this.queue.enqueue(agent.id, message)
    }));
    
    return {
      status: 200,
      body: {
        success: true,
        broadcast: true,
        delivered: results.length
      }
    };
  }

  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
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

  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const val = item[key] || 'unknown';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }
}

// ============================================================================
// Startup
// ============================================================================

if (require.main === module) {
  const hub = new MailboxHub();
  hub.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    hub.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    hub.stop();
    process.exit(0);
  });
}

module.exports = {
  MailboxHub,
  AgentRegistry,
  MessageQueue,
  MessageRouter,
  SchemaValidator,
  CONFIG
};