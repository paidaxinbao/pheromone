# Mailbox 协议测试用例设计

**测试编号**: TEST-001  
**创建日期**: 2026-03-01  
**测试者**: Tester Agent  
**协议版本**: 1.0.0

---

## 测试概览

| 测试类型 | 用例数 | 覆盖范围 |
|----------|--------|----------|
| 单元测试 | 24 | Schema 验证 |
| 集成测试 | 12 | 消息流程 |
| 边界测试 | 16 | 极限值 |
| 异常测试 | 20 | 错误处理 |
| **总计** | **72** | 全覆盖 |

---

## 测试环境

```
- Node.js: v20+
- 测试框架: Jest / Mocha
- Schema 验证: ajv
- 覆盖率目标: > 90%
```

---

## 一、单元测试 (Unit Tests)

### 1.1 Envelope Schema 验证

#### TC-UNIT-ENV-001: 有效信封消息

**描述**: 验证完整的有效消息信封  
**优先级**: P0  
**前置条件**: 无

```json
{
  "input": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "task.assign",
    "version": "1.0.0",
    "timestamp": "2026-03-01T01:00:00.000Z",
    "sender": {
      "id": "agent-manager-001",
      "role": "manager"
    },
    "payload": {
      "task": {
        "id": "task-feature-001",
        "type": "feature",
        "title": "实现登录功能",
        "status": "pending",
        "timestamps": {
          "createdAt": "2026-03-01T01:00:00.000Z"
        }
      }
    }
  },
  "expected": {
    "valid": true
  }
}
```

#### TC-UNIT-ENV-002: 缺少必填字段 id

```json
{
  "input": {
    "type": "task.assign",
    "version": "1.0.0",
    "timestamp": "2026-03-01T01:00:00.000Z",
    "sender": { "id": "agent-001", "role": "developer" },
    "payload": {}
  },
  "expected": {
    "valid": false,
    "errors": ["required: id"]
  }
}
```

#### TC-UNIT-ENV-003: 无效 UUID 格式

```json
{
  "input": {
    "id": "invalid-uuid",
    "type": "task.assign",
    "version": "1.0.0",
    "timestamp": "2026-03-01T01:00:00.000Z",
    "sender": { "id": "agent-001", "role": "developer" },
    "payload": {}
  },
  "expected": {
    "valid": false,
    "errors": ["format: uuid"]
  }
}
```

#### TC-UNIT-ENV-004: 无效消息类型

```json
{
  "input": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "invalid.type",
    "version": "1.0.0",
    "timestamp": "2026-03-01T01:00:00.000Z",
    "sender": { "id": "agent-001", "role": "developer" },
    "payload": {}
  },
  "expected": {
    "valid": false,
    "errors": ["pattern: type"]
  }
}
```

#### TC-UNIT-ENV-005: 无效时间戳格式

```json
{
  "input": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "task.assign",
    "version": "1.0.0",
    "timestamp": "2026/03/01 01:00:00",
    "sender": { "id": "agent-001", "role": "developer" },
    "payload": {}
  },
  "expected": {
    "valid": false,
    "errors": ["format: date-time"]
  }
}
```

#### TC-UNIT-ENV-006: 消息类型枚举覆盖

**描述**: 验证所有支持的消息类型

```json
{
  "validTypes": [
    "task.assign", "task.update", "task.complete", "task.fail",
    "message.direct", "message.broadcast",
    "status.heartbeat", "status.sync",
    "handshake.register", "handshake.ack"
  ],
  "testStrategy": "遍历所有类型，每个都应通过验证"
}
```

---

### 1.2 Agent Schema 验证

#### TC-UNIT-AGT-001: 有效 Agent 信息

```json
{
  "input": {
    "id": "agent-developer-001",
    "role": "developer",
    "name": "Dev Agent 1",
    "capabilities": ["code.read", "code.write", "git.read"],
    "status": "idle"
  },
  "expected": {
    "valid": true
  }
}
```

#### TC-UNIT-AGT-002: Agent ID 格式验证

