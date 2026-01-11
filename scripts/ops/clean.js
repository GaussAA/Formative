#!/usr/bin/env node

/**
 * Formative 清理助手 - 优化版
 *
 * 功能：
 * 1. ✅ 清理构建缓存 (.next, node_modules/.cache, .turbo, .swc)
 * 2. ✅ 清理日志文件 (logs/ 目录)
 * 3. ✅ 清理测试报告 (coverage/, playwright-report/, test-results/)
 * 4. ✅ 清理临时文件 (.DS_Store, Thumbs.db, *.log, nul)
 * 5. ✅ 清理备份文件 (.backup/)
 * 6. ✅ 清理 TypeScript 构建缓存 (tsconfig.tsbuildinfo)
 * 7. ✅ 清理临时文档
 * 8. ✅ 删除 node_modules 并重装依赖
 * 9. ✅ 显示磁盘使用情况
 *
 * 使用：
 *   pnpm ops:clean              # 清理所有缓存和临时文件
 *   pnpm ops:clean --cache      # 仅清理构建缓存
 *   pnpm ops:clean --logs       # 仅清理日志
 *   pnpm ops:clean --test       # 仅清理测试报告
 *   pnpm ops:clean --temp       # 仅清理临时文件
 *   pnpm ops:clean --backup     # 仅清理备份
 *   pnpm ops:clean --reinstall  # 重装依赖
 *   pnpm ops:clean --disk       # 显示磁盘使用
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  ROOT: path.join(__dirname, '../../'),

  // 构建缓存目录
  CACHE_DIRS: [
    '.next',
    'node_modules/.cache',
    'node_modules/.vite',
    'dist',
    '.turbo',
    '.swc',
  ],

  // 测试报告目录
  TEST_DIRS: [
    'coverage',
    'playwright-report',
    'test-results',
  ],

  // 备份目录
  BACKUP_DIRS: [
    '.backup',
  ],

  // 日志文件（已废弃的特定文件）
  LOG_FILES: [
    'logs/startup.log',
    'logs/app.log',
  ],

  // 临时文件模式
  TEMP_FILES: [
    '*.log',
    '.DS_Store',
    'Thumbs.db',
    'nul',
  ],

  // TypeScript 构建信息
  TS_BUILD_INFO: [
    'tsconfig.tsbuildinfo',
  ],

  // 临时文档（可删除）
  TEMP_DOCS: [
    'LOGGING_IMPLEMENTATION_COMPLETE.md',
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
 * 清理目录中的所有文件（保留目录本身）
 */
function cleanDirectory(dirPath, description) {
  const fullPath = path.join(CONFIG.ROOT, dirPath);

  if (!fs.existsSync(fullPath)) {
    log(`不存在: ${description || dirPath}`, 'gray');
    return 0;
  }

  if (!fs.lstatSync(fullPath).isDirectory()) {
    log(`⚠️ 不是目录: ${description || dirPath}`, 'yellow');
    return 0;
  }

  try {
    const files = fs.readdirSync(fullPath);
    if (files.length === 0) {
      log(`目录为空: ${description || dirPath}`, 'gray');
      return 0;
    }

    let count = 0;
    files.forEach(file => {
      const filePath = path.join(fullPath, file);
      if (safeDelete(filePath, `${dirPath}/${file}`)) {
        count++;
      }
    });

    return count;
  } catch (error) {
    log(`❌ 清理失败: ${description || dirPath} - ${error.message}`, 'red');
    return 0;
  }
}

/**
 * 清理构建缓存
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

  // 清理特定日志文件
  CONFIG.LOG_FILES.forEach(file => {
    if (safeDelete(file)) count++;
  });

  // 清理 logs/ 目录中的所有文件
  count += cleanDirectory('logs', 'logs/ 目录');

  return count;
}

/**
 * 清理测试报告
 */
function cleanTests() {
  log('\n清理测试报告...', 'blue');
  let count = 0;

  CONFIG.TEST_DIRS.forEach(dir => {
    if (safeDelete(dir)) count++;
  });

  return count;
}

/**
 * 清理备份文件
 */
function cleanBackup() {
  log('\n清理备份文件...', 'blue');
  let count = 0;

  CONFIG.BACKUP_DIRS.forEach(dir => {
    if (safeDelete(dir)) count++;
  });

  return count;
}

/**
 * 清理临时文件
 */
function cleanTemp() {
  log('\n清理临时文件...', 'blue');
  let count = 0;

  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows: 直接检查常见临时文件位置
      const commonPaths = [
        path.join(CONFIG.ROOT, '.DS_Store'),
        path.join(CONFIG.ROOT, 'Thumbs.db'),
        path.join(CONFIG.ROOT, 'nul'),
      ];

      // 检查 logs 目录下的所有 .log 文件
      const logsDir = path.join(CONFIG.ROOT, 'logs');
      if (fs.existsSync(logsDir) && fs.lstatSync(logsDir).isDirectory()) {
        const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
        logFiles.forEach(file => {
          commonPaths.push(path.join(logsDir, file));
        });
      }

      commonPaths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          if (safeDelete(filePath, path.relative(CONFIG.ROOT, filePath))) {
            count++;
          }
        }
      });
    } else {
      // Unix/Linux: 使用 find 命令
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
    }
  } catch (error) {
    log(`临时文件清理出错: ${error.message}`, 'yellow');
  }

  return count;
}

/**
 * 清理 TypeScript 构建信息
 */
function cleanTSBuildInfo() {
  log('\n清理 TypeScript 构建信息...', 'blue');
  let count = 0;

  CONFIG.TS_BUILD_INFO.forEach(file => {
    if (safeDelete(file)) count++;
  });

  return count;
}

/**
 * 清理临时文档
 */
function cleanTempDocs() {
  log('\n清理临时文档...', 'blue');
  let count = 0;

  CONFIG.TEMP_DOCS.forEach(file => {
    if (safeDelete(file, `docs/${file}`)) count++;
  });

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
  log('\n用法: pnpm ops:clean [选项]', 'cyan');
  log('\n选项:', 'yellow');
  log('  --all, -a        清理所有缓存和临时文件', 'gray');
  log('  --cache, -c      仅清理构建缓存', 'gray');
  log('  --logs, -l       仅清理日志文件', 'gray');
  log('  --test, -t       仅清理测试报告', 'gray');
  log('  --temp           仅清理临时文件', 'gray');
  log('  --backup         仅清理备份文件', 'gray');
  log('  --ts             仅清理 TypeScript 构建信息', 'gray');
  log('  --docs           仅清理临时文档', 'gray');
  log('  --node-modules   删除 node_modules', 'gray');
  log('  --reinstall      删除 node_modules 并重装依赖', 'gray');
  log('  --npm            使用 npm 而非 pnpm', 'gray');
  log('  --disk, -d       显示磁盘使用情况', 'gray');
  log('  --help, -h       显示此帮助信息', 'gray');
  log('\n示例:', 'yellow');
  log('  pnpm ops:clean --all          # 清理所有', 'gray');
  log('  pnpm ops:clean --reinstall    # 重装依赖', 'gray');
  log('  pnpm ops:clean --cache --logs # 仅清理缓存和日志', 'gray');
  log('  pnpm ops:clean --test         # 仅清理测试报告', 'gray');
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
    test: args.includes('--test') || args.includes('-t'),
    temp: args.includes('--temp'),
    backup: args.includes('--backup'),
    ts: args.includes('--ts'),
    docs: args.includes('--docs'),
    nodeModules: args.includes('--node-modules'),
    reinstall: args.includes('--reinstall'),
    npm: args.includes('--npm'),
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

  if (options.all || options.test) {
    totalDeleted += cleanTests();
  }

  if (options.all || options.temp) {
    totalDeleted += cleanTemp();
  }

  if (options.all || options.backup) {
    totalDeleted += cleanBackup();
  }

  if (options.all || options.ts) {
    totalDeleted += cleanTSBuildInfo();
  }

  if (options.all || options.docs) {
    totalDeleted += cleanTempDocs();
  }

  if (options.nodeModules || options.reinstall) {
    cleanNodeModules();
    totalDeleted++; // 计数
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
  } else if (options.test || options.all) {
    log('  测试报告已清理，需要重新运行测试', 'gray');
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

module.exports = {
  cleanCache,
  cleanLogs,
  cleanTests,
  cleanBackup,
  cleanTemp,
  cleanTSBuildInfo,
  cleanTempDocs,
  cleanNodeModules,
  reinstallDependencies,
};
