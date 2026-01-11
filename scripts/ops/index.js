#!/usr/bin/env node

/**
 * Formative 运维脚本主入口
 * 统一管理所有运维操作
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置
const SCRIPTS = {
  start: { file: 'start.js', desc: '启动开发服务器' },
  stop: { file: 'stop.js', desc: '停止开发服务器' },
  clean: { file: 'clean.js', desc: '清理缓存和临时文件' },
  reinstall: { file: 'reinstall.js', desc: '重装依赖' },
  health: { file: 'health.js', desc: '健康检查' },
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
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 显示帮助信息
 */
function showHelp() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Formative 运维脚本 - 项目管理工具集                      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  log('\n用法:', 'yellow');
  log('  pnpm ops <command> [options]', 'gray');

  log('\n可用命令:', 'yellow');

  Object.entries(SCRIPTS).forEach(([name, info]) => {
    log(`  ${name.padEnd(12)}  ${info.desc}`, 'gray');
  });

  log('\n示例:', 'yellow');
  log('  pnpm ops:start          # 启动开发服务器', 'gray');
  log('  pnpm ops:stop           # 停止服务器', 'gray');
  log('  pnpm ops:clean --all    # 完整清理', 'gray');
  log('  pnpm ops:health         # 健康检查', 'gray');
  log('  pnpm ops:reinstall      # 重装依赖', 'gray');

  log('\n快捷命令:', 'yellow');
  log('  pnpm dev                # 启动 (同 ops:start)', 'gray');
  log('  pnpm build              # 构建项目', 'gray');
  log('  pnpm lint               # 代码检查', 'gray');
  log('  pnpm type-check         # 类型检查', 'gray');

  log('\n提示:', 'cyan');
  log('  • 所有脚本支持 --help 查看详细用法', 'gray');
  log('  • 日志文件位于 logs/ 目录', 'gray');
  log('  • 备份文件位于 .backup/ 目录', 'gray');
}

/**
 * 显示系统信息
 */
function showSystemInfo() {
  log('\n系统信息:', 'blue');
  log(`  Node.js: ${process.version}`, 'gray');
  log(`  平台: ${process.platform}`, 'gray');
  log(`  工作目录: ${process.cwd()}`, 'gray');

  // 检查关键文件
  const files = [
    'package.json',
    'pnpm-lock.yaml',
    '.env.local',
    'src/app/globals.css',
  ];

  log('\n关键文件状态:', 'blue');
  files.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    const status = exists ? '✅' : '❌';
    log(`  ${status} ${file}`, 'gray');
  });

  // 检查端口
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `netstat -ano | findstr ":3000"`
      : `lsof -i :3000 2>/dev/null || netstat -tuln | grep :3000`;

    execSync(command, { stdio: 'ignore' });
    log('\n端口状态:', 'blue');
    log('  ⚠️  3000 端口已被占用', 'yellow');
  } catch {
    log('\n端口状态:', 'blue');
    log('  ✅ 3000 端口可用', 'gray');
  }
}

/**
 * 显示项目状态
 */
function showProjectStatus() {
  log('\n项目状态:', 'blue');

  // 检查 node_modules
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = pkg.dependencies ? Object.keys(pkg.dependencies).length : 0;
    log(`  ✅ 依赖已安装 (${deps} 个包)`, 'gray');
  } else {
    log('  ❌ 依赖未安装', 'red');
  }

  // 检查构建
  const nextPath = path.join(process.cwd(), '.next');
  if (fs.existsSync(nextPath)) {
    log('  ✅ 已构建', 'gray');
  } else {
    log('  ⚠️  未构建', 'yellow');
  }

  // 检查日志目录
  const logsPath = path.join(process.cwd(), 'logs');
  if (fs.existsSync(logsPath)) {
    const files = fs.readdirSync(logsPath);
    if (files.length > 0) {
      log(`  📄 日志文件: ${files.length} 个`, 'gray');
    } else {
      log('  📄 日志目录: 空', 'gray');
    }
  } else {
    log('  📄 日志目录: 不存在', 'gray');
  }
}

/**
 * 运行指定脚本
 */
function runScript(scriptName, args) {
  const scriptInfo = SCRIPTS[scriptName];

  if (!scriptInfo) {
    log(`❌ 未知命令: ${scriptName}`, 'red');
    log('\n可用命令: ' + Object.keys(SCRIPTS).join(', '), 'yellow');
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, scriptInfo.file);

  if (!fs.existsSync(scriptPath)) {
    log(`❌ 脚本文件不存在: ${scriptInfo.file}`, 'red');
    process.exit(1);
  }

  log(`🚀 ${scriptInfo.desc}...`, 'cyan');

  // 运行脚本
  const child = spawn('node', [scriptPath, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    process.exit(code);
  });

  child.on('error', (error) => {
    log(`❌ 运行脚本失败: ${error.message}`, 'red');
    process.exit(1);
  });
}

/**
 * 显示菜单选择
 */
function showMenu() {
  const readline = require('readline-sync');

  log('\n╔════════════════════════════════════════════════════════════╗', 'magenta');
  log('║         Formative 运维菜单 - 请选择操作                    ║', 'magenta');
  log('╚════════════════════════════════════════════════════════════╝', 'magenta');

  const choices = [
    { key: '1', name: '启动开发服务器', script: 'start' },
    { key: '2', name: '停止开发服务器', script: 'stop' },
    { key: '3', name: '健康检查', script: 'health' },
    { key: '4', name: '清理缓存', script: 'clean', args: ['--all'] },
    { key: '5', name: '重装依赖', script: 'reinstall' },
    { key: '6', name: '显示系统信息', action: 'info' },
    { key: '7', name: '显示项目状态', action: 'status' },
    { key: '0', name: '退出', action: 'exit' },
  ];

  choices.forEach(choice => {
    log(`  ${choice.key}. ${choice.name}`, 'gray');
  });

  const answer = readline.question('\n请选择 (0-7): ');

  const selected = choices.find(c => c.key === answer);

  if (!selected) {
    log('❌ 无效选择', 'red');
    return false;
  }

  if (selected.action === 'exit') {
    log('👋 再见!', 'cyan');
    process.exit(0);
  } else if (selected.action === 'info') {
    showSystemInfo();
    return true;
  } else if (selected.action === 'status') {
    showProjectStatus();
    return true;
  } else if (selected.script) {
    const args = selected.args || [];
    runScript(selected.script, args);
    return true;
  }

  return false;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  // 没有参数，显示菜单
  if (args.length === 0) {
    showSystemInfo();
    showProjectStatus();

    while (true) {
      if (!showMenu()) {
        break;
      }
      log('\n按回车继续...', 'gray');
      require('readline-sync').question('');
    }
    return;
  }

  // 解析命令
  const command = args[0];
  const commandArgs = args.slice(1);

  // 特殊命令
  if (command === '--version' || command === '-v') {
    log('Formative 运维脚本 v1.0.0', 'cyan');
    return;
  }

  if (command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (command === 'info') {
    showSystemInfo();
    return;
  }

  if (command === 'status') {
    showProjectStatus();
    return;
  }

  // 运行脚本
  runScript(command, commandArgs);
}

// 错误处理
process.on('uncaughtException', (error) => {
  log(`❌ 未捕获的异常: ${error.message}`, 'red');
  process.exit(1);
});

process.on('SIGINT', () => {
  log('\n👋 已取消', 'yellow');
  process.exit(0);
});

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { runScript, showHelp, showSystemInfo, showProjectStatus };