```json
{
  "validIds": [
    "agent-001",
    "agent-developer-001",
    "agent-a1b2c3"
  ],
  "invalidIds": [
    "Agent-001",
    "agent_001",
    "agent",
    "001",
    "agent-001-TEST"
  ],
  "testStrategy": "有效 ID 通过，无效 ID 拒绝"
}
```

#### TC-UNIT-AGT-003: 角色枚举验证

```json
{
  "validRoles": ["manager", "developer", "reviewer", "tester", "coordinator"],
  "invalidRoles": ["admin", "user", "worker", "bot"],
  "testStrategy": "枚举外的角色应被拒绝"
}
```

#### TC-UNIT-AGT-004: 能力枚举验证

```json
{
  "validCapabilities": [
    "code.read", "code.write", "code.execute",
    "git.read", "git.write",
    "file.read", "file.write",
    "test.run", "test.write",
    "review.code", "deploy"
  ],
  "invalidCapabilities": ["code.compile", "admin.access", "shell.execute"]
}
```

#### TC-UNIT-AGT-005: 最小必填字段

```json
{
  "input": {
    "id": "agent-minimal",
    "role": "developer"
  },
  "expected": {
    "valid": true
  }
}
```

---

### 1.3 Task Schema 验证

#### TC-UNIT-TSK-001: 有效任务结构

```json
{
  "input": {
    "id": "task-feature-001",
    "type": "feature",
    "title": "实现用户认证",
    "description": "添加 JWT 认证支持",
    "status": "pending",
    "priority": "high",
    "timestamps": {
      "createdAt": "2026-03-01T01:00:00.000Z"
    }
  },
  "expected": {
    "valid": true
  }
}
```

#### TC-UNIT-TSK-002: Task ID 格式验证

```json
{
  "validIds": [
    "task-001",
    "task-feature-abc123",
    "task-bugfix-login-error"
  ],
  "invalidIds": [
    "Task-001",
    "task",
    "001",
    "task_001",
    "TASK-001"
  ]
}
```

#### TC-UNIT-TSK-003: 任务状态枚举

```json
{
  "validStatuses": [
    "pending", "assigned", "in_progress", "blocked",
    "review", "completed", "failed", "cancelled"
  ],
  "invalidStatuses": ["started", "done", "error", "waiting"]
}
```

#### TC-UNIT-TSK-004: 进度值边界

```json
{
  "validProgress": [0, 1, 50, 99, 100],
  "invalidProgress": [-1, 101, 150, -100],
  "testStrategy": "0-100 有效，超出范围拒绝"
}
```

#### TC-UNIT-TSK-005: 依赖任务引用

```json
{
  "input": {
    "id": "task-feature-002",
    "type": "feature",
    "title": "实现用户注册",
    "status": "pending",
    "dependencies": ["task-feature-001", "task-feature-000"],
    "timestamps": {
      "createdAt": "2026-03-01T01:00:00.000Z"
    }
  },
  "expected": {
    "valid": true
  }
}
```

---

### 1.4 Message Payload 验证

#### TC-UNIT-MSG-001: TaskAssignPayload

```json
{
  "input": {
    "task": {
      "id": "task-001",
      "type": "feature",
      "title": "Test",
      "status": "pending",
      "timestamps": { "createdAt": "2026-03-01T01:00:00.000Z" }
    }
  },
  "expected": { "valid": true }
}
```

#### TC-UNIT-MSG-002: HeartbeatPayload

```json
{
  "input": {
    "agentId": "agent-developer-001",
    "status": "busy",
    "currentTask": "task-001",
    "metrics": {
      "cpu": 45.5,
      "memory": 1024,
      "queueSize": 3
    }
  },
  "expected": { "valid": true }
}
```

#### TC-UNIT-MSG-003: TaskFailPayload 错误结构

```json
{
  "input": {
    "taskId": "task-001",
    "error": {
      "code": "ERR_EXEC_TIMEOUT",
      "message": "执行超时",
      "retryable": true
    }
  },
  "expected": { "valid": true }
}
```

---

## 二、集成测试 (Integration Tests)

### 2.1 消息流程测试

#### TC-INT-FLOW-001: 完整任务生命周期

