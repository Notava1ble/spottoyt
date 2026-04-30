# SpottoYT

Local-first Spotify to YouTube Music playlist conversion app.

## Stack

- Bun workspace monorepo
- React + Vite frontend
- Shared shadcn-style UI package
- Fastify backend
- Shared TypeScript/Zod contracts
- Spicetify extension for local Spotify desktop imports
- Reserved Python worker for future `ytmusicapi`

## Commands

```bash
bun install
bun run dev
bun run test
bun run typecheck
bun run lint
bun run build:spicetify
```

## Workspace

```text
apps/web            React app shell
apps/api            Local Fastify API
apps/spicetify-extension Spotify desktop bridge
apps/ytmusic-worker Future Python YouTube Music adapter
packages/shared     Shared schemas and types
packages/ui         Shared shadcn components and Tailwind theme tokens
```

## Spotify Import

The Spicetify extension in `apps/spicetify-extension` pushes the currently open
Spotify desktop playlist to the local API and updates the website through
server-sent events.

See `docs/spicetify-extension.md` for local setup.
