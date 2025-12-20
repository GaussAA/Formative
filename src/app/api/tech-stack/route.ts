import { NextRequest, NextResponse } from 'next/server';
import { callLLMWithJSON } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';
import { RequirementProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface TechStackResult {
  category: 'frontend-only' | 'fullstack' | 'baas';
  reasoning: string;
  options: Array<{
    id?: string;
    name: string;
    category: 'frontend-only' | 'fullstack' | 'baas';
    stack: {
      frontend: string;
      backend?: string;
      database?: string;
      deployment: string;
    };
    pros: string[];
    cons: string[];
    evolutionCost: string;
    suitableFor: string;
    recommended?: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, profile, riskApproach } = body;

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile is required' },
        { status: 400 }
      );
    }

    logger.info('Tech stack API called', { sessionId });

    // 获取技术选型提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.TECH);

    const contextMessage = `
需求画像：
${JSON.stringify(profile, null, 2)}

${riskApproach ? `选择的风险方案：${riskApproach}` : ''}

请根据需求推荐合适的技术栈方案（2-3个选项）。
返回JSON格式，包含以下字段：
{
  "category": "frontend-only/fullstack/baas",
  "reasoning": "推荐理由",
  "options": [
    {
      "name": "方案名称",
      "category": "frontend-only/fullstack/baas",
      "stack": {
        "frontend": "前端技术",
        "backend": "后端技术（可选）",
        "database": "数据库（可选）",
        "deployment": "部署方案"
      },
      "pros": ["优点1", "优点2"],
      "cons": ["缺点1", "缺点2"],
      "evolutionCost": "演进成本描述",
      "suitableFor": "适合场景",
      "recommended": true/false
    }
  ]
}
`;

    const result = await callLLMWithJSON<TechStackResult>(systemPrompt, contextMessage);

    // 转换为前端需要的格式
    const options = result.options.map((opt) => ({
      id: opt.id || uuidv4(),
      name: opt.name,
      category: opt.category,
      stack: opt.stack,
      pros: opt.pros,
      cons: opt.cons,
      evolutionCost: opt.evolutionCost,
      suitableFor: opt.suitableFor,
      recommended: opt.recommended || false,
    }));

    logger.info('Tech stack recommendations completed', {
      sessionId,
      category: result.category,
      optionsCount: options.length,
    });

    return NextResponse.json({
      category: result.category,
      options,
    });
  } catch (error: any) {
    logger.error('Tech stack API error', { error: error.message, stack: error.stack });

    return NextResponse.json(
      {
        error: true,
        message: '技术栈推荐失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
