/**
 * Swarm Management Script - 牢张、福瑞、曼舟协作管理
 */

const { exec } = require('child_process');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 牢张 - Docker 容器管理
class LaoZhang {
  constructor() {
    console.log(`${COLORS.yellow}🔧 牢张：Docker 容器管理员已就绪${COLORS.reset}`);
  }

  async startContainers() {
    console.log(`${COLORS.yellow}🔧 牢张：正在启动 Docker 容器...${COLORS.reset}`);
    
    return new Promise((resolve) => {
      exec('docker-compose up -d', (error, stdout, stderr) => {
        if (error) {
          console.log(`${COLORS.red}❌ 牢张：启动失败 - ${error.message}${COLORS.reset}`);
          resolve(false);
        } else {
          console.log(`${COLORS.green}✅ 牢张：所有容器已启动${COLORS.reset}`);
          console.log(stdout);
          resolve(true);
        }
      });
    });
  }

  async stopContainers() {
    console.log(`${COLORS.yellow}🔧 牢张：正在停止 Docker 容器...${COLORS.reset}`);
    
    return new Promise((resolve) => {
      exec('docker-compose down', (error, stdout, stderr) => {
        if (error) {
          console.log(`${COLORS.red}❌ 牢张：停止失败 - ${error.message}${COLORS.reset}`);
          resolve(false);
        } else {
          console.log(`${COLORS.green}✅ 牢张：所有容器已停止${COLORS.reset}`);
          resolve(true);
        }
      });
    });
  }

  async checkStatus() {
    return new Promise((resolve) => {
      exec('docker-compose ps', (error, stdout, stderr) => {
        if (error) {
          resolve(null);
        } else {
          console.log(`${COLORS.cyan}📊 牢张：容器状态${COLORS.reset}`);
          console.log(stdout);
          resolve(stdout);
        }
      });
    });
  }

  async viewLogs(service) {
    return new Promise((resolve) => {
      exec(`docker-compose logs -f ${service}`, (error, stdout, stderr) => {
        if (error) {
          resolve(null);
        } else {
          console.log(`${COLORS.cyan}📜 牢张：${service} 日志${COLORS.reset}`);
          console.log(stdout);
          resolve(stdout);
        }
      });
    });
  }
}

// 福瑞 - 前端界面管理
class Fury {
  constructor() {
    console.log(`${COLORS.magenta}🎨 福瑞：前端界面管理员已就绪${COLORS.reset}`);
  }

  async checkDashboard() {
    console.log(`${COLORS.magenta}🎨 福瑞：检查 Dashboard 配置...${COLORS.reset}`);
    
    const fs = require('fs');
    const dashboardPath = path.join(__dirname, '..', 'dashboard', 'index.html');
    
    if (fs.existsSync(dashboardPath)) {
      console.log(`${COLORS.green}✅ 福瑞：Dashboard 文件存在${COLORS.reset}`);
      return true;
    } else {
      console.log(`${COLORS.red}❌ 福瑞：Dashboard 文件缺失${COLORS.reset}`);
      return false;
    }
  }

  async checkVisualization() {
    console.log(`${COLORS.magenta}🎨 福瑞：检查蜂群可视化配置...${COLORS.reset}`);
    
    const appJsPath = path.join(__dirname, '..', 'dashboard', 'app.js');
    if (fs.existsSync(appJsPath)) {
      const content = fs.readFileSync(appJsPath, 'utf8');
      const hasSwarm = content.includes('drawSwarm');
      const hasAnimation = content.includes('messageAnimations');
      
      if (hasSwarm && hasAnimation) {
        console.log(`${COLORS.green}✅ 福瑞：蜂群可视化配置完整${COLORS.reset}`);
        return true;
      } else {
        console.log(`${COLORS.yellow}⚠️ 福瑞：蜂群可视化配置不完整${COLORS.reset}`);
        return false;
      }
    }
    
    return false;
  }

  getDashboardUrl() {
    const url = 'http://localhost:18890';
    console.log(`${COLORS.magenta}🌐 福瑞：Dashboard 地址${COLORS.reset}`);
    console.log(`${COLORS.cyan}${url}${COLORS.reset}`);
    return url;
  }
}