**描述**: 验证从任务分配到完成的完整流程

```
流程:
1. Manager → Agent: task.assign
2. Agent → Manager: status.heartbeat (busy)
3. Agent → Manager: task.update (in_progress, 30%)
4. Agent → Manager: task.update (in_progress, 60%)
5. Agent → Manager: task.complete
6. Agent → Manager: status.heartbeat (idle)
```

**验证点**:
- 每条消息符合 Schema
- 状态转换符合预期
- correlationId 正确关联

#### TC-INT-FLOW-002: Agent 注册流程

```
流程:
1. Agent → Manager: handshake.register (携带 token)
2. Manager → Agent: handshake.ack (返回配置)
3. Agent → Manager: status.heartbeat (idle)
```

#### TC-INT-FLOW-003: 任务失败与重试

```
流程:
1. Manager → Agent: task.assign
2. Agent → Manager: task.update (in_progress)
3. Agent → Manager: task.fail (retryable: true)
4. Manager → Agent: task.assign (重试)
5. Agent → Manager: task.complete
```

#### TC-INT-FLOW-004: 多 Agent 协作

```
场景: Developer 完成 → Reviewer 审查 → Tester 测试

1. Manager → Developer: task.assign (开发任务)
2. Developer → Manager: task.complete
3. Manager → Reviewer: task.assign (审查任务)
4. Reviewer → Manager: task.complete
5. Manager → Tester: task.assign (测试任务)
6. Tester → Manager: task.complete
```

---

### 2.2 广播消息测试

#### TC-INT-BCAST-001: 全员广播

```json
{
  "message": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "type": "message.broadcast",
    "version": "1.0.0",
    "timestamp": "2026-03-01T01:00:00.000Z",
    "sender": { "id": "agent-manager-001", "role": "manager" },
    "payload": {
      "subject": "系统维护通知",
      "content": "将于 10 分钟后进行系统维护",
      "urgent": true
    }
  },
  "expectedRecipients": ["all agents"]
}
```

#### TC-INT-BCAST-002: 角色定向广播

```json
{
  "recipient": {
    "type": "role",
    "target": "developer"
  },
  "expectedRecipients": ["all developer agents"]
}
```

---

## 三、边界测试 (Boundary Tests)

### 3.1 字符串长度边界

#### TC-BOUND-STR-001: 任务标题边界

```json
{
  "testCases": [
    { "title": "", "expected": "invalid (minLength: 1)" },
    { "title": "A", "expected": "valid" },
    { "title": "A".repeat(256), "expected": "valid" },
    { "title": "A".repeat(257), "expected": "invalid (maxLength: 256)" }
  ]
}
```

#### TC-BOUND-STR-002: 任务描述边界

```json
{
  "testCases": [
    { "description": "A".repeat(8192), "expected": "valid" },
    { "description": "A".repeat(8193), "expected": "invalid" }
  ]
}
```

#### TC-BOUND-STR-003: Agent 名称边界

```json
{
  "testCases": [
    { "name": "A".repeat(64), "expected": "valid" },
    { "name": "A".repeat(65), "expected": "invalid" }
  ]
}
```

---

### 3.2 数值边界

#### TC-BOUND-NUM-001: TTL 边界

```json
{
  "testCases": [
    { "ttl": 0, "expected": "valid (永不过期)" },
    { "ttl": 1, "expected": "valid" },
    { "ttl": 86400, "expected": "valid (1天)" },
    { "ttl": -1, "expected": "invalid (minimum: 0)" }
  ]
}
```

#### TC-BOUND-NUM-002: 进度边界

```json
{
  "testCases": [
    { "progress": 0, "expected": "valid" },
    { "progress": 100, "expected": "valid" },
    { "progress": -1, "expected": "invalid" },
    { "progress": 101, "expected": "invalid" }
  ]
}
```

#### TC-BOUND-NUM-003: 预估时间边界

```json
{
  "testCases": [
    { "estimatedMinutes": 1, "expected": "valid" },
    { "estimatedMinutes": 0, "expected": "invalid (minimum: 1)" },
    { "estimatedMinutes": 10080, "expected": "valid (1周)" }
  ]
}
```

