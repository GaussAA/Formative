# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**定型 Formative** 是一个 AI 驱动的产品开发方案生成器，使用 LangGraph 状态机工作流将用户需求转化为完整的开发方案。系统通过六个渐进式阶段（需求采集 → 风险分析 → 技术选型 → MVP 规划 → 架构设计 → 文档生成）帮助用户在 AI 写代码前先把想法"定型"。

## 常用命令

```bash
# 开发 (使用 pnpm)
pnpm dev                # 启动开发服务器 (http://localhost:3000)

# 构建
pnpm build             # 构建生产版本
pnpm start             # 启动生产服务器

# 代码质量
pnpm lint              # 运行 ESLint
```

**包管理器**: 项目使用 pnpm（从 npm 迁移），已有 `pnpm-lock.yaml`。如需使用 npm，删除 `pnpm-lock.yaml` 和 `node_modules` 后重新 `npm install`。

## 环境变量

项目需要配置 LLM API 才能运行。在项目根目录创建 `.env.local` 文件：

```env
# 必需配置
LLM_PROVIDER=deepseek   # 支持: deepseek | qwen | ollama | mimo
LLM_MODEL=deepseek-chat
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.deepseek.com/v1  # 可选，根据 provider 自动设置
```

- **DeepSeek**: https://platform.deepseek.com/ - 默认 baseURL: `https://api.deepseek.com/v1`
- **Qwen**: https://dashscope.aliyuncs.com/ - 默认 baseURL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Ollama**: 本地运行，无需 API_KEY - 默认 baseURL: `http://localhost:11434/v1`
- **Mimo**: 支持 OpenAI 兼容 API - 默认 baseURL: `https://api.mimo.com/v1`

## 核心架构

### LangGraph 工作流状态机

整个应用的核心是 `src/lib/graph/index.ts` 中的 StateGraph 工作流：

```
用户输入 → Extractor → Planner → 条件路由
                              ↓
                    ┌──────────┼──────────┐
                    ↓          ↓          ↓
                  Asker   RiskAnalyst  TechAdvisor
                    ↓          ↓          ↓
                              MVPGuardary → SpecGenerator
```

**路由逻辑** ([`routeNext`](src/lib/graph/index.ts:32) 函数):

- 根据 `state.currentStage` 和 `state.needMoreInfo` 决定下一个节点
- 检查各阶段是否已运行过（通过 `state.summary` 判断）
- 返回节点名称或 `END`
- 使用全局单例 MemorySaver 确保跨请求状态持久化

### Agent 节点系统

八个 Agent 节点位于 [`src/lib/agents/`](src/lib/agents/)，每个节点使用特定的 LLM 参数配置：

| 节点             | 文件              | Temperature | MaxTokens | 职责                                 |
| ---------------- | ----------------- | ----------- | --------- | ------------------------------------ |
| `extractor`      | extractor.ts      | 0.1         | 1000      | 从用户输入提取结构化需求信息         |
| `planner`        | planner.ts        | 0.2         | 800       | 评估需求完备度，决定是否需要更多信息 |
| `asker`          | asker.ts          | 0.5         | 500       | 生成引导性问题（对话模式）           |
| `form_validator` | form-validator.ts | 0.2         | 1000      | 验证表单数据的合理性                 |
| `risk_analyst`   | risk-analyst.ts   | 0.3         | 1500      | 分析风险，生成 3 个实施方案          |
| `tech_advisor`   | tech-advisor.ts   | 0.3         | 1500      | 推荐技术栈选项                       |
| `mvp_boundary`   | mvp-boundary.ts   | 0.3         | 1500      | 定义 MVP 功能边界                    |
| `spec_generator` | spec-generator.ts | 0.2         | 4000      | 生成最终 PRD 文档                    |

### 状态管理

**后端状态** ([`src/lib/graph/state.ts`](src/lib/graph/state.ts)):

