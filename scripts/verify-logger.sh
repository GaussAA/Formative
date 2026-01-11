#!/bin/bash

echo "=========================================="
echo "Logger 系统验证脚本"
echo "=========================================="
echo ""

echo "1. 运行类型检查..."
pnpm type-check 2>&1 | grep -E "(logger|error)" | grep -v "node_modules" || echo "✓ 类型检查通过"
echo ""

echo "2. 运行 Logger 单元测试..."
pnpm test:unit tests/unit/lib/logger/index.test.ts 2>&1 | grep -E "(passed|failed)" | tail -3
echo ""

echo "3. 检查 ESLint..."
pnpm eslint src/lib/logger/ 2>&1
if [ $? -eq 0 ]; then
    echo "✓ ESLint 检查通过"
else
    echo "⚠  检查到 ESLint 问题"
fi
echo ""

echo "4. 验证文件存在..."
files=(
    "src/lib/logger/index.ts"
    "src/lib/logger/utils.ts"
    "src/lib/logger/trace.ts"
    "src/lib/logger/README.md"
    "docs/logging-system.md"
    "docs/logging-system-summary.md"
    "tests/unit/lib/logger/index.test.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (缺失)"
    fi
done
echo ""

echo "=========================================="
echo "验证完成！"
echo "=========================================="
