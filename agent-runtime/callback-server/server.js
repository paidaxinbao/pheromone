/**
 * Agent Callback Server
 * Receives messages from Pheromone Hub via Webhook callbacks
 */

const http = require('http');

const CALLBACK_PORT = parseInt(process.env.CALLBACK_PORT || '9000');
const HUB_URL = process.env.HUB_URL || 'http://hub:18888';
const AGENT_ID = process.env.AGENT_ID;
const AGENT_ROLE = process.env.AGENT_ROLE || 'developer';
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://localhost:18789';

if (!AGENT_ID) {
  console.error('AGENT_ID environment variable is required');
  process.exit(1);
}

// ============================================================================
// Helper: POST to Hub
// ============================================================================

function postToHub(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(`${HUB_URL}${endpoint}`);

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            resolve(responseBody);
          }
        });
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================================
// Helper: Process with OpenClaw (simulated)
// ============================================================================

async function processWithOpenClaw(incomingMessage) {
  const senderInfo = incomingMessage.sender
    ? `${incomingMessage.sender.id} (${incomingMessage.sender.role})`
    : 'unknown';

  const messageContent = incomingMessage.payload
    ? JSON.stringify(incomingMessage.payload, null, 2)
    : JSON.stringify(incomingMessage, null, 2);

  const prompt = [
    `You are ${AGENT_ID}, role: ${AGENT_ROLE}.`,
    `Received message from ${senderInfo}: type=${incomingMessage.type}`,
    '',
    'Content:',
    messageContent,
    '',
    'Please process this message and respond appropriately.',
    'If you need to send replies, specify:',
    '- recipient Agent ID',
    '- message content',
    '- message type (task.update / message.direct / task.complete etc.)',
    '',
    'If no reply needed, explain why.',
  ].join('\n');

  console.log(`[${AGENT_ID}] Processing with OpenClaw...`);
  console.log(`[${AGENT_ID}] Prompt: ${prompt.substring(0, 200)}...`);

  // Simulated OpenClaw response (in real implementation, call OpenClaw API)
  // For now, return a simple acknowledgment
  return {
    outgoing_messages: [
      {
        recipient: incomingMessage.sender.id,
        type: 'message.direct',
        payload: {
          subject: `Re: ${incomingMessage.payload?.subject || 'Message'}`,
          content: `Received your message. I will process it shortly.`,
        },
      },
    ],
  };
}

// ============================================================================
// Helper: Send outgoing messages
// ============================================================================

async function sendOutgoingMessages(openclawResult, originalMessage) {
  if (!openclawResult) return;

  if (openclawResult.outgoing_messages) {
    for (const msg of openclawResult.outgoing_messages) {
      const envelope = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: msg.type || 'message.direct',
        version: '1.1.0',
        timestamp: new Date().toISOString(),
        sender: { id: AGENT_ID, role: AGENT_ROLE },
        recipient: { id: msg.recipient },
        payload: msg.payload || { content: msg.content },
        metadata: {
          correlationId: originalMessage.id,
          turn: (originalMessage.metadata?.turn || 0) + 1,
        },
      };

      try {
        const result = await postToHub('/message', envelope);
        console.log(`[${AGENT_ID}] → ${msg.recipient}: sent (${result.success})`);
      } catch (err) {
        console.error(`[${AGENT_ID}] Failed to send to ${msg.recipient}: ${err.message}`);
      }
    }
  }
}

// ============================================================================
// Callback HTTP Server
// ============================================================================

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', agentId: AGENT_ID }));
    return;
  }

  // Incoming messages from Hub
  if (req.method === 'POST' && req.url === '/incoming') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      // Respond 200 immediately (acknowledge receipt)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, agentId: AGENT_ID }));

      // Process asynchronously (don't block Hub)
      try {
        const message = JSON.parse(body);
        console.log(
          `[${AGENT_ID}] ← ${message.sender?.id || '?'}: ${message.type} (${message.id})`
        );

        // Process with OpenClaw
        const result = await processWithOpenClaw(message);

        // Send replies
        await sendOutgoingMessages(result, message);
      } catch (err) {
        console.error(`[${AGENT_ID}] Error processing message: ${err.message}`);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ============================================================================
// Startup
// ============================================================================

async function startup() {
  // 1. Start callback server
  server.listen(CALLBACK_PORT, '0.0.0.0', () => {
    console.log(`[${AGENT_ID}] Callback server listening on port ${CALLBACK_PORT}`);
  });

  // 2. Wait for Hub to be ready
  let hubReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${HUB_URL}/health`);
      if (res.ok) {
        hubReady = true;
        break;
      }
    } catch {}
    console.log(`[${AGENT_ID}] Waiting for Hub...`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!hubReady) {
    console.error(`[${AGENT_ID}] Hub not reachable, exiting`);
    process.exit(1);
  }

  // 3. Register with Hub (provide callbackUrl)
  const callbackUrl = `http://${AGENT_ID}:${CALLBACK_PORT}/incoming`;

  try {
    const result = await postToHub('/register', {
      agent: {
        id: AGENT_ID,
        role: AGENT_ROLE,
        callbackUrl: callbackUrl,
      },
    });

    console.log(`[${AGENT_ID}] Registered with Hub: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error(`[${AGENT_ID}] Registration failed: ${err.message}`);
    process.exit(1);
  }

  // 4. Send heartbeats periodically
  setInterval(async () => {
    try {
      await postToHub('/heartbeat', {
        agentId: AGENT_ID,
        status: 'idle',
      });
    } catch (err) {
      console.error(`[${AGENT_ID}] Heartbeat failed: ${err.message}`);
    }
  }, 25000);

  console.log(`[${AGENT_ID}] Agent runtime started`);
}

startup();
