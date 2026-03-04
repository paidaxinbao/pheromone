/**
 * CallbackDispatcher - Webhook 推送模块
 * 
 * 职责:
 * - 接收 agentId + message，查 AgentRegistry 取 callbackUrl
 * - 向 callbackUrl 发起 HTTP POST 推送消息
 * - 推送失败：消息入队列，启动指数退避重试（2s → 4s → 8s，最多 3 次）
 * - 全部重试失败：消息留在队列，等 Agent 恢复后通过心跳/轮询取回
 * - 无 callbackUrl：直接入队，走原有轮询路径（兜底）
 */

const http = require('http');

class CallbackDispatcher {
  constructor(registry, queue, options = {}) {
    this.registry = registry;
    this.queue = queue;
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.retryBaseDelay || 2000;
    this.callbackTimeout = options.callbackTimeout || 10000;
  }

  /**
   * 推送消息给单个 Agent
   * @param {string} agentId 
   * @param {object} message 
   * @returns {Promise<{success: boolean, delivered: boolean, reason?: string}>}
   */
  async push(agentId, message) {
    const agent = this.registry.get(agentId);
    
    if (!agent) {
      console.log(`[CallbackDispatcher] Agent ${agentId} not found, queuing message`);
      this.queue.enqueue(agentId, message);
      return { success: true, delivered: false, reason: 'agent_not_found' };
    }

    const callbackUrl = agent.callbackUrl;
    
    if (!callbackUrl) {
      console.log(`[CallbackDispatcher] Agent ${agentId} has no callbackUrl, queuing message`);
      this.queue.enqueue(agentId, message);
      return { success: true, delivered: false, reason: 'no_callback_url' };
    }

    // 尝试推送，失败则重试
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const delivered = await this._httpPost(callbackUrl, message);
        
        if (delivered) {
          console.log(`[CallbackDispatcher] → ${agentId}: delivered`);
          return { success: true, delivered: true };
        }
      } catch (error) {
        console.log(`[CallbackDispatcher] → ${agentId}: attempt ${attempt} failed - ${error.message}`);
        
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          console.log(`[CallbackDispatcher] Retrying in ${delay}ms...`);
          await this._sleep(delay);
        }
      }
    }

    // 全部重试失败，消息入队列
    console.log(`[CallbackDispatcher] → ${agentId}: all retries failed, queuing message`);
    this.queue.enqueue(message);
    return { success: true, delivered: false, reason: 'all_retries_failed' };
  }

  /**
   * 广播消息给所有 Agent
   * @param {object} message 
   * @returns {Promise<{success: boolean, delivered: number, failed: number}>}
   */
  async pushBroadcast(message) {
    const agents = this.registry.getAll();
    const results = await Promise.allSettled(
      agents.map(agent => this.push(agent.id, message))
    );

    const delivered = results.filter(r => r.status === 'fulfilled' && r.value.delivered).length;
    const failed = results.length - delivered;

    console.log(`[CallbackDispatcher] Broadcast: ${delivered} delivered, ${failed} failed`);
    return { success: true, delivered, failed };
  }

  /**
   * HTTP POST 请求
   * @param {string} url 
   * @param {object} data 
   * @returns {Promise<boolean>}
   */
  _httpPost(url, data) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const body = JSON.stringify(data);

      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 5000,
        },
        (res) => {
          let responseBody = '';
          res.on('data', (chunk) => (responseBody += chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(true);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.write(body);
      req.end();
    });
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CallbackDispatcher;