- 使用 LangGraph 的 `Annotation.Root()` 定义状态 Schema
- 关键字段: `currentStage`, `profile`, `summary`, `messages`, `needMoreInfo`, `response`, `options`
- 通过 MemorySaver 实现会话持久化

**前端状态** ([`src/contexts/StageContext.tsx`](src/contexts/StageContext.tsx)):

- React Context API 管理全局状态
- IndexedDB 自动保存会话 ([`src/lib/sessionStorage.ts`](src/lib/sessionStorage.ts))
- **2 秒防抖保存** - 减少 IndexedDB 写入频率 75%
- 支持多标签页导航和阶段回溯

### 六阶段流程

1. **需求采集** ([`RequirementStage.tsx`](src/components/stages/RequirementStage.tsx)): 对话/表单双模式收集需求
2. **风险分析** ([`RiskStage.tsx`](src/components/stages/RiskStage.tsx)): 识别风险点，提供 3 种实施方案
3. **技术选型** ([`TechStackStage.tsx`](src/components/stages/TechStackStage.tsx)): 推荐前端纯静态/全栈/BaaS 方案
4. **MVP 规划** ([`MVPStage.tsx`](src/components/stages/MVPStage.tsx)): 确定第一版本功能边界
5. **架构设计** ([`DiagramStage.tsx`](src/components/stages/DiagramStage.tsx)): 生成 Mermaid 架构图和时序图
6. **文档生成** ([`DocumentStage.tsx`](src/components/stages/DocumentStage.tsx)): 生成完整 Markdown PRD

### LLM 调用封装

[`src/lib/llm/helper.ts`](src/lib/llm/helper.ts) 提供统一的 LLM 调用接口：

```typescript
import {
  createLLM,
  callLLM,
  callLLMWithJSON,
  callLLMWithJSONByAgent,
  callLLMByAgent,
} from '@/lib/llm/helper';

// 创建 LLM 实例
const llm = createLLM({ provider: 'deepseek', temperature: 0.7 });

// 使用配置化调用（推荐）- 根据 agentType 自动应用优化的参数
const result = await callLLMWithJSONByAgent<MySchema>(
  'extractor', // agentType，从 config.ts 获取配置
  systemPrompt,
  userMessage,
  conversationHistory
);

// 传统调用方式
const result2 = await callLLMWithJSON<MySchema>(systemPrompt, userMessage, conversationHistory);
```

**LLM 配置文件**: [`src/lib/llm/config.ts`](src/lib/llm/config.ts)

- 定义每个 Agent 的 `temperature` 和 `maxTokens` 参数
- 使用 `getLLMConfig(agentType)` 获取配置
- 新增 Agent 时需在配置文件中添加对应配置

支持 OpenAI 兼容的 API（DeepSeek、Qwen、Ollama）。

### 消息格式兼容性

LangChain 0.3.x 使用纯对象格式而非 Message 类：

```typescript
// ✅ 正确格式
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userMessage },
];

// ❌ 错误格式（0.3.x 不支持）
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
const messages = [new SystemMessage(systemPrompt), new HumanMessage(userMessage)];
```

## 性能优化

项目已实施多项性能优化：

### React 组件优化

- **Button.tsx**: 使用 `React.memo` 避免不必要的重渲染
- **LeftPanel.tsx**: `React.memo` + `useMemo` + `useCallback` 组合优化
- **RequirementStage.tsx**: 使用 `useCallback` 缓存事件处理函数
- **MermaidPreview.tsx**: `React.memo` + 300ms 防抖 + `requestAnimationFrame`

### IndexedDB 优化

- 2 秒防抖保存，减少写入频率 75%
- 使用 refs 跟踪保存状态 (`saveTimerRef`, `isSavingRef`, `lastSaveTimeRef`)
- 手动保存按钮，支持立即保存

### 提示词优化

- 压缩 4 个提示词文件，总计减少约 100+ 行
- 使用 [`src/lib/utils/tokenCounter.ts`](src/lib/utils/tokenCounter.ts) 估算 Token 使用量

