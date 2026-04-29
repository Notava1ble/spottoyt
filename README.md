# SpottoYT

Local-first Spotify to YouTube Music playlist conversion app.

## Stack

- Bun workspace monorepo
- React + Vite frontend
- Shared shadcn-style UI package
- Fastify backend
- Shared TypeScript/Zod contracts
- Reserved Python worker for future `ytmusicapi`

## Commands

```bash
bun install
bun run dev
bun run test
bun run typecheck
bun run lint
```

## Workspace

```text
apps/web            React app shell
apps/api            Local Fastify API
apps/ytmusic-worker Future Python YouTube Music adapter
packages/shared     Shared schemas and types
packages/ui         Shared shadcn components and Tailwind theme tokens
```
