#!/usr/bin/env node

/**
 * 一键启动脚本
 * 功能：
 * 1. 检查端口占用
 * 2. 验证环境变量
 * 3. 启动开发服务器
 * 4. 显示启动状态和访问地址
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置
const CONFIG = {
  PORT: 3000,
  HOST: 'localhost',
  MAX_STARTUP_TIME: 60000, // 60秒超时
  LOG_FILE: path.join(__dirname, '../../logs/startup.log'),
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function checkPort(port) {
  try {
    const isWindows = os.platform() === 'win32';
    const command = isWindows
      ? `netstat -ano | findstr ":${port}"`
      : `lsof -i :${port} || netstat -tuln | grep :${port}`;

    execSync(command, { stdio: 'ignore' });
    return true; // 端口被占用
  } catch {
    return false; // 端口可用
  }
}

function killPort(port) {
  try {
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
      const result = execSync(`netstat -ano | findstr ":${port}"`).toString();
      const match = result.match(/(\d+)\s*$/m);
      if (match) {
        const pid = match[1];
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        log(`已终止端口 ${port} 的进程 (PID: ${pid})`, 'yellow');
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
      log(`已终止端口 ${port} 的进程`, 'yellow');
    }
    return true;
  } catch (error) {
    log(`终止端口进程失败: ${error.message}`, 'red');
    return false;
  }
}

function checkEnvFile() {
  const envLocalPath = path.join(__dirname, '../../.env.local');
  const envExamplePath = path.join(__dirname, '../../.env.example');

  if (!fs.existsSync(envLocalPath)) {
    log('❌ 未找到 .env.local 文件', 'red');

    if (fs.existsSync(envExamplePath)) {
      log('💡 建议: 复制 .env.example 为 .env.local 并配置 API Key', 'yellow');
      const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
      log(`\n模板内容:\n${exampleContent}`, 'cyan');
    }

    return false;
  }

  // 检查必要环境变量
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const required = ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY'];
  const missing = required.filter(key => !content.includes(`${key}=`));

  if (missing.length > 0) {
    log(`❌ 缺少必要环境变量: ${missing.join(', ')}`, 'red');
    return false;
  }

  log('✅ 环境变量检查通过', 'green');
  return true;
}

function createLogDirectory() {
  const logDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    log(`创建日志目录: ${logDir}`, 'cyan');
  }
}

function startDevServer() {
  log('🚀 启动开发服务器...', 'blue');

  // 创建日志流
  createLogDirectory();
  const logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });

  const child = spawn('pnpm', ['dev'], {
    cwd: path.join(__dirname, '../../'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let startupCompleted = false;
  let startTime = Date.now();

  // 处理 stdout
  child.stdout.on('data', (data) => {
    const output = data.toString();
    logStream.write(data);

    // 检查启动成功标志
    if (output.includes('Ready in') || output.includes('Local:') || output.includes('http://localhost:')) {
      if (!startupCompleted) {
        startupCompleted = true;
        const startupTime = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`✅ 开发服务器启动成功! (${startupTime}s)`, 'green');
        log(`🌐 访问地址: http://localhost:${CONFIG.PORT}`, 'cyan');
        log(`📄 日志文件: ${CONFIG.LOG_FILE}`, 'gray');
        log('💡 提示: 按 Ctrl+C 停止服务器', 'yellow');

        // 显示进程信息
        try {
          const isWindows = os.platform() === 'win32';
          if (isWindows) {
            log(`PID: ${child.pid}`, 'gray');
          } else {
            const pid = execSync(`pgrep -f "next dev"`).toString().trim();
            log(`PID: ${pid}`, 'gray');
          }
        } catch {}
      }
    }

    // 实时输出到控制台（过滤一些冗余信息）
    if (!output.includes('Fast refresh') && !output.includes('Compiling')) {
      process.stdout.write(data);
    }
  });

  // 处理 stderr
  child.stderr.on('data', (data) => {
    logStream.write(data);
    const error = data.toString();

    if (error.includes('Error') || error.includes('error')) {
      log(`❌ ${error.trim()}`, 'red');
    }
  });

  // 处理退出
  child.on('close', (code) => {
    logStream.end();
    if (code !== 0 && !startupCompleted) {
      log(`❌ 启动失败，退出码: ${code}`, 'red');
      log(`💡 查看日志: ${CONFIG.LOG_FILE}`, 'yellow');
      process.exit(code);
    }
  });

  // 超时检查
  setTimeout(() => {
    if (!startupCompleted) {
      log('⚠️ 启动超时，但可能仍在编译中...', 'yellow');
      log('💡 建议: 检查日志或手动访问 http://localhost:3000', 'yellow');
    }
  }, CONFIG.MAX_STARTUP_TIME);

  // 处理 Ctrl+C
  process.on('SIGINT', () => {
    log('\n🛑 收到停止信号，正在关闭服务器...', 'yellow');
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      process.exit(0);
    }, 2000);
  });

  return child;
}

function main() {
  log('══════════════════ Formative 启动助手 ════════════════', 'cyan');

  // 1. 检查端口
  log('步骤 1/3: 检查端口占用...');
  if (checkPort(CONFIG.PORT)) {
    log(`⚠️ 端口 ${CONFIG.PORT} 已被占用`, 'yellow');
    const answer = require('readline-sync').question(`是否终止占用进程? (y/N): `);
    if (answer.toLowerCase() === 'y') {
      if (!killPort(CONFIG.PORT)) {
        log('❌ 无法终止进程，请手动处理', 'red');
        process.exit(1);
      }
    } else {
      log('❌ 已取消启动', 'red');
      process.exit(1);
    }
  } else {
    log(`✅ 端口 ${CONFIG.PORT} 可用`, 'green');
  }

  // 2. 检查环境变量
  log('\n步骤 2/3: 验证环境变量...');
  if (!checkEnvFile()) {
    log('❌ 环境变量配置不完整', 'red');
    process.exit(1);
  }

  // 3. 启动服务器
  log('\n步骤 3/3: 启动开发服务器...');
  startDevServer();
}

// 错误处理
process.on('uncaughtException', (error) => {
  log(`❌ 未捕获的异常: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ 未处理的 Promise 拒绝: ${reason}`, 'red');
  process.exit(1);
});

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { startDevServer, checkPort, checkEnvFile };
