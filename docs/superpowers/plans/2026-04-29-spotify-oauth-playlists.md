# Spotify OAuth Playlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real local Spotify OAuth login and playlist listing without exposing secrets to the client.

**Architecture:** Add a focused Spotify auth/token service behind the Fastify API, expand shared contracts for auth status and playlist summaries, and update the React Convert/Settings surfaces to call the local API. Tokens remain in memory for this milestone so the feature can be tested before durable local storage is introduced.

**Tech Stack:** Bun workspaces, Fastify, React/Vite, TanStack Query, Zod shared contracts, Vitest.

---

### Task 1: Shared Contracts

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/types.ts`
- Test: `packages/shared/src/schemas.test.ts`

- [ ] Add `configured` and `error` to connection status.
- [ ] Add `spotifyPlaylistSummarySchema` and `spotifyPlaylistsResponseSchema`.
- [ ] Write schema tests for playlist summaries and account status parsing.
- [ ] Run `bun run test:shared`.
- [ ] Commit with `feat: add spotify playlist contracts`.

### Task 2: Spotify OAuth API

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Create: `apps/api/src/services/spotify-auth.service.ts`
- Modify: `apps/api/src/services/spotify.service.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] Write failing Fastify inject tests for `/auth/status`, `/auth/spotify/login`, `/auth/spotify/callback`, `/auth/spotify/logout`, and `/spotify/playlists`.
- [ ] Implement environment reads for Spotify client ID, client secret, and redirect URI.
- [ ] Implement OAuth state generation/validation and token exchange through Spotify Accounts.
- [ ] Implement token refresh and normalized playlist fetching through Spotify Web API.
- [ ] Keep tokens in memory and never serialize access or refresh tokens to the client.
- [ ] Run `bun run test:api`.
- [ ] Commit with `feat: add spotify oauth api`.

### Task 3: Web Settings And Convert UI

**Files:**
- Modify: `apps/web/src/lib/apiClient.ts`
- Modify: `apps/web/src/components/auth/AccountConnectionCard.tsx`
- Create: `apps/web/src/components/conversion/SpotifyPlaylistPicker.tsx`
- Modify: `apps/web/src/components/conversion/PlaylistImportPanel.tsx`
- Modify: `apps/web/src/pages/ConvertPage.tsx`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

- [ ] Write failing React tests for disconnected config, connect action, and playlist picker rendering.
- [ ] Add API helpers for auth status, Spotify playlists, and logout.
- [ ] Wire Settings to show callback URI and config state.
- [ ] Wire Convert to show Connect when disconnected and playlists when connected.
- [ ] Keep the existing URL import fallback visible.
- [ ] Run `bun run test:web`.
- [ ] Commit with `feat: show spotify login and playlists`.

### Task 4: Local Config And Verification

**Files:**
- Modify: `.env.example`
- Local only: `.env`

- [ ] Confirm `.env.example` documents the Spotify callback URI.
- [ ] Add the provided credentials to local `.env` only.
- [ ] Run `bun run typecheck`.
- [ ] Run focused tests, then `bun run test` if the focused checks are clean.
- [ ] Commit tracked config docs if changed with `docs: document spotify oauth config`.
