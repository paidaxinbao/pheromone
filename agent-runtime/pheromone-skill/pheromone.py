"""
Pheromone Communication Skill for OpenClaw Agent

Provides methods for Agent-to-Agent communication via Pheromone Hub.
"""

import json
import os
import uuid
from datetime import datetime, timezone
import urllib.request
import urllib.error

HUB_URL = os.environ.get("HUB_URL", "http://hub:18888")
AGENT_ID = os.environ.get("AGENT_ID", "unknown")
AGENT_ROLE = os.environ.get("AGENT_ROLE", "developer")


def _post(endpoint: str, body: dict) -> dict:
    """POST request to Hub"""
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{HUB_URL}{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        return {"success": False, "error": str(e)}


def _get(endpoint: str) -> dict:
    """GET request to Hub"""
    req = urllib.request.Request(f"{HUB_URL}{endpoint}", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        return {"success": False, "error": str(e)}


def _build_envelope(msg_type: str, payload: dict, recipient_id: str = None) -> dict:
    """Build message envelope"""
    envelope = {
        "id": f"msg-{uuid.uuid4().hex[:12]}",
        "type": msg_type,
        "version": "1.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender": {"id": AGENT_ID, "role": AGENT_ROLE},
        "payload": payload,
    }
    if recipient_id:
        envelope["recipient"] = {"id": recipient_id}
    return envelope


def send_message(recipient_id: str, content: str, subject: str = None) -> dict:
    """Send direct message to specific Agent"""
    payload = {"content": content}
    if subject:
        payload["subject"] = subject
    envelope = _build_envelope("message.direct", payload, recipient_id)
    return _post("/message", envelope)


def send_task(
    recipient_id: str, title: str, description: str, task_type: str = "task.assign"
) -> dict:
    """Assign task to specific Agent"""
    payload = {"title": title, "description": description}
    envelope = _build_envelope(task_type, payload, recipient_id)
    return _post("/message", envelope)


def update_task(
    recipient_id: str, task_id: str, status: str, progress: int, message: str = ""
) -> dict:
    """Update task progress"""
    payload = {
        "taskId": task_id,
        "status": status,
        "progress": progress,
        "message": message,
    }
    envelope = _build_envelope("task.update", payload, recipient_id)
    return _post("/message", envelope)


def complete_task(recipient_id: str, task_id: str, message: str = "") -> dict:
    """Mark task as complete"""
    return update_task(recipient_id, task_id, "complete", 100, message)


def broadcast(subject: str, content: str, urgent: bool = False) -> dict:
    """Broadcast message to all Agents"""
    return _post("/broadcast", {
        "subject": subject,
        "content": content,
        "urgent": urgent,
    })


def list_agents() -> list:
    """Get list of all registered Agents"""
    result = _get("/agents")
    return result.get("agents", [])


def get_history(agent_id: str = None, limit: int = 50) -> list:
    """Query message history"""
    endpoint = f"/messages/history?limit={limit}"
    if agent_id:
        endpoint += f"&agentId={agent_id}"
    result = _get(endpoint)
    return result.get("messages", [])


def search_messages(query: str, limit: int = 50) -> list:
    """Search messages by keyword"""
    endpoint = f"/messages/search?q={query}&limit={limit}"
    result = _get(endpoint)
    return result.get("messages", [])


def get_agent_status(agent_id: str) -> dict:
    """Get status of specific Agent"""
    agents = list_agents()
    for agent in agents:
        if agent["id"] == agent_id:
            return agent
    return {"error": "Agent not found"}


# Example usage
if __name__ == "__main__":
    print(f"Agent: {AGENT_ID} ({AGENT_ROLE})")
    print(f"Hub: {HUB_URL}")
    print()
    
    # List agents
    agents = list_agents()
    print(f"Registered agents: {len(agents)}")
    for agent in agents:
        print(f"  - {agent['id']} ({agent['role']}) - {agent['status']}")
    print()
    
    # Send test message
    if agents:
        test_agent = agents[0]["id"]
        result = send_message(test_agent, "Hello from Pheromone Skill!", "Test")
        print(f"Sent message to {test_agent}: {result}")
