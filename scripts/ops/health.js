#!/usr/bin/env node

/**
 * 健康检查脚本
 * 功能：
 * 1. 检查端口占用和进程状态
 * 2. 验证环境变量配置
 * 3. 测试 API 端点可用性
 * 4. 检查依赖完整性
 * 5. 生成健康报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// 配置
const CONFIG = {
  PORT: 3000,
  HOST: 'localhost',
  TIMEOUT: 5000,
  ENDPOINTS: [
    '/',
    '/api/chat',
    '/api/analyze-risks',
    '/api/tech-stack',
  ],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

/**
 * 检查端口占用
 */
function checkPort() {
  log('检查端口状态...', 'blue');

  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `netstat -ano | findstr ":${CONFIG.PORT}"`
      : `lsof -i :${CONFIG.PORT} || netstat -tuln | grep :${CONFIG.PORT}`;

    execSync(command, { stdio: 'ignore' });

    log(`✅ 端口 ${CONFIG.PORT} 已被占用 (服务可能正在运行)`, 'green');
    return { status: 'occupied', port: CONFIG.PORT };
  } catch {
    log(`⚠️ 端口 ${CONFIG.PORT} 未被占用`, 'yellow');
    return { status: 'free', port: CONFIG.PORT };
  }
}

/**
 * 检查进程状态
 */
function checkProcess() {
  log('\n检查进程状态...', 'blue');

  const isWindows = process.platform === 'win32';
  let pids = [];

  try {
    if (isWindows) {
      const result = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8' });
      const lines = result.split('\n').filter(line => line.includes('node.exe'));

      lines.forEach(line => {
        const match = line.match(/"node.exe","(\d+)"/);
        if (match) {
          const pid = match[1];
          try {
            const cmdline = execSync(`wmic process where "ProcessId=${pid}" get CommandLine`, { encoding: 'utf8' });
            if (cmdline.includes('next') && cmdline.includes('dev')) {
              pids.push(pid);
            }
          } catch {}
        }
      });
    } else {
      const result = execSync('ps aux | grep "next.*dev" | grep -v grep', { encoding: 'utf8' });
      const lines = result.trim().split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const pid = parts[1];
          if (pid && /^\d+$/.test(pid)) {
            pids.push(pid);
          }
        }
      });
    }
  } catch {}

  if (pids.length > 0) {
    log(`✅ 发现 ${pids.length} 个 Next.js 进程`, 'green');
    pids.forEach(pid => log(`   PID: ${pid}`, 'gray'));
    return { status: 'running', pids };
  } else {
    log('⚠️ 未发现运行中的 Next.js 进程', 'yellow');
    return { status: 'stopped' };
  }
}

/**
 * 验证环境变量
 */
function checkEnv() {
  log('\n验证环境变量...', 'blue');

  const envPath = path.join(__dirname, '../../.env.local');
  const examplePath = path.join(__dirname, '../../.env.example');

  if (!fs.existsSync(envPath)) {
    log('❌ 未找到 .env.local 文件', 'red');

    if (fs.existsSync(examplePath)) {
      log('💡 建议: 复制 .env.example 为 .env.local', 'yellow');
    }

    return { status: 'missing', required: [] };
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const required = ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY'];
  const missing = [];

  required.forEach(key => {
    if (content.includes(`${key}=`)) {
      const value = content.split('\n').find(line => line.startsWith(`${key}=`));
      const val = value ? value.split('=')[1] : '';
      const masked = val ? `${val.substring(0, 4)}***${val.substring(val.length - 4)}` : '(empty)';
      log(`✅ ${key}: ${masked}`, 'green');
    } else {
      log(`❌ ${key}: 缺失`, 'red');
      missing.push(key);
    }
  });

  if (missing.length === 0) {
    return { status: 'complete', required };
  } else {
    return { status: 'incomplete', required: missing };
  }
}

/**
 * 检查依赖完整性
 */
function checkDependencies() {
  log('\n检查依赖完整性...', 'blue');

  const nodeModulesPath = path.join(__dirname, '../../node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    log('❌ node_modules 不存在', 'red');
    return { status: 'missing', missing: ['node_modules'] };
  }

  const pkgPath = path.join(__dirname, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const criticalDeps = [
    'next',
    'react',
    'react-dom',
    'zod',
    'langchain',
    '@langchain/core',
    '@langchain/langgraph',
    'tailwindcss',
  ];

  const missing = [];
  const installed = [];

  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      installed.push(dep);
    } else {
      missing.push(dep);
    }
  });

  installed.forEach(dep => log(`✅ ${dep}`, 'gray'));
  missing.forEach(dep => log(`❌ ${dep} 未安装`, 'red'));

  if (missing.length === 0) {
    log(`✅ 所有 ${installed.length} 个关键依赖已安装`, 'green');
    return { status: 'complete', missing: [] };
  } else {
    log(`❌ 缺失 ${missing.length} 个关键依赖`, 'red');
    return { status: 'incomplete', missing };
  }
}