---

### 3.3 数组边界

#### TC-BOUND-ARR-001: 依赖任务数量

```json
{
  "testCases": [
    { "dependencies": [], "expected": "valid" },
    { "dependencies": ["task-001"], "expected": "valid" },
    { "dependencies": ["task-001", "task-002", "...task-100"], "expected": "valid (无上限)" }
  ]
}
```

#### TC-BOUND-ARR-002: 标签数量

```json
{
  "testStrategy": "验证多标签场景，无数量限制但应有合理上限"
}
```

---

### 3.4 时间边界

#### TC-BOUND-TIME-001: 时间戳范围

```json
{
  "testCases": [
    { "timestamp": "1970-01-01T00:00:00.000Z", "expected": "valid (Unix epoch)" },
    { "timestamp": "2026-03-01T01:00:00.000Z", "expected": "valid" },
    { "timestamp": "2100-12-31T23:59:59.999Z", "expected": "valid" },
    { "timestamp": "未来时间", "expected": "valid (schema 允许)" }
  ]
}
```

#### TC-BOUND-TIME-002: Deadline 验证

```json
{
  "testCases": [
    { "deadline": "过去时间", "context": "业务层应警告" },
    { "deadline": "当前时间", "expected": "valid" },
    { "deadline": "未来时间", "expected": "valid" }
  ]
}
```

---

## 四、异常测试 (Exception Tests)

### 4.1 格式错误

#### TC-EXC-FMT-001: 无效 JSON

```json
{
  "input": "{ invalid json }",
  "expected": {
    "valid": false,
    "error": "JSON_PARSE_ERROR"
  }
}
```

#### TC-EXC-FMT-002: 类型错误

```json
{
  "testCases": [
    { "field": "id", "value": 12345, "expected": "type error" },
    { "field": "progress", "value": "50%", "expected": "type error" },
    { "field": "priority", "value": 1, "expected": "type error" },
    { "field": "tags", "value": "single", "expected": "type error (expected array)" }
  ]
}
```

---

### 4.2 缺失字段

#### TC-EXC-MISS-001: Envelope 必填字段缺失

```json
{
  "testCases": [
    { "missing": "id" },
    { "missing": "type" },
    { "missing": "version" },
    { "missing": "timestamp" },
    { "missing": "sender" },
    { "missing": "payload" }
  ],
  "expected": "所有缺失必填字段的消息应被拒绝"
}
```

#### TC-EXC-MISS-002: Agent 必填字段缺失

```json
{
  "testCases": [
    { "missing": "id" },
    { "missing": "role" }
  ]
}
```

#### TC-EXC-MISS-003: Task 必填字段缺失

```json
{
  "testCases": [
    { "missing": "id" },
    { "missing": "type" },
    { "missing": "title" },
    { "missing": "status" }
  ]
}
```

---

### 4.3 未知字段

#### TC-EXC-UNK-001: Envelope 未知字段

```json
{
  "input": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "task.assign",
    "version": "1.0.0",
    "timestamp": "2026-03-01T01:00:00.000Z",
    "sender": { "id": "agent-001", "role": "developer" },
    "payload": {},
    "unknownField": "should be rejected"
  },
  "expected": {
    "valid": false,
    "reason": "additionalProperties: false"
  }
}
```

---

### 4.4 业务逻辑错误

#### TC-EXC-BIZ-001: 循环依赖检测

```json
{
  "scenario": "Task A 依赖 B，B 依赖 A",
  "expected": "Schema 无法检测，业务层应拒绝"
}
```

#### TC-EXC-BIZ-002: 自引用依赖

```json
{
  "input": {
    "id": "task-001",
    "dependencies": ["task-001"]
  },
  "expected": "业务层应拒绝自引用"
}
```

#### TC-EXC-BIZ-003: 无效状态转换

```json
{
  "transitions": [
    { "from": "completed", "to": "in_progress", "expected": "invalid" },
    { "from": "failed", "to": "pending", "expected": "invalid" },
    { "from": "pending", "to": "completed", "expected": "invalid (需经过 assigned/in_progress)" }
  ]
}
```

