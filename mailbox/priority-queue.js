/**
 * Priority Message Queue
 * Handles message priorities (urgent, high, normal, low)
 */

class PriorityQueue {
  constructor() {
    // Separate queues for each priority
    this.queues = {
      urgent: [],    // Critical alerts
      high: [],      // Important messages
      normal: [],    // Regular messages (default)
      low: []        // Background updates
    };
    this.maxQueueSize = 1000;
  }

  enqueue(message, priority = 'normal') {
    if (!this.queues[priority]) {
      priority = 'normal';
    }
    
    const queuedMessage = {
      ...message,
      _priority: priority,
      _enqueuedAt: Date.now()
    };
    
    this.queues[priority].push(queuedMessage);
    
    // Trim if over capacity (low priority first)
    this.trim();
    
    return queuedMessage;
  }

  dequeue() {
    // Process by priority order
    const priorities = ['urgent', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      if (this.queues[priority].length > 0) {
        return this.queues[priority].shift();
      }
    }
    
    return null;
  }

  trim() {
    const totalSize = this.getTotalSize();
    
    if (totalSize <= this.maxQueueSize) {
      return;
    }
    
    // Remove from lowest priority first
    if (this.queues.low.length > 0) {
      this.queues.low.shift();
      return;
    }
    
    if (this.queues.normal.length > 0) {
      this.queues.normal.shift();
      return;
    }
    
    if (this.queues.high.length > 0) {
      this.queues.high.shift();
      return;
    }
  }

  get(agentId = null, priority = null) {
    let messages = [];
    
    // Collect messages from all queues
    const priorities = priority ? [priority] : ['urgent', 'high', 'normal', 'low'];
    
    for (const p of priorities) {
      let queueMessages = this.queues[p];
      
      if (agentId) {
        queueMessages = queueMessages.filter(msg => 
          msg.sender?.id === agentId || 
          msg.recipient?.id === agentId ||
          !msg.recipient?.id // broadcast
        );
      }
      
      messages = [...messages, ...queueMessages];
    }
    
    // Sort by priority and timestamp
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    messages.sort((a, b) => {
      const priorityDiff = priorityOrder[a._priority] - priorityOrder[b._priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b._enqueuedAt - a._enqueuedAt;
    });
    
    return messages;
  }

  getTotalSize() {
    return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
  }

  getStats() {
    return {
      total: this.getTotalSize(),
      byPriority: {
        urgent: this.queues.urgent.length,
        high: this.queues.high.length,
        normal: this.queues.normal.length,
        low: this.queues.low.length
      }
    };
  }

  clear() {
    for (const key of Object.keys(this.queues)) {
      this.queues[key] = [];
    }
  }
}

module.exports = { PriorityQueue };
