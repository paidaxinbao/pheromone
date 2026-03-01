#!/bin/bash
# Docker Manager - 牢张 (Lao Zhang)
# 性格：严谨、高效、话少但靠谱
# 职责：动态管理 Agent 容器

set -e

HUB_URL="${HUB_URL:-http://localhost:18888}"
SWARM_NETWORK="${SWARM_NETWORK:-swarm-net}"
AGENT_IMAGE="${AGENT_IMAGE:-pheromone-agent:latest}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 牢张的汇报函数
report() {
    echo -e "${BLUE}[牢张]${NC} $1"
}

success() {
    echo -e "${GREEN}[牢张]${NC} ✅ $1"
}

warning() {
    echo -e "${YELLOW}[牢张]${NC} ⚠️ $1"
}

error() {
    echo -e "${RED}[牢张]${NC} ❌ $1"
}

# 创建 Agent
create_agent() {
    local agent_id=$1
    local role=$2
    local level=${3:-3}
    
    report "正在创建 Agent: $agent_id (role: $role, level: $level)..."
    
    # 检查容器是否已存在
    if docker ps -a --format '{{.Names}}' | grep -q "^${agent_id}$"; then
        warning "容器 $agent_id 已存在，先销毁..."
        destroy_agent "$agent_id"
    fi
    
    # 创建并启动容器
    docker run -d \
        --name "$agent_id" \
        --network "$SWARM_NETWORK" \
        -e AGENT_ID="$agent_id" \
        -e AGENT_ROLE="$role" \
        -e AGENT_LEVEL="$level" \
        -e HUB_URL="$HUB_URL" \
        --restart unless-stopped \
        "$AGENT_IMAGE" \
        /app/startup.sh
    
    # 等待容器启动
    sleep 3
    
    # 检查容器状态
    if docker ps --format '{{.Names}}' | grep -q "^${agent_id}$"; then
        success "容器已就绪。$agent_id 运行中。"
    else
        error "容器启动失败。"
        exit 1
    fi
}

# 销毁 Agent
destroy_agent() {
    local agent_id=$1
    
    report "正在销毁 Agent: $agent_id..."
    
    # 停止并删除容器
    docker stop "$agent_id" 2>/dev/null || true
    docker rm "$agent_id" 2>/dev/null || true
    
    # 向 Hub 注销
    curl -s -X DELETE "$HUB_URL/agents/$agent_id" > /dev/null 2>&1 || true
    
    success "容器已清理。$agent_id 已移除。"
}

# 列出所有 Agent
list_agents() {
    report "当前运行的 Agent 容器:"
    echo ""
    docker ps --filter "name=^/" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | tail -n +2
    echo ""
    
    # 查询 Hub 中的注册信息
    report "Hub 中注册的 Agent:"
    curl -s "$HUB_URL/agents" | python3 -m json.tool 2>/dev/null || echo "无法连接 Hub"
}

# 查看日志
view_logs() {
    local agent_id=$1
    local lines=${2:-50}
    
    report "查看 $agent_id 的最近 $lines 行日志:"
    docker logs --tail "$lines" "$agent_id"
}

# 检查状态
check_status() {
    local agent_id=$1
    
    report "检查 $agent_id 状态..."
    
    # 容器状态
    echo "容器状态:"
    docker inspect "$agent_id" --format '{{.State.Status}}' 2>/dev/null || echo "容器不存在"
    
    # Hub 状态
    echo ""
    echo "Hub 注册状态:"
    curl -s "$HUB_URL/agents" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for agent in data.get('agents', []):
    if agent['id'] == '$agent_id':
        print(f\"  ID: {agent['id']}\")
        print(f\"  Role: {agent['role']}\")
        print(f\"  Status: {agent['status']}\")
        print(f\"  Callback: {agent.get('callbackUrl', 'none')}\")
        break
else:
    print('  未在 Hub 中找到')
" 2>/dev/null || echo "无法连接 Hub"
}

# 重启 Agent
restart_agent() {
    local agent_id=$1
    
    report "重启 Agent: $agent_id..."
    docker restart "$agent_id"
    sleep 3
    
    if docker ps --format '{{.Names}}' | grep -q "^${agent_id}$"; then
        success "重启完成。$agent_id 运行中。"
    else
        error "重启失败。"
        exit 1
    fi
}

# 创建蜂群
create_swarm() {
    local swarm_name=$1
    local count=$2
    local role=${3:-developer}
    
    report "创建蜂群：$swarm_name ($count 个 $role)..."
    
    for i in $(seq 1 $count); do
        local agent_id="${swarm_name}-${i}"
        create_agent "$agent_id" "$role"
    done
    
    success "蜂群已部署。$swarm_name 包含 $count 个 Agent。"
}

# 销毁蜂群
destroy_swarm() {
    local swarm_name=$1
    
    report "销毁蜂群：$swarm_name..."
    
    # 获取所有属于该蜂群的容器
    local containers=$(docker ps --format '{{.Names}}' | grep "^${swarm_name}-")
    
    if [ -z "$containers" ]; then
        warning "未找到蜂群 $swarm_name 的容器。"
        return
    fi
    
    # 逐个销毁
    for container in $containers; do
        destroy_agent "$container"
    done
    
    success "蜂群已撤离。$swarm_name 已清理。"
}

# 显示帮助
show_help() {
    echo "牢张的 Docker 管理工具"
    echo ""
    echo "用法:"
    echo "  $0 <command> [arguments]"
    echo ""
    echo "命令:"
    echo "  create <agent_id> <role> [level]     创建 Agent"
    echo "  destroy <agent_id>                   销毁 Agent"
    echo "  list                                 列出所有 Agent"
    echo "  logs <agent_id> [lines]              查看日志"
    echo "  status <agent_id>                    检查状态"
    echo "  restart <agent_id>                   重启 Agent"
    echo "  create-swarm <name> <count> [role]   创建蜂群"
    echo "  destroy-swarm <name>                 销毁蜂群"
    echo "  help                                 显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 create dev-01 developer 3"
    echo "  $0 create-swarm dev-team 5 developer"
    echo "  $0 destroy-swarm dev-team"
    echo ""
}

# 主程序
main() {
    local command=$1
    shift || true
    
    case "$command" in
        create)
            create_agent "$@"
            ;;
        destroy)
            destroy_agent "$@"
            ;;
        list)
            list_agents
            ;;
        logs)
            view_logs "$@"
            ;;
        status)
            check_status "$@"
            ;;
        restart)
            restart_agent "$@"
            ;;
        create-swarm)
            create_swarm "$@"
            ;;
        destroy-swarm)
            destroy_swarm "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "未知命令：$command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
