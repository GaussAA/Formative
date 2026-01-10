#!/usr/bin/env node

/**
 * 清除缓存和临时文件脚本
 * 功能：
 * 1. 清理 Next.js 构建缓存 (.next)
 * 2. 清理 Node.js 模块缓存
 * 3. 清理日志文件
 * 4. 可选：删除 node_modules 并重装依赖
 * 5. 可选：清理 Git 忽略的文件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  ROOT: path.join(__dirname, '../../'),
  CACHE_DIRS: [
    '.next',
    'node_modules/.cache',
    'node_modules/.vite',
    'dist',
    '.turbo',
    '.swc',
  ],
  LOG_FILES: [
    'logs/startup.log',
    'logs/app.log',
  ],
  TEMP_FILES: [
    '*.log',
    '.DS_Store',
    'Thumbs.db',
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
 * 安全删除文件或目录
 */
function safeDelete(targetPath, description) {
  const fullPath = path.join(CONFIG.ROOT, targetPath);

  if (!fs.existsSync(fullPath)) {
    log(`不存在: ${description || targetPath}`, 'gray');
    return false;
  }

  try {
    if (fs.lstatSync(fullPath).isDirectory()) {
      execSync(`rm -rf "${fullPath}"`, { stdio: 'ignore' });
    } else {
      fs.unlinkSync(fullPath);
    }
    log(`✅ 已删除: ${description || targetPath}`, 'green');
    return true;
  } catch (error) {
    log(`❌ 删除失败: ${description || targetPath} - ${error.message}`, 'red');
    return false;
  }
}

/**
 * 清理缓存目录
 */
function cleanCache() {
  log('清理构建缓存...', 'blue');
  let count = 0;

  CONFIG.CACHE_DIRS.forEach(dir => {
    if (safeDelete(dir)) count++;
  });

  return count;
}

/**
 * 清理日志文件
 */
function cleanLogs() {
  log('\n清理日志文件...', 'blue');
  let count = 0;

  CONFIG.LOG_FILES.forEach(file => {
    if (safeDelete(file)) count++;
  });

  // 清理日志目录中的所有文件
  const logsDir = path.join(CONFIG.ROOT, 'logs');
  if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir);
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      if (fs.statSync(filePath).isFile()) {
        if (safeDelete(filePath, `logs/${file}`)) count++;
      }
    });
  }

  return count;
}

/**
 * 清理临时文件
 */
function cleanTemp() {
  log('\n清理临时文件...', 'blue');
  let count = 0;

  try {
    // 使用 find 命令查找并删除临时文件
    CONFIG.TEMP_FILES.forEach(pattern => {
      try {
        const result = execSync(`find "${CONFIG.ROOT}" -name "${pattern}" -type f 2>/dev/null`, { encoding: 'utf8' });
        const files = result.trim().split('\n').filter(f => f);

        files.forEach(file => {
          if (safeDelete(file.replace(CONFIG.ROOT, '').replace(/^\//, ''), path.relative(CONFIG.ROOT, file))) {
            count++;
          }
        });
      } catch {}
    });
  } catch (error) {
    log(`临时文件清理出错: ${error.message}`, 'yellow');
  }

  return count;
}

/**
 * 清理 node_modules
 */
function cleanNodeModules() {
  log('\n清理 node_modules (耗时较长)...', 'blue');

  const nodeModulesPath = path.join(CONFIG.ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('node_modules 不存在', 'gray');
    return false;
  }

  if (safeDelete('node_modules', 'node_modules 目录')) {
    log('💡 node_modules 已删除，建议运行 pnpm install 重装', 'yellow');
    return true;
  }
  return false;
}

/**
 * 重装依赖
 */
function reinstallDependencies(useNpm = false) {
  log('\n重装依赖...', 'blue');

  const manager = useNpm ? 'npm' : 'pnpm';

  try {
    log(`正在运行 ${manager} install...`, 'cyan');

    // 删除锁文件
    safeDelete('pnpm-lock.yaml', 'pnpm-lock.yaml');
    safeDelete('package-lock.json', 'package-lock.json');

    // 运行安装
    execSync(`${manager} install`, {
      cwd: CONFIG.ROOT,
      stdio: 'inherit',
    });

    log(`✅ ${manager} install 完成`, 'green');
    return true;
  } catch (error) {
    log(`❌ 依赖安装失败: ${error.message}`, 'red');
    return false;
  }
}

/**
 * 清理 Git 忽略的文件
 */
function cleanGitIgnored() {
  log('\n清理 Git 忽略的文件...', 'blue');
  let count = 0;

  try {
    // 获取 Git 忽略的文件列表
    const ignored = execSync('git check-ignore -v **/* 2>/dev/null || true', {
      cwd: CONFIG.ROOT,
      encoding: 'utf8',
    });

    const lines = ignored.trim().split('\n').filter(l => l);

    if (lines.length === 0) {
      log('没有发现 Git 忽略的文件', 'gray');
      return 0;
    }

    log(`发现 ${lines.length} 个 Git 忽略的文件/模式`, 'yellow');

    // 实际删除操作需要谨慎，这里只显示信息
    lines.slice(0, 10).forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 3) {
        const file = parts[2];
        log(`  - ${file}`, 'gray');
      }
    });

    if (lines.length > 10) {
      log(`  ... 还有 ${lines.length - 10} 个`, 'gray');
    }

    log('💡 注意: Git 忽略的文件未实际删除，如需删除请手动操作', 'yellow');

    return lines.length;
  } catch (error) {
    log(`Git 操作出错: ${error.message}`, 'yellow');
    return 0;
  }
}

