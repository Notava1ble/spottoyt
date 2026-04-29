# Agent Instructions

## Project

SpottoYT is a local-first app for converting Spotify playlists into reviewed YouTube Music playlists.

## Default Workflow

- Run `git status --short` before edits.
- Protect user work: if target files contain uncommitted changes you did not make, ask before touching them.
- Push back when a requested change would create fragile architecture, expose credentials, add unnecessary tooling, or hide a refactor that should be explicit.
- Commit after each reasonable verified milestone without asking first.
- Use concise typed commit messages such as `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, or `test:`.
- Right-size verification: for small changes, prefer focused checks such as linting, typechecking, or targeted tests when useful; reserve full test/build/browser sweeps for larger refactors or risky behavior changes.
- When installing agent skills, use `skills.sh` and the Skills CLI as the source of truth, and always install skills locally to the project.
- In the final response, state that you committed and include the exact commit message.
- If you start a dev server, API server, web server, watcher, or other long-running process, stop the process before your final response unless the user explicitly asks you to leave it running.
- Do not stop a server the user started. Only clean up processes you launched.
- Keep secrets out of the client. Only `VITE_` values that are safe to expose may reach `apps/web`.

## Architecture Rules

- Use Bun workspaces.
- UI code lives in `apps/web`.
- Shared shadcn primitives and Tailwind theme tokens live in `packages/ui`.
- Fastify API code lives in `apps/api`.
- Shared request/response contracts live in `packages/shared`.
- YouTube Music access must go through `apps/ytmusic-worker` or `YtmusicService`; do not call it from React.
- Prefer small service boundaries over direct cross-layer imports.

## Commands

```bash
bun install
bun run dev
bun run test
bun run typecheck
bun run lint
```

## UI Rules

- Use Tailwind, shadcn-style local components, Radix primitives, and lucide icons.
- Prefer shadcn-style local components and Radix primitives over custom-built UI; extend existing components before creating new sidebar, navigation, dialog, form, or control primitives.
- Do not use gradients for backgrounds, panels, cards, or decorative fills unless explicitly requested or they make clear product sense for the specific surface.
- Use badges and helper copy sparingly; keep labels short and reserve badges for meaningful status, state, or metadata.
- Build app-first screens, not marketing pages.
- Keep the converter dense, calm, and operational.

## Longer Workflows

See `docs/workflows/agent-change-workflow.md`.