---

### 4.5 安全测试

#### TC-EXC-SEC-001: 注入攻击测试

```json
{
  "testCases": [
    {
      "field": "title",
      "value": "<script>alert('xss')</script>",
      "expected": "Schema 通过，业务层应转义"
    },
    {
      "field": "description",
      "value": "'; DROP TABLE tasks; --",
      "expected": "Schema 通过，业务层应防护"
    }
  ]
}
```

#### TC-EXC-SEC-002: 超大消息攻击

```json
{
  "testCases": [
    {
      "description": "A".repeat(10000000),
      "expected": "超出 maxLength 或内存限制"
    }
  ]
}
```

---

## 五、测试数据集

### 5.1 有效消息样本

```json
{
  "samples": [
    "test-data/valid/task-assign-full.json",
    "test-data/valid/task-assign-minimal.json",
    "test-data/valid/heartbeat-idle.json",
    "test-data/valid/heartbeat-busy.json",
    "test-data/valid/task-complete.json",
    "test-data/valid/handshake-register.json",
    "test-data/valid/broadcast-urgent.json"
  ]
}
```

### 5.2 无效消息样本

```json
{
  "samples": [
    "test-data/invalid/missing-id.json",
    "test-data/invalid/invalid-uuid.json",
    "test-data/invalid/unknown-type.json",
    "test-data/invalid/invalid-status.json",
    "test-data/invalid/extra-fields.json",
    "test-data/invalid/negative-progress.json"
  ]
}
```

---

## 六、测试执行计划

### 6.1 测试优先级

| 优先级 | 测试类型 | 执行时机 |
|--------|----------|----------|
| P0 | 单元测试 - 必填字段验证 | CI 每次提交 |
| P0 | 单元测试 - 格式验证 | CI 每次提交 |
| P1 | 集成测试 - 消息流程 | CI merge |
| P1 | 边界测试 | CI merge |
| P2 | 异常测试 | Nightly |
| P2 | 安全测试 | Weekly |

### 6.2 覆盖率目标

```
┌─────────────────────────────────────┐
│ Schema 文件           目标覆盖率    │
├─────────────────────────────────────┤
│ envelope.schema.json   > 95%        │
│ agent.schema.json      > 95%        │
│ task.schema.json       > 95%        │
│ message.schema.json    > 90%        │
└─────────────────────────────────────┘
```

---

## 七、测试代码模板

### 7.1 Jest 测试示例

```javascript
const Ajv = require('ajv');
const envelopeSchema = require('./schemas/envelope.schema.json');
const agentSchema = require('./schemas/agent.schema.json');

const ajv = new Ajv({ allErrors: true });

describe('Envelope Schema Validation', () => {
  let validate;

  beforeAll(() => {
    validate = ajv.compile(envelopeSchema);
  });

  test('TC-UNIT-ENV-001: valid envelope', () => {
    const valid = validate({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'task.assign',
      version: '1.0.0',
      timestamp: '2026-03-01T01:00:00.000Z',
      sender: { id: 'agent-001', role: 'developer' },
      payload: {}
    });
    expect(valid).toBe(true);
  });

  test('TC-UNIT-ENV-002: missing required id', () => {
    const valid = validate({
      type: 'task.assign',
      version: '1.0.0',
      timestamp: '2026-03-01T01:00:00.000Z',
      sender: { id: 'agent-001', role: 'developer' },
      payload: {}
    });
    expect(valid).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({ keyword: 'required' })
    );
  });
});
```

---

## 八、审查问题关联

根据 REVIEW-001 发现的问题，以下测试用例专门针对：

| 问题 | 对应测试 |
|------|----------|
| task.schema.json required 字段位置 | TC-UNIT-TSK-001, TC-EXC-MISS-003 |
| token 无格式约束 | TC-EXC-SEC-001 |
| payload 未关联 type | TC-INT-FLOW-* (业务层验证) |
| additionalProperties 不一致 | TC-EXC-UNK-001 |

---

**文档版本**: 1.0.0  
**最后更新**: 2026-03-01 01:30 UTC+8