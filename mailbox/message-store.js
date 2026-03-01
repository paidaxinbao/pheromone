/**
 * Message Store - Persistent message storage
 * Saves messages to JSON files for persistence
 */

const fs = require('fs');
const path = require('path');

class MessageStore {
  constructor(dataDir = './data/messages') {
    this.dataDir = dataDir;
    this.ensureDir();
    this.messageIndex = this.loadIndex();
  }

  ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadIndex() {
    const indexPath = path.join(this.dataDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    return { messages: [], lastId: 0 };
  }

  saveIndex() {
    const indexPath = path.join(this.dataDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(this.messageIndex, null, 2), 'utf8');
  }

  generateId() {
    this.messageIndex.lastId++;
    return `msg-${Date.now()}-${this.messageIndex.lastId}`;
  }

  save(message) {
    const id = message.id || this.generateId();
    const savedAt = new Date().toISOString();
    
    const savedMessage = {
      ...message,
      _id: id,
      _savedAt: savedAt,
      _read: false
    };
    
    // Save to individual file
    const filePath = path.join(this.dataDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(savedMessage, null, 2), 'utf8');
    
    // Update index
    this.messageIndex.messages.push({
      id,
      type: message.type,
      sender: message.sender,
      recipient: message.recipient,
      timestamp: message.timestamp,
      savedAt: savedAt
    });
    this.saveIndex();
    
    console.log(`💾 Message saved: ${id}`);
    return savedMessage;
  }

  get(id) {
    const filePath = path.join(this.dataDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  }

  getAll(agentId = null, limit = 100) {
    let messages = this.messageIndex.messages;
    
    if (agentId) {
      messages = messages.filter(msg => 
        msg.sender.id === agentId || 
        msg.recipient.id === agentId ||
        !msg.recipient.id // broadcast
      );
    }
    
    // Sort by timestamp descending
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Load full messages
    const fullMessages = messages.slice(0, limit).map(idx => this.get(idx.id)).filter(m => m);
    
    return fullMessages;
  }

  markAsRead(id) {
    const message = this.get(id);
    if (message) {
      message._read = true;
      const filePath = path.join(this.dataDir, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(message, null, 2), 'utf8');
      return true;
    }
    return false;
  }

  search(query, limit = 50) {
    const messages = this.getAll(null, 1000);
    const results = messages.filter(msg => {
      const content = JSON.stringify(msg).toLowerCase();
      return content.includes(query.toLowerCase());
    });
    return results.slice(0, limit);
  }

  cleanup(maxAgeDays = 30) {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let deleted = 0;
    
    for (const idx of this.messageIndex.messages) {
      const msgDate = new Date(idx.timestamp).getTime();
      if (msgDate < cutoff) {
        const filePath = path.join(this.dataDir, `${idx.id}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
    }
    
    // Rebuild index
    this.messageIndex.messages = this.messageIndex.messages.filter(idx => {
      const msgDate = new Date(idx.timestamp).getTime();
      return msgDate >= cutoff;
    });
    this.saveIndex();
    
    console.log(`🧹 Cleaned up ${deleted} old messages`);
    return deleted;
  }

  stats() {
    const total = this.messageIndex.messages.length;
    const today = new Date().toDateString();
    const todayCount = this.messageIndex.messages.filter(
      msg => new Date(msg.timestamp).toDateString() === today
    ).length;
    
    const byType = {};
    for (const msg of this.messageIndex.messages) {
      byType[msg.type] = (byType[msg.type] || 0) + 1;
    }
    
    return {
      total,
      today: todayCount,
      byType,
      oldest: this.messageIndex.messages[this.messageIndex.messages.length - 1]?.timestamp,
      newest: this.messageIndex.messages[0]?.timestamp
    };
  }
}

module.exports = { MessageStore };
