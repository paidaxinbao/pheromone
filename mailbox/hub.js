/**
 * Mailbox Hub - Agent 消息中转站
 * 
 * 功能:
 * - 接收和分发消息
 * - 维护消息队列
 * - 追踪 Agent 状态
 * - 提供状态查询接口
 */

const http = require('http');
const { MESSAGE_TYPES, AGENT_ROLES, createMessage, validateMessage } = require('./protocol');

class MailboxHub {
  constructor(options = {}) {
    this.port = options.port || 18790;
    this.agents = new Map();          // Agent 注册表
    this.messageQueue = new Map();    // 消息队列 (agentId -> messages[])
    this.taskRegistry = new Map();    // 任务注册表
    this.messageHistory = [];         // 消息历史 (最近1000条)
    this.maxHistory = 1000;
  }

  /**
   * 注册 Agent
   */
  registerAgent(agentId, role, metadata = {}) {
    const agent = {
      id: agentId,
      role,
      status: 'idle',
      lastSeen: new Date().toISOString(),
      currentTask: null,
      metadata
    };
    
    this.agents.set(agentId, agent);
    this.messageQueue.set(agentId, []);
    
    console.log(`[Hub] Agent registered: ${agentId} (${role})`);
    
    // 通知 Manager
    this.notifyManager({
      type: 'agent_registered',
      agentId,
      role
    });
    
    return agent;
  }

  /**
   * 发送消息
   */
  sendMessage(msg) {
    const validation = validateMessage(msg);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 记录历史
    this.messageHistory.push(msg);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    // 广播消息
    if (msg.to === 'broadcast') {
      for (const [agentId] of this.agents) {
        if (agentId !== msg.from) {
          this.messageQueue.get(agentId)?.push({ ...msg, to: agentId });
        }
      }
      return { success: true, delivered: this.agents.size - 1 };
    }

    // 发送给 Manager
    if (msg.to === 'manager') {
      // Manager 消息会通过特殊通道传递给主机 OpenClaw
      this.pendingManagerMessages = this.pendingManagerMessages || [];
      this.pendingManagerMessages.push(msg);
      return { success: true, delivered: 1 };
    }

    // 发送给特定 Agent
    if (this.messageQueue.has(msg.to)) {
      this.messageQueue.get(msg.to).push(msg);
      return { success: true, delivered: 1 };
    }

    return { success: false, error: `Unknown recipient: ${msg.to}` };
  }

  /**
   * 获取消息
   */
  getMessages(agentId) {
    const messages = this.messageQueue.get(agentId) || [];
    this.messageQueue.set(agentId, []); // 清空队列
    return messages;
  }

  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(agentId, status, currentTask = null) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.currentTask = currentTask;
      agent.lastSeen = new Date().toISOString();
      
      // 通知 Manager
      this.notifyManager({
        type: 'agent_status_update',
        agentId,
        status,
        currentTask
      });
      
      return true;
    }
    return false;
  }

  /**
   * 通知 Manager
   */
  notifyManager(data) {
    const msg = createMessage(
      'hub',
      'manager',
      MESSAGE_TYPES.NOTIFICATION,
      data,
      { priority: 2 }
    );
    this.pendingManagerMessages = this.pendingManagerMessages || [];
    this.pendingManagerMessages.push(msg);
  }

  /**
   * 获取 Manager 待处理消息
   */
  getManagerMessages() {
    const messages = this.pendingManagerMessages || [];
    this.pendingManagerMessages = [];
    return messages;
  }

  /**
   * 注册任务
   */
  registerTask(taskId, task) {
    this.taskRegistry.set(taskId, {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return this.taskRegistry.get(taskId);
  }

  /**
   * 更新任务状态
   */
  updateTask(taskId, updates) {
    const task = this.taskRegistry.get(taskId);
    if (task) {
      Object.assign(task, updates, { updatedAt: new Date().toISOString() });
      return task;
    }
    return null;
  }

  /**
   * 获取所有 Agent 状态
   */
  getAllAgentStatus() {
    const result = {};
    for (const [id, agent] of this.agents) {
      result[id] = {
        role: agent.role,
        status: agent.status,
        currentTask: agent.currentTask,
        lastSeen: agent.lastSeen
      };
    }
    return result;
  }

  /**
   * 启动 HTTP 服务器
   */
  start() {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        // API 路由
        if (req.method === 'POST' && url.pathname === '/register') {
          const body = await this.parseBody(req);
          const agent = this.registerAgent(body.agentId, body.role, body.metadata);
          this.sendJson(res, 200, { success: true, agent });
        }
        
        else if (req.method === 'POST' && url.pathname === '/message') {
          const body = await this.parseBody(req);
          const result = this.sendMessage(body);
          this.sendJson(res, 200, result);
        }
        
        else if (req.method === 'GET' && url.pathname === '/messages') {
          const agentId = url.searchParams.get('agentId');
          const messages = this.getMessages(agentId);
          this.sendJson(res, 200, { messages });
        }
        
        else if (req.method === 'GET' && url.pathname === '/manager/messages') {
          const messages = this.getManagerMessages();
          this.sendJson(res, 200, { messages });
        }
        
        else if (req.method === 'POST' && url.pathname === '/status') {
          const body = await this.parseBody(req);
          const result = this.updateAgentStatus(body.agentId, body.status, body.currentTask);
          this.sendJson(res, 200, { success: result });
        }
        
        else if (req.method === 'GET' && url.pathname === '/agents') {
          const status = this.getAllAgentStatus();
          this.sendJson(res, 200, { agents: status });
        }
        
        else if (req.method === 'POST' && url.pathname === '/task') {
          const body = await this.parseBody(req);
          const task = this.registerTask(body.taskId, body.task);
          this.sendJson(res, 200, { success: true, task });
        }
        
        else if (req.method === 'GET' && url.pathname === '/tasks') {
          const tasks = Array.from(this.taskRegistry.values());
          this.sendJson(res, 200, { tasks });
        }
        
        else if (req.method === 'GET' && url.pathname === '/health') {
          this.sendJson(res, 200, { status: 'ok', agents: this.agents.size });
        }
        
        else {
          this.sendJson(res, 404, { error: 'Not found' });
        }
      } catch (error) {
        console.error('[Hub] Error:', error);
        this.sendJson(res, 500, { error: error.message });
      }
    });

    server.listen(this.port, () => {
      console.log(`[Hub] Mailbox Hub started on port ${this.port}`);
    });

    this.server = server;
  }

  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

module.exports = { MailboxHub };