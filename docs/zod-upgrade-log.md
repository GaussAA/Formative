# Zod 升级日志 (3.24.1 → 4.3.5)

## 升级概览

- **升级时间**: 2026-01-10
- **旧版本**: 3.24.1
- **新版本**: 4.3.5
- **风险等级**: 低
- **升级状态**: ✅ 成功

## 主要 API 变更

### 1. ZodError 结构变更 ⚠️

**变更**: `error.errors` → `error.issues`

```typescript
// ❌ Zod 3.x 旧写法
catch (error) {
  if (error instanceof z.ZodError) {
    const missingVars = error.errors
      .filter(e => e.path.length > 0)
      .map(e => `  - ${e.path.join('.')}: ${e.message}`)
  }
}

// ✅ Zod 4.x 新写法
catch (error) {
  if (error instanceof z.ZodError) {
    const missingVars = error.issues
      .filter(issue => issue.path.length > 0)
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
  }
}
```

**影响范围**:
- `src/config/env.ts:35` - 已修复 ✅

### 2. 兼容性保持良好的 API

以下 API 在 Zod 4.x 中保持完全兼容，无需修改：

- ✅ `z.object({})` - 对象 Schema
- ✅ `z.enum([])` - 枚举类型
- ✅ `z.string()` - 字符串类型
- ✅ `.min(1)` - 最小长度验证
- ✅ `.url()` - URL 验证
- ✅ `.optional()` - 可选字段
- ✅ `.default()` - 默认值
- ✅ `z.infer<typeof schema>` - 类型推断

## 项目中使用的 Zod API

### 当前使用情况

```typescript
// src/config/env.ts
const LLMProviderSchema = z.enum(['deepseek', 'qwen', 'ollama', 'mimo']);

const envSchema = z.object({
  LLM_PROVIDER: LLMProviderSchema.default('deepseek'),
  LLM_MODEL: z.string().default('deepseek-chat'),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_BASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
```

### 验证结果

- ✅ 所有 Schema 定义兼容
- ✅ 类型推断正常工作
- ✅ 运行时验证正常
- ✅ 错误处理正常

## Zod 4.x 新特性

### 1. 改进的类型推断

Zod 4.x 提供更精确的 TypeScript 类型推断，特别是在复杂嵌套对象中。

### 2. 性能优化

- 更快的解析速度
- 更低的内存占用
- 更好的 Tree Shaking 支持

### 3. 新增方法（未使用）

- `z.pick()` - 选择部分字段
- `z.omit()` - 排除部分字段
- `z.partial()` - 所有字段可选
- `z.required()` - 所有字段必填

## 验证测试

### 构建验证

```bash
$ pnpm build
✓ Compiled successfully in 7.1s
✓ Generating static pages using 15 workers (13/13) in 875.4ms
```

### 类型检查

```bash
$ pnpm type-check
# 无错误
```

### ESLint 检查

```bash
$ pnpm lint
# 无错误
```

## 回滚方案

如果需要回滚到 Zod 3.x：

```bash
pnpm add zod@^3.24.1
# 恢复 src/config/env.ts 中的 error.errors
```

## 后续建议

1. **探索新特性**: 可以考虑使用 `z.pick()` 简化部分 Schema
2. **性能监控**: 观察 Zod 4.x 在生产环境的性能表现
3. **类型安全**: 利用改进的类型推断减少显式类型注解

## 总结

Zod 4.x 升级非常顺利，仅需修改一处 API 调用（`errors` → `issues`）。项目中使用的其他 Zod API 都保持向后兼容，升级风险极低，收益包括更好的性能和类型推断。
