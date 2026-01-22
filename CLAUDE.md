# Vibe Console

A constrained vibe-coding platform to tweak UI using AI assistance.

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
- Runs selected repo in dev mode
- Hot reload enabled for instant preview
- Isolated from production

## Key Features

1. **GitHub OAuth Login** - User signs in with their GitHub account
2. **Repo Selector** - User picks which repo to work on (any repo they have push access to)
3. **OpenAI Codex Integration** - AI processes UI change requests
4. **Live Preview** - iframe shows the running dev server with HMR
5. **PR Workflow** - Auto-creates branches like `vibe/2024-01-22-1430-fix-button` and PRs
6. **Branch Protection** - App never pushes to main/master/production directly

## Environment Variables

See `.env.example` for required variables.

## Deployment (Coolify)

1. Deploy this repo as "vibe-console" application
2. Set up the sandbox container with workspace volume
3. Configure domains:
   - `ceo.guiido.com` → console
   - `ceo-preview.guiido.com` → sandbox dev server

## Security Model

- App never pushes directly to protected branches (main, master, production, prod, release)
- All changes go through auto-named branches: `vibe/<date>-<time>-<slug>`
- PRs target the repo's default branch
- Repo owner sets branch protection rules on GitHub (require PR reviews, etc.)
- `ALLOWED_EMAILS` env var restricts who can log in
