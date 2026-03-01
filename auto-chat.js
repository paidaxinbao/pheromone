/**
 * Agent Auto-Chat Trigger
 * Makes agents communicate autonomously
 */

const http = require('http');

const MAILBOX_URL = 'http://localhost:18888';

// Agent conversation scenarios
const scenarios = [
  {
    name: 'progress_report',
    from: { id: 'developer', role: 'developer' },
    to: { id: 'orchestrator', role: 'manager' },
    type: 'task.update',
    payloads: [
      { taskId: 'TASK-002', status: 'in_progress', progress: 50, message: '已完成 Mailbox Hub 集成测试框架搭建' },
      { taskId: 'TASK-002', status: 'in_progress', progress: 75, message: '正在编写测试用例，已完成 75%' },
      { taskId: 'TASK-002', status: 'complete', progress: 100, message: '测试用例编写完成，共 85 个测试用例' }
    ]
  },
  {
    name: 'help_request',
    from: { id: 'reviewer', role: 'reviewer' },
    to: { id: 'developer', role: 'developer' },
    type: 'message.direct',
    payloads: [
      { subject: '代码审查问题', content: '你好！我在审查你的代码时发现几个问题可以讨论一下吗？' },
      { subject: '测试覆盖率', content: '请问测试覆盖率目标是多少？我需要确保审查标准一致。' }
    ]
  },
  {
    name: 'collaboration',
    from: { id: 'tester', role: 'tester' },
    to: { id: 'developer', role: 'developer' },
    type: 'message.direct',
    payloads: [
      { subject: '测试用例共享', content: '我有 72 个测试用例可以分享给你，包括边界测试和异常测试。需要吗？' },
      { subject: '协作建议', content: '我们可以合并测试用例，避免重复工作。你觉得怎么样？' }
    ]
  },
  {
    name: 'status_sync',
    from: { id: 'orchestrator', role: 'manager' },
    to: { id: 'reviewer', role: 'reviewer' },
    type: 'status.sync',
    payloads: [
      { currentTask: 'REVIEW-002', progress: 60, message: '审查进度正常，预计 30 分钟完成' },
      { currentTask: 'REVIEW-002', progress: 90, message: '审查即将完成，发现 3 个优化建议' }
    ]
  }
];

function sendMessage(scenario) {
  const payload = scenario.payloads[Math.floor(Math.random() * scenario.payloads.length)];
  
  const message = {
    id: `msg-auto-${Date.now()}`,
    type: scenario.type,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sender: scenario.from,
    recipient: scenario.to,
    payload: payload
  };
  
  const data = JSON.stringify(message);
  
  const options = {
    hostname: 'localhost',
    port: 18888,
    path: '/message',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(data, 'utf8')
    }
  };
  
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`✅ [${scenario.name}] ${scenario.from.id} → ${scenario.to.id}: ${payload.subject || payload.taskId || 'OK'}`);
    });
  });
  
  req.on('error', (e) => {
    console.error(`❌ Error: ${e.message}`);
  });
  
  req.write(data, 'utf8');
  req.end();
}

// Main loop - send messages every 30-60 seconds
function startAutoChat() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Agent Auto-Chat Started              ║');
  console.log('║   Messages every 30-60 seconds         ║');
  console.log('╚════════════════════════════════════════╝');
  
  // Send first message immediately
  const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  sendMessage(randomScenario);
  
  // Then send messages periodically
  setInterval(() => {
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    sendMessage(randomScenario);
  }, 30000 + Math.random() * 30000); // 30-60 seconds
}

// Start
startAutoChat();