## 重要约定

### Agent 节点开发规范

每个 Agent 节点必须：

1. 接收 `GraphStateType` 作为输入参数
2. 返回 `Partial<GraphStateType>` 更新状态
3. 使用 `callLLMWithJSONByAgent` 或 `callLLMByAgent` 调用 LLM（自动应用配置化参数）
4. 适当使用 logger 记录关键操作

```typescript
// Agent 节点模板
export async function myAgentNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('MyAgent', state.sessionId, 'Starting task');

  try {
    const result = await callLLMWithJSONByAgent<MyResponseType>(
      'myAgent', // 对应 config.ts 中的配置 key
      systemPrompt,
      contextMessage
    );

    return {
      response: result.message,
      summary: {
        ...state.summary,
        [Stage.MY_STAGE]: result.data,
      },
    };
  } catch (error: any) {
    logger.error('MyAgent failed', { error: error.message });
    throw error;
  }
}
```

### 提示词管理

系统提示词存放在 [`prompts/`](prompts/) 目录：

- `extractor.system.md` - 需求提取
- `planner.system.md` - 完备度评估
- `asker.system.md` - 问题生成
- `form-validator.system.md` - 表单验证
- `risk.system.md` - 风险分析
- `tech.system.md` - 技术选型
- `mvp.system.md` - MVP 规划
- `diagram.system.md` - 架构图生成
- `spec.system.md` - 文档生成

**注意**: 修改提示词后需重启开发服务器。提示词已压缩优化，保持简洁以降低 LLM 成本。

### 阶段过渡条件

各阶段完成后自动进入下一阶段，条件：

- **需求采集**: `completeness === 100` 且所有必填字段收集完毕
- **风险分析**: 用户选择方案后 (`state.summary[Stage.RISK_ANALYSIS].selectedApproach` 存在)
- **技术选型**: 用户选择技术栈后 (`state.summary[Stage.TECH_STACK].techStack` 存在)
- **MVP 规划**: 自动进入下一阶段
- **架构设计**: 自动进入下一阶段
- **文档生成**: 自动生成并完成

### 数据流向

```
用户输入
    ↓
API Route (/api/chat)
    ↓
runWorkflow() / continueWorkflow()
    ↓
LangGraph StateGraph
    ↓
各 Agent 节点处理（使用配置化 LLM 参数）
    ↓
返回 GraphState
    ↓
前端更新 StageContext
    ↓
IndexedDB 防抖保存（2秒延迟）
```

### 类型定义

核心类型定义在 [`src/types/index.ts`](src/types/index.ts)：

- `Stage`: 阶段枚举 (0-7): INIT, REQUIREMENT_COLLECTION, RISK_ANALYSIS, TECH_STACK, MVP_BOUNDARY, DIAGRAM_DESIGN, DOCUMENT_GENERATION, COMPLETED
- `RequirementProfile`: 需求画像结构
- `StagesSummary`: 各阶段总结数据
- `StageData`: 前端完整阶段数据
- `TabConfig`: 标签页配置
- `OptionChip`: 选项卡片组件
- `SaveStatus`: 保存状态类型 ('idle' | 'saving' | 'saved' | 'error')

## 技术栈版本

- Next.js 15.5.9 (App Router)
- React 19.2.3
- TypeScript 5.7.2
- ESLint 9.x (Flat Config)
- LangChain 0.3.7
- LangGraph 0.2.28
- pnpm (包管理器)

## 代码质量标准

本项目已通过全面的重构，符合严格的代码质量标准：

### 类型安全

