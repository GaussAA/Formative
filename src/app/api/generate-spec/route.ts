import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';
import { RequirementProfile, TechStackOption, MVPFeature, DevPlan } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, requirement, riskApproach, techStack, mvpBoundary } = body;

    if (!requirement) {
      return NextResponse.json(
        { error: 'Requirement profile is required' },
        { status: 400 }
      );
    }

    logger.info('Generate spec API called', { sessionId });

    // 获取文档生成提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.SPEC);

    const contextMessage = `
请根据以下信息生成完整的开发方案文档：

需求画像：
${JSON.stringify(requirement, null, 2)}

${riskApproach ? `选择的风险方案：${riskApproach}` : ''}

${techStack ? `技术栈：\n${JSON.stringify(techStack, null, 2)}` : ''}

${mvpBoundary ? `MVP边界：\n${JSON.stringify(mvpBoundary, null, 2)}` : ''}

请生成一份完整的Markdown格式开发方案文档，包含以下章节：
1. 项目概述
2. 产品目标
3. 目标用户与使用场景
4. MVP功能范围
5. 非目标（后续版本功能）
6. 技术方案
7. 数据与API设计
8. 开发步骤
9. 下一步行动建议

文档应该清晰、详细、可执行，适合直接交给开发团队使用。
`;

    const document = await callLLM(systemPrompt, contextMessage);

    logger.info('Specification document generated', {
      sessionId,
      length: document.length,
    });

    return NextResponse.json({
      document,
    });
  } catch (error: any) {
    logger.error('Generate spec API error', { error: error.message, stack: error.stack });

    return NextResponse.json(
      {
        error: true,
        message: '文档生成失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
