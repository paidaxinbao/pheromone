/**
 * Mailbox Hub v3 - Intelligent Scheduling Mode
 * 
 * Features:
 * - Agent State Management (idle/busy/suspended/offline)
 * - Per-Agent Message Queue (50 messages limit)
 * - Message Scheduler (0.5s interval)
 * - Broadcast Filter (max 4 recipients)
 * - Implicit ACK Mechanism
 * - Conversation Manager (rate limiting)
 * - Cooldown Manager (anti-pingpong)
 * 
 * @version 3.0.0
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');

// Import new modules
const config = require('./config');
const { MessageStore } = require('./message-store');
const { AgentStateManager } = require('./agent-state-manager');
const { PerAgentQueue } = require('./per-agent-queue');
const { MessageScheduler } = require('./message-scheduler');
const { BroadcastFilter } = require('./broadcast-filter');
const { ConversationManager } = require('./conversation-manager');
const { CooldownManager } = require('./cooldown-manager');
const CallbackDispatcher = require('./callback-dispatcher');

// ============================================================================
// Logger
// ============================================================================

const logger = {
  info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [Hub] [INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[${new Date().toISOString()}] [Hub] [ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[${new Date().toISOString()}] [Hub] [WARN] ${msg}`, ...args),
  debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [Hub] [DEBUG] ${msg}`, ...args)
};

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
    
    if (!agent.role || typeof agent.role !== 'string' || agent.role.trim() === '') {
      errors.push({ field: 'role', message: 'Role must be a non-empty string' });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null
    };
  }
}

// ============================================================================
// Mailbox Hub (Main Server)
// ============================================================================

class MailboxHub {
  constructor() {
    // Initialize core components
    this.stateManager = new AgentStateManager(config.agentState);
    this.queue = new PerAgentQueue(config.messageQueue);
    this.scheduler = new MessageScheduler(config.scheduler);
    this.broadcastFilter = new BroadcastFilter(config.broadcastFilter);
    this.conversationManager = new ConversationManager(config.conversationManager);
    this.cooldownManager = new CooldownManager(config.cooldownManager);
    this.messageStore = config.hub.persistMessages ? new MessageStore() : null;
    this.validator = new SchemaValidator();
    
    // Create dispatcher with new queue
    this.dispatcher = new CallbackDispatcher(
      { 
        get: (agentId) => this.stateManager.getState(agentId),
        getAll: () => this.stateManager.getAllStates()
      },
      this.queue,
      {
        maxRetries: config.hub.maxRetries,
        retryBaseDelay: config.hub.callbackTimeout / 5,
        callbackTimeout: config.hub.callbackTimeout,
      }
    );
    
    this.server = null;
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
    
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(config.hub.port, config.hub.host, () => {
      logger.info(`Mailbox Hub v3.0 listening on http://${config.hub.host}:${config.hub.port}`);
      logger.info('Components enabled:');
      logger.info(`  - AgentStateManager: maxConcurrent=${config.agentState.maxConcurrentMessages}, busyTimeout=${config.agentState.busyTimeout/1000}s`);
      logger.info(`  - PerAgentQueue: maxSize=${config.messageQueue.maxQueueSize}`);
      logger.info(`  - MessageScheduler: interval=${config.scheduler.interval}ms`);
      logger.info(`  - BroadcastFilter: maxRecipients=${config.broadcastFilter.maxRecipients}`);
      logger.info(`  - ConversationManager: maxMessages=${config.conversationManager.maxMessagesIn5Minutes}/5min`);
      logger.info(`  - CooldownManager: period=${config.cooldownManager.period/1000}s`);
    });
    
    // Start scheduler
    this.scheduler.init({
      stateManager: this.stateManager,
      queue: this.queue,
      dispatcher: this.dispatcher,
      registry: { getAll: () => this.stateManager.getAllStates() }
    });
    this.scheduler.start();
    
    // Start heartbeat checker
    this.heartbeatChecker = setInterval(() => this.checkHeartbeats(), config.hub.heartbeatInterval);
    
    // Start message cleanup
    this.cleanupInterval = setInterval(() => this.cleanupOldMessages(), 60000);
    
    return this;
  }

  stop() {
    if (this.heartbeatChecker) clearInterval(this.heartbeatChecker);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.scheduler) this.scheduler.stop();
    if (this.conversationManager) this.conversationManager.stopCleanupTimer();
    if (this.cooldownManager) this.cooldownManager.stop();
    
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
          agents: this.stateManager.count(),
          messages: this.queue.getTotalQueued(),
          scheduler: this.scheduler.getStats()
        }
      };
    }
    
    if (method === 'GET' && pathname === '/agents') {
      return {
        status: 200,
        body: {
          success: true,
          count: this.stateManager.count(),
          agents: this.stateManager.getAllStates()
        }
      };
    }
    
    if (method === 'GET' && pathname === '/agents/:agentId/state') {
      const agentId = pathname.split('/')[2];
      const state = this.stateManager.getState(agentId);
      if (!state) {
        return { status: 404, body: { success: false, error: 'Agent not found' } };
      }
      return {
        status: 200,
        body: { success: true, agent: state }
      };
    }
    
    if (method === 'GET' && pathname === '/queues') {
      return {
        status: 200,
        body: {
          success: true,
          queues: this.queue.getAllQueues(),
          totalMessages: this.queue.getTotalQueued()
        }
      };
    }
    
    if (method === 'GET' && pathname === '/scheduler/stats') {
      return {
        status: 200,
        body: { success: true, scheduler: this.scheduler.getStats() }
      };
    }
    
    if (method === 'GET' && pathname === '/protection/stats') {
      return {
        status: 200,
        body: {
          success: true,
          conversationManager: this.conversationManager.getStats(),
          cooldownManager: this.cooldownManager.getStats()
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
      // Register with state manager
      this.stateManager.registerAgent(agent.id, {
        role: agent.role,
        callbackUrl: agent.callbackUrl,
        metadata: agent.metadata
      });

      return {
        status: 200,
        body: {
          success: true,
          agentId: agent.id,
          callbackEnabled: !!agent.callbackUrl,
          message: 'Registration successful',
          config: {
            heartbeatInterval: config.hub.heartbeatInterval / 1000,
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
    
    const senderId = body.sender?.id;
    const recipient = body.recipient;
    
    // ===== Implicit ACK: Mark sender as idle if they were busy =====
    if (senderId) {
      const senderState = this.stateManager.getState(senderId);
      if (senderState && senderState.status === 'busy') {
        this.stateManager.markIdle(senderId);
        logger.debug(`[Implicit ACK] ${senderId} marked idle`);
      }
    }
    
    // ===== Conversation Manager: Check rate limits =====
    if (recipient && recipient.id) {
      const convId = this.getConversationId([senderId, recipient.id]);
      const { allowed, reason, retryAfter } = this.conversationManager.canSendMessage(convId);
      
      if (!allowed) {
        logger.warn(`Message blocked by conversation manager: ${reason}`);
        return {
          status: 429,
          body: {
            success: false,
            error: 'Conversation rate limit exceeded',
            reason,
            retryAfter
          }
        };
      }
    }
    
    // ===== Cooldown Manager: Check cooldown =====
    if (recipient && recipient.id && senderId) {
      const { allowed, retryAfter } = this.cooldownManager.canSendMessage(senderId, recipient.id);
      
      if (!allowed) {
        logger.debug(`Message blocked by cooldown: ${senderId} → ${recipient.id}`);
        return {
          status: 429,
          body: {
            success: false,
            error: 'Sender is in cooldown period',
            retryAfter
          }
        };
      }
    }
    
    // Check for message loop (turn limit)
    const turn = body.metadata?.turn || 0;
    if (turn > 50) {
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

    // Record in conversation manager
    if (recipient && recipient.id) {
      const convId = this.getConversationId([senderId, recipient.id]);
      this.conversationManager.recordMessage(convId, body);
    }
    
    // Record cooldown
    if (recipient && recipient.id && senderId) {
      this.cooldownManager.recordMessage(senderId, recipient.id);
    }

    // Route message
    const result = await this.routeMessage(body);
    return { status: 200, body: result };
  }

  async routeMessage(message) {
    const { recipient } = message;
    const senderId = message.sender?.id;

    if (!recipient) {
      return { success: false, error: 'Recipient required' };
    }

    // Direct message to specific agent
    if (recipient.id) {
      const agentState = this.stateManager.getState(recipient.id);
      
      if (!agentState) {
        // Agent not registered, queue the message
        const result = this.queue.enqueue(recipient.id, message, 'normal');
        return { success: true, messageId: result.messageId, queued: true };
      }
      
      // Check if agent can receive
      const { canReceive, reason } = this.stateManager.canReceiveMessage(recipient.id);
      
      if (!canReceive) {
        // Queue the message
        const result = this.queue.enqueue(recipient.id, message, 'normal');
        logger.debug(`Agent ${recipient.id} cannot receive (${reason}), message queued`);
        return { success: true, messageId: result.messageId, queued: true, reason };
      }
      
      // Send via dispatcher
      const dispatchResult = await this.dispatcher.push(recipient.id, message);
      
      if (dispatchResult.delivered) {
        this.stateManager.markBusy(recipient.id, message.id);
        return { success: true, delivered: true, agentId: recipient.id };
      } else {
        // Failed, message already queued by dispatcher
        return { success: true, queued: true, reason: dispatchResult.reason };
      }
    }

    // Role-based routing
    if (recipient.type === 'role' && recipient.target) {
      const agents = this.stateManager.getStatesByRole(recipient.target);
      const results = [];
      
      for (const agent of agents) {
        const { canReceive } = this.stateManager.canReceiveMessage(agent.id);
        
        if (canReceive) {
          const dispatchResult = await this.dispatcher.push(agent.id, message);
          results.push({ agentId: agent.id, delivered: dispatchResult.delivered });
          
          if (dispatchResult.delivered) {
            this.stateManager.markBusy(agent.id, message.id);
          }
        }
      }
      
      return { success: true, delivered: results.filter(r => r.delivered).length, results };
    }

    return { success: false, error: 'Invalid recipient specification' };
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

    const senderId = message.sender.id;
    const allAgents = this.stateManager.getAllStates();
    
    // Apply broadcast filter
    const selectedAgents = this.broadcastFilter.filterRecipients(allAgents, message, senderId);
    
    if (selectedAgents.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          broadcast: true,
          delivered: 0,
          message: 'No eligible recipients after filtering'
        }
      };
    }
    
    // Send to selected agents
    const results = [];
    for (const agent of selectedAgents) {
      const { canReceive, reason } = this.stateManager.canReceiveMessage(agent.id);
      
      if (canReceive) {
        const dispatchResult = await this.dispatcher.push(agent.id, message);
        results.push({ agentId: agent.id, delivered: dispatchResult.delivered });
        
        if (dispatchResult.delivered) {
          this.stateManager.markBusy(agent.id, message.id);
        }
      } else {
        results.push({ agentId: agent.id, delivered: false, reason });
      }
    }
    
    // Record in conversation manager for each recipient
    for (const agent of selectedAgents) {
      const convId = this.getConversationId([senderId, agent.id]);
      this.conversationManager.recordMessage(convId, message);
    }
    
    return {
      status: 200,
      body: {
        success: true,
        broadcast: true,
        delivered: results.filter(r => r.delivered).length,
        totalRecipients: selectedAgents.length,
        results
      }
    };
  }

  handleHeartbeat(body) {
    const { agentId, status } = body;

    if (!agentId) {
      return { status: 400, body: { success: false, error: 'agentId required' } };
    }

    const agentState = this.stateManager.getState(agentId);
    if (!agentState) {
      return { status: 404, body: { success: false, error: 'Agent not found' } };
    }

    this.stateManager.updateHeartbeat(agentId);
    
    if (status) {
      this.stateManager.updateStatus(agentId, status);
    }

    return { status: 200, body: { success: true, agentId, status: agentState.status } };
  }

  checkHeartbeats() {
    const now = Date.now();
    const timeout = config.hub.heartbeatTimeout;
    
    for (const agent of this.stateManager.getAllStates()) {
      if (now - agent.lastHeartbeat > timeout) {
        const oldStatus = agent.status;
        this.stateManager.updateStatus(agent.id, 'offline');
        
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

  getConversationId(participants) {
    const sorted = [...participants].filter(Boolean).sort();
    return `conv-${crypto.createHash('md5').update(sorted.join('|')).digest('hex').substring(0, 12)}`;
  }

  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.setEncoding('utf-8');
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
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
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
  SchemaValidator,
  config
};