/**
 * 测试 API 端点
 */
function testEndpoints() {
  log('\n测试 API 端点...', 'blue');

  return new Promise((resolve) => {
    const results = [];

    // 检查服务是否运行
    const portCheck = checkPort();
    if (portCheck.status === 'free') {
      log('⚠️ 服务未运行，跳过端点测试', 'yellow');
      resolve([]);
      return;
    }

    let completed = 0;

    CONFIG.ENDPOINTS.forEach(endpoint => {
      const url = `http://${CONFIG.HOST}:${CONFIG.PORT}${endpoint}`;
      const protocol = url.startsWith('https') ? https : http;

      const startTime = Date.now();

      const req = protocol.request(url, { method: 'GET', timeout: CONFIG.TIMEOUT }, (res) => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        if (status >= 200 && status < 400) {
          log(`✅ ${endpoint} - ${status} (${duration}ms)`, 'green');
          results.push({ endpoint, status, duration, success: true });
        } else {
          log(`⚠️ ${endpoint} - ${status} (${duration}ms)`, 'yellow');
          results.push({ endpoint, status, duration, success: false });
        }

        completed++;
        if (completed === CONFIG.ENDPOINTS.length) {
          resolve(results);
        }
      });

      req.on('error', (error) => {
        log(`❌ ${endpoint} - 错误: ${error.message}`, 'red');
        results.push({ endpoint, error: error.message, success: false });
        completed++;
        if (completed === CONFIG.ENDPOINTS.length) {
          resolve(results);
        }
      });

      req.on('timeout', () => {
        log(`❌ ${endpoint} - 超时`, 'red');
        req.destroy();
        results.push({ endpoint, error: 'timeout', success: false });
        completed++;
        if (completed === CONFIG.ENDPOINTS.length) {
          resolve(results);
        }
      });

      req.end();
    });
  });
}

/**
 * 检查构建状态
 */
function checkBuild() {
  log('\n检查构建状态...', 'blue');

  const nextDir = path.join(__dirname, '../../.next');

  if (!fs.existsSync(nextDir)) {
    log('⚠️ .next 目录不存在，未构建', 'yellow');
    return { status: 'not-built' };
  }

  // 检查是否有构建产物
  const buildDir = path.join(nextDir, 'static');
  if (fs.existsSync(buildDir)) {
    const files = fs.readdirSync(buildDir);
    if (files.length > 0) {
      log('✅ 已构建', 'green');
      return { status: 'built', files: files.length };
    }
  }

  log('⚠️ 构建不完整', 'yellow');
  return { status: 'incomplete' };
}

/**
 * 生成健康报告
 */
