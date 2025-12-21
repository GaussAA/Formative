# 定型 Formative

> **不是 AI 不行，是需求没定型**
> 在让 AI 写第一行代码之前，先让你的想法变成可执行的开发方案

![Hero Image](./docs/images/hero.png)
<!-- 请在 docs/images/ 目录下添加 hero.png 截图 -->

---

## 📖 项目简介

**定型 Formative** 是一个 AI 驱动的产品开发方案生成器，专注于解决 VibeCoding 的"最前一公里"问题。

大多数人使用 AI 写代码失败，并不是因为 AI 不会写代码，**而是因为一开始就说不清楚自己想要什么**。

定型通过六个结构化阶段，帮助你：
- 📝 把一句白话需求，拆解成完整的工程问题
- ⚠️ 暴露潜在风险，并给出可选方案
- 🔧 确定适合你的技术栈，而不是"看起来最酷的那种"
- 📋 明确 MVP 边界，知道做什么、不做什么
- 🎨 自动生成架构图和时序图
- 📄 生成一份 AI 能真正执行的开发方案文档

**你不需要懂架构、不需要会数据库，你只需要回答问题、做选择。剩下的复杂度，由定型替你承担。**

---

## ✨ 核心价值

### 问题：不是 AI 不行，是人没准备好
用户往往只有一句话的想法：
- "我想做一个 App"
- "我想搞个 AI 工具"
- "能不能帮我写个网站"

于是 AI 开始猜，用户开始改；AI 不断生成，用户不断推倒。最后的结果通常只有三种：
- 项目越写越乱
- 出了错也看不懂
- 只能不停地说一句话："不对，改一下"

**问题不在代码，而在"需求没有定型"。**

### 转折：定型，发生在写代码之前
定型不是一个写代码的工具，它存在于 VibeCoding 的**最前一公里**。

在你让 AI 开始写第一行代码之前，定型会做三件关键的事：
1. 把一句白话需求，拆解成完整的工程问题
2. 暴露潜在风险，并给出可选方案
3. 帮你做出适合你的技术决策

### 结果：你第一次拥有"AI 能真正执行的方案"
当你完成定型流程，你最终拿到的不是聊天记录，而是：
- 📋 明确边界的 MVP 定义
- 🔧 已确定技术栈的开发方案
- 🎨 清晰的架构图和时序图
- 📊 必要的技术说明（数据库/API/部署配置）
- 📄 完整的开发文档（可以直接交给 AI 执行）

这意味着：
- ✓ AI 不再自由发挥
- ✓ 你不再反复推倒重来
- ✓ VibeCoding 变成一个可控、可推进的过程

---

## 🚀 快速开始

### 1. 环境要求
- **Node.js**: >= 18.0
- **LLM API**: DeepSeek / Qwen / Ollama

### 2. 安装依赖

