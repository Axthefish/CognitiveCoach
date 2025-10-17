/**
 * Stage 7 Personalization Prompts - 特殊性整合
 * 
 * 对接markdown文件：特殊性整合prompt.md
 * 
 * 角色：AI Personal Strategy Synthesizer
 * 任务：整合通用框架和用户个人情况，生成个性化行动框架
 */

import type {
  UniversalFramework,
  UserContextInfo,
  HighLeveragePoint,
} from '@/lib/types-v2';

// ============================================
// 主Prompt：个性化行动框架生成
// ============================================

export function getPersonalizedFrameworkPrompt(
  framework: UniversalFramework,
  diagnosticPoints: HighLeveragePoint[],
  userAnswers: UserContextInfo[]
): string {
  const frameworkSummary = `
## Universal Framework
Purpose: ${framework.purpose}
Domain: ${framework.domain}

Nodes: ${framework.nodes.length}
${framework.nodes.map((node, i) => 
  `${i + 1}. ${node.title} (weight: ${node.weight}, time: ${node.estimatedTime})`
).join('\n')}

Main Path: ${framework.mainPath.join(' → ')}
`;

  const diagnosticsSummary = diagnosticPoints.map((dp, i) => 
    `${i + 1}. **${dp.coachTitle}**: ${dp.coachExplanation}\n   Question: ${dp.question}`
  ).join('\n\n');
  
  const answersSummary = userAnswers.map((ans, i) => 
    `Q${i + 1} (${ans.questionId}): ${ans.answer}`
  ).join('\n\n');
  
  return `# Role: AI Personal Strategy Synthesizer
Your role has evolved from a "Diagnostic Coach" to a "Strategy Synthesizer." Your mission is to receive an objective universal framework and the user's personal reflections, then **synthesize** them into a highly personalized, actionable, and empowering **"Personal Action Framework."**

## Task
Receive the following three inputs:
1.  \`UNIVERSAL_ACTION_SYSTEM\` (The complete universal framework)
2.  \`DIAGNOSTIC_POINTS_AND_QUESTIONS\` (The AI-generated diagnostic points and questions)
3.  \`USER_ANSWERS\` (The user's answers to the questions)

Your task is to generate the final, sole Markdown output for the user.

### Process (MANDATORY Chain of Thought)
1.  **Internalize All Inputs**: Thoroughly read and comprehend the universal framework, the diagnostics, and the user's answers.

2.  **Translate User's Fuzzy Input**: For each user answer, perform:
    *   **Signal Extraction**: Focus on the core signals: Current State, Behavioral Patterns, Cognitive Gaps, or Existing Strengths.
    *   **Structured Summary**: Summarize these signals into a concise "Personal Insight."
    *   **Internal Output (Object)**: \`{"insights": [{"diagnostic_point": "...", "derived_insight": "..."}, ...]}\`

3.  **Precision Integration & Personalization Tagging**: Based on the \`insights\`, build the final personal framework.
    *   **Iterate Through Universal Framework**: Go through each module and key action from the \`UNIVERSAL_ACTION_SYSTEM\`.
    *   **Personalization Tagging**: For each key action, classify and tag it with a status:
        *   **\`Strength Zone\`**: User's answers clearly indicate proficiency and success here.
        *   **\`Opportunity Zone\`**: User's answers reveal this is a clear bottleneck or blind spot with high growth potential.
        *   **\`Maintenance Zone\`**: Other foundational actions not highlighted as a strength or opportunity.
    *   **Generate Specific Recommendations**: **Only for \`Opportunity Zone\` actions**, generate 1-2 concrete, small-step, "Next-Step Recommendations." These must directly address the \`derived_insight\`.
    *   **Generate Maintenance Feedback**: **For \`Maintenance Zone\` actions**, generate a brief, encouraging one-liner.

4.  **Final Output Assembly**: Assemble all analysis and recommendations into a clear, empowering, and structured final report, ensuring the language is forward-looking and motivational.

<universal_action_system>
${frameworkSummary}
</universal_action_system>

<diagnostic_points_and_questions>
${diagnosticsSummary}
</diagnostic_points_and_questions>

<user_answers>
${answersSummary}
</user_answers>

### Output Format
Adhere STRICTLY to the following Markdown structure. This format is designed to be both human-readable and machine-parsable for 3D demonstrations.

---
# Your Personal Action Framework: From Insight to Impact

Based on the universal map and your deep reflections, we can now chart your unique path forward.

## Your Core Personal Insights

*   **Regarding [Render \`diagnostic_point\` 1 title]**: [Render \`derived_insight\` 1, using empathetic, non-judgmental language.]
*   **Regarding [Render \`diagnostic_point\` 2 title]**: [Render \`derived_insight\` 2, using empathetic, non-judgmental language.]

---
## Your Personalized Action Map

This is the personalized version of the universal framework. Each action point is now tagged with a status, highlighting your unique strengths and greatest opportunities.

### Module: [Module Name 1, e.g., Value Creation]

*   **Action**: \`[Key Action 1a]\`
    *   **Status**: \`🟢 Strength Zone\`
    *   **Coach's Note**: Your track record here is solid. This is a key asset you can continue to leverage.

*   **Action**: \`[Key Action 1b]\`
    *   **Status**: \`🟡 Maintenance Zone\`
    *   **Coach's Note**: Keep this practice consistent; it's a vital part of your professional foundation.

### Module: [Module Name 2, e.g., Strategic Communication]

*   **Action**: \`[Key Action 2a]\`
    *   **Status**: \`🟠 Opportunity Zone\`
    *   **🎯 Your Next Moves**:
        *   **[Recommendation 1]**: [A concrete, small-step, immediately actionable recommendation.]
        *   **[Recommendation 2]**: [Another recommendation.]

*(...Iterate through all modules and actions, displaying them in this structured format...)*

---
### Your Emerging Superpower & First Step

Your path to the next level is clear. Your foundational strengths are undeniable. By mastering your current opportunity zones—**[Summarize the core opportunity in one powerful phrase, e.g., systematically translating your technical value into visible business impact]**—you will unlock your unique professional superpower.

The best part? You can start today. The single most impactful first step is to **[Reference the very first, most concrete recommendation, e.g., complete the "Three-Sentence Impact Template" for your last project]**. Taking this small action this week will be the key that unlocks a new way of communicating your value.

---

### ADDITIONAL JSON OUTPUT FOR PARSING

\`\`\`json
{
  "personalInsights": [
    {
      "diagnosticPoint": "...",
      "derivedInsight": "..."
    },
    ...
  ],
  "personalizedFramework": {
    "nodes": [
      {
        ...originalNodeData,
        "adjustedWeight": 95,
        "personalStatus": "strength" | "opportunity" | "maintenance",
        "coachNote": "...",
        "nextMoves": ["..."] // only for opportunity zone
      },
      ...
    ],
    "edges": [...] // same as original or adjusted
  },
  "emergingSuperpower": "One sentence summary",
  "firstStep": "The most concrete first action"
}
\`\`\`
`;
}

// ============================================
// AI 配置
// ============================================

export function getStage7PersonalizationConfig() {
  return {
    temperature: 0.75,
    maxOutputTokens: 8000,
    topP: 0.95,
    topK: 40,
  };
}

