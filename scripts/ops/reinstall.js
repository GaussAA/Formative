#!/usr/bin/env node

/**
 * 依赖重装脚本
 * 功能：
 * 1. 备份当前依赖状态
 * 2. 删除 node_modules 和 lock 文件
 * 3. 重新安装依赖
 * 4. 验证安装结果
 * 5. 可选：验证构建
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  ROOT: path.join(__dirname, '../../'),
  BACKUP_DIR: path.join(__dirname, '../../.backup/'),
  MANAGERS: ['pnpm', 'npm', 'yarn'],
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
 * 检测包管理器
 */
function detectPackageManager() {
  log('检测包管理器...', 'blue');

  // 检查 lock 文件
  if (fs.existsSync(path.join(CONFIG.ROOT, 'pnpm-lock.yaml'))) {
    log('✅ 检测到 pnpm', 'green');
    return 'pnpm';
  }
  if (fs.existsSync(path.join(CONFIG.ROOT, 'package-lock.json'))) {
    log('✅ 检测到 npm', 'green');
    return 'npm';
  }
  if (fs.existsSync(path.join(CONFIG.ROOT, 'yarn.lock'))) {
    log('✅ 检测到 yarn', 'green');
    return 'yarn';
  }

  // 检查 package.json 中的 packageManager 字段
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(CONFIG.ROOT, 'package.json'), 'utf8'));
    if (pkg.packageManager) {
      const manager = pkg.packageManager.split('@')[0];
      log(`✅ 从 package.json 检测到 ${manager}`, 'green');
      return manager;
    }
  } catch {}

  log('⚠️ 未检测到包管理器，默认使用 pnpm', 'yellow');
  return 'pnpm';
}

/**
 * 备份当前依赖状态
 */
function backupDependencies() {
  log('\n备份当前依赖状态...', 'blue');

  if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
    fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(CONFIG.BACKUP_DIR, `backup-${timestamp}`);

  fs.mkdirSync(backupPath, { recursive: true });

  const filesToBackup = [
    'package.json',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
  ];

  let backedUp = 0;

  filesToBackup.forEach(file => {
    const src = path.join(CONFIG.ROOT, file);
    const dest = path.join(backupPath, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      log(`✅ 备份: ${file}`, 'gray');
      backedUp++;
    }
  });

  if (backedUp > 0) {
    log(`💡 备份位置: ${backupPath}`, 'cyan');
  }

  return backedUp;
}

/**
 * 删除依赖文件
 */
function deleteDependencies() {
  log('\n删除依赖文件...', 'blue');

  const targets = [
    'node_modules',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
  ];

  let deleted = 0;

  targets.forEach(target => {
    const fullPath = path.join(CONFIG.ROOT, target);

    if (fs.existsSync(fullPath)) {
      try {
        if (fs.lstatSync(fullPath).isDirectory()) {
          execSync(`rm -rf "${fullPath}"`, { stdio: 'ignore' });
        } else {
          fs.unlinkSync(fullPath);
        }
        log(`✅ 已删除: ${target}`, 'green');
        deleted++;
      } catch (error) {
        log(`❌ 删除失败: ${target} - ${error.message}`, 'red');
      }
    } else {
      log(`不存在: ${target}`, 'gray');
    }
  });

  return deleted;
}

/**
 * 安装依赖
 */
