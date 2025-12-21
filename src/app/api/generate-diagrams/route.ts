import { NextRequest, NextResponse } from 'next/server';
import { callLLMWithJSON } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';

interface DiagramsResult {
  architectureDiagram: {
    mermaidCode: string;
    description: string;
  };
  sequenceDiagram: {
    mermaidCode: string;
    description: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirement, techStack, mvpFeatures } = body;

    if (!requirement) {
      return NextResponse.json(
        { error: 'Requirement is required' },
        { status: 400 }
      );
    }

    logger.info('Generate diagrams API called');

    // 获取图表生成提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.DIAGRAM);

    const contextMessage = `
需求画像：
${JSON.stringify(requirement, null, 2)}

${techStack ? `选择的技术栈：\n${JSON.stringify(techStack, null, 2)}` : ''}

${mvpFeatures ? `MVP 功能列表：\n${JSON.stringify(mvpFeatures.filter((f: any) => f.inMVP).map((f: any) => f.name), null, 2)}` : ''}

请生成系统架构图和核心流程时序图的 Mermaid 代码。

返回 JSON 格式，包含以下字段：
{
  "architectureDiagram": {
    "mermaidCode": "完整的 Mermaid 架构图代码（使用 graph TD 或 flowchart TD）",
    "description": "架构图简要说明"
  },
  "sequenceDiagram": {
    "mermaidCode": "完整的 Mermaid 时序图代码（使用 sequenceDiagram）",
    "description": "时序图简要说明"
  }
}

注意：
1. 架构图应展示系统的主要组件及其关系（前端、后端、数据库、缓存等）
2. 时序图应展示核心用户流程（如用户注册登录、核心功能使用等）
3. Mermaid 代码必须是有效的语法
4. 使用中文标签，但节点 ID 使用英文
`;

    const result = await callLLMWithJSON<DiagramsResult>(systemPrompt, contextMessage);

    // 转换为前端需要的格式
    const response = {
      architectureDiagram: {
        type: 'architecture' as const,
        mermaidCode: result.architectureDiagram.mermaidCode,
        description: result.architectureDiagram.description,
      },
      sequenceDiagram: {
        type: 'sequence' as const,
        mermaidCode: result.sequenceDiagram.mermaidCode,
        description: result.sequenceDiagram.description,
      },
    };

    logger.info('Diagrams generated successfully');

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error('Error in generate-diagrams API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