```bash
# 克隆项目
git clone https://github.com/jaguarliuu/Formative.git
cd Formative

# 安装依赖
npm install
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```bash
# LLM 配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 或使用其他提供商
# QWEN_API_KEY=your_qwen_api_key
# OLLAMA_BASE_URL=http://localhost:11434
```

### 4. 启动应用

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可开始使用。

---

## 📱 使用指南

### 工作流程概览

定型采用**六阶段渐进式流程**，从需求到方案逐步细化：

```
需求采集 → 风险分析 → 技术选型 → MVP规划 → 架构设计 → 文档生成
```

每个阶段完成后，会自动进入下一阶段，你也可以通过顶部标签页随时查看和编辑已完成的阶段。

---

### 阶段 1：需求采集 📝

**目标**：完整收集产品需求，达到 100% 完备度

**两种模式可选：**

#### 对话模式（推荐）
- AI 通过对话引导你逐步补全需求
- 可以选择 AI 提供的选项卡片，或自由输入文本
- 左侧面板实时显示已收集的信息和完备度进度
- 所有已收集信息都可以点击铅笔图标进行编辑

#### 表单模式（快速）
- 一次性填写完整表单
- 适合需求已经明确的用户
- 填写后系统会自动验证并过渡到下一阶段

**必须收集的信息：**
- ✅ 产品目标（要解决什么问题）
- ✅ 目标用户（谁会使用）
- ✅ 核心功能（至少 1 个）
- ✅ 数据存储需求（是/否）
- ✅ 多用户功能（是/否）
- ✅ 用户登录认证（是/否）

**完成条件**：所有必填字段都收集完毕，完备度达到 100%

---

### 阶段 2：风险分析 ⚠️

**目标**：识别潜在风险，选择合适的实施方案

**AI 会分析：**
- 🔴 高风险点（技术难度、成本、时间等）
- 🟡 中风险点
- 🟢 低风险点

**系统提供 3 种方案对比：**
1. **激进方案** - 功能完整，风险较高
2. **平衡方案** - 功能适中，风险可控（推荐）
3. **保守方案** - 功能精简，快速上线

**你需要做的：**
- 查看每个方案的优缺点、实施成本、适用场景
- 选择一个最符合你当前情况的方案
- 点击"选择此方案"按钮确认

---

### 阶段 3：技术选型 🔧

**目标**：选择适合你的技术栈

**基于你的需求和风险方案，AI 会推荐 3 种技术栈选项：**

1. **前端纯静态方案**
   - 优点：最简单，无需后端，成本低
   - 缺点：功能受限，无法实现复杂业务逻辑
   - 适用：纯展示类、工具类应用

2. **全栈方案**
   - 优点：功能完整，灵活可控
   - 缺点：开发成本高，需要运维
   - 适用：需要复杂业务逻辑和数据处理

3. **BaaS 方案（Backend as a Service）**
   - 优点：快速上线，减少后端开发
   - 缺点：依赖第三方，可能有供应商锁定
   - 适用：快速验证想法，早期产品

**每个方案包含：**
- 前端框架（React / Vue）
- 后端技术（Node.js / Python）
- 数据库（MySQL / PostgreSQL / MongoDB）
- 部署方式（Vercel / 云服务器）

**你需要做的：**
- 对比三个方案的优缺点
- 考虑自己的技术背景和项目周期
- 选择一个技术栈

---

### 阶段 4：MVP 规划 📋

**目标**：明确第一版本（MVP）的功能边界

**AI 会：**
- 列出所有可能的功能清单
- 标注哪些功能应该在 MVP 中实现
- 标注哪些功能可以延后到未来版本

**功能分类：**
- ✅ **MVP 核心功能** - 第一版必须有的功能
- 📦 **未来功能** - 可以延后的功能
- 🚫 **非目标** - 明确不做的事情

**你需要做的：**
- 查看 AI 的建议
- 可以调整功能的优先级
- 确认 MVP 边界，明确"做什么"和"不做什么"

---

### 阶段 5：架构设计 🎨

**目标**：可视化系统架构，生成技术图表

**系统自动生成：**

1. **架构图 (Architecture Diagram)**
   - 展示系统的整体架构
   - 包含：前端、后端、数据库、第三方服务
   - 使用 Mermaid 图表语法

2. **时序图 (Sequence Diagram)**
   - 展示关键业务流程的交互时序
   - 例如：用户登录流程、数据提交流程
   - 使用 Mermaid 图表语法

**功能：**
- 📊 实时渲染 Mermaid 图表
- ✏️ 可以编辑图表代码
- 💾 保存修改后的图表
- 📋 复制图表代码

---

### 阶段 6：文档生成 📄

**目标**：生成完整的产品需求文档（PRD）

**文档包含 9 个章节：**

1. **项目概述**
   - 产品名称、目标、目标用户
   - 核心价值主张

2. **需求分析**
   - 用户需求
   - 使用场景
   - 核心功能列表

3. **技术方案**
   - 技术栈选择
   - 架构设计
   - 技术难点和解决方案

4. **功能设计**
   - MVP 功能详细说明
   - 功能优先级
   - 未来规划

5. **数据模型**
   - 数据库设计
   - 核心数据表结构

6. **API 设计**
   - 关键 API 接口列表
   - 请求/响应格式

7. **部署方案**
   - 部署环境
   - 部署流程
   - 监控和维护

8. **风险与应对**
   - 已识别的风险点
   - 应对措施

9. **项目排期**
   - 开发阶段划分
   - 里程碑和交付物

**功能：**
- 📄 Markdown 格式，AI 友好
- 📋 一键复制整个文档
- 💾 下载为 `.md` 文件
- ✏️ 可以在线编辑

**使用场景：**
- 直接复制给 Cursor、Claude Code、Windsurf 等 AI 编程工具
- 作为团队沟通的技术文档
- 作为开发的参考蓝图

---

## 🎯 适用场景

定型适合以下人群和场景：

✅ **非技术创业者**
有想法但不懂技术，需要把想法转化成技术方案

✅ **产品经理**
需要快速输出 PRD 和技术选型建议

✅ **独立开发者**
想在开发前理清思路，避免中途推倒重来

✅ **AI 编程爱好者**
使用 Cursor、Claude Code、Windsurf 等工具前，先生成清晰的方案文档

✅ **技术顾问**
需要快速为客户生成可行性分析和技术方案

---

## 🔧 技术栈

### 前端框架
- **Next.js 15** - App Router, React Server Components
- **React 19** - 最新版本，支持 Hooks 和 Context API
- **TypeScript** - 类型安全
- **Tailwind CSS** - 原子化 CSS

### 状态管理
- **React Context API** - 全局状态管理
- **IndexedDB** - 浏览器本地会话持久化

### LLM 集成
- **LangChain** - LLM 编排框架
- **LangGraph** - 工作流状态机
- **DeepSeek API** - 默认 LLM（可配置其他模型）

### 可视化
- **Mermaid.js** - 架构图和时序图渲染

### 工程化
- **ESLint + Prettier** - 代码规范
- **pnpm / npm** - 包管理

---

## 📂 项目结构

```
Formative/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # 首页（Hero Page）
│   │   ├── main/              # 主应用页面
│   │   └── api/               # API 路由
│   │       ├── chat/          # 需求采集对话
│   │       ├── form-submit/   # 表单提交
│   │       ├── analyze-risks/ # 风险分析
│   │       ├── tech-stack/    # 技术选型
│   │       ├── mvp-plan/      # MVP 规划
│   │       ├── generate-diagrams/ # 架构图生成
│   │       └── generate-spec/ # 文档生成
│   │
│   ├── components/            # React 组件
│   │   ├── stages/           # 六个阶段组件
│   │   │   ├── RequirementStage.tsx  # 需求采集
│   │   │   ├── RiskStage.tsx         # 风险分析
│   │   │   ├── TechStackStage.tsx    # 技术选型
│   │   │   ├── MVPStage.tsx          # MVP 规划
│   │   │   ├── DiagramStage.tsx      # 架构设计
│   │   │   └── DocumentStage.tsx     # 文档生成
│   │   └── shared/           # 共享组件
│   │       ├── Button.tsx
│   │       ├── LeftPanel.tsx  # 左侧需求面板
│   │       └── SkeletonLoader.tsx
│   │
│   ├── contexts/             # React Context
│   │   └── StageContext.tsx  # 全局状态管理
│   │
│   ├── lib/                  # 核心业务逻辑
│   │   ├── agents/          # LangGraph Agents
│   │   │   ├── extractor.ts      # 信息提取
│   │   │   ├── planner.ts        # 完备度评估
│   │   │   ├── asker.ts          # 问题生成
│   │   │   ├── risk-analyst.ts   # 风险分析
│   │   │   ├── tech-advisor.ts   # 技术建议
│   │   │   ├── mvp-boundary.ts   # MVP 规划
│   │   │   └── spec-generator.ts # 文档生成
│   │   │
│   │   ├── graph/           # LangGraph 工作流
│   │   │   ├── index.ts     # 工作流编排
│   │   │   └── state.ts     # 状态定义
│   │   │
│   │   ├── llm/             # LLM 调用封装
│   │   │   └── helper.ts
│   │   │
│   │   ├── prompts/         # 提示词管理
│   │   │   └── index.ts
│   │   │
│   │   ├── storage/         # IndexedDB 封装
│   │   │   └── sessionStore.ts
│   │   │
│   │   └── logger.ts        # 日志工具
│   │
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   │
│   └── utils/               # 工具函数
│       └── projectNameGenerator.ts
│
├── prompts/                 # LLM 系统提示词
│   ├── extractor.system.md
│   ├── planner.system.md
│   ├── asker.system.md
│   ├── risk-analyst.system.md
│   ├── tech-advisor.system.md
│   ├── mvp.system.md
│   ├── diagram.system.md
│   └── spec.system.md
│
├── docs/                    # 项目文档
│   ├── FormativePrd.md     # 产品需求文档
│   ├── MultiTabDesign.md   # 多标签设计文档
│   └── PROGRESS.md         # 项目进度
│
└── public/                  # 静态资源
```

---

## 🎨 核心特性

### 1. 双模式需求采集
- **对话模式**：AI 引导式提问，适合需求不明确的场景
- **表单模式**：一次性填写，适合需求已经清晰的场景
- 两种模式可随时切换

### 2. 可编辑的需求面板
- 所有已收集的需求信息都可以手动编辑
- 支持编辑文本字段和数组字段
- 修改实时同步到全局状态

### 3. 会话持久化
- 基于 IndexedDB 实现浏览器本地存储
- 刷新页面不会丢失数据
- 支持多个会话的历史记录

### 4. 多标签导航
- 顶部标签页展示所有阶段
- 已完成的阶段可以随时回看和编辑
- 未完成的阶段显示为锁定状态

### 5. 实时进度追踪
- 左侧面板显示需求收集的完备度（0-100%）
- 每个阶段都有明确的完成标志
- 可视化的进度条

### 6. 智能工作流编排
- 基于 LangGraph 的状态机管理
- 自动判断阶段过渡条件
- 支持条件路由和循环检测

### 7. Markdown 文档导出
- 所有文档都是 Markdown 格式
- 可以直接复制或下载
- 格式友好，AI 可读性强

---

## 🏗️ 架构设计

### 工作流架构

定型基于 **LangGraph** 实现状态机工作流，每个阶段由专门的 Agent 负责：

```
用户输入
    ↓
