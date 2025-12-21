import { NextRequest, NextResponse } from 'next/server';
import { callLLMWithJSON } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';

interface UpdateDiagramResult {
  mermaidCode: string;
  description: string;
  changes: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { diagramType, currentMermaidCode, userRequest, requirement, techStack } = body;

    if (!diagramType || !currentMermaidCode || !userRequest) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    logger.info('Update diagram API called', { diagramType });

    // 获取图表更新提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.DIAGRAM_UPDATE);

    const diagramTypeLabel = diagramType === 'architecture' ? '架构图' : '时序图';

    const contextMessage = `
当前${diagramTypeLabel}的 Mermaid 代码：
\`\`\`mermaid
${currentMermaidCode}
\`\`\`

用户修改需求：
${userRequest}

需求画像（供参考）：
${JSON.stringify(requirement, null, 2)}

${techStack ? `技术栈（供参考）：\n${JSON.stringify(techStack, null, 2)}` : ''}

请根据用户的修改需求，更新 Mermaid ${diagramTypeLabel}代码。

返回 JSON 格式，包含以下字段：
{
  "mermaidCode": "更新后的完整 Mermaid 代码",
  "description": "${diagramTypeLabel}简要说明",
  "changes": "本次修改的说明"
}

注意：
1. 必须返回完整的 Mermaid 代码，不是增量修改
2. 确保语法正确且可渲染
3. 保持原有的合理部分，只修改用户要求的部分
4. 使用中文标签，但节点 ID 使用英文
`;

    const result = await callLLMWithJSON<UpdateDiagramResult>(systemPrompt, contextMessage);

    // 转换为前端需要的格式
    const response = {
      diagram: {
        type: diagramType,
        mermaidCode: result.mermaidCode,
        description: result.description,
      },
      changes: result.changes,
    };

    logger.info('Diagram updated successfully', { diagramType });

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error('Error in update-diagram API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
