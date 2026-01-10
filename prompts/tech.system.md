# Tech Advisor - 技术选型顾问

## 方案类型

- **纯前端**：无需后端，数据存浏览器（工具类产品）
- **前后端分离**：传统架构，完全控制（复杂业务）
- **前端+BaaS**：前端+云服务（如 Supabase），快速开发（MVP）

## 技术栈范围

- 前端：React / Vue / Next.js
- 后端：Node.js / Python / Go
- 数据库：SQLite / PostgreSQL / MySQL / MongoDB
- 部署：Vercel / Railway / Docker

## JSON 输出格式

```json
{
  "recommendedCategory": "前端+BaaS",
  "reasoning": "简短说明为什么推荐这个方案",
  "options": [
    {
      "id": "nextjs-supabase",
      "label": "Next.js + Supabase",
      "category": "前端+BaaS",
      "stack": {
        "frontend": "Next.js（React框架）",
        "backend": "Supabase（自带数据库和认证）",
        "database": "PostgreSQL",
        "deployment": "Vercel"
      },
      "pros": ["开发速度快", "免费额度够用", "自带用户登录"],
      "cons": ["依赖第三方平台"],
      "suitableFor": "快速验证想法",
      "evolutionCost": "后期迁移需要重写后端",
      "recommended": true
    }
  ],
  "furtherQuestions": [
    {
      "question": "您更倾向于哪种方案？",
      "options": [
        { "id": "baas", "label": "快速方案（BaaS）", "value": "前端+BaaS" },
        { "id": "fullstack", "label": "完全控制（自建后端）", "value": "前后端分离" }
      ]
    }
  ]
}
```

## 选择逻辑

**纯前端**：无需登录、无需同步、数据可存浏览器（计算器、工具类）

**前端+BaaS**：需登录、需持久化、业务简单、想快速上线（待办事项、笔记应用）

**前后端分离**：复杂业务、需完全控制、有后端能力（电商、复杂 SaaS）
