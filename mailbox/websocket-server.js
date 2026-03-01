/**
 * WebSocket Server for Real-time Message Push
 * Provides real-time updates to Dashboard and clients
 */

const WebSocket = require('ws');

class WebSocketServer {
  constructor(port = 18889) {
    this.port = port;
    this.wss = null;
    this.clients = new Map(); // clientId -> WebSocket
    this.messageQueue = [];   // Recent messages for new clients
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`🔌 Client connected: ${clientId}`);
      
      // Store client
      this.clients.set(clientId, {
        ws,
        id: clientId,
        connectedAt: new Date(),
        agentId: null
      });
      
      // Send recent messages
      this.sendRecentMessages(ws);
      
      // Handle messages
      ws.on('message', (data) => {
        this.handleMessage(clientId, data);
      });
      
      // Handle disconnect
      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        message: 'Connected to Pheromone WebSocket Server'
      }));
    });
    
    console.log(`🚀 WebSocket Server running on ws://localhost:${this.port}`);
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      const client = this.clients.get(clientId);
      
      if (!client) return;
      
      switch (message.type) {
        case 'register':
          client.agentId = message.agentId;
          console.log(`Client ${clientId} registered as ${message.agentId}`);
          break;
          
        case 'subscribe':
          // Subscribe to specific agent messages
          client.subscriptions = message.agents || [];
          break;
          
        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  }

  sendRecentMessages(ws) {
    // Send last 50 messages from queue
    const recent = this.messageQueue.slice(-50);
    ws.send(JSON.stringify({
      type: 'history',
      messages: recent
    }));
  }

  broadcast(message, options = {}) {
    const data = JSON.stringify({
      type: 'message',
      timestamp: Date.now(),
      ...message
    });
    
    // Add to queue
    this.messageQueue.push(message);
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
    
    // Broadcast to all clients
    let sent = 0;
    for (const [clientId, client] of this.clients) {
      // Check subscriptions
      if (options.agentId && client.subscriptions) {
        if (!client.subscriptions.includes(options.agentId)) {
          continue;
        }
      }
      
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
        sent++;
      }
    }
    
    console.log(`📢 Broadcast to ${sent} clients`);
  }

  broadcastToAgent(agentId, message) {
    this.broadcast(message, { agentId });
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      messageQueueSize: this.messageQueue.length,
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        agentId: c.agentId,
        connectedAt: c.connectedAt
      }))
    };
  }

  stop() {
    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket Server stopped');
      });
    }
  }
}

module.exports = { WebSocketServer };
