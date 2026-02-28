/**
 * Developer Agent - 运行时入口
 * 
 * 功能:
 * - 连接 Mailbox Hub
 * - 接收任务并执行
 * - 汇报进度和结果
 */

const http = require('http');
const { MESSAGE_TYPES, AGENT_ROLES, createMessage } = require('../../mailbox/protocol');

const CONFIG = {
  agentId: process.env.AGENT_ID || 'developer',
  role: process.env.AGENT_ROLE || 'developer',
  mailboxUrl: process.env.MAILBOX_URL || 'http://localhost:18790',
  workspace: process.env.OPENCLAW_WORKSPACE || './'
};

class DeveloperAgent {
  constructor() {
    this.currentTask = null;
    this.status = 'idle';
    this.taskQueue = [];
  }

  /**
   * 注册到 Mailbox Hub
   */
  async register() {
    const data = JSON.stringify({
      agentId: CONFIG.agentId,
      role: CONFIG.role,
      metadata: {
        capabilities: ['code_development', 'bug_fix', 'documentation']
      }
    });

    return this.request('POST', '/register', data);
  }

  /**
   * 更新状态
   */
  async updateStatus(status, currentTask = null) {
    this.status = status;
    this.currentTask = currentTask;

    const data = JSON.stringify({
      agentId: CONFIG.agentId,
      status,
      currentTask
    });

    return this.request('POST', '/status', data);
  }

  /**
   * 获取消息
   */
  async getMessages() {
    const result = await this.request('GET', `/messages?agentId=${CONFIG.agentId}`);
    return result.messages || [];
  }

  /**
   * 发送消息
   */
  async sendMessage(to, type, content, options = {}) {
    const msg = createMessage(CONFIG.agentId, to, type, content, options);
    const data = JSON.stringify(msg);
    return this.request('POST', '/message', data);
  }

  /**
   * 处理任务
   */
  async processTask(task) {
    console.log(`[Developer] Processing task: ${task.task_id}`);
    
    await this.updateStatus('working', task.task_id);
    
    try {
      // 模拟任务处理
      await this.updateStatus('working', task.task_id);
      await this.sendProgress(50, '任务进行中...');
      
      // 任务完成
      await this.updateStatus('idle', null);
      await this.sendTaskComplete(task.task_id, {
        summary: `任务 ${task.task_id} 已完成`,
        files_changed: [],
        review_required: true
      });
      
      console.log(`[Developer] Task completed: ${task.task_id}`);
    } catch (error) {
      await this.updateStatus('idle', null);
      await this.sendTaskFailed(task.task_id, error.message);
      console.error(`[Developer] Task failed: ${task.task_id}`, error);
    }
  }

  /**
   * 发送进度更新
   */
  async sendProgress(progress, notes = '') {
    return this.sendMessage('manager', MESSAGE_TYPES.TASK_UPDATE, {
      task_id: this.currentTask?.task_id,
      progress,
      status: 'in_progress',
      notes
    });
  }

  /**
   * 发送任务完成
   */
  async sendTaskComplete(taskId, result) {
    return this.sendMessage('manager', MESSAGE_TYPES.TASK_COMPLETE, {
      task_id: taskId,
      ...result
    });
  }

  /**
   * 发送任务失败
   */
  async sendTaskFailed(taskId, error) {
    return this.sendMessage('manager', MESSAGE_TYPES.TASK_FAILED, {
      task_id: taskId,
      error
    });
  }

  /**
   * HTTP 请求 helper
   */
  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(CONFIG.mailboxUrl + path);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * 主循环
   */
  async run() {
    console.log(`[Developer] Starting agent...`);
    
    // 注册
    await this.register();
    console.log(`[Developer] Registered to Mailbox Hub`);
    
    // 主循环：每 5 秒检查消息
    setInterval(async () => {
      const messages = await this.getMessages();
      
      for (const msg of messages) {
        if (msg.type === MESSAGE_TYPES.TASK_ASSIGN) {
          this.taskQueue.push(msg);
          console.log(`[Developer] Received task: ${msg.content.task_id}`);
        }
      }
      
      // 处理任务队列
      if (this.taskQueue.length > 0 && this.status === 'idle') {
        const task = this.taskQueue.shift();
        await this.processTask(task.content);
      }
    }, 5000);
    
    console.log(`[Developer] Agent running, waiting for tasks...`);
  }
}

// 启动 Agent
const agent = new DeveloperAgent();
agent.run().catch(console.error);

module.exports = { DeveloperAgent };