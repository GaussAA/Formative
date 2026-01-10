import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/helper';
import promptManager, { PromptType } from '@/lib/prompts';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, requirement, riskApproach, techStack, mvpBoundary, diagrams } = body;

    if (!requirement) {
      return NextResponse.json(
        { error: 'Requirement profile is required' },
        { status: 400 }
      );
    }

    logger.info('Generate spec API called', { sessionId });

    // 获取文档生成提示词
    const systemPrompt = await promptManager.getPrompt(PromptType.SPEC);

    // 注意：diagrams 数据不参与上下文，避免上下文爆炸
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

    let document = await callLLM(systemPrompt, contextMessage);

    // 在文档中插入图表（在技术方案章节之后）
    if (diagrams && (diagrams.architectureDiagram || diagrams.sequenceDiagram)) {
      const diagramsSection = generateDiagramsSection(diagrams);

      // 尝试在 "数据与API设计" 之前插入图表章节
      const apiDesignHeader = /##?\s*数据与API设计/;
      if (apiDesignHeader.test(document)) {
        document = document.replace(apiDesignHeader, `${diagramsSection}\n\n$&`);
      } else {
        // 如果找不到特定章节，直接添加到文档末尾
        document = `${document}\n\n${diagramsSection}`;
      }
    }

    logger.info('Specification document generated', {
      sessionId,
      length: document.length,
    });

    return NextResponse.json({
      document,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Generate spec API error', { error: errorMessage, stack: errorStack });

    return NextResponse.json(
      {
        error: true,
        message: '文档生成失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// 生成图表章节的 Markdown 内容
interface DiagramsData {
  architectureDiagram?: {
    mermaidCode: string;
    description?: string;
  };
  sequenceDiagram?: {
    mermaidCode: string;
    description?: string;
  };
}

function generateDiagramsSection(diagrams: DiagramsData): string {
  let section = '## 系统设计图\n\n';

  if (diagrams.architectureDiagram) {
    section += '### 系统架构图\n\n';
    if (diagrams.architectureDiagram.description) {
      section += `${diagrams.architectureDiagram.description}\n\n`;
    }
    section += '```mermaid\n';
    section += diagrams.architectureDiagram.mermaidCode;
    section += '\n```\n\n';
  }

  if (diagrams.sequenceDiagram) {
    section += '### 核心流程时序图\n\n';
    if (diagrams.sequenceDiagram.description) {
      section += `${diagrams.sequenceDiagram.description}\n\n`;
    }
    section += '```mermaid\n';
    section += diagrams.sequenceDiagram.mermaidCode;
    section += '\n```\n\n';
  }

  return section;
}