// 曼舟 - Hub 中枢管理
class ManZhou {
  constructor() {
    console.log(`${COLORS.blue}📊 曼舟：Hub 中枢管理员已就绪${COLORS.reset}`);
  }

  async checkHub() {
    console.log(`${COLORS.blue}📊 曼舟：检查 Hub 服务器...${COLORS.reset}`);
    
    const fs = require('fs');
    const hubPath = path.join(__dirname, '..', 'hub', 'hub-server.js');
    
    if (fs.existsSync(hubPath)) {
      console.log(`${COLORS.green}✅ 曼舟：Hub 服务器文件存在${COLORS.reset}`);
      return true;
    } else {
      console.log(`${COLORS.red}❌ 曼舟：Hub 服务器文件缺失${COLORS.reset}`);
      return false;
    }
  }

  async checkHubHealth() {
    console.log(`${COLORS.blue}📊 曼舟：检查 Hub 健康状态...${COLORS.reset}`);
    
    try {
      const response = await fetch('http://localhost:18888/health');
      const data = await response.json();
      
      console.log(`${COLORS.green}✅ 曼舟：Hub 健康状态${COLORS.reset}`);
      console.log(`  状态：${data.status}`);
      console.log(`  Agent 数量：${data.agents}`);
      console.log(`  消息数量：${data.messages}`);
      
      return data;
    } catch (error) {
      console.log(`${COLORS.red}❌ 曼舟：Hub 未运行或无法访问${COLORS.reset}`);
      return null;
    }
  }

  async monitorMessages() {
    console.log(`${COLORS.blue}📊 曼舟：监控消息流...${COLORS.reset}`);
    
    try {
      const response = await fetch('http://localhost:18888/messages?limit=10');
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        console.log(`${COLORS.green}📬 曼舟：最近消息${COLORS.reset}`);
        data.messages.forEach(msg => {
          console.log(`  ${msg.sender.id} → ${msg.recipient?.id || 'broadcast'}: ${msg.payload?.content?.substring(0, 50)}...`);
        });
      } else {
        console.log(`${COLORS.yellow}⚠️ 曼舟：暂无消息${COLORS.reset}`);
      }
    } catch (error) {
      console.log(`${COLORS.red}❌ 曼舟：无法获取消息${COLORS.reset}`);
    }
  }
}

// Main - 三人组协作
async function main() {
  console.log('\n========================================');
  console.log('🎭 蜂群管理系统 - 牢张、福瑞、曼舟');
  console.log('========================================\n');

  const laoZhang = new LaoZhang();
  const fury = new Fury();
  const manZhou = new ManZhou();

  // 启动前检查
  console.log('\n📋 启动前检查...\n');
  await fury.checkDashboard();
  await manZhou.checkHub();

  // 启动蜂群
  console.log('\n🚀 启动蜂群...\n');
  const started = await laoZhang.startContainers();

  if (started) {
    // 等待容器启动
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 检查状态
    console.log('\n📊 检查状态...\n');
    await laoZhang.checkStatus();
    await manZhou.checkHubHealth();

    // 等待 Agent 注册
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 监控消息
    console.log('\n📬 监控消息流...\n');
    await manZhou.monitorMessages();

    // Dashboard 地址
    console.log('\n🌐 访问 Dashboard:\n');
    fury.getDashboardUrl();

    console.log('\n========================================');
    console.log('✅ 蜂群启动完成！');
    console.log('========================================\n');
  } else {
    console.log('\n========================================');
    console.log('❌ 蜂群启动失败！');
    console.log('========================================\n');
  }
}

// 停止蜂群
async function stop() {
  console.log('\n========================================');
  console.log('🛑 停止蜂群...');
  console.log('========================================\n');

  const laoZhang = new LaoZhang();
  await laoZhang.stopContainers();

  console.log('\n✅ 蜂群已停止\n');
}

// 命令行参数
const command = process.argv[2];

if (command === 'stop') {
  stop();
} else {
  main();
}
