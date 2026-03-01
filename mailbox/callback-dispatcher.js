/**
 * Callback Dispatcher - Webhook Callback Module
 * Sends messages to Agent callback URLs with retry logic
 */

const http = require('http');
const https = require('https');
const url = require('url');

class CallbackDispatcher {
  constructor(registry, queue, options = {}) {
    this.registry = registry;
    this.queue = queue;
    this.maxRetries = options.maxRetries || 3;
    this.retryBaseDelay = options.retryBaseDelay || 2000;
    this.callbackTimeout = options.callbackTimeout || 10000;
    this.pendingRetries = new Map();
  }

  async push(agentId, message) {
    const agent = this.registry.get(agentId);

    if (!agent || !agent.callbackUrl) {
      this.queue.enqueue(agentId, message);
      return { delivered: false, reason: 'no_callback_url', queued: true };
    }

    if (agent.status === 'offline') {
      this.queue.enqueue(agentId, message);
      return { delivered: false, reason: 'agent_offline', queued: true };
    }

    try {
      await this._httpPost(agent.callbackUrl, message);
      return { delivered: true };
    } catch (err) {
      console.error(
        `[CallbackDispatcher] Push to ${agentId} failed: ${err.message}`
      );
      this.queue.enqueue(agentId, message);
      this._scheduleRetry(agentId, message, 0);
      return { delivered: false, reason: err.message, queued: true };
    }
  }

  async pushBroadcast(message, excludeAgentId = null) {
    const agents = this.registry.getAll().filter(
      (a) => a.status !== 'offline' && a.id !== excludeAgentId
    );
    const results = [];

    for (const agent of agents) {
      const result = await this.push(agent.id, message);
      results.push({ agentId: agent.id, ...result });
    }

    return results;
  }

  _scheduleRetry(agentId, message, attempt) {
    if (attempt >= this.maxRetries) {
      console.error(
        `[CallbackDispatcher] Max retries reached for ${agentId}, message stays in queue`
      );
      return;
    }

    const delay = this.retryBaseDelay * Math.pow(2, attempt);
    const jitter = delay * 0.25 * Math.random();

    setTimeout(async () => {
      const agent = this.registry.get(agentId);
      if (!agent || !agent.callbackUrl || agent.status === 'offline') return;

      try {
        await this._httpPost(agent.callbackUrl, message);
        console.log(
          `[CallbackDispatcher] Retry succeeded for ${agentId} (attempt ${attempt + 1})`
        );
      } catch (err) {
        console.error(
          `[CallbackDispatcher] Retry ${attempt + 1} failed for ${agentId}: ${err.message}`
        );
        this._scheduleRetry(agentId, message, attempt + 1);
      }
    }, delay + jitter);
  }

  _httpPost(callbackUrl, body) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(callbackUrl);
      const transport = parsed.protocol === 'https:' ? https : http;

      const data = JSON.stringify(body);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-Pheromone-Hub': 'true',
        },
        timeout: this.callbackTimeout,
      };

      const req = transport.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseBody);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Callback timeout'));
      });

      req.on('error', (err) => reject(err));
      req.write(data);
      req.end();
    });
  }
}

module.exports = { CallbackDispatcher };
