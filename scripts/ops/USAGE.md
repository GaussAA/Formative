# 运维脚本快速使用指南

## 🎯 5 分钟快速上手

### 1️⃣ 启动项目

```bash
# 方式 A: 使用 pnpm 命令
pnpm ops:start

# 方式 B: 使用主入口
node scripts/ops/index.js start

# 方式 C: 交互式菜单
pnpm ops
# 然后输入 1
```

**效果**: 自动检查端口、验证配置、启动服务、显示访问地址

---

### 2️⃣ 常用操作速查

| 需求 | 命令 | 说明 |
|------|------|------|
| 启动服务 | `pnpm ops:start` | 智能启动，自动处理端口冲突 |
| 停止服务 | `pnpm ops:stop` | 安全关闭，可选清理缓存 |
| 重启服务 | `pnpm ops:stop && pnpm ops:start` | 一键重启 |
| 健康检查 | `pnpm ops:health` | 快速诊断系统状态 |
| 清理缓存 | `pnpm ops:clean --all` | 完整清理，释放空间 |
| 重装依赖 | `pnpm ops:reinstall` | 解决依赖问题 |
| 查看菜单 | `pnpm ops` | 交互式操作界面 |

---

### 3️⃣ 日常开发流程

```bash
# 第一天：启动项目
pnpm ops:start
# 浏览器访问 http://localhost:3000

# 开发过程中遇到问题
pnpm ops:health

# 需要重启服务
pnpm ops:stop
pnpm ops:start

# 代码更新后清理缓存
pnpm ops:clean --cache
pnpm ops:start
```

---

### 4️⃣ 故障处理

#### ❌ 端口被占用

```bash
# 自动解决
pnpm ops:stop --force
pnpm ops:start
```

#### ❌ 依赖安装失败

```bash
# 完整重装
pnpm ops:reinstall --verify
```

#### ❌ 构建失败

```bash
# 清理并重建
pnpm ops:clean --all
pnpm build
pnpm ops:start
```

#### ❌ 环境变量错误

```bash
# 检查配置
pnpm ops:health

# 参考模板
cp .env.example .env.local
# 编辑 .env.local 填入 API Key
```

---

### 5️⃣ 高级功能

#### 完整维护流程

```bash
# 一键完整维护（适合每周执行）
pnpm ops:stop && \
pnpm ops:clean --all && \
pnpm ops:reinstall --verify --build && \
pnpm ops:start
```

#### 生产部署前检查

```bash
pnpm ops:health --full && \
pnpm type-check && \
pnpm lint && \
pnpm build
```

#### 查看系统信息

```bash
pnpm ops info
pnpm ops status
```

---

## 📋 脚本详解

### start.js - 智能启动器

**特点**:
- ✅ 自动检测端口占用
- ✅ 验证环境变量完整性
- ✅ 实时显示启动日志
- ✅ 自动记录日志到文件
- ✅ 支持 Ctrl+C 平滑关闭

**日志位置**: `logs/startup.log`

---

### stop.js - 安全关闭器

**特点**:
- ✅ 查找并终止相关进程
- ✅ 释放端口
- ✅ 可选清理缓存
- ✅ 支持强制模式

**选项**:
- `--clean`: 关闭后清理缓存
- `--force`: 不确认直接关闭

---

### clean.js - 清理工具

**清理内容**:
- `.next/` - 构建缓存
- `node_modules/.cache/` - 模块缓存
- `logs/` - 日志文件
- `*.log` - 临时日志

**常用组合**:
- `--cache`: 仅清理构建缓存（快速）
- `--logs`: 仅清理日志
- `--all`: 完整清理
- `--reinstall`: 清理并重装依赖

---

### reinstall.js - 依赖重装

**流程**:
1. 备份当前依赖（`package.json`, `*-lock.yaml`）
2. 删除 `node_modules` 和 lock 文件
3. 重新安装依赖
4. 验证安装结果
5. 可选：验证构建

**备份位置**: `.backup/backup-YYYY-MM-DD-HH-MM-SS/`

**安全特性**:
- 自动备份
- 可选验证
- 支持回滚

---

### health.js - 健康检查

**检查项目**:
1. 端口状态
2. 进程状态
3. 环境变量
4. 依赖完整性
5. 构建状态
6. API 端点（可选）

**输出**:
- 彩色控制台输出
- 详细错误信息
- 修复建议
- JSON 格式（`--json`）

---

### index.js - 主入口

**功能**:
- 统一入口
- 交互式菜单
- 系统信息展示
- 命令转发

**菜单选项**:
```
1. 启动开发服务器
2. 停止开发服务器
3. 健康检查
4. 清理缓存
5. 重装依赖
6. 显示系统信息
7. 显示项目状态
0. 退出
```

---

## 💡 最佳实践

### 1. 每日工作流程

```bash
# 开始工作
pnpm ops:start

# 遇到问题时
pnpm ops:health

# 结束工作
pnpm ops:stop
```

### 2. 每周维护

```bash
# 周一早上
pnpm ops:clean --all
pnpm ops:health --full
```

### 3. 代码更新后

```bash
# 拉取代码后
pnpm ops:clean --cache
pnpm install
pnpm ops:start
```

### 4. 部署前

```bash
# 完整检查
pnpm ops:health --full
pnpm type-check
pnpm lint
pnpm build
```

---

## 🔧 自定义配置

### 修改端口

编辑脚本文件，修改 `CONFIG.PORT`:

```javascript
// scripts/ops/start.js
const CONFIG = {
  PORT: 3000, // 改为你需要的端口
  // ...
};
```

### 添加新脚本

1. 在 `scripts/ops/` 创建新脚本
2. 在 `index.js` 的 `SCRIPTS` 对象中添加配置
3. 在 `package.json` 添加命令

---

## 📊 性能数据

| 操作 | 首次运行 | 有缓存 | 说明 |
|------|---------|--------|------|
| 启动 | 5-10s | 2-3s | 取决于项目大小 |
| 停止 | <1s | <1s | 立即响应 |
| 清理缓存 | 1-3s | 1-3s | 取决于缓存大小 |
| 重装依赖 | 30-60s | - | 取决于网络 |
| 健康检查 | 2-5s | 2-5s | 包含 API 测试 |

---

## 🎓 学习资源

- **详细文档**: `scripts/ops/README.md`
- **源码注释**: 每个脚本都有详细注释
- **错误信息**: 脚本会显示详细的错误和解决方案

---

## 🆘 获取帮助

```bash
# 查看帮助
pnpm ops --help
pnpm ops:start --help
pnpm ops:health --help

# 查看文档
cat scripts/ops/README.md
cat scripts/ops/USAGE.md
```

---

**提示**: 所有脚本都支持 `--help` 参数查看详细用法！

**版本**: 1.0.0
**更新**: 2026-01-10
