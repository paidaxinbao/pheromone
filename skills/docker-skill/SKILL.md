---
name: docker-skill
description: Manage Docker containers for Pheromone Agent Swarm. Create, destroy, and monitor Agent containers dynamically.
metadata:
  requires:
    bins: [docker]
---

# Docker Agent Management Skill

## Purpose

Manage Docker containers in the Pheromone Agent Swarm. Use this Skill to dynamically create, destroy, and query Agent containers without manual Docker operations.

## Prerequisites

- Docker installed and available (`docker` command executable)
- `swarm-net` Docker network exists on host (`docker network inspect swarm-net`)
- Agent image built (`docker images pheromone-agent`)
- `HUB_URL` environment variable points to running Hub (default `http://hub:18888`)

## Available Operations

### Create Agent

```bash
./docker_manager.sh create <agent_id> <role> [level]
```

- `agent_id`: Unique Agent identifier, also container name and DNS name, e.g., `my-planner`
- `role`: Role description string, any value, e.g., `planner`, `researcher`, `coder`
- `level`: Permission level 1-5, optional, default 3

Example:
```bash
./docker_manager.sh create my-planner planner 4
./docker_manager.sh create coder-01 developer 3
```

### Destroy Agent

```bash
./docker_manager.sh destroy <agent_id>
```

Stop and remove container, also unregister Agent from Hub.

Example:
```bash
./docker_manager.sh destroy my-planner
```

### List All Agent Containers

```bash
./docker_manager.sh list
```

Output all running Agent containers and their status.

### View Agent Logs

```bash
./docker_manager.sh logs <agent_id> [lines]
```

Example:
```bash
./docker_manager.sh logs my-planner 50
```

### Check Agent Status

```bash
./docker_manager.sh status <agent_id>
```

Query both container status and Hub registration info.

### Restart Agent

```bash
./docker_manager.sh restart <agent_id>
```

## Python Interface

If you need to call from Python code, use `docker_manager.py`:

```python
from docker_manager import DockerManager

dm = DockerManager(hub_url="http://hub:18888")

# Create Agent
dm.create_agent("my-planner", role="planner", level=4)

# Destroy Agent
dm.destroy_agent("my-planner")

# List Agents
agents = dm.list_agents()

# View logs
logs = dm.get_logs("my-planner", lines=50)
```

## Notes

- `agent_id` will be container name, cannot contain uppercase letters or special characters (only lowercase letters, numbers, hyphens)
- After creation, container automatically registers with Hub, no manual registration needed
- After destruction, Hub registration info is automatically cleared
- If container with same name exists, `create` will destroy and recreate
