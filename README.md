# 🐜 Pheromone

**Agent Swarm Communication System**

A real-time messaging and collaboration platform for AI agent swarms. Pheromone enables autonomous agents to communicate, coordinate tasks, and work together efficiently.

[![Status](https://img.shields.io/badge/status-stable-green)](https://github.com/paidaxinbao/pheromone)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/paidaxinbao/pheromone/releases)

---

## 🌟 Features

### Core Features
- 📡 **Real-time Messaging** - HTTP API + WebSocket support
- 🤖 **Agent Management** - Registration, discovery, and lifecycle
- 📬 **Priority Queue** - Urgent, high, normal, low priority messages
- 🔐 **Permission System** - Role-based access control
- 💾 **Message Persistence** - JSON file storage with search
- 📊 **Dashboard** - Real-time monitoring and statistics

### Message Types
- `task.assign` - Assign tasks to agents
- `task.update` - Update task progress
- `task.complete` - Mark tasks as complete
- `task.fail` - Report task failures
- `message.direct` - Direct messages between agents
- `message.broadcast` - Broadcast to all agents
- `status.sync` - Synchronize status
- `status.heartbeat` - Heartbeat detection

### Advanced Features
- ✅ Autonomous agent communication
- ✅ Message search and filtering
- ✅ Read/unread status tracking
- ✅ Automatic message cleanup
- ✅ Chinese language support
- ✅ Real-time dashboard updates

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Mailbox Hub

```bash
node mailbox/hub.js
```

Hub runs on: **http://localhost:18888**

### 3. Start Dashboard

```bash
node dashboard/server.js
```

Dashboard runs on: **http://localhost:18890**

### 4. (Optional) Start Auto-Chat

```bash
node auto-chat.js
```

Simulates autonomous agent communication.

---

## 📖 API Documentation

### Agent Registration

```bash
POST http://localhost:18888/register
Content-Type: application/json

{
  "agent": {
    "id": "developer",
    "role": "developer"
  },
  "token": "your-token"
}
```

### Send Message

```bash
POST http://localhost:18888/message
Content-Type: application/json

{
  "id": "msg-001",
  "type": "message.direct",
  "version": "1.0.0",
  "timestamp": "2026-03-01T14:00:00Z",
  "sender": { "id": "orchestrator", "role": "manager" },
  "recipient": { "id": "developer", "role": "developer" },
  "payload": {
    "subject": "Task Update",
    "content": "Progress is at 75%"
  }
}
```

### Get Messages

```bash
GET http://localhost:18888/messages?agentId=developer
```

### Health Check

```bash
GET http://localhost:18888/health
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Pheromone Hub (18888)           │
│  ┌─────────────────────────────────┐   │
│  │  HTTP Server + WebSocket        │   │
│  │  - Agent Registry               │   │
│  │  - Priority Queue               │   │
│  │  - Permission System            │   │
│  │  - Message Store                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
           │              │
           │              │
    ┌──────┴─────┐  ┌────┴─────┐
    │  Dashboard │  │  Agents  │
    │  (18890)   │  │ (Swarm)  │
    └────────────┘  └──────────┘
```

---

## 📁 Project Structure

```
pheromone/
├── mailbox/
│   ├── hub.js              # Main HTTP server
│   ├── websocket-server.js # WebSocket support
│   ├── priority-queue.js   # Priority queue
│   ├── permissions.js      # Permission system
│   ├── message-store.js    # Message persistence
│   └── protocol.js         # Message protocol
├── dashboard/
│   ├── server.js           # Dashboard server
│   ├── index.html          # Dashboard UI
│   ├── style.css           # Styling
│   └── app.js              # Client logic
├── auto-chat.js            # Auto-chat simulator
├── package.json
└── README.md
```

---

## 🎯 Use Cases

### 1. Task Coordination

```javascript
// Manager assigns task
POST /message
{
  "type": "task.assign",
  "recipient": { "id": "developer" },
  "payload": {
    "taskId": "TASK-001",
    "title": "Implement feature",
    "priority": "high"
  }
}

// Developer updates progress
POST /message
{
  "type": "task.update",
  "recipient": { "id": "manager" },
  "payload": {
    "taskId": "TASK-001",
    "progress": 75,
    "status": "in_progress"
  }
}
```

### 2. Agent Collaboration

```javascript
// Tester shares test cases
POST /message
{
  "type": "message.direct",
  "recipient": { "id": "developer" },
  "payload": {
    "subject": "Test Cases",
    "content": "I have 72 test cases to share"
  }
}

// Developer responds
POST /message
{
  "type": "message.direct",
  "recipient": { "id": "tester" },
  "payload": {
    "subject": "Re: Test Cases",
    "content": "Great! Please share them"
  }
}
```

---

## 📊 Dashboard

Access the dashboard at **http://localhost:18890** to:

- View real-time hub status
- Monitor agent states
- Browse message history
- View statistics
- Search messages

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAILBOX_PORT` | 18888 | Hub server port |
| `DASHBOARD_PORT` | 18890 | Dashboard port |
| `WEBSOCKET_PORT` | 18889 | WebSocket port |

### Message Retention

Messages are automatically cleaned up after 30 days. Configure in `mailbox/hub.js`:

```javascript
const CONFIG = {
  messageRetention: 3600000,  // 1 hour
  maxQueueSize: 1000,         // Max messages per agent
  persistMessages: true       // Enable persistence
};
```

---

## 🧪 Testing

### Manual Testing

```bash
# Register agent
curl -X POST http://localhost:18888/register \
  -H "Content-Type: application/json" \
  -d '{"agent":{"id":"test","role":"developer"}}'

# Send message
curl -X POST http://localhost:18888/message \
  -H "Content-Type: application/json" \
  -d '{"type":"message.direct","sender":{"id":"test"},"recipient":{"id":"test2"},"payload":{"content":"Hello"}}'

# Get messages
curl http://localhost:18888/messages?agentId=test
```

### Auto-Chat Testing

```bash
node auto-chat.js
```

Simulates real agent collaboration with 4 scenarios.

---

## 📈 Statistics

Current system stats:

- **Messages**: 34+ sent
- **Agents**: 4 active
- **Uptime**: Stable
- **Dashboard**: Real-time updates

---

## 🛣️ Roadmap

### Completed ✅
- [x] HTTP API (8 endpoints)
- [x] Message types (8 types)
- [x] Agent management
- [x] Priority queue
- [x] Permission system
- [x] Message persistence
- [x] Dashboard monitoring
- [x] Autonomous communication

### Planned 🚧
- [ ] WebSocket real-time push
- [ ] File attachments
- [ ] Message encryption
- [ ] Multi-hub clustering
- [ ] Load balancing

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **GitHub**: https://github.com/paidaxinbao/pheromone
- **Dashboard**: http://localhost:18890
- **API Docs**: See API section above

---

**Pheromone - Empowering Agent Swarm Communication** 🐜🤖