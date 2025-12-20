import { NextRequest, NextResponse } from 'next/server';
import { callLLMWithJSON } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';
import { RiskSeverity, RequirementProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface RiskAnalysisResult {
  risks: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    impact?: string[];
  }>;
  approaches: Array<{
    id: string;
    name: string;
    label: string;
    description: string;
    pros: string[];
    cons: string[];
    timeline?: string;
    complexity?: string;
    recommended?: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, profile } = body;

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile is required' },
        { status: 400 }
      );
    }

    logger.info('Analyze risks API called', { sessionId });

    // 获取风险分析提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.RISK);

    const contextMessage = `
需求画像：
${JSON.stringify(profile, null, 2)}

请分析潜在风险并提供2-3种可选实施方案。
返回JSON格式，包含以下字段：
{
  "risks": [
    {
      "type": "风险类型",
      "description": "风险描述",
      "severity": "low/medium/high",
      "impact": ["影响点1", "影响点2"]
    }
  ],
  "approaches": [
    {
      "id": "approach-id",
      "name": "方案简称",
      "label": "方案完整名称",
      "description": "方案描述",
      "pros": ["优点1", "优点2"],
      "cons": ["缺点1", "缺点2"],
      "timeline": "开发周期",
      "complexity": "技术复杂度",
      "recommended": true/false
    }
  ]
}
`;

    const result = await callLLMWithJSON<RiskAnalysisResult>(systemPrompt, contextMessage);

    // 转换为前端需要的格式
    const risks = result.risks.map((r) => ({
      id: uuidv4(),
      type: r.type,
      description: r.description,
      severity: r.severity as RiskSeverity,
      impact: r.impact,
    }));

    const approaches = result.approaches.map((a) => ({
      id: a.id || uuidv4(),
      name: a.name,
      label: a.label,
      description: a.description,
      pros: a.pros,
      cons: a.cons,
      timeline: a.timeline,
      complexity: a.complexity,
      recommended: a.recommended || false,
    }));

    logger.info('Risk analysis completed', {
      sessionId,
      risksCount: risks.length,
      approachesCount: approaches.length,
    });

    return NextResponse.json({
      risks,
      approaches,
    });
  } catch (error: any) {
    logger.error('Analyze risks API error', { error: error.message, stack: error.stack });

    return NextResponse.json(
      {
        error: true,
        message: '风险分析失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
