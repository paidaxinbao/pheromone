# Pheromone Dashboard

Real-time monitoring dashboard for Agent Swarm communication.

## Features

- 📡 **Mailbox Hub Status** - Real-time health monitoring
- 🤖 **Agent Status** - View all registered agents and their status
- 📊 **Statistics** - Total agents, messages, and role distribution
- 💬 **Message Log** - View communication between agents

## Quick Start

### Start Dashboard

```bash
node dashboard/server.js
```

Dashboard will be available at: **http://localhost:18890**

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_PORT` | 18890 | Dashboard server port |
| `MAILBOX_URL` | http://localhost:18888 | Mailbox Hub URL |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Mailbox Hub health status |
| `/api/agents` | GET | List all registered agents |
| `/api/stats` | GET | Dashboard statistics |

## Screenshots

The dashboard displays:

1. **Hub Status Card**
   - Online/Offline status
   - Uptime
   - Connected agents count
   - Total messages processed

2. **Agent Grid**
   - Agent ID and role
   - Current status (idle/busy)
   - Registration time
   - Last heartbeat
   - Current task (if any)

3. **Statistics**
   - Total agents
   - Online agents
   - Total messages
   - Agents by role

4. **Message Log**
   - Recent messages between agents
   - Message type and timestamp
   - Sender and recipient info

## Auto-Refresh

Dashboard automatically refreshes every 10 seconds.

## Integration

To integrate with your Agent Swarm:

1. Ensure Mailbox Hub is running on port 18888
2. Start dashboard: `node dashboard/server.js`
3. Open http://localhost:18890 in your browser
4. Agents automatically appear when they register with Mailbox Hub

## Development

### File Structure

```
dashboard/
├── server.js      # Node.js server
├── index.html     # Dashboard UI
├── style.css      # Styling
├── app.js         # Client-side logic
└── README.md      # This file
```

### Customize

- Edit `style.css` to change colors/theme
- Edit `app.js` to add new features
- Edit `server.js` to add new API endpoints

## License

MIT