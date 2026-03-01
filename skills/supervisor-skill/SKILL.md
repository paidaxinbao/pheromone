---
name: supervisor-skill
description: Supervisor Skill for Pheromone Agent Swarm. Monitor and coordinate Agent activities, assign tasks, and oversee project progress.
metadata:
  requires:
    bins: [curl]
---

# Supervisor Skill

## Purpose

Supervise and coordinate the Pheromone Agent Swarm. Use this Skill to monitor Agent activities, assign tasks, and oversee project progress.

## Prerequisites

- Pheromone Hub running and accessible
- `HUB_URL` environment variable (default `http://localhost:18888`)
- Supervisor role permissions

## Available Operations

### Assign Task to Orchestrator

```bash
./send-task.sh "Task Title" "Task Description"
```

Example:
```bash
./send-task.sh "Implement authentication module" "Add JWT-based session authentication to the system"
```

### Send Direct Message

```bash
curl -X POST http://localhost:18888/message \
  -H "Content-Type: application/json" \
  -d '{
    "id": "msg-supervisor-001",
    "type": "message.direct",
    "sender": { "id": "supervisor", "role": "manager" },
    "recipient": { "id": "orchestrator" },
    "payload": {
      "subject": "Priority Update",
      "content": "Focus on authentication module first"
    }
  }'
```

### View Agent Status

```bash
curl http://localhost:18888/agents | python3 -m json.tool
```

### View Message History

```bash
curl "http://localhost:18888/messages/history?limit=20" | python3 -m json.tool
```

### Search Messages

```bash
curl "http://localhost:18888/messages/search?q=authentication" | python3 -m json.tool
```

## Python Interface

```python
import requests
import json
from datetime import datetime

HUB_URL = "http://localhost:18888"

def assign_task(title, description, recipient="orchestrator"):
    """Assign a task to an Agent"""
    message = {
        "id": f"msg-supervisor-{int(datetime.now().timestamp())}",
        "type": "task.assign",
        "version": "1.1.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "sender": { "id": "supervisor", "role": "manager" },
        "recipient": { "id": recipient },
        "payload": {
            "title": title,
            "description": description
        },
        "metadata": { "priority": "high" }
    }
    
    response = requests.post(f"{HUB_URL}/message", json=message)
    return response.json()

def send_message(recipient, subject, content):
    """Send a direct message to an Agent"""
    message = {
        "id": f"msg-supervisor-{int(datetime.now().timestamp())}",
        "type": "message.direct",
        "version": "1.1.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "sender": { "id": "supervisor", "role": "manager" },
        "recipient": { "id": recipient },
        "payload": {
            "subject": subject,
            "content": content
        }
    }
    
    response = requests.post(f"{HUB_URL}/message", json=message)
    return response.json()

# Example usage
assign_task("Implement auth", "Add JWT authentication")
send_message("orchestrator", "Priority", "Focus on auth module first")
```

## Notes

- Supervisor has manager role permissions
- Can assign tasks to any Agent
- Can broadcast messages to all Agents
- Can view all message history
- Messages are persisted and can be searched
