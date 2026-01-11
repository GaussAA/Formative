#!/usr/bin/env node

/**
 * 一键关闭脚本
 * 功能：
 * 1. 查找并终止 Next.js 开发服务器进程
 * 2. 清理端口占用
 * 3. 可选：清理临时文件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置
const CONFIG = {
  PORT: 3000,
  PROCESSES: ['next', 'node.*dev', 'pnpm.*dev'],
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
 * 查找进程并返回PID列表
 */
function findProcesses() {
  const isWindows = os.platform() === 'win32';
  const pids = [];

  try {
    if (isWindows) {
      // Windows: 使用 tasklist 和 findstr
      CONFIG.PROCESSES.forEach(pattern => {
        try {
          const result = execSync(`tasklist /FI "IMAGENAME eq node.exe" /FO CSV`, { encoding: 'utf8' });
          const lines = result.split('\n').filter(line => line.includes('node.exe'));

          lines.forEach(line => {
            // 解析 CSV: "node.exe","12345","Console","1","15,240 K"
            const match = line.match(/"node.exe","(\d+)"/);
            if (match) {
              const pid = match[1];
              // 检查命令行参数是否包含 next dev
              try {
                const cmdline = execSync(`wmic process where "ProcessId=${pid}" get CommandLine`, { encoding: 'utf8' });
                if (cmdline.includes('next') && cmdline.includes('dev')) {
                  pids.push(pid);
                }
              } catch {}
            }
          });
        } catch {}
      });
    } else {
      // Unix/Linux/Mac: 使用 ps 和 grep
      CONFIG.PROCESSES.forEach(pattern => {
        try {
          const result = execSync(`ps aux | grep "${pattern}" | grep -v grep`, { encoding: 'utf8' });
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
        } catch {}
      });
    }
  } catch (error) {
    log(`查找进程时出错: ${error.message}`, 'red');
  }

  // 去重
  return [...new Set(pids)];
}

/**
 * 终止指定PID的进程
 */
function killProcess(pid) {
  const isWindows = os.platform() === 'win32';

  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch (error) {
    log(`终止进程 ${pid} 失败: ${error.message}`, 'red');
    return false;
  }
}

/**
 * 检查端口占用
 */
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

/**
 * 释放端口
 */
function releasePort(port) {
  const pids = findProcesses();
  let released = 0;

  pids.forEach(pid => {
    if (killProcess(pid)) {
      released++;
    }
  });

  return released;
}

/**
 * 清理缓存文件
 */
function cleanCache() {
  const cacheDirs = [
    path.join(__dirname, '../../.next'),
    path.join(__dirname, '../../node_modules/.cache'),
    path.join(__dirname, '../../logs'),
  ];

  let cleaned = 0;

  cacheDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
        log(`已清理: ${path.relative(process.cwd(), dir)}`, 'gray');
        cleaned++;
      } catch (error) {
        log(`清理失败: ${dir} - ${error.message}`, 'red');
      }
    }
  });

  return cleaned;
}

/**
 * 清理临时文件
 */
function cleanTempFiles() {
  const tempFiles = [
    path.join(__dirname, '../../logs/startup.log'),
    path.join(__dirname, '../../logs/app.log'),
  ];

  let cleaned = 0;

  tempFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        log(`已删除: ${path.relative(process.cwd(), file)}`, 'gray');
        cleaned++;
      } catch (error) {
        log(`删除失败: ${file} - ${error.message}`, 'red');
      }
    }
  });

  return cleaned;
}

/**
 * 显示进程信息
 */
function showProcessInfo(pids) {
  if (pids.length === 0) {
    log('未找到相关进程', 'gray');
    return;
  }

  log(`找到 ${pids.length} 个进程:`, 'yellow');
  pids.forEach(pid => {
    try {
      const isWindows = os.platform() === 'win32';
      let info = `PID: ${pid}`;

      if (isWindows) {
        try {
          const cmdline = execSync(`wmic process where "ProcessId=${pid}" get CommandLine`, { encoding: 'utf8' });
          const match = cmdline.match(/next.*dev/);
          if (match) info += ` - ${match[0]}`;
        } catch {}
      } else {
        try {
          const result = execSync(`ps -p ${pid} -o args=`, { encoding: 'utf8' }).trim();
          info += ` - ${result}`;
        } catch {}
      }

      log(`  ${info}`, 'gray');
    } catch {}
  });
}

/**
 * 主函数
 */
function main() {
  log('══════════════════ Formative 关闭助手 ════════════════', 'cyan');

  const args = process.argv.slice(2);
  const options = {
    clean: args.includes('--clean') || args.includes('-c'),
    cache: args.includes('--cache') || args.includes('--temp'),
    force: args.includes('--force') || args.includes('-f'),
  };

  // 步骤1: 查找进程
  log('步骤 1/3: 查找相关进程...');
  const pids = findProcesses();

  if (pids.length === 0 && !checkPort(CONFIG.PORT)) {
    log('✅ 没有发现运行中的 Formative 服务', 'green');

    if (options.clean || options.cache) {
      log('\n步骤 2/3: 清理缓存文件...');
      const cleaned = cleanCache();
      const tempCleaned = cleanTempFiles();
      log(`✅ 已清理 ${cleaned + tempCleaned} 个文件/目录`, 'green');
    }

    process.exit(0);
  }

  showProcessInfo(pids);

  // 步骤2: 终止进程
  log('\n步骤 2/3: 终止进程...');
  if (!options.force) {
    const readline = require('readline-sync');
    const answer = readline.question('确认终止? (Y/n): ');
    if (answer.toLowerCase() === 'n') {
      log('❌ 已取消操作', 'red');
      process.exit(0);
    }
  }

  let killed = 0;
  pids.forEach(pid => {
    if (killProcess(pid)) {
      killed++;
      log(`✅ 已终止进程: ${pid}`, 'green');
    }
  });

  // 等待端口释放
  if (checkPort(CONFIG.PORT)) {
    log('⏳ 等待端口释放...', 'yellow');
    setTimeout(() => {
      if (checkPort(CONFIG.PORT)) {
        log('⚠️ 端口仍被占用，可能需要手动检查', 'yellow');
      } else {
        log('✅ 端口已释放', 'green');
      }
    }, 2000);
  } else {
    log('✅ 端口已释放', 'green');
  }

  // 步骤3: 清理缓存（可选）
  if (options.clean || options.cache) {
    log('\n步骤 3/3: 清理缓存...');
    const cleaned = cleanCache();
    const tempCleaned = cleanTempFiles();
    log(`✅ 已清理 ${cleaned + tempCleaned} 个文件/目录`, 'green');
  } else {
    log('\n步骤 3/3: 跳过缓存清理', 'gray');
    log('💡 提示: 使用 --clean 或 -c 参数自动清理缓存', 'yellow');
  }

  log('\n════════════════ 关闭完成 ════════════════', 'cyan');
  log(`已终止 ${killed} 个进程`, 'green');
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

module.exports = { findProcesses, killProcess, cleanCache };