/**
 * 显示磁盘使用情况
 */
function showDiskUsage() {
  log('\n磁盘使用情况:', 'blue');

  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `dir "${CONFIG.ROOT}" /s /-c | findstr /C:"文件" /C:"目录"`
      : `du -sh "${CONFIG.ROOT}" 2>/dev/null || du -sh .`;

    const result = execSync(command, { encoding: 'utf8' });
    log(result.trim(), 'gray');
  } catch (error) {
    // 静默处理
  }

  // 显示 node_modules 大小
  const nodeModulesPath = path.join(CONFIG.ROOT, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows
        ? `dir "${nodeModulesPath}" /s /-c | findstr /C:"文件" /C:"目录"`
        : `du -sh "${nodeModulesPath}" 2>/dev/null`;

      const result = execSync(command, { encoding: 'utf8' });
      const size = result.split('\n')[0].trim();
      log(`node_modules: ${size}`, 'gray');
    } catch {}
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  log('\n用法: node clean.js [选项]', 'cyan');
  log('\n选项:', 'yellow');
  log('  --all, -a        清理所有缓存和临时文件', 'gray');
  log('  --cache, -c      仅清理构建缓存 (.next, .cache 等)', 'gray');
  log('  --logs, -l       仅清理日志文件', 'gray');
  log('  --temp, -t       仅清理临时文件', 'gray');
  log('  --node-modules   删除 node_modules', 'gray');
  log('  --reinstall      删除 node_modules 并重装依赖', 'gray');
  log('  --npm            使用 npm 而非 pnpm', 'gray');
  log('  --git            显示 Git 忽略的文件', 'gray');
  log('  --disk, -d       显示磁盘使用情况', 'gray');
  log('  --help, -h       显示此帮助信息', 'gray');
  log('\n示例:', 'yellow');
  log('  node clean.js --all          # 清理所有', 'gray');
  log('  node clean.js --reinstall    # 重装依赖', 'gray');
  log('  node clean.js --cache --logs # 仅清理缓存和日志', 'gray');
}

/**
 * 主函数
 */
function main() {
  log('══════════════════ Formative 清理助手 ════════════════', 'cyan');

  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options = {
    all: args.includes('--all') || args.includes('-a'),
    cache: args.includes('--cache') || args.includes('-c'),
    logs: args.includes('--logs') || args.includes('-l'),
    temp: args.includes('--temp') || args.includes('-t'),
    nodeModules: args.includes('--node-modules'),
    reinstall: args.includes('--reinstall'),
    npm: args.includes('--npm'),
    git: args.includes('--git'),
    disk: args.includes('--disk') || args.includes('-d'),
  };

  // 显示初始磁盘使用
  if (options.disk) {
    showDiskUsage();
  }

  let totalDeleted = 0;

  // 执行清理操作
  if (options.all || options.cache) {
    totalDeleted += cleanCache();
  }

  if (options.all || options.logs) {
    totalDeleted += cleanLogs();
  }

  if (options.all || options.temp) {
    totalDeleted += cleanTemp();
  }

  if (options.nodeModules || options.reinstall) {
    cleanNodeModules();
    totalDeleted++; // 计数
  }

  if (options.git) {
    cleanGitIgnored();
  }

  // 重装依赖
  if (options.reinstall) {
    reinstallDependencies(options.npm);
  }

  // 显示最终结果
  log('\n════════════════ 清理完成 ════════════════', 'cyan');

  if (totalDeleted > 0) {
    log(`✅ 总计清理 ${totalDeleted} 个项目`, 'green');
  } else {
    log('⚠️ 未执行清理操作，请检查选项', 'yellow');
  }

  // 显示最终磁盘使用
  if (options.disk || options.all) {
    showDiskUsage();
  }

  log('\n💡 提示:', 'yellow');
  if (options.reinstall) {
    log('  依赖已重装，可以启动项目了', 'gray');
  } else if (options.cache || options.all) {
    log('  缓存已清理，下次启动会重新编译', 'gray');
  } else {
    log('  使用 --all 执行完整清理，或 --help 查看详细选项', 'gray');
  }
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

module.exports = { cleanCache, cleanLogs, cleanNodeModules, reinstallDependencies };
