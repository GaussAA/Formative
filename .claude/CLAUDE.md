# CLAUDE.md — 全局开发宪法

## 一、 核心准则 (Core Principles)

- **语言偏好**：对话交互、需求分析、说明文档统一使用 **中文**；代码注释、技术文档、Git Commit 使用 **英文**。
- **能力优先**：优先调用系统 Skill/Tools 处理任务（如文件读写、搜索、测试运行，技术栈选择等）。
- **代码优先**：优先通过代码了项目实际情况，项目的文档仅供参考补充。
- **LTS 支持**：优先使用最新的 LTS 技术栈，在确保系统的稳定性的前提下合理使用新特性提高体验。
- **架构哲学**：
  - **前后端分离**：天然解耦，API 驱动。
  - **Monorepo 组织**：单一仓库管理多个包（如apps/packages），利用工具（如 Turborepo, Nx, pnpm workspace）优化依赖。
  - **可读性 > 简洁性 > 性能**：代码是写给人看的，禁止使用晦涩的 One-liners。
  - **显式胜于隐式**：严禁元编程黑魔法，确保静态分析工具（LSP）能准确跳转。

---

## 二、 编码规范 (Coding Standards)

### 1. 逻辑与结构 (KISS & SOLID)

- **函数约束**：原则上单个函数不超过 **50 行**。
- **深度限制**：严禁嵌套超过 **3 层**。
- **早退模式 (Guard Clauses)**：

  ```typescript
  // 推荐
  if (!user) return;
  if (!hasPermission) throw new Error('...');
  doSomething();
  ```

- **解耦冗余权衡**：若抽象会导致不相关的模块产生硬耦合，优先选择代码冗余。

### 2. 类型安全 (Type Safety)

- **禁止 `any**`类型**：所有未知类型必须使用 `unknown` 并配合类型守卫（Type Guards）。
- **契约优先**：所有外部输入（API、用户输入）必须有 `interface` 或 `schema`（如 Zod, Yup）。
- **副作用标注**：所有异步或产生副作用的函数必须明确定义返回类型 `Promise<T>`。

### 3. 错误处理 (Error Handling)

- **禁止静默捕获**：`catch` 块必须至少包含日志上报（Error level）。
- **结构化异常**：使用自定义异常类，包含错误码（ErrorCode）和上下文数据。

---

## 三、 工程化与质量保证 (Engineering & QA)

### 1. TDD 流程 (Red-Green-Refactor)

- **步骤**：先在 `tests/` 编写失败测试 -> 实现最小化功能使测试通过 -> 重构代码。
- **模式**：遵循 **AAA 模式** (Arrange, Act, Assert)。
- **隔离**：单元测试严禁依赖真实数据库或外部网络，必须使用 Mock。

### 2. 可观测性日志 (Logging)

- **格式**：统一使用 **JSON** 格式。
- **日志持久化**：日志文件必须存储在 `logs/` 目录下，并按天分割。
- **标准字段**：`timestamp`, `level`, `message`, `source`, `context`, `traceId`。
- **级别规范**：
  | 级别 | 场景 |
  | :--- | :--- |  
  | **DEBUG** | 开发环境下的详细运行轨迹 |
  | **INFO** | 关键业务路径（如：订单已创建） |
  | **WARN** | 可恢复的异常（如：网络重试） |
  | **ERROR** | 需人工介入的错误（如：数据库断开） |
  | **CRITICAL** | 系统级崩溃 |

### 3. 安全编码 (Security)

- **输入过滤**：对所有输入进行白名单验证。
- **敏感数据**：日志记录时必须对手机号、邮箱、密码进行脱敏处理（Masking）。
- **配置解耦**：`.env` 仅存储非敏感开发配置，生产敏感词使用 Secrets 管理器。

### 4. 测试原则 (Testing Principles)

- **不掩盖问题**：测试用例失败先考虑是否是代码问题，再考虑是否是测试用例问题。
- **覆盖率**：单元测试覆盖率目标不低于 80%。
- **独立性**：测试用例之间相互独立，不依赖外部状态。
- **可读性**：测试用例必须有描述性，便于定位问题。

---

## 四、 交互与协作流程 (Workflow)

### 1. Git 分支管理

- **任务隔离**：开始新任务前创建 `feat-xxx` 或 `fix-xxx` 分支。
- **原子提交**：一次提交只解决一个问题，解决一个问题就提交一次。

### 2. Commit Message 规范

格式：`<type>(<scope>): <description>`

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档变更
- `style`: 格式化（不影响逻辑）
- `refactor`: 重构
- `test`: 增加/修改测试
- `chore`: 构建过程或辅助工具的变动

---

## 五、 部署与运维 (Ops)

- **基础设施持久化**：基础设施（如数据库、缓存、消息队列、模型）必须持久化存储，统一存放于 `infra/` 目录下。
- **容器化**：所有服务必须提供 `Dockerfile`，且镜像包含完整运行环境。
- **CI/CD**：每次 Push 必须触发代码风格检查（Lint）、类型检查和单元测试。
- **版本发布**：遵循语义化版本 (SemVer)，release 必须打 Tag。

---

## 六、 参考资料 (References)

- [GitHub Actions Workflows](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
