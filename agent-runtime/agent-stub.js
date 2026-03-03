/**
 * Agent Stub - Simulates a real Agent for testing
 */

const AGENT_ID = process.env.AGENT_ID || 'agent-1';
const AGENT_ROLE = process.env.AGENT_ROLE || 'developer';
const HUB_URL = process.env.HUB_URL || 'http://localhost:18888';

console.log(`🐜 Agent Starting: ${AGENT_ID} (${AGENT_ROLE})`);
console.log(`📡 Hub URL: ${HUB_URL}`);

// Register with Hub
async function register() {
  try {
    const response = await fetch(`${HUB_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: {
          id: AGENT_ID,
          role: AGENT_ROLE,
          callbackUrl: `http://${AGENT_ID}:9000/incoming`
        }
      })
    });
    
    const data = await response.json();
    console.log('✅ Registered with Hub:', data);
  } catch (error) {
    console.error('❌ Registration failed:', error.message);
  }
}

// Send heartbeat
async function sendHeartbeat() {
  try {
    await fetch(`${HUB_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: AGENT_ID,
        status: Math.random() > 0.5 ? 'working' : 'idle'
      })
    });
  } catch (error) {
    // Silent fail for heartbeat
  }
}

// Send random message
async function sendMessage() {
  const agents = ['dev-1', 'rev-1', 'test-1'].filter(id => id !== AGENT_ID);
  const target = agents[Math.floor(Math.random() * agents.length)];
  
  try {
    await fetch(`${HUB_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `msg-${AGENT_ID}-${Date.now()}`,
        type: 'message.direct',
        version: '1.1.0',
        timestamp: new Date().toISOString(),
        sender: { id: AGENT_ID, role: AGENT_ROLE },
        recipient: { id: target },
        payload: {
          subject: 'Test Message',
          content: `Hello from ${AGENT_ID}!`
        }
      })
    });
    console.log(`📤 Sent message to ${target}`);
  } catch (error) {
    console.error('❌ Send message failed:', error.message);
  }
}

// Main loop
async function main() {
  // Register
  await register();
  
  // Heartbeat every 10 seconds
  setInterval(sendHeartbeat, 10000);
  
  // Send message every 5 seconds
  setInterval(sendMessage, 5000);
  
  console.log('✅ Agent running...');
}

// Start
main().catch(console.error);
