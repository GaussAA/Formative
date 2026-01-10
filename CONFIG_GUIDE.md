# 🔧 修复完成 - 配置说明

## 已修复的问题

✅ **API Key 配置问题** - 修复了 ChatOpenAI 的 API 密钥传递
✅ **messages 字段错误** - 修复了状态初始化和数组检查

## ⚙️ 环境变量配置

**重要**: 您需要配置 LLM API 密钥才能运行系统。

### 步骤 1: 创建.env 文件

在项目根目录创建 `.env` 文件（如果还没有的话）：

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

### 步骤 2: 配置 API 密钥

根据您使用的 LLM 提供商，在 `.env` 文件中添加以下配置：

#### 选项 1: 使用 DeepSeek（推荐）

```env
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-your-deepseek-api-key-here
LLM_BASE_URL=https://api.deepseek.com/v1
```

**获取 DeepSeek API Key:**

1. 访问 https://platform.deepseek.com/
2. 注册/登录账号
3. 进入 API 密钥页面
4. 创建新密钥并复制

#### 选项 2: 使用 Qwen（阿里云）

```env
LLM_PROVIDER=qwen
LLM_MODEL=qwen-plus
LLM_API_KEY=sk-your-qwen-api-key-here
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

#### 选项 3: 使用本地 Ollama

```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b
LLM_BASE_URL=http://localhost:11434
# Ollama不需要API密钥，可以留空或删除
```

**使用 Ollama 前需要:**

```bash
# 安装Ollama
# 下载模型
ollama pull qwen2.5:7b
# 启动服务（通常自动启动）
ollama serve
```

### 步骤 3: 重启开发服务器

配置完成后，重启服务器：

```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

## 🧪 测试

访问 http://localhost:3000，输入：

```
我想做一个任务管理工具
```

如果看到 AI 回复，说明配置成功！

## ❌ 常见错误

### 错误 1: "LLM_API_KEY is required"

**原因**: 未设置 API 密钥
**解决**: 按上述步骤配置 `.env` 文件

### 错误 2: "401 Unauthorized"

**原因**: API 密钥无效或过期
**解决**: 检查密钥是否正确，是否有余额

### 错误 3: "Connection refused"（使用 Ollama 时）

**原因**: Ollama 服务未启动
**解决**: 运行 `ollama serve`

## 📞 需要帮助？

如果遇到其他问题，请检查：

1. `.env` 文件是否在项目根目录
2. API 密钥是否正确复制（注意前后空格）
3. 是否重启了开发服务器
4. 控制台日志中的具体错误信息