Extractor (信息提取)
    ↓
Planner (完备度评估)
    ↓
[条件路由]
    ├─→ Asker (继续提问) → 等待用户输入
    ├─→ Risk Analyst (风险分析) → 等待用户选择方案
    ├─→ Tech Advisor (技术建议) → 等待用户选择技术栈
    ├─→ MVP Boundary (MVP 规划) → 自动进入下一阶段
    ├─→ Diagram Generator (架构设计) → 自动进入下一阶段
    └─→ Spec Generator (文档生成) → 完成
```

### Agent 职责划分

| Agent | 职责 | 输入 | 输出 |
|-------|------|------|------|
| **Extractor** | 从用户输入中提取结构化信息 | 用户消息 | 更新后的需求画像 |
| **Planner** | 评估需求完备度，决定下一步 | 当前需求画像 | 完备度、缺失字段、是否需要更多信息 |
| **Asker** | 生成引导性问题和选项 | 缺失字段 | 问题文本、选项卡片 |
| **Risk Analyst** | 分析风险并生成方案对比 | 完整需求画像 | 风险列表、3 个实施方案 |
| **Tech Advisor** | 推荐技术栈选项 | 需求画像、风险方案 | 3 个技术栈选项 |
| **MVP Boundary** | 定义 MVP 边界 | 需求画像、技术栈 | MVP 功能列表、非目标 |
| **Diagram Generator** | 生成架构图和时序图 | 技术栈、MVP 功能 | Mermaid 图表代码 |
| **Spec Generator** | 生成完整 PRD 文档 | 所有阶段汇总 | Markdown 文档 |

---

## 📚 文档

- [产品需求文档 (PRD)](./docs/FormativePrd.md)
- [多标签设计文档](./docs/MultiTabDesign.md)
- [项目进度文档](./docs/PROGRESS.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 如何贡献

1. Fork 本项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 开发指南

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

---

## 🐛 常见问题

### 1. LLM API 配置错误
**问题**：提示 "❌ LLM配置错误：请检查.env文件中的API密钥配置"

**解决方案**：
- 检查 `.env.local` 文件是否存在
- 确认 `DEEPSEEK_API_KEY` 已正确配置
- 确认 API key 有效且有额度

### 2. 会话数据丢失
**问题**：刷新页面后数据丢失

**解决方案**：
- 检查浏览器是否支持 IndexedDB
- 清除浏览器缓存后重试
- 检查是否在无痕模式下使用（IndexedDB 可能受限）

### 3. 图表渲染失败
**问题**：架构图或时序图无法显示

**解决方案**：
- 检查 Mermaid 代码语法是否正确
- 尝试编辑图表代码并重新保存
- 检查浏览器控制台是否有错误信息

---

## 📄 许可证

MIT License

---

## 💬 联系方式

- **项目地址**: [GitHub](https://github.com/jaguarliuu/formative)
- **反馈建议**: 通过 GitHub Issues 提交
- **技术交流**: 欢迎在 Discussions 中讨论

---

## 🌟 致谢

感谢以下开源项目和社区：
- [Next.js](https://nextjs.org/) - React 框架
- [LangChain](https://www.langchain.com/) - LLM 应用框架
- [LangGraph](https://langchain-ai.github.io/langgraph/) - 工作流编排
- [Mermaid](https://mermaid.js.org/) - 图表渲染
- [DeepSeek](https://www.deepseek.com/) - LLM 服务

---

**准备好让你的想法定型了吗？**
5 分钟，从一句话到完整方案。

[开始使用 →](http://localhost:3000)