function generateReport(checks) {
  log('\n════════════════ 健康报告 ════════════════', 'cyan');

  const summary = {
    passed: 0,
    warnings: 0,
    failed: 0,
  };

  // 端口检查
  if (checks.port.status === 'occupied') summary.passed++;
  else summary.warnings++;

  // 进程检查
  if (checks.process.status === 'running') summary.passed++;
  else summary.warnings++;

  // 环境变量
  if (checks.env.status === 'complete') summary.passed++;
  else if (checks.env.status === 'incomplete') summary.warnings++;
  else summary.failed++;

  // 依赖检查
  if (checks.deps.status === 'complete') summary.passed++;
  else summary.failed++;

  // 构建检查
  if (checks.build.status === 'built') summary.passed++;
  else summary.warnings++;

  // API 测试
  if (checks.api && checks.api.length > 0) {
    const successCount = checks.api.filter(r => r.success).length;
    if (successCount === checks.api.length) {
      summary.passed++;
    } else if (successCount > 0) {
      summary.warnings++;
    } else {
      summary.failed++;
    }
  }

  // 显示总结
  log(`\n通过: ${summary.passed} | 警告: ${summary.warnings} | 失败: ${summary.failed}`, 'blue');

  if (summary.failed === 0 && summary.warnings === 0) {
    log('\n🎉 完美! 系统健康状态良好', 'green');
    log('可以开始开发了', 'cyan');
  } else if (summary.failed === 0) {
    log('\n⚠️  系统基本健康，但有警告', 'yellow');
    log('建议修复警告以获得最佳体验', 'cyan');
  } else {
    log('\n❌ 发现严重问题', 'red');
    log('请根据上述错误信息进行修复', 'cyan');
  }

  // 显示建议
  log('\n💡 操作建议:', 'cyan');

  if (checks.port.status === 'free' && checks.process.status === 'stopped') {
    log('  - 运行: pnpm ops:start  启动服务', 'gray');
  }

  if (checks.env.status !== 'complete') {
    log('  - 配置: .env.local 文件', 'gray');
  }

  if (checks.deps.status !== 'complete') {
    log('  - 安装: pnpm install  或 pnpm ops:reinstall', 'gray');
  }

  if (checks.build.status !== 'built') {
    log('  - 构建: pnpm build', 'gray');
  }

  if (checks.process.status === 'running' && checks.api && checks.api.some(r => !r.success)) {
    log('  - 重启: pnpm ops:stop && pnpm ops:start', 'gray');
  }

  return summary;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  log('\n用法: node health.js [选项]', 'cyan');
  log('\n选项:', 'yellow');
  log('  --full, -f        执行完整检查 (包括 API 测试)', 'gray');
  log('  --quick, -q       快速检查 (跳过 API 测试)', 'gray');
  log('  --json            输出 JSON 格式报告', 'gray');
  log('  --help, -h        显示此帮助信息', 'gray');
  log('\n示例:', 'yellow');
  log('  node health.js           # 标准检查', 'gray');
  log('  node health.js --full    # 完整检查', 'gray');
  log('  node health.js --json    # JSON 输出', 'gray');
}

/**
 * 主函数
 */
async function main() {
  log('════════════════ Formative 健康检查助手 ════════════════', 'cyan');

  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options = {
    full: args.includes('--full') || args.includes('-f'),
    quick: args.includes('--quick') || args.includes('-q'),
    json: args.includes('--json'),
  };

  // 执行检查
  const checks = {
    port: checkPort(),
    process: checkProcess(),
    env: checkEnv(),
    deps: checkDependencies(),
    build: checkBuild(),
  };

  // API 测试
  if (!options.quick && (options.full || checks.process.status === 'running')) {
    log('等待 API 测试...', 'gray');
    checks.api = await testEndpoints();
  }

  // 生成报告
  const summary = generateReport(checks);

  // JSON 输出
  if (options.json) {
    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary,
      checks,
    };
    console.log('\n' + JSON.stringify(jsonReport, null, 2));
  }

  // 退出码
  const hasFailures = summary.failed > 0;
  process.exit(hasFailures ? 1 : 0);
}

// 错误处理
process.on('uncaughtException', (error) => {
  log(`❌ 未捕获的异常: ${error.message}`, 'red');
  process.exit(1);
});

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = {
  checkPort,
  checkProcess,
  checkEnv,
  checkDependencies,
  testEndpoints,
};
