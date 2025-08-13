# Cognitive Coach

An AI-powered learning companion that guides you through a structured learning journey using the S0–S4 framework.

## Features

- S0: Intent Calibration — Clarify and refine your learning goals
- S1: Knowledge Framework — Generate structured knowledge maps
- S2: System Dynamics — Visualize relationships with Mermaid diagrams
- S3: Action Plan — Create actionable steps with KPIs and Strategy DSL
- S4: Autonomous Operation — Monitor progress and get AI coaching

### Run Tiers

- **Lite**: Fast responses using `gemini-2.5-flash-lite`, single variant generation
- **Pro**: Comprehensive analysis using `gemini-2.5-pro`, multi-variant generation with QA selection
- **Review**: Same as Pro but triggers human review for low-confidence outputs

## Tech Stack

- Next.js 15.2.4, React 19, TypeScript, Tailwind CSS
- Google Gemini (gemini-2.5-pro)
- Zustand for state management
- Mermaid for diagrams
- zod for runtime schema validation

## Environment Variables

```bash
# Google Gemini
GOOGLE_AI_API_KEY=your_key
# or
GEMINI_API_KEY=your_key

# Model configuration
GEMINI_MODEL=gemini-2.5-pro          # Default model for Pro/Review tiers
GEMINI_LITE_MODEL=gemini-2.5-flash-lite  # Faster model for Lite tier

# API
ALLOWED_ORIGINS=https://yourdomain.com,https://another.com
RATE_LIMIT_PER_MINUTE=60

# Health check protection
HEALTH_TOKEN=your_health_token

# Feature flags
ENABLE_RAG=false
```

## Quality Gates & Contracts

- Strong schemas (zod) for S0–S4 outputs; required fields include optional evidence[], confidence, applicability
- QA checks (lib/qa.ts):
  - S1 schema; S1→S2 consistency (framework ids appear in S2.nodes)
  - S2 schema and Mermaid precheck
  - S3 schema + coverage (S2.nodes → strategySpec.metrics) + actionability (triggers/diagnosis/options/recovery/stopLoss)
- Strategy DSL (lib/strategy-dsl.ts): unifies metrics → triggers → diagnosis → options → recovery/stopLoss

## Local Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Notes

- If QA fails, the UI blocks state transition and shows issues
- S2 returns nodes[] for mapping; S3 renders a Strategy table and shows VOI Top-3 and reviewWindow when present

