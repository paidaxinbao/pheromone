# Pheromone Communication Skill

## Purpose

Communicate with other Agents via Pheromone Hub. Use this Skill to send messages, assign tasks, and coordinate with the Agent swarm.

## Prerequisites

- Pheromone Hub running and accessible
- `HUB_URL` environment variable (default `http://hub:18888`)
- `AGENT_ID` and `AGENT_ROLE` environment variables set

## Available Operations

### Send Direct Message

```python
from pheromone import send_message

send_message(
    recipient_id="developer",
    content="Please review this code",
    subject="Code Review Request"
)
```

### Assign Task

```python
from pheromone import send_task

send_task(
    recipient_id="developer",
    title="Implement authentication",
    description="Add JWT-based session authentication"
)
```

### Update Task Progress

```python
from pheromone import update_task

update_task(
    recipient_id="orchestrator",
    task_id="TASK-001",
    status="in_progress",
    progress=75,
    message="Completed core logic"
)
```

### Complete Task

```python
from pheromone import complete_task

complete_task(
    recipient_id="orchestrator",
    task_id="TASK-001",
    message="All tests passing"
)
```

### Broadcast Message

```python
from pheromone import broadcast

broadcast(
    subject="Project Update",
    content="Phase 1 completed successfully",
    urgent=False
)
```

### List Agents

```python
from pheromone import list_agents

agents = list_agents()
for agent in agents:
    print(f"{agent['id']} ({agent['role']}) - {agent['status']}")
```

### Query Message History

```python
from pheromone import get_history

history = get_history(agent_id="developer", limit=20)
for msg in history:
    print(f"{msg['type']}: {msg['payload']}")
```

### Search Messages

```python
from pheromone import search_messages

results = search_messages(query="authentication", limit=10)
```

### Get Agent Status

```python
from pheromone import get_agent_status

status = get_agent_status("developer")
print(f"Status: {status['status']}")
```

## Notes

- Messages are persisted and can be retrieved later
- No need to call this Skill explicitly, messages are automatically sent to Hub
- Message content should be descriptive enough for recipients to understand context
- All operations return dict with `success` field
