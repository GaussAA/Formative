#!/bin/bash

# Logger 系统快速启动脚本

echo "=========================================="
echo "Logger 系统快速启动"
echo "=========================================="
echo ""

echo "📋 功能清单："
echo "  • 5 个日志级别：DEBUG, INFO, WARN, ERROR, CRITICAL"
echo "  • JSON 格式输出（开发/生产环境差异化）"
echo "  • 敏感数据自动脱敏"
echo "  • TraceId 分布式追踪"
echo "  • 源码位置追踪"
echo ""

echo "🚀 快速使用："
echo ""
echo "  import logger from '@/lib/logger';"
echo ""
echo "  logger.debug('Debug message', { data: 'value' });"
echo "  logger.info('Info message', { userId: 123 });"
echo "  logger.warn('Warning', { remaining: 10 });"
echo "  logger.error('Error', error);"
echo "  logger.critical('Critical', { system: 'db' }, error);"
echo ""

echo "📖 文档："
echo "  • 快速指南: src/lib/logger/README.md"
echo "  • 完整文档: docs/logging-system.md"
echo "  • 实施总结: docs/logging-system-summary.md"
echo ""

echo "🧪 测试验证："
read -p "是否运行测试验证? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "运行 Logger 单元测试..."
    pnpm test:unit tests/unit/lib/logger/index.test.ts
    echo ""
    echo "✅ 测试完成！"
fi

echo ""
echo "=========================================="
echo "Logger 系统已就绪！"
echo "=========================================="
