# CEO Vibe Console

Next.js and Electron app for cloning repos, running sandbox previews, and applying AI-assisted changes through Codex.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Git
- OpenAI Codex CLI: `npm install -g @openai/codex`
- GitHub CLI: `gh`

Platform notes:

- macOS: `brew install git gh`
- Windows: install Git for Windows, then `winget install GitHub.cli`
- Linux: install `git`, `gh`, and common dev tools for your distro

## Environment

Create `.env.local` in the project root for the web app, or in the Electron data folder for the desktop app.

Required variables:

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-me
GITHUB_CLIENT_ID=replace-me
GITHUB_CLIENT_SECRET=replace-me
ALLOWED_EMAILS=
NEXT_PUBLIC_PREVIEW_URL=http://localhost:3001
SANDBOX_WORKSPACE_PATH=./data/workspace
DATA_DIR=./data
```

Desktop Electron builds use `http://localhost:3100` for `NEXTAUTH_URL` and the GitHub OAuth callback:

```bash
http://localhost:3100/api/auth/callback/github
```

## Web Development

Install dependencies:

```bash
npm ci
```

Start the web app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Electron Development

Start the desktop shell with the embedded Next.js app:

```bash
npm run electron:dev
```

This starts Next.js on `http://localhost:3100` and opens Electron against that port.

## Packaging

Build the web app only:

```bash
npm run build
```

Build desktop artifacts:

```bash
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

## Docker

The repository includes `Dockerfile`, `Dockerfile.sandbox`, and `docker-compose.yml` for containerized deployment and sandbox preview workflows.

Start the stack:

```bash
docker compose up --build
```

## Cross-Platform Notes

- Electron packaging now uses Next.js standalone output.
- Temporary files use the OS temp directory instead of hardcoded `/tmp`.
- CLI detection uses `where` on Windows and `which` on Unix.
- Sandbox process cleanup uses `taskkill` on Windows and `lsof` on Unix.