function installDependencies(manager, options) {
  log(`\n使用 ${manager} 安装依赖...`, 'blue');

  const installCmd = {
    pnpm: 'pnpm install',
    npm: 'npm install',
    yarn: 'yarn install',
  };

  const cmd = installCmd[manager] || 'pnpm install';

  try {
    const startTime = Date.now();

    // 显示安装进度
    log(`正在执行: ${cmd}`, 'cyan');

    execSync(cmd, {
      cwd: CONFIG.ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        // 某些包管理器需要的颜色控制
        FORCE_COLOR: 'true',
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ 依赖安装完成 (${duration}s)`, 'green');

    return true;
  } catch (error) {
    log(`❌ 安装失败: ${error.message}`, 'red');
    return false;
  }
}

/**
 * 验证安装结果
 */
function verifyInstallation() {
  log('\n验证安装结果...', 'blue');

  // 检查 node_modules 是否存在
  const nodeModulesPath = path.join(CONFIG.ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('❌ node_modules 不存在', 'red');
    return false;
  }

  // 检查关键依赖
  const pkgPath = path.join(CONFIG.ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const criticalDeps = [
    'next',
    'react',
    'zod',
    'langchain',
    '@langchain/core',
  ];

  let missing = 0;
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      log(`✅ ${dep}`, 'gray');
    } else {
      log(`❌ ${dep} 未安装`, 'red');
      missing++;
    }
  });

  if (missing === 0) {
    log('✅ 所有关键依赖已安装', 'green');
    return true;
  } else {
    log(`❌ 缺失 ${missing} 个关键依赖`, 'red');
    return false;
  }
}

/**
 * 验证构建
 */
function verifyBuild() {
  log('\n验证构建...', 'blue');

  try {
    const startTime = Date.now();

    log('正在运行类型检查...', 'cyan');
    execSync('pnpm type-check', {
      cwd: CONFIG.ROOT,
      stdio: 'pipe',
    });

    const typeCheckTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ 类型检查通过 (${typeCheckTime}s)`, 'green');

    log('正在运行 ESLint...', 'cyan');
    execSync('pnpm lint', {
      cwd: CONFIG.ROOT,
      stdio: 'pipe',
    });

    const lintTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ ESLint 检查通过 (${lintTime}s)`, 'green');

    return true;
  } catch (error) {
    log(`❌ 验证失败: ${error.message}`, 'red');
    return false;
  }
}

/**
 * 显示依赖树统计
 */
function showDependencyStats() {
  log('\n依赖统计...', 'blue');

  try {
    const pkgPath = path.join(CONFIG.ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const deps = pkg.dependencies ? Object.keys(pkg.dependencies).length : 0;
    const devDeps = pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0;

    log(`生产依赖: ${deps} 个`, 'gray');
    log(`开发依赖: ${devDeps} 个`, 'gray');
    log(`总计: ${deps + devDeps} 个`, 'gray');

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
        log(`node_modules 大小: ${size}`, 'gray');
      } catch {}
    }
  } catch (error) {
    log(`无法读取统计: ${error.message}`, 'yellow');
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  log('\n用法: node reinstall.js [选项]', 'cyan');
  log('\n选项:', 'yellow');
  log('  --manager <name>  指定包管理器 (pnpm|npm|yarn)', 'gray');
  log('  --no-backup       跳过备份', 'gray');
  log('  --verify          安装后验证构建', 'gray');
  log('  --build           运行完整构建验证', 'gray');
  log('  --force, -f       不询问直接执行', 'gray');
  log('  --help, -h        显示此帮助信息', 'gray');
  log('\n示例:', 'yellow');
  log('  node reinstall.js              # 自动检测并重装', 'gray');
  log('  node reinstall.js --manager npm # 使用 npm', 'gray');
  log('  node reinstall.js --verify     # 安装后验证', 'gray');
  log('  node reinstall.js --build --force # 强制完整验证', 'gray');
}

/**
 * 主函数
 */
function main() {
  log('════════════════ Formative 依赖重装助手 ════════════════', 'cyan');

  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // 解析参数
  const options = {
    manager: null,
    backup: !args.includes('--no-backup'),
    verify: args.includes('--verify') || args.includes('--build'),
    build: args.includes('--build'),
    force: args.includes('--force') || args.includes('-f'),
  };

  // 获取 manager
  const managerIndex = args.indexOf('--manager');
  if (managerIndex !== -1 && args[managerIndex + 1]) {
    options.manager = args[managerIndex + 1];
  }

  // 步骤1: 确认包管理器
  const manager = options.manager || detectPackageManager();

  if (!CONFIG.MANAGERS.includes(manager)) {
    log(`❌ 不支持的包管理器: ${manager}`, 'red');
    process.exit(1);
  }

  // 步骤2: 备份
  if (options.backup) {
    const backedUp = backupDependencies();
    if (backedUp === 0) {
      log('⚠️ 没有可备份的文件', 'yellow');
    }
  } else {
    log('⚠️ 跳过备份', 'yellow');
  }

  // 步骤3: 确认删除
  if (!options.force) {
    const readline = require('readline-sync');
    log('\n⚠️  即将删除 node_modules 和 lock 文件', 'yellow');
    const answer = readline.question('确认继续? (y/N): ');

    if (answer.toLowerCase() !== 'y') {
      log('❌ 已取消操作', 'red');
      process.exit(0);
    }
  }

  // 步骤4: 删除依赖
  const deleted = deleteDependencies();

  if (deleted === 0) {
    log('⚠️ 没有删除任何文件', 'yellow');
  }

  // 步骤5: 安装依赖
  const success = installDependencies(manager, options);

  if (!success) {
    log('❌ 安装失败，请手动处理', 'red');
    process.exit(1);
  }

  // 步骤6: 验证
  if (options.verify) {
    const verified = verifyInstallation();

    if (verified && options.build) {
      verifyBuild();
    }
  }

  // 步骤7: 显示统计
  showDependencyStats();

  log('\n════════════════ 重装完成 ════════════════', 'cyan');
  log('✅ 依赖重装成功', 'green');

  if (options.verify) {
    log('✅ 验证通过', 'green');
  } else {
    log('💡 提示: 使用 --verify 参数进行验证', 'yellow');
  }

  log('\n💡 下一步:', 'cyan');
  log('  1. 运行 pnpm dev 启动项目', 'gray');
  log('  2. 检查浏览器控制台是否有错误', 'gray');
  log('  3. 如有问题，查看 .backup/ 目录恢复文件', 'gray');
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
  detectPackageManager,
  backupDependencies,
  deleteDependencies,
  installDependencies,
  verifyInstallation,
};
