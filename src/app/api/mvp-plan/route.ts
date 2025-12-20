import { NextRequest, NextResponse } from 'next/server';
import { callLLMWithJSON } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';
import { RequirementProfile, TechStackOption } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface MVPPlanResult {
  mvpFeatures: Array<{
    name: string;
    description?: string;
  }>;
  futureFeatures: Array<{
    name: string;
    description?: string;
  }>;
  devPlan: {
    phase1: string[];
    phase2?: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    estimatedWeeks?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, profile, techStack } = body;

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile is required' },
        { status: 400 }
      );
    }

    logger.info('MVP plan API called', { sessionId });

    // 获取MVP边界提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.MVP);

    const contextMessage = `
需求画像：
${JSON.stringify(profile, null, 2)}

${techStack ? `选择的技术栈：\n${JSON.stringify(techStack, null, 2)}` : ''}

请根据需求和技术栈，定义MVP的功能边界和开发计划。
返回JSON格式，包含以下字段：
{
  "mvpFeatures": [
    {
      "name": "功能名称",
      "description": "功能描述"
    }
  ],
  "futureFeatures": [
    {
      "name": "功能名称",
      "description": "功能描述"
    }
  ],
  "devPlan": {
    "phase1": ["任务1", "任务2"],
    "phase2": ["任务3", "任务4"],
    "estimatedComplexity": "low/medium/high",
    "estimatedWeeks": "预估工期"
  }
}
`;

    const result = await callLLMWithJSON<MVPPlanResult>(systemPrompt, contextMessage);

    // 转换为前端需要的格式
    const features = [
      ...result.mvpFeatures.map((f) => ({
        id: uuidv4(),
        name: f.name,
        description: f.description,
        inMVP: true,
      })),
      ...result.futureFeatures.map((f) => ({
        id: uuidv4(),
        name: f.name,
        description: f.description,
        inMVP: false,
      })),
    ];

    logger.info('MVP plan completed', {
      sessionId,
      mvpFeaturesCount: result.mvpFeatures.length,
      futureFeaturesCount: result.futureFeatures.length,
    });

    return NextResponse.json({
      features,
      devPlan: result.devPlan,
    });
  } catch (error: any) {
    logger.error('MVP plan API error', { error: error.message, stack: error.stack });

    return NextResponse.json(
      {
        error: true,
        message: 'MVP规划失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