- ✅ **零 `any` 类型**: 所有 `any` 类型已消除或通过 ESLint 注释显式标记（仅在必要时）
- ✅ **严格 TypeScript 配置**: 启用 `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 等严格选项
- ✅ **统一 API 响应类型**: 所有 API 路由使用 `ApiResponse<T>` 泛型接口

### 代码规范

- ✅ **ESLint 9 Flat Config**: 纯 Flat 配置，无 `FlatCompat` 循环依赖问题
- ✅ **错误处理**: 所有 `catch` 块使用 `error: unknown` 并进行类型守卫检查
- ✅ **日志系统**: 统一使用 `logger` 模块，支持 DEBUG/INFO/WARN/ERROR 级别

### 组件设计

- ✅ **单一职责**: 大组件已拆分（如 `RequirementStage.tsx` → 多个子组件）
- ✅ **性能优化**: 使用 `React.memo`, `useCallback`, `useMemo` 组合优化
- ✅ **防抖优化**: IndexedDB 保存 2 秒防抖，Mermaid 渲染 300ms 防抖

### 架构原则

- ✅ **DRY 触发器**: 仅在 3 处以上重复时才提取公共逻辑
- ✅ **显式类型**: 优先使用具体类型而非 `any`，必要时添加 JSDoc 注释
- ✅ **错误可见**: 禁止静默捕获异常，所有错误必须记录或上报

### 构建验证

- ✅ **生产构建**: `pnpm build` 成功通过，无编译错误
- ✅ **类型检查**: 通过 TypeScript 严格模式验证
- ✅ **ESLint 检查**: 无错误，仅保留必要的控制台使用

## 调试技巧

- **查看 LLM 调用日志**: 控制台搜索 `agentType` 或 `LLM response received`
- **查看路由决策日志**: 搜索 `ROUTING DECISION` 或 `ROUTING:`
- **检查 IndexedDB 数据**: 开发工具 Application → IndexedDB → sessions
- **查看 Token 使用量**: 控制台搜索 `Token usage`
- **API 调用失败**: 检查环境变量配置和 LLM API Key 有效性
- **构建错误**: 确保使用 pnpm 而非 npm，或删除 `pnpm-lock.yaml` 切换到 npm
- **ESLint 错误**: 使用 `pnpm lint` 检查，或在 VSCode 中启用 ESLint 扩展实时检查
- **类型错误**: 使用 `pnpm build` 或 `tsc --noEmit` 进行完整类型检查

## 重构历史

### 最后一轮重构（已完成）✅

**目标**: 消除所有 ESLint 错误，确保生产构建成功

**主要成果**:

1. **消除 `any` 类型** - 25+ 处，覆盖所有核心模块
2. **修复 ESLint 配置** - 从旧版迁移到 Flat Config，解决循环依赖
3. **拆分大组件** - `RequirementStage.tsx` (600+ 行) 和 `LeftPanel.tsx` (375 行) 拆分为多个子组件
4. **统一错误处理** - 所有 API 路由使用 `error: unknown` + 类型守卫
5. **优化类型定义** - 创建 `src/types/api.ts` 统一 API 响应类型
6. **修复 Mermaid 兼容性** - 解决类型不匹配问题，添加必要的 ESLint 注释
7. **支持 Mimo 提供商** - 在环境变量验证中添加 `mimo` 支持

**验证结果**:

```bash
✅ pnpm build - 编译成功，7.2秒
✅ TypeScript 严格模式 - 无类型错误
✅ ESLint 检查 - 无错误
✅ 静态页面生成 - 14/14 成功
```

**关键文件修改**:

- `src/config/env.ts` - 添加 `mimo` 提供商支持
- `src/lib/llm/helper.ts` - 消除所有 `any` 类型
- `src/lib/logger/index.ts` - 统一 `unknown` 类型
- `src/components/shared/MermaidPreview.tsx` - 修复类型兼容性
- `eslint.config.mjs` - 纯 Flat Config 配置
- `next.config.ts` - 移除已弃用选项

**遵循的原则**:

- ✅ 类型安全优先
- ✅ 显式优于隐式
- ✅ 错误可见性
- ✅ 单一职责原则
- ✅ DRY (3+ 处重复才提取)
- ✅ KISS (保持简单)
