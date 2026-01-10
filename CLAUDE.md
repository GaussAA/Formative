# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**定型 Formative** 是一个 AI 驱动的产品开发方案生成器，使用 LangGraph 状态机工作流将用户需求转化为完整的开发方案。系统通过六个渐进式阶段（需求采集 → 风险分析 → 技术选型 → MVP 规划 → 架构设计 → 文档生成）帮助用户在 AI 写代码前先把想法"定型"。

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器 (http://localhost:3000)

# 构建
npm run build           # 构建生产版本
npm start               # 启动生产服务器

# 代码质量
npm run lint            # 运行 ESLint
```

## 环境变量

项目需要配置 LLM API 才能运行。在项目根目录创建 `.env.local` 文件：

```env
# 必需配置
LLM_PROVIDER=deepseek   # 支持: deepseek | qwen | ollama
LLM_MODEL=deepseek-chat
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.deepseek.com/v1
```

- **DeepSeek**: https://platform.deepseek.com/
- **Qwen**: https://dashscope.aliyuncs.com/
- **Ollama**: 本地运行，无需 API_KEY

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

### Agent 节点系统

七个 Agent 节点位于 [`src/lib/agents/`](src/lib/agents/)：

| 节点             | 文件              | 职责                                 |
| ---------------- | ----------------- | ------------------------------------ |
| `extractor`      | extractor.ts      | 从用户输入提取结构化需求信息         |
| `planner`        | planner.ts        | 评估需求完备度，决定是否需要更多信息 |
| `asker`          | asker.ts          | 生成引导性问题（对话模式）           |
| `risk_analyst`   | risk-analyst.ts   | 分析风险，生成 3 个实施方案          |
| `tech_advisor`   | tech-advisor.ts   | 推荐技术栈选项                       |
| `mvp_boundary`   | mvp-boundary.ts   | 定义 MVP 功能边界                    |
| `spec_generator` | spec-generator.ts | 生成最终 PRD 文档                    |

### 状态管理

**后端状态** ([`src/lib/graph/state.ts`](src/lib/graph/state.ts)):

- 使用 LangGraph 的 `Annotation.Root()` 定义状态 Schema
- 关键字段: `currentStage`, `profile`, `summary`, `messages`, `needMoreInfo`
- 通过 MemorySaver 实现会话持久化

**前端状态** ([`src/contexts/StageContext.tsx`](src/contexts/StageContext.tsx)):

- React Context API 管理全局状态
- IndexedDB 自动保存会话 ([`src/lib/sessionStorage.ts`](src/lib/sessionStorage.ts))
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
import { createLLM, callLLM, callLLMWithJSON } from "@/lib/llm/helper";

// 创建 LLM 实例
const llm = createLLM({ provider: "deepseek", temperature: 0.7 });

// 调用并解析 JSON 响应
const result = await callLLMWithJSON<MySchema>(
  systemPrompt,
  userMessage,
  conversationHistory
);
```

支持 OpenAI 兼容的 API（DeepSeek、Qwen、Ollama）。

## 重要约定

### Agent 节点开发规范

每个 Agent 节点必须：

1. 接收 `GraphStateType` 作为输入参数
2. 返回 `Partial<GraphStateType>` 更新状态
3. 通过 `callLLM` 或 `callLLMWithJSON` 调用 LLM
4. 适当使用 logger 记录关键操作

### 提示词管理

系统提示词存放在 [`prompts/`](prompts/) 目录：

- `extractor.system.md`
- `planner.system.md`
- `asker.system.md`
- `risk.system.md`
- `tech.system.md`
- `mvp.system.md`
- `diagram.system.md`
- `spec.system.md`

修改提示词后需重启开发服务器。

### 阶段过渡条件

各阶段完成后自动进入下一阶段，条件：

- **需求采集**: `completeness === 100` 且所有必填字段收集完毕
- **风险分析**: 用户选择方案后 (`state.summary.riskAnalysis.selectedApproach` 存在)
- **技术选型**: 用户选择技术栈后
- **MVP 规划**: 用户确认 MVP 边界后
- **架构设计**: 自动生成图表
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
各 Agent 节点处理
    ↓
返回 GraphState
    ↓
前端更新 StageContext
    ↓
IndexedDB 自动保存
```

## 类型定义

核心类型定义在 [`src/types/index.ts`](src/types/index.ts)：

- `Stage`: 阶段枚举 (0-7)
- `RequirementProfile`: 需求画像结构
- `StagesSummary`: 各阶段总结数据
- `StageData`: 前端完整阶段数据
- `TabConfig`: 标签页配置

## 调试技巧

- 查看浏览器控制台日志（所有 logger 输出）
- 检查 IndexedDB 中的会话数据（开发工具 Application → IndexedDB）
- 查看 LangGraph 路由决策日志（包含 `ROUTING` 关键字）
- API 调用失败时检查环境变量配置和 LLM API Key 有效性
