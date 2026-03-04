/**
 * Broadcast Filter - 广播消息过滤器
 * 
 * 职责:
 * - 识别广播消息
 * - 过滤接收者（宽松策略：最多 4 个）
 * - 支持多种选择策略
 * 
 * 广播识别:
 * - message.type === 'message.broadcast'
 * - message.recipient?.type === 'all'
 * - message.metadata?.tags?.includes('broadcast')
 * 
 * 选择策略:
 * - round-robin: 轮流选择
 * - random: 随机选择
 * - role-based: 根据消息内容选择相关角色
 * 
 * @version 2.0.0
 */

const crypto = require('crypto');

class BroadcastFilter {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      maxRecipients: config.maxRecipients || 4,    // 最多 4 个接收者
      minRecipients: config.minRecipients || 2,    // 最少 2 个
      strategy: config.strategy || 'role-based',   // round-robin | random | role-based
      fallbackToAll: config.fallbackToAll || false
    };
    
    // Round-robin 状态
    this.roundRobinIndex = 0;
    
    // 统计
    this.stats = {
      totalBroadcasts: 0,
      totalRecipients: 0,
      filteredRecipients: 0
    };
    
    // 日志
    this.log = {
      info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [BroadcastFilter] [INFO] ${msg}`, ...args),
      debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [BroadcastFilter] [DEBUG] ${msg}`, ...args)
    };
  }

  /**
   * 判断是否为广播消息
   * @param {object} message 
   * @returns {boolean}
   */
  isBroadcast(message) {
    // 方式 1: type 字段
    if (message.type === 'message.broadcast') {
      return true;
    }
    
    // 方式 2: recipient.type 字段
    if (message.recipient?.type === 'all') {
      return true;
    }
    
    // 方式 3: tags 字段
    if (message.metadata?.tags?.includes('broadcast')) {
      return true;
    }
    
    return false;
  }

  /**
   * 过滤广播接收者
   * @param {Array} allAgents - 所有在线 Agent
   * @param {object} message - 广播消息
   * @param {string} senderId - 发送者 ID（用于排除）
   * @returns {Array} 选中的接收者
   */
  filterRecipients(allAgents, message, senderId = null) {
    if (!this.config.enabled) {
      // 未启用过滤，返回所有 Agent（排除发送者）
      return allAgents.filter(a => a.id !== senderId);
    }
    
    // 排除发送者和离线 Agent
    const eligibleAgents = allAgents.filter(a => 
      a.id !== senderId && a.status !== 'offline'
    );
    
    if (eligibleAgents.length === 0) {
      this.log.debug('No eligible agents for broadcast');
      return [];
    }
    
    // 如果符合条件的 Agent 少于最小值，返回所有
    if (eligibleAgents.length <= this.config.minRecipients) {
      this.log.debug(`Only ${eligibleAgents.length} eligible agents, sending to all`);
      this.stats.totalBroadcasts++;
      this.stats.totalRecipients += eligibleAgents.length;
      return eligibleAgents;
    }
    
    // 根据策略选择接收者
    let selected;
    
    switch (this.config.strategy) {
      case 'random':
        selected = this.selectRandom(eligibleAgents);
        break;
      case 'round-robin':
        selected = this.selectRoundRobin(eligibleAgents);
        break;
      case 'role-based':
      default:
        selected = this.selectRoleBased(eligibleAgents, message);
        break;
    }
    
    // 记录统计
    this.stats.totalBroadcasts++;
    this.stats.totalRecipients += selected.length;
    this.stats.filteredRecipients += (eligibleAgents.length - selected.length);
    
    this.log.info(
      `Broadcast filtered: ${eligibleAgents.length} → ${selected.length} recipients ` +
      `(${this.config.strategy} strategy)`
    );
    
    return selected;
  }

  /**
   * 随机选择
   * @param {Array} agents 
   * @returns {Array}
   */
  selectRandom(agents) {
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, this.config.maxRecipients);
  }

  /**
   * 轮流选择
   * @param {Array} agents 
   * @returns {Array}
   */
  selectRoundRobin(agents) {
    // 按 ID 排序以保证一致性
    const sorted = [...agents].sort((a, b) => a.id.localeCompare(b.id));
    
    const selected = [];
    for (let i = 0; i < this.config.maxRecipients; i++) {
      const index = (this.roundRobinIndex + i) % sorted.length;
      selected.push(sorted[index]);
    }
    
    // 更新索引
    this.roundRobinIndex = (this.roundRobinIndex + this.config.maxRecipients) % sorted.length;
    
    return selected;
  }

  /**
   * 基于角色选择
   * @param {Array} agents 
   * @param {object} message 
   * @returns {Array}
   */
  selectRoleBased(agents, message) {
    // 尝试从消息内容中提取角色关键词
    const content = JSON.stringify(message).toLowerCase();
    
    // 角色关键词映射
    const roleKeywords = {
      'director': ['director', 'overall', 'narrative', 'pacing'],
      'screenwriter': ['screenwriter', 'script', 'dialogue', 'scene'],
      'science_advisor': ['science', 'physics', 'quantum', 'tech'],
      'visual_designer': ['visual', 'design', 'scene', 'effect'],
      'character_designer': ['character', 'personality', 'background'],
      'producer': ['producer', 'market', 'feasibility', 'budget']
    };
    
    // 计算每个角色的相关性得分
    const scores = agents.map(agent => {
      const role = agent.role?.toLowerCase() || '';
      let score = 0;
      
      // 检查角色关键词
      if (roleKeywords[role]) {
        for (const keyword of roleKeywords[role]) {
          if (content.includes(keyword)) {
            score++;
          }
        }
      }
      
      return { agent, score };
    });
    
    // 按得分排序，选择最高的
    scores.sort((a, b) => b.score - a.score);
    
    // 选择得分最高的 maxRecipients 个
    const selected = scores.slice(0, this.config.maxRecipients).map(s => s.agent);
    
    // 如果没有相关性得分，回退到轮流选择
    if (selected.every(s => scores.find(sc => sc.agent === s)?.score === 0)) {
      return this.selectRoundRobin(agents);
    }
    
    return selected;
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      filterRate: this.stats.totalBroadcasts > 0
        ? ((this.stats.filteredRecipients / (this.stats.totalRecipients + this.stats.filteredRecipients)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * 更新配置
   * @param {object} newConfig 
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.log.info('Config updated', newConfig);
  }
}

module.exports = { BroadcastFilter };
