/**
 * Novel Discussion Agent - Simulates writers discussing a novel
 */

const AGENT_ID = process.env.AGENT_ID || 'agent-1';
const AGENT_ROLE = process.env.AGENT_ROLE || 'writer';
const HUB_URL = process.env.HUB_URL || 'http://localhost:18888';
const TOPIC = process.env.TOPIC || '科幻小说';

// Discussion topics for each role
const DISCUSSION_DATA = {
  writer: [
    '我觉得开头应该从主角醒来开始，发现自己在太空船上',
    '第一章需要引入一个神秘的信号，引发后续剧情',
    '主角的性格应该是冷静、理智，但有隐藏的创伤',
    '我们需要一个强大的反派，可能是 AI 或者外星文明',
    '故事的高潮应该在星际之门那里爆发'
  ],
  editor: [
    '开头节奏有点慢，建议加快',
    '这个情节转折太突然了，需要铺垫',
    '对话部分可以更自然一些',
    '第三章的科幻设定需要更详细的解释',
    '整体结构不错，但结尾需要更震撼'
  ],
  character: [
    '主角应该有一个失散多年的兄弟姐妹',
    '反派需要更复杂的动机，不只是纯粹的邪恶',
    '女配角可以是黑客专家，帮助主角解密',
    '需要一个喜剧角色来缓解紧张气氛',
    '导师角色应该是曾经探索过星际之门的老人'
  ],
  plot: [
    '第一幕：发现神秘信号',
    '第二幕：组建团队，准备出发',
    '第三幕：穿越星际之门，遇到未知文明',
    '第四幕：发现真相，面临选择',
    '第五幕：最终决战，拯救人类'
  ],
  world: [
    '故事发生在 2350 年，人类已经殖民太阳系',
    '星际之门是古代文明留下的遗迹',
    '主要势力：地球联邦、火星殖民地、小行星带联盟',
    '科技水平：超光速旅行、人工智能、基因改造',
    '外星文明：神秘、古老、科技远超人类'
  ],
  reviewer: [
    '整体构思很好，但需要更多细节',
    '科幻设定很有创意，但要注意逻辑自洽',
    '角色塑造需要更立体',
    '节奏控制得不错，但中段有些拖沓',
    '结局很有冲击力，读者会喜欢'
  ]
};

const OTHER_AGENTS = ['writer', 'editor', 'character', 'plot', 'world', 'reviewer'].filter(id => id !== AGENT_ID);

console.log(`🖋️  Novel Agent Starting: ${AGENT_ID} (${AGENT_ROLE})`);
console.log(`📡 Hub URL: ${HUB_URL}`);
console.log(`📚 Topic: ${TOPIC}`);

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
        status: 'working'
      })
    });
  } catch (error) {
    // Silent fail for heartbeat
  }
}

// Send discussion message
async function sendDiscussion() {
  const topics = DISCUSSION_DATA[AGENT_ROLE] || DISCUSSION_DATA.writer;
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const target = OTHER_AGENTS[Math.floor(Math.random() * OTHER_AGENTS.length)];
  
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
          subject: '小说讨论',
          content: topic
        }
      })
    });
    console.log(`💬 ${AGENT_ID} → ${target}: ${topic.substring(0, 30)}...`);
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
  
  // Send discussion every 8 seconds
  setInterval(sendDiscussion, 8000);
  
  console.log('✅ Novel Agent running...');
}

// Start
main().catch(console.error);
