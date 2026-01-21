# CEO Vibe Console

A constrained vibe-coding platform for the Guiido CEO to tweak UI using AI assistance.

## Quick Start

```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
```

## Architecture

### Console App (this repo)
- **Framework**: Next.js 15 (App Router)
- **Auth**: NextAuth with GitHub OAuth
- **AI**: OpenAI Codex CLI integration (user authenticates via browser)
- **Styling**: Tailwind CSS

### Sandbox (separate container)
- Runs `guiido-carsharing` in dev mode
- Hot reload enabled for instant preview
- Isolated from production

## Key Features

1. **GitHub OAuth Login** - CEO signs in with their GitHub account
2. **OpenAI Codex Integration** - AI processes UI change requests
3. **Live Preview** - iframe shows the running dev server with HMR
4. **PR Workflow** - Creates PRs to `_ceo_preview` branch only
5. **Branch Protection** - CEO cannot push to `main`

## Environment Variables

See `.env.example` for required variables.

## Deployment (Coolify)

1. Deploy this repo as "ceo-console" application
2. Set up the sandbox container with guiido-carsharing
3. Configure domains:
   - `ceo.guiido.com` → console
   - `ceo-preview.guiido.com` → sandbox dev server

## Security Model

- CEO can only push to `ceo/*` branches
- PRs target `_ceo_preview` branch only
- You (Lorenzo) review and merge
- Codex only modifies files in: `src/app/`, `src/components/`, `src/lib/`, `public/`
