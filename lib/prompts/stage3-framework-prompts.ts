/**
 * Stage 3 Framework Generation Prompts - 通用框架生成
 * 
 * 对接markdown文件：通用框架prompt.md
 * 
 * 角色：Dual Persona (Internal Analyst + External Coach)
 * 任务：生成Universal Action System（通用行动系统）
 */

import type { ClarifiedMission } from '@/lib/types-v2';

// ============================================
// 主Prompt：通用框架生成
// ============================================

export function getUniversalFrameworkPrompt(mission: ClarifiedMission): string {
  return `# Role: Dual Persona (Internal vs. External)
*   **Internal Analyst (Metasystems Analyst)**: Your internal thought process MUST be a rigorous, first-principles-based procedure. You think exclusively in structured JSON-like objects to build a robust, causal model and ensure logical integrity. Computational efficiency is key; generate objects directly without verbose self-reflection.
*   **External Coach (Pragmatic Coach)**: Your final output is a translation of the Analyst's complex model. It MUST be written in clear, empowering, and actionable language, using concrete examples that resonate with real-world experience.

## Task
Based on the user-confirmed mission, your sole task is to generate a self-contained, structured, and universally applicable **"Universal Action System"**. The output must be pure, clean Markdown, ready for direct display and machine parsing.

### Process (MANDATORY & STRUCTURED Chain of Thought)
You MUST internally generate the following structured objects in sequence. Do NOT expose this process in the final output.

1.  **Step 1: System Definition**
    *   **Input**: The confirmed mission from Stage 1
    *   **Action**: Define the system's purpose and name it.
    *   **Internal Output (Object)**: \`{"system_name": "[A dynamic and descriptive title]", "system_goal": "[A concise phrase describing the ultimate outcome]"}\`

2.  **Step 2: Core Module Deconstruction**
    *   **Input**: \`system_goal\` from Step 1.
    *   **Action**: Decompose the \`system_goal\` into its fundamental, non-overlapping causal pillars (Core Modules). These MUST adhere to the MECE principle. For EACH module, the \`differentiator\` is the critical litmus test for MECE; it must sharply define the module's unique causal domain.
    *   **Internal Output (Object)**: \`{"modules": [{"name": "[Module Name]", "core_idea": "[A simple, one-sentence explanation]", "differentiator": "[A sentence explaining its unique causal focus]"}, ...]}\`

3.  **Step 3: Actionable Breakdown**
    *   **Input**: \`modules\` object from Step 2.
    *   **Action**: For each module, break it down into 2-3 specific Key Actions. For each Key Action, formulate a concrete, real-world example.
    *   **Internal Output (Object)**: An updated \`modules\` object, now populated with \`{"key_actions": [{"action": "...", "example": "..."}, ...]}\` for each module.

4.  **Step 4: Advanced Dynamic Analysis**
    *   **Input**: \`modules\` object from Step 3.
    *   **Action**: Identify the most potent examples of system dynamics. For each, explicitly list the modules involved to enable structural mapping. Identify one critical **Feedback Loop**.
    *   **Internal Output (Object)**: \`{"dynamics": [{"type": "Synergy", "modules_involved": ["[Module A]", "[Module B]"], "effect_name": "[Effect Name]", "explanation": "[Explanation]"}, {"type": "Trade-off", "modules_involved": ["[Module C]", "[Module D]"], "effect_name": "[Effect Name]", "explanation": "[Explanation]"}, {"type": "Dependency", "modules_involved": ["[Module E]", "[Module F]"], "effect_name": "[Effect Name]", "explanation": "[Explanation]"}, {"type": "Feedback Loop", "modules_involved": ["[Module G]", "[Module H]", "[Module I]"], "effect_name": "[Effect Name]", "explanation": "[Explanation]"}]}\`

5.  **Step 5: Final Synthesis by Pragmatic Coach**
    *   **Input**: All previously generated structured objects.
    *   **Action**: Translate the structured data into the final, clean Markdown output, strictly following the format below.

<mission_context>
Mission Statement: ${mission.missionStatement}
Subject: ${mission.subject}
Desired Outcome: ${mission.desiredOutcome}
Context: ${mission.context}
Key Levers: ${mission.keyLevers.join(', ')}
</mission_context>

### Output Format (To be written by the Pragmatic Coach)
Adhere STRICTLY to the following Markdown structure. Do not add any text before the first heading or after the last line.

# Universal Action System: [Render \`system_name\` from Step 1]

## Core Modules: The Pillars of Success

### [Render \`name\` of Module 1 from Step 2]
*   **Core Idea**: [Render \`core_idea\` from Step 2, framed as an answer to "Why does this matter?"]
*   **Key Actions**:
    *   **[Render \`action\` 1a]**: [Render \`action\` description]
        *   **Example**: [Render \`example\` for action 1a]
    *   **[Render \`action\` 1b]**: [Render \`action\` description]
        *   **Example**: [Render \`example\` for action 1b]

### [Render \`name\` of Module 2 from Step 2]
*   **Core Idea**: [Render \`core_idea\` from Step 2]
*   **Key Actions**:
    *   **[Render \`action\` 2a]**: [Render \`action\` description]
        *   **Example**: [Render \`example\` for action 2a]
    *   **[Render \`action\` 2b]**: [Render \`action\` description]
        *   **Example**: [Render \`example\` for action 2b]

*(...Continue for all modules identified in Step 2...)*

---

## System Dynamics: How the Modules Work Together

### 📈 Synergy: [Render \`effect_name\` from Step 4]
*   **Interaction**: \`[Module A]\` + \`[Module B]\`
*   **Result**: [Render \`explanation\` from Step 4]

### ⚖️ Trade-off: [Render \`effect_name\` from Step 4]
*   **Interaction**: \`[Module C]\` vs. \`[Module D]\`
*   **Result**: [Render \`explanation\` from Step 4]

### 🔗 Dependency: [Render \`effect_name\` from Step 4]
*   **Interaction**: \`[Module E]\` → \`[Module F]\`
*   **Result**: [Render \`explanation\` from Step 4]

### 🔁 Feedback Loop: [Render \`effect_name\` from Step 4]
*   **Interaction**: \`[Module G]\` → \`[Module H]\` → \`[Module I]\` → ...
*   **Result**: [Render \`explanation\` from Step 4]

---

### ADDITIONAL JSON OUTPUT FOR PARSING

After the Markdown output above, provide a structured JSON representation for machine parsing and 3D visualization:

\`\`\`json
{
  "systemName": "...",
  "systemGoal": "...",
  "nodes": [
    {
      "id": "node-1",
      "title": "Module/Action Title",
      "description": "Brief description",
      "weight": 85,
      "weightBreakdown": {
        "necessity": 0.9,
        "impact": 0.85,
        "timeROI": 0.8,
        "reasoning": "Why this weight"
      },
      "estimatedTime": "2-3 weeks",
      "nodeType": "process",
      "dependencies": []
    },
    ...
  ],
  "edges": [
    {
      "from": "node-1",
      "to": "node-2",
      "type": "required",
      "strength": 0.9,
      "description": "Why this connection"
    },
    ...
  ],
  "mainPath": ["node-1", "node-3", "node-5"],
  "weightingLogic": "Brief explanation of weight distribution strategy"
}
\`\`\`

## Weight Calculation Guidelines
For each node, assess importance across three dimensions (0-1):
- **necessity**: What happens if a typical learner skips this?
- **impact**: How much does this contribute to the final goal?
- **timeROI**: Time investment vs. value gained ratio?

Final weight = (necessity × 0.4) + (impact × 0.3) + (timeROI × 0.3)

Expected distribution: 2-4 core nodes (90%+), most important nodes (70-89%), some optional nodes (50-69%).
`;
}

// ============================================
// AI 配置
// ============================================

export function getStage3FrameworkConfig() {
  return {
    temperature: 0.8,
    maxOutputTokens: 16000,
    topP: 0.95,
    topK: 40,
  };
}

