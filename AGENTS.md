# Creator — Agent Instructions

## Project Goal

Creator is a professional AI-powered web application for automatically turning raw Dead by Daylight gameplay into high-quality long-form YouTube videos.

The application will eventually handle:
- gameplay upload
- video analysis
- story generation
- voiceover generation
- automated editing
- video rendering
- quality control

The current priority is long-form YouTube content.

Shorts, TikTok, Instagram Reels, billing, and unrelated SaaS features are out of scope unless explicitly requested.

## Core Rules

1. Only implement the scope explicitly requested in the current task.
2. Do not add unrelated features or infrastructure.
3. Do not make major architectural changes without explicit instruction.
4. Never commit secrets, API keys, credentials, or private tokens.
5. Prefer simple, maintainable, production-quality solutions over unnecessary complexity.
6. Use strict TypeScript where TypeScript is used.
7. Do not silently ignore errors or create unsafe fallbacks.
8. Security, data integrity, and reliability are mandatory.
9. Preserve existing working functionality unless a task explicitly requires changing it.
10. Before declaring a coding task complete, run all relevant available checks such as linting, type checking, tests, and builds.

## Development Approach

Work incrementally.

Do not attempt to build the entire product in one task.

Follow the repository documentation in `/docs` as the source of truth for architecture, scope, and implementation decisions.
