# Logger 模块使用指南

## 快速开始

```typescript
import logger from '@/lib/logger';

// 基础日志记录
logger.debug('Debug message', { data: 'value' });
logger.info('Info message', { userId: 123 });
logger.warn('Warning message', { remaining: 10 });
logger.error('Error message', error);
logger.critical('Critical failure', { system: 'database' }, error);
```

## 核心特性

### 1. 5 个日志级别

```typescript
logger.debug('开发调试');    // DEBUG = 0
logger.info('业务信息');     // INFO = 1
logger.warn('警告');         // WARN = 2
logger.error('错误');        // ERROR = 3
logger.critical('崩溃');     // CRITICAL = 4
```

### 2. JSON 格式输出

**开发环境**（带颜色和格式化）：
```
[INFO    ] 12:34:56.789 User created src/lib/agents/planner.ts:45 {
  "userId": 123,
  "email": "u***@example.com"  // 自动脱敏
}
```

**生产环境**（单行 JSON）：
```json
{"timestamp":"2025-01-11T12:34:56.789Z","level":"INFO","message":"User created","source":"src/lib/agents/planner.ts:45","context":{"userId":123,"email":"u***@example.com"}}
```

### 3. 自动敏感数据脱敏

```typescript
logger.info('User data', {
  email: 'user@example.com',      // → u***@example.com
  phone: '13812345678',           // → 138****5678
  apiKey: 'sk-abc123def456',      // → sk-******
  password: 'secret123',          // → *** (在 JSON 中)
});
```

### 4. TraceId 分布式追踪

```typescript
import { runWithTraceId, generateTraceId } from '@/lib/logger';

const traceId = generateTraceId();
await runWithTraceId(traceId, { sessionId: 'abc' }, async () => {
  // 所有 logger 调用自动包含 traceId
  logger.info('Processing');
});
```

## Agent 专用日志

```typescript
logger.agent('Planner', 'session-123', 'Evaluating', {
  completeness: 80,
  riskLevel: 'medium'
});
```

## 错误处理

```typescript
try {
  await doSomething();
} catch (error) {
  // 方式 1: 直接传递 Error 对象
  logger.error('Operation failed', error);

  // 方式 2: 带上下文
  logger.error('Operation failed', { operation: 'doSomething' }, error);

  // 方式 3: CRITICAL 级别
  logger.critical('System failure', error);
}
```

## 获取日志

```typescript
import { Logger, LogLevel } from '@/lib/logger';

const logger = new Logger({ minLevel: LogLevel.DEBUG });

// 获取所有日志
const logs = logger.getLogs();

// 按条件过滤
const errors = logger.getLogs({ level: LogLevel.ERROR });
const sessionLogs = logger.getLogs({ sessionId: 'abc' });
const agentLogs = logger.getLogs({ agent: 'Planner' });

// 清空日志
logger.clear();

// 动态调整级别
logger.setMinLevel(LogLevel.WARN);
```

## 最佳实践

### ✅ 推荐做法

```typescript
// 1. 添加有意义的上下文
logger.info('Order created', { orderId: 123, amount: 99.99 });

// 2. 在关键路径使用 TraceId
await runWithTraceId(traceId, { sessionId }, async () => {
  logger.info('Processing request');
  // ...
});

// 3. 错误必须记录
try {
  await apiCall();
} catch (error) {
  logger.error('API call failed', { endpoint: '/users' }, error);
  throw error;
}

// 4. Agent 日志包含 session
logger.agent('RiskAnalyst', sessionId, 'Analyzing risks', {
  riskCount: 3
});
```

### ❌ 避免做法

```typescript
// 不要 - 缺少上下文
logger.info('User created');

// 不要 - 循环中大量日志
for (const item of items) {
  logger.debug('Processing', { item }); // 会产生大量日志
}

// 不要 - 静默捕获
try {
  await doSomething();
} catch {
  // 什么都不做
}
```

## 配置选项

```typescript
import { Logger, LogLevel } from '@/lib/logger';

const logger = new Logger({
  minLevel: LogLevel.DEBUG,        // 最小日志级别
  enableMasking: true,             // 启用敏感数据脱敏
  enableSourceTracking: true,      // 启用源码追踪
});
```

## 完整示例

```typescript
import logger from '@/lib/logger';
import { runWithTraceId, generateTraceId } from '@/lib/logger';

// API 路由示例
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  const sessionId = request.headers.get('x-session-id') || 'unknown';

  return await runWithTraceId(traceId, { sessionId }, async () => {
    logger.info('API request received', {
      method: request.method,
      url: request.url
    });

    try {
      const body = await request.json();

      // 业务逻辑
      const result = await processRequest(body);

      logger.info('API request completed', {
        status: 200,
        duration: Date.now() - startTime
      });

      return Response.json({ success: true, data: result });
    } catch (error) {
      logger.critical('API request failed',
        { traceId, sessionId },
        error instanceof Error ? error : new Error(String(error))
      );
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

// Agent 节点示例
export async function plannerAgent(state: GraphStateType) {
  logger.agent('Planner', state.sessionId, 'Starting evaluation', {
    messageCount: state.messages.length
  });

  try {
    const result = await callLLMWithJSONByAgent<PlannerResponse>(
      'planner',
      systemPrompt,
      userMessage
    );

    logger.info('Planner completed', {
      completeness: result.completeness,
      needMoreInfo: result.needMoreInfo
    });

    return { summary: { ...state.summary, planner: result } };
  } catch (error) {
    logger.error('Planner failed', { sessionId: state.sessionId }, error);
    throw error;
  }
}
```

## 测试

```bash
# 运行 logger 单元测试
pnpm test:unit tests/unit/lib/logger/index.test.ts

# 生成覆盖率报告
pnpm test:coverage
```

## 相关文件

- `index.ts` - 核心 Logger 类
- `utils.ts` - 工具函数（格式化、脱敏、源码追踪）
- `trace.ts` - TraceId 支持
- `tests/unit/lib/logger/index.test.ts` - 单元测试
- `docs/logging-system.md` - 完整文档
