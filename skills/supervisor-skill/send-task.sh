#!/bin/bash
# Supervisor Task Sender - 福瑞 (Fury)
# 性格：热情、细致、善于沟通
# 职责：任务分配和协调

set -e

HUB_URL="${HUB_URL:-http://localhost:18888}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 福瑞的汇报函数
report() {
    echo -e "${MAGENTA}[福瑞]${NC} $1"
}

success() {
    echo -e "${GREEN}[福瑞]${NC} ✅ $1"
}

warning() {
    echo -e "${YELLOW}[福瑞]${NC} ⚠️ $1"
}

error() {
    echo -e "${RED}[福瑞]${NC} ❌ $1"
}

# 发送任务
send_task() {
    local title=$1
    local description=$2
    local recipient=${3:-orchestrator}
    local priority=${4:-high}
    
    report "正在分配任务：$title"
    report "目标 Agent: $recipient"
    report "优先级：$priority"
    
    local msg_id="msg-supervisor-$(date +%s)"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    # 发送任务
    local response=$(curl -s -X POST "$HUB_URL/message" \
      -H "Content-Type: application/json" \
      -d "{
        \"id\": \"$msg_id\",
        \"type\": \"task.assign\",
        \"version\": \"1.1.0\",
        \"timestamp\": \"$timestamp\",
        \"sender\": { \"id\": \"supervisor\", \"role\": \"manager\" },
        \"recipient\": { \"id\": \"$recipient\" },
        \"payload\": {
          \"title\": \"$title\",
          \"description\": \"$description\"
        },
        \"metadata\": { \"priority\": \"$priority\" }
      }")
    
    # 检查响应
    if echo "$response" | grep -q '"success":true'; then
        success "任务已分配！交给我吧！"
        echo ""
        echo "任务详情:"
        echo "  ID: $msg_id"
        echo "  标题：$title"
        echo "  目标：$recipient"
        echo "  优先级：$priority"
        echo ""
        echo "响应：$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        error "任务分配失败"
        echo "响应：$response"
        exit 1
    fi
}

# 发送直接消息
send_message() {
    local recipient=$1
    local subject=$2
    local content=$3
    
    report "发送消息给 $recipient: $subject"
    
    local msg_id="msg-supervisor-$(date +%s)"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    curl -s -X POST "$HUB_URL/message" \
      -H "Content-Type: application/json" \
      -d "{
        \"id\": \"$msg_id\",
        \"type\": \"message.direct\",
        \"version\": \"1.1.0\",
        \"timestamp\": \"$timestamp\",
        \"sender\": { \"id\": \"supervisor\", \"role\": \"manager\" },
        \"recipient\": { \"id\": \"$recipient\" },
        \"payload\": {
          \"subject\": \"$subject\",
          \"content\": \"$content\"
        }
      }" | python3 -m json.tool 2>/dev/null
    
    success "消息已送达！"
}

# 广播消息
broadcast() {
    local subject=$1
    local content=$2
    local urgent=${3:-false}
    
    report "广播消息：$subject"
    
    local msg_id="msg-broadcast-$(date +%s)"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    curl -s -X POST "$HUB_URL/broadcast" \
      -H "Content-Type: application/json" \
      -d "{
        \"subject\": \"$subject\",
        \"content\": \"$content\",
        \"urgent\": $urgent
      }" | python3 -m json.tool 2>/dev/null
    
    success "广播已发送！所有 Agent 都会收到。"
}

# 查看 Agent 状态
list_agents() {
    report "查询 Agent 状态..."
    
    curl -s "$HUB_URL/agents" | python3 -m json.tool 2>/dev/null || {
        error "无法连接 Hub"
        exit 1
    }
    
    success "Agent 状态已获取！"
}

# 跟踪进度
track_progress() {
    local task_id=$1
    
    report "跟踪任务进度：$task_id"
    
    # 搜索相关消息
    curl -s "$HUB_URL/messages/search?q=$task_id&limit=20" | python3 -m json.tool 2>/dev/null || {
        error "无法查询进度"
        exit 1
    }
    
    success "进度信息已获取！"
}

# 显示帮助
show_help() {
    echo "福瑞的任务管理工具"
    echo ""
    echo "用法:"
    echo "  $0 <command> [arguments]"
    echo ""
    echo "命令:"
    echo "  task <title> <description> [recipient] [priority]  分配任务"
    echo "  message <recipient> <subject> <content>            发送消息"
    echo "  broadcast <subject> <content> [urgent]             广播消息"
    echo "  agents                                             查看 Agent 状态"
    echo "  track <task_id>                                    跟踪进度"
    echo "  help                                               显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 task \"实现认证模块\" \"添加 JWT 认证\" orchestrator high"
    echo "  $0 message developer \"代码审查\" \"请审查 PR #123\""
    echo "  $0 broadcast \"项目更新\" \"Phase 1 完成\" false"
    echo "  $0 track TASK-001"
    echo ""
}

# 主程序
main() {
    local command=$1
    shift || true
    
    case "$command" in
        task)
            send_task "$@"
            ;;
        message)
            send_message "$@"
            ;;
        broadcast)
            broadcast "$@"
            ;;
        agents)
            list_agents
            ;;
        track)
            track_progress "$@"
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
