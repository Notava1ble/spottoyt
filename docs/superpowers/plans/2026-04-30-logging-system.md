# Logging System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build unified recent file logging for the web app, Fastify API, and YouTube Music worker.

**Architecture:** The API owns `.logs/spottoyt-current.jsonl` and rotates recent session files on startup. Web logs are sent to `POST /logs/client`; Python worker stderr emits JSON Lines diagnostics that the API bridge ingests into the same file.

**Tech Stack:** Bun workspaces, Fastify, Pino, Vitest, React, Python `unittest`, JSON Lines.

---

## File Structure

- Modify `.gitignore`: ignore `.logs/`.
- Modify `apps/api/src/config/env.ts`: expose logging config from `.env` and process env.
- Modify `apps/api/src/app.ts`: wire logger config, request/error hooks, and client log route.
- Modify `apps/api/src/server.ts`: log startup and shutdown lifecycle events.
- Modify `apps/api/src/services/conversion.service.ts`: log conversion lifecycle and match summaries.
- Modify `apps/api/src/services/ytmusic.service.ts`: log worker spawn/exit, parsed diagnostics, match decisions, and worker failures.
- Create `apps/api/src/logging/redact.ts`: recursive field redaction helper.
- Create `apps/api/src/logging/file-log-store.ts`: log directory creation and startup rotation.
- Create `apps/api/src/logging/logger.ts`: Pino setup plus typed `logEvent` helper.
- Create `apps/api/src/logging/client-log.routes.ts`: `POST /logs/client` endpoint.
- Create `apps/api/src/logging/worker-diagnostics.ts`: parse worker stderr JSON Lines.
- Create tests under `apps/api/src/logging/*.test.ts`.
- Modify `apps/web/src/lib/apiClient.ts`: instrument API requests while the logger sends its own endpoint calls directly.
- Create `apps/web/src/lib/logger.ts`: best-effort client logger, batching, and browser error hooks.
- Modify `apps/web/src/main.tsx`: install global browser error logging.
- Modify `apps/web/src/pages/ConvertPage.tsx`: log SSE lifecycle, match/reset actions, query failures, and state changes.
- Modify `apps/web/src/components/conversion/MatchReviewTable.tsx`: log review decision changes.
- Modify `apps/web/src/app/App.test.tsx`: accept `/logs/client` calls in the fetch mock.
- Modify `apps/ytmusic-worker/src/main.py`: formalize JSON Lines diagnostics and elapsed timing.
- Modify `apps/ytmusic-worker/src/main_test.py`: assert diagnostic event behavior.

---

### Task 1: API File Logger Foundation

**Files:**
- Modify: `.gitignore`
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/config/env.test.ts`
- Create: `apps/api/src/logging/redact.ts`
- Create: `apps/api/src/logging/file-log-store.ts`
- Create: `apps/api/src/logging/logger.ts`
- Test: `apps/api/src/logging/redact.test.ts`
- Test: `apps/api/src/logging/file-log-store.test.ts`

- [ ] **Step 1: Confirm logging uses Fastify's built-in Pino integration**

Run:

```powershell
Get-Content apps/api/package.json
```

Expected: `apps/api/package.json` keeps the existing Fastify dependency and does not add a separate logger package.

- [ ] **Step 2: Ignore local runtime logs**

Modify `.gitignore` by adding `.logs/` near the other runtime output ignores:

```gitignore
node_modules/
.venv/
dist/
build/
coverage/
.logs/
.env
.env.*
!.env.example
*.log
*.tsbuildinfo
.DS_Store
Thumbs.db
.vscode/
.idea/
data/
/auth/
```

- [ ] **Step 3: Write redaction tests**

Create `apps/api/src/logging/redact.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redactLogFields } from "./redact";

describe("redactLogFields", () => {
  it("redacts sensitive keys recursively without mutating input", () => {
    const input = {
      token: "abc",
      nested: {
        authorization: "Bearer secret",
        safe: "value",
      },
      list: [{ refreshToken: "refresh", trackId: "spotify:track:1" }],
    };

    expect(redactLogFields(input)).toEqual({
      token: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        safe: "value",
      },
      list: [{ refreshToken: "[REDACTED]", trackId: "spotify:track:1" }],
    });
    expect(input.nested.authorization).toBe("Bearer secret");
  });
});
```

- [ ] **Step 4: Run the redaction test and verify it fails**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/redact.test.ts
```

Expected: FAIL because `apps/api/src/logging/redact.ts` does not exist.

- [ ] **Step 5: Implement recursive redaction**

Create `apps/api/src/logging/redact.ts`:

```ts
const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "password",
  "headers",
  "env",
]);

export function redactLogFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactLogFields(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKeys.has(key) ? "[REDACTED]" : redactLogFields(nested),
    ]),
  );
}
```

- [ ] **Step 6: Verify redaction passes**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/redact.test.ts
```

Expected: PASS.

- [ ] **Step 7: Write log rotation tests**

Create `apps/api/src/logging/file-log-store.test.ts`:

```ts
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareLogFile } from "./file-log-store";

describe("prepareLogFile", () => {
  it("rotates the current log and keeps only recent files", () => {
    const dir = mkdtempSync(join(tmpdir(), "spottoyt-logs-"));

    try {
      writeFileSync(join(dir, "spottoyt-current.jsonl"), "current\n");
      writeFileSync(join(dir, "spottoyt-previous-1.jsonl"), "previous-1\n");
      writeFileSync(join(dir, "spottoyt-previous-2.jsonl"), "previous-2\n");

      const currentPath = prepareLogFile({ logDir: dir, retain: 2 });

      expect(currentPath).toBe(join(dir, "spottoyt-current.jsonl"));
      expect(existsSync(currentPath)).toBe(false);
      expect(readFileSync(join(dir, "spottoyt-previous-1.jsonl"), "utf8")).toBe(
        "current\n",
      );
      expect(readFileSync(join(dir, "spottoyt-previous-2.jsonl"), "utf8")).toBe(
        "previous-1\n",
      );
      expect(existsSync(join(dir, "spottoyt-previous-3.jsonl"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates the log directory when it is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "spottoyt-logs-root-"));
    const dir = join(root, "nested", "logs");

    try {
      const currentPath = prepareLogFile({ logDir: dir, retain: 5 });

      expect(currentPath).toBe(join(dir, "spottoyt-current.jsonl"));
      expect(existsSync(dir)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 8: Run log rotation tests and verify they fail**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/file-log-store.test.ts
```

Expected: FAIL because `file-log-store.ts` does not exist.

- [ ] **Step 9: Implement log file rotation**

Create `apps/api/src/logging/file-log-store.ts`:

```ts
import { existsSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";

const currentLogFile = "spottoyt-current.jsonl";

export type PrepareLogFileOptions = {
  logDir: string;
  retain: number;
};

export function prepareLogFile({ logDir, retain }: PrepareLogFileOptions) {
  mkdirSync(logDir, { recursive: true });

  const normalizedRetain = Math.max(0, Math.floor(retain));
  const oldest = join(logDir, `spottoyt-previous-${normalizedRetain}.jsonl`);

  if (normalizedRetain > 0 && existsSync(oldest)) {
    rmSync(oldest, { force: true });
  }

  for (let index = normalizedRetain - 1; index >= 1; index -= 1) {
    const source = join(logDir, `spottoyt-previous-${index}.jsonl`);
    const target = join(logDir, `spottoyt-previous-${index + 1}.jsonl`);

    if (existsSync(source)) {
      renameSync(source, target);
    }
  }

  const currentPath = join(logDir, currentLogFile);

  if (normalizedRetain > 0 && existsSync(currentPath)) {
    renameSync(currentPath, join(logDir, "spottoyt-previous-1.jsonl"));
  } else if (existsSync(currentPath)) {
    rmSync(currentPath, { force: true });
  }

  return currentPath;
}
```

- [ ] **Step 10: Verify log rotation passes**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/file-log-store.test.ts
```

Expected: PASS.

- [ ] **Step 11: Extend environment config for logging**

Modify `apps/api/src/config/env.ts` so `getEnv()` returns logging config:

```ts
export function getEnv() {
  const source = getEnvSource();

  return {
    apiPort: Number(source.API_PORT ?? 4317),
    apiHost: source.API_HOST ?? "127.0.0.1",
    webUrl: source.WEB_URL ?? "http://127.0.0.1:5173/",
    logLevel: source.LOG_LEVEL ?? "debug",
    logDir: source.SPOTTOYT_LOG_DIR ?? ".logs",
    logRetain: Number(source.SPOTTOYT_LOG_RETAIN ?? 5),
    nodeEnv: source.NODE_ENV ?? "development",
  };
}
```

Append this test to `apps/api/src/config/env.test.ts`:

```ts
it("should expose local logging settings", () => {
  const root = mkdtempSync(join(tmpdir(), "spottoyt-env-"));

  try {
    writeFileSync(
      join(root, ".env"),
      [
        "LOG_LEVEL=trace",
        "SPOTTOYT_LOG_DIR=.custom-logs",
        "SPOTTOYT_LOG_RETAIN=3",
      ].join("\n"),
    );

    const source = getEnvSource(root);

    expect(source.LOG_LEVEL).toBe("trace");
    expect(source.SPOTTOYT_LOG_DIR).toBe(".custom-logs");
    expect(source.SPOTTOYT_LOG_RETAIN).toBe("3");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 12: Create the Pino logger module**

Create `apps/api/src/logging/logger.ts`:

```ts
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import type { FastifyBaseLogger, FastifyServerOptions } from "fastify";
import { prepareLogFile } from "./file-log-store";
import { redactLogFields } from "./redact";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type LogSource = "api" | "web" | "ytmusic-worker";
export type LogFields = Record<string, unknown>;

export type LogEventWriter = (
  level: LogLevel,
  source: LogSource,
  event: string,
  fields?: LogFields,
  message?: string,
) => void;

export type LoggingConfig = {
  logLevel: string;
  logDir: string;
  logRetain: number;
  nodeEnv: string;
};

export const noopLogEvent: LogEventWriter = () => {};

export function createApiLoggerOptions(
  config: LoggingConfig,
): FastifyServerOptions["logger"] {
  if (config.nodeEnv === "test") {
    return false;
  }

  const logPath = prepareLogFile({
    logDir: resolve(config.logDir),
    retain: config.logRetain,
  });

  return {
    level: config.logLevel,
    base: { service: "spottoyt-api" },
    stream: createWriteStream(logPath, { flags: "a" }),
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  };
}

export function createLogEventWriter(
  logger: FastifyBaseLogger | false,
): LogEventWriter {
  if (!logger) {
    return noopLogEvent;
  }

  return (level, source, event, fields = {}, message = event) => {
    logger[level](
      redactLogFields({
        source,
        event,
        ...fields,
      }) as LogFields,
      message,
    );
  };
}
```

- [ ] **Step 13: Run focused API logging foundation tests**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/redact.test.ts src/logging/file-log-store.test.ts src/config/env.test.ts
```

Expected: PASS.

- [ ] **Step 14: Commit API logging foundation**

Run:

```powershell
git status --short
git add .gitignore apps/api/src/config/env.ts apps/api/src/config/env.test.ts apps/api/src/logging/redact.ts apps/api/src/logging/redact.test.ts apps/api/src/logging/file-log-store.ts apps/api/src/logging/file-log-store.test.ts apps/api/src/logging/logger.ts
git commit -m "feat: add api file logger foundation"
```

Expected: commit succeeds.

---

### Task 2: API Request Logging And Client Log Endpoint

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/src/logging/client-log.routes.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Write client log endpoint tests**

Append these tests inside `describe("api shell", () => { ... })` in `apps/api/src/app.test.ts`:

```ts
it("accepts structured client log events", async () => {
  const app = buildApp({ logger: false });
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/logs/client",
    payload: {
      level: "info",
      event: "web.api.request.started",
      fields: { path: "/auth/status", token: "secret" },
      message: "Client request started",
    },
  });

  expect(response.statusCode).toBe(202);
  expect(response.json()).toEqual({ ok: true });

  await app.close();
});

it("rejects malformed client log events", async () => {
  const app = buildApp({ logger: false });
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/logs/client",
    payload: { level: "loud", event: "" },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().error).toBe("Invalid client log event");

  await app.close();
});
```

- [ ] **Step 2: Run endpoint tests and verify they fail**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/app.test.ts
```

Expected: FAIL because `/logs/client` is not registered.

- [ ] **Step 3: Implement client log route**

Create `apps/api/src/logging/client-log.routes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { LogEventWriter, LogFields, LogLevel } from "./logger";

const allowedLevels = new Set(["trace", "debug", "info", "warn", "error"]);

type ClientLogBody = {
  level?: unknown;
  event?: unknown;
  message?: unknown;
  fields?: unknown;
};

export function registerClientLogRoutes(
  app: FastifyInstance,
  logEvent: LogEventWriter,
) {
  app.post<{ Body: ClientLogBody | ClientLogBody[] }>(
    "/logs/client",
    async (request, reply) => {
      const events = Array.isArray(request.body) ? request.body : [request.body];

      for (const event of events) {
        if (!isClientLogEvent(event)) {
          reply.code(400);
          return { error: "Invalid client log event" };
        }
      }

      for (const event of events) {
        logEvent(event.level, "web", event.event, {
          ...(event.fields as LogFields | undefined),
          requestId: request.id,
          userAgent: request.headers["user-agent"],
        }, event.message);
      }

      reply.code(202);
      return { ok: true };
    },
  );
}

function isClientLogEvent(
  event: ClientLogBody,
): event is {
  level: LogLevel;
  event: string;
  message?: string;
  fields?: LogFields;
} {
  return (
    event !== null &&
    typeof event === "object" &&
    typeof event.event === "string" &&
    event.event.length > 0 &&
    typeof event.level === "string" &&
    allowedLevels.has(event.level) &&
    (event.message === undefined || typeof event.message === "string") &&
    (event.fields === undefined ||
      (event.fields !== null &&
        typeof event.fields === "object" &&
        !Array.isArray(event.fields)))
  );
}
```

- [ ] **Step 4: Wire API logger and request hooks**

Modify `apps/api/src/app.ts` imports:

```ts
import { env } from "./config/env";
import { registerClientLogRoutes } from "./logging/client-log.routes";
import {
  createApiLoggerOptions,
  createLogEventWriter,
  type LogEventWriter,
} from "./logging/logger";
```

Extend `AppDependencies`:

```ts
type AppDependencies = {
  conversions?: ConversionService;
  logEvent?: LogEventWriter;
};
```

Replace the Fastify construction at the start of `buildApp`:

```ts
  const logger =
    options.logger === undefined ? createApiLoggerOptions(env) : options.logger;
  const app = Fastify({
    disableRequestLogging: true,
    logger,
    ...options,
  });
  const logEvent =
    dependencies.logEvent ?? createLogEventWriter(app.log || false);
```

Register hooks after CORS registration:

```ts
  registerClientLogRoutes(app, logEvent);

  app.addHook("onRequest", async (request) => {
    logEvent("info", "api", "api.request.started", {
      requestId: request.id,
      method: request.method,
      url: request.url,
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    logEvent("info", "api", "api.request.completed", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });

  app.setErrorHandler((error, request, reply) => {
    logEvent("error", "api", "api.request.failed", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      errorName: error.name,
      message: error.message,
      stack: error.stack,
    });

    reply.send(error);
  });
```

- [ ] **Step 5: Log server startup and fatal startup failure**

Modify `apps/api/src/server.ts`:

```ts
import { createLogEventWriter } from "./logging/logger";

const app = buildApp();
const logEvent = createLogEventWriter(app.log || false);

try {
  await app.listen({ port: env.apiPort, host: env.apiHost });
  logEvent("info", "api", "api.server.started", {
    host: env.apiHost,
    port: env.apiPort,
  });
} catch (error) {
  logEvent("fatal", "api", "api.server.start_failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
}
```

- [ ] **Step 6: Verify API endpoint and request logging tests**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/app.test.ts
bun run --filter @spottoyt/api typecheck
```

Expected: both commands PASS.

- [ ] **Step 7: Commit API request and client log endpoint**

Run:

```powershell
git status --short
git add apps/api/src/app.ts apps/api/src/server.ts apps/api/src/logging/client-log.routes.ts apps/api/src/app.test.ts
git commit -m "feat: collect api and client log events"
```

Expected: commit succeeds.

---

### Task 3: Web Logging Instrumentation

**Files:**
- Create: `apps/web/src/lib/logger.ts`
- Modify: `apps/web/src/lib/apiClient.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/pages/ConvertPage.tsx`
- Modify: `apps/web/src/components/conversion/MatchReviewTable.tsx`
- Modify: `apps/web/src/app/App.test.tsx`

- [ ] **Step 1: Update web fetch mock to accept client logs**

In `apps/web/src/app/App.test.tsx`, add this branch before the final `Not found` response in `mockApi`:

```ts
      if (method === "POST" && url.endsWith("/logs/client")) {
        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      }
```

- [ ] **Step 2: Create best-effort web logger**

Create `apps/web/src/lib/logger.ts`:

```ts
type ClientLogLevel = "trace" | "debug" | "info" | "warn" | "error";
type ClientLogFields = Record<string, unknown>;

type ClientLogEvent = {
  level: ClientLogLevel;
  event: string;
  message?: string;
  fields?: ClientLogFields;
};

let installed = false;
let flushing = false;
const queue: ClientLogEvent[] = [];
const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4317";

export function logClientEvent(
  level: ClientLogLevel,
  event: string,
  fields: ClientLogFields = {},
  message?: string,
) {
  queue.push({
    level,
    event,
    fields: {
      route: window.location.pathname,
      ...fields,
    },
    message,
  });

  void flushClientLogs();
}

export async function flushClientLogs() {
  if (flushing || queue.length === 0) {
    return;
  }

  flushing = true;
  const batch = queue.splice(0, queue.length);

  try {
    await fetch(`${apiUrl}/logs/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  } catch {
    // Logging must never break the UI.
  } finally {
    flushing = false;
  }
}

export function installBrowserErrorLogging() {
  if (installed) {
    return;
  }

  installed = true;
  logClientEvent("info", "web.app.started", {
    apiOrigin: new URL(apiUrl).origin,
  });

  window.addEventListener("error", (event) => {
    logClientEvent("error", "web.error.unhandled", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logClientEvent("error", "web.promise.unhandled_rejection", {
      reason:
        event.reason instanceof Error ? event.reason.message : String(event.reason),
    });
  });
}
```

- [ ] **Step 3: Install global browser logging**

Modify `apps/web/src/main.tsx`:

```ts
import { installBrowserErrorLogging } from "./lib/logger";
```

Call it after the root check:

```ts
installBrowserErrorLogging();
```

- [ ] **Step 4: Instrument API client requests**

Modify `apps/web/src/lib/apiClient.ts`:

```ts
import { logClientEvent } from "./logger";
```

Replace `apiGet` and `apiPost` with:

```ts
export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "POST" });
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const startedAt = performance.now();
  const method = init?.method ?? "GET";

  logClientEvent("debug", "web.api.request.started", { method, path });

  try {
    const response = await fetch(`${apiUrl}${path}`, init);
    const durationMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      logClientEvent("warn", "web.api.request.failed", {
        method,
        path,
        statusCode: response.status,
        durationMs,
      });
      throw new Error(`Request failed: ${response.status}`);
    }

    logClientEvent("debug", "web.api.request.completed", {
      method,
      path,
      statusCode: response.status,
      durationMs,
    });

    return response.json() as Promise<T>;
  } catch (error) {
    logClientEvent("error", "web.api.request.error", {
      method,
      path,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

- [ ] **Step 5: Instrument convert workflow**

Modify `apps/web/src/pages/ConvertPage.tsx` imports:

```ts
import { logClientEvent } from "../lib/logger";
```

Add this effect after the queries are created:

```ts
  useEffect(() => {
    if (accountStatus.error) {
      logClientEvent("error", "web.query.account_status.failed", {
        message: accountStatus.error.message,
      });
    }
  }, [accountStatus.error]);

  useEffect(() => {
    if (latestImport.error) {
      logClientEvent("error", "web.query.latest_import.failed", {
        message: latestImport.error.message,
      });
    }
  }, [latestImport.error]);
```

Extend the match mutation:

```ts
    onMutate: (id) => {
      logClientEvent("info", "web.conversion.match.clicked", {
        conversionId: id,
      });
    },
    onError: (error) => {
      logClientEvent("error", "web.conversion.match.failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
```

Extend the reset mutation:

```ts
    onMutate: () => {
      logClientEvent("info", "web.import.reset.clicked", {
        conversionId: conversion?.id,
      });
    },
    onError: (error) => {
      logClientEvent("error", "web.import.reset.failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
```

Add SSE logging inside the existing EventSource effect:

```ts
    logClientEvent("info", "web.sse.opening", { url: getEventsUrl() });
    const events = new EventSource(getEventsUrl());
    events.onopen = () => {
      logClientEvent("info", "web.sse.connected");
    };
    events.onerror = () => {
      logClientEvent("warn", "web.sse.error");
    };
```

Inside the `spicetify-imported` listener, add:

```ts
      logClientEvent("info", "web.sse.spicetify_imported");
```

Before `events.close()` in cleanup, add:

```ts
      logClientEvent("info", "web.sse.closed");
```

- [ ] **Step 6: Instrument review decisions**

Modify `apps/web/src/components/conversion/MatchReviewTable.tsx` imports:

```ts
import { logClientEvent } from "../../lib/logger";
```

Inside `updateDecision`, before `setMatches`, add:

```ts
    logClientEvent("info", "web.decision.changed", {
      conversionId: conversion.id,
      trackId,
      status,
    });
```

- [ ] **Step 7: Run web tests and typecheck**

Run:

```powershell
bun run --filter @spottoyt/web test
bun run --filter @spottoyt/web typecheck
```

Expected: both commands PASS.

- [ ] **Step 8: Commit web logging instrumentation**

Run:

```powershell
git status --short
git add apps/web/src/lib/logger.ts apps/web/src/lib/apiClient.ts apps/web/src/main.tsx apps/web/src/pages/ConvertPage.tsx apps/web/src/components/conversion/MatchReviewTable.tsx apps/web/src/app/App.test.tsx
git commit -m "feat: send web diagnostics to api logs"
```

Expected: commit succeeds.

---

### Task 4: Worker Diagnostic Ingestion

**Files:**
- Create: `apps/api/src/logging/worker-diagnostics.ts`
- Test: `apps/api/src/logging/worker-diagnostics.test.ts`
- Modify: `apps/api/src/services/ytmusic.service.ts`
- Modify: `apps/api/src/services/ytmusic.service.test.ts`
- Modify: `apps/ytmusic-worker/src/main.py`
- Modify: `apps/ytmusic-worker/src/main_test.py`

- [ ] **Step 1: Write worker diagnostic parser tests**

Create `apps/api/src/logging/worker-diagnostics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseWorkerDiagnostics } from "./worker-diagnostics";

describe("parseWorkerDiagnostics", () => {
  it("parses worker stderr JSON Lines diagnostics", () => {
    expect(
      parseWorkerDiagnostics(
        [
          '{"event":"ytmusic.search.started","trackId":"spotify:track:1"}',
          '{"event":"ytmusic.search.completed","candidateCount":2}',
        ].join("\n"),
      ),
    ).toEqual([
      {
        event: "ytmusic.search.started",
        fields: { trackId: "spotify:track:1" },
      },
      {
        event: "ytmusic.search.completed",
        fields: { candidateCount: 2 },
      },
    ]);
  });

  it("keeps plain stderr lines as warning diagnostics", () => {
    expect(parseWorkerDiagnostics("plain failure")).toEqual([
      {
        event: "ytmusic.worker.stderr",
        fields: { line: "plain failure" },
      },
    ]);
  });
});
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/worker-diagnostics.test.ts
```

Expected: FAIL because `worker-diagnostics.ts` does not exist.

- [ ] **Step 3: Implement worker diagnostic parser**

Create `apps/api/src/logging/worker-diagnostics.ts`:

```ts
export type WorkerDiagnostic = {
  event: string;
  fields: Record<string, unknown>;
};

export function parseWorkerDiagnostics(stderr: string): WorkerDiagnostic[] {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseWorkerDiagnosticLine(line));
}

function parseWorkerDiagnosticLine(line: string): WorkerDiagnostic {
  try {
    const parsed = JSON.parse(line) as unknown;

    if (
      parsed &&
      typeof parsed === "object" &&
      "event" in parsed &&
      typeof parsed.event === "string"
    ) {
      const { event, ...fields } = parsed as {
        event: string;
        [key: string]: unknown;
      };

      return { event, fields };
    }
  } catch {
    return { event: "ytmusic.worker.stderr", fields: { line } };
  }

  return { event: "ytmusic.worker.stderr", fields: { line } };
}
```

- [ ] **Step 4: Inject logger into YouTube Music service**

Modify imports in `apps/api/src/services/ytmusic.service.ts`:

```ts
import {
  type LogEventWriter,
  noopLogEvent,
} from "../logging/logger";
import { parseWorkerDiagnostics } from "../logging/worker-diagnostics";
```

Change constructors:

```ts
export class YtmusicService {
  constructor(
    private readonly searchClient: YtmusicSearchClient = new PythonYtmusicSearchClient(),
    private readonly logEvent: LogEventWriter = noopLogEvent,
  ) {}
```

```ts
export class PythonYtmusicSearchClient implements YtmusicSearchClient {
  constructor(
    private readonly pythonCommand = getDefaultPythonCommand(),
    private readonly logEvent: LogEventWriter = noopLogEvent,
  ) {}
```

Call `runWorker` with the logger:

```ts
    return runWorker(this.pythonCommand, workerPath, {
      limit: searchLimit,
      tracks,
    }, this.logEvent);
```

Update `runWorker` signature:

```ts
async function runWorker(
  pythonCommand: string,
  workerPath: string,
  payload: { limit: number; tracks: SpotifyTrack[] },
  logEvent: LogEventWriter,
): Promise<YtmusicCandidateSearchResult[]> {
```

Inside `runWorker`, before `spawn`, add:

```ts
    logEvent("info", "api", "ytmusic.worker.spawned", {
      workerPath,
      trackCount: payload.tracks.length,
      limit: payload.limit,
    });
```

Inside `child.on("close", (code) => { ... })`, before the non-zero check:

```ts
      logEvent("info", "api", "ytmusic.worker.exited", {
        exitCode: code,
        stderrBytes: Buffer.concat(stderr).byteLength,
      });

      for (const diagnostic of parseWorkerDiagnostics(errorOutput)) {
        logEvent("debug", "ytmusic-worker", diagnostic.event, diagnostic.fields);
      }
```

Replace `logWorkerDiagnostics(errorOutput);` with no call, then delete `logWorkerDiagnostics`.

- [ ] **Step 5: Add service-level match decision logging**

In `findMatchesForTracks`, after creating `searchResults`, add:

```ts
    this.logEvent("info", "api", "conversion.match.worker_results_received", {
      trackCount: tracks.length,
      resultCount: searchResults.length,
    });
```

Replace the `tracks.map(...)` expression with:

```ts
      tracks.map((track) => {
        const decision = decideMatch(track, candidatesByTrackId.get(track.id) ?? []);

        this.logEvent(
          decision.status === "accepted" ? "debug" : "info",
          "api",
          "conversion.match.decision",
          {
            trackId: track.id,
            status: decision.status,
            confidence: decision.confidence,
            candidateVideoId: decision.candidate?.videoId,
          },
        );

        return decision;
      }),
```

- [ ] **Step 6: Verify API worker parser and service tests**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/logging/worker-diagnostics.test.ts src/services/ytmusic.service.test.ts
bun run --filter @spottoyt/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Formalize Python worker event names**

Modify `apps/ytmusic-worker/src/main.py`:

```py
import time
```

At the start of `match_tracks`, add:

```py
    started_at = time.perf_counter()
    log_event("ytmusic.worker.command.started", trackCount=len(tracks), limit=limit)
```

Replace existing event names:

```py
        log_event("ytmusic.search.started", trackId=track_id, query=query, limit=limit)
```

```py
            log_event(
                "ytmusic.search.completed",
                trackId=track_id,
                rawResults=len(results),
                candidateCount=len(candidates),
            )
```

```py
                log_event(
                    "ytmusic.youtube_fallback.completed",
                    trackId=track_id,
                    candidateCount=len(candidates),
                )
```

```py
            log_event("ytmusic.search.failed", trackId=track_id, message=str(error))
```

Before `return matches`, add:

```py
    log_event(
        "ytmusic.worker.command.completed",
        trackCount=len(tracks),
        durationMs=round((time.perf_counter() - started_at) * 1000),
    )
```

Replace fallback event names:

```py
        log_event("ytmusic.youtube_fallback.unavailable", reason="Install yt-dlp.")
```

```py
        log_event("ytmusic.youtube_fallback.failed", message=str(error))
```

- [ ] **Step 8: Add Python diagnostic test**

Append to `apps/ytmusic-worker/src/main_test.py`:

```py
    @patch("main.YTMusic")
    def test_match_tracks_emits_structured_diagnostics(self, ytmusic):
        client = Mock()
        client.search.return_value = []
        ytmusic.return_value = client

        with patch("main.log_event") as log_event:
            match_tracks(
                [
                    {
                        "id": "spotify:track:midnight-city",
                        "title": "Midnight City",
                        "artists": ["M83"],
                    }
                ],
                limit=5,
            )

        event_names = [call.args[0] for call in log_event.call_args_list]
        self.assertIn("ytmusic.worker.command.started", event_names)
        self.assertIn("ytmusic.search.started", event_names)
        self.assertIn("ytmusic.search.completed", event_names)
        self.assertIn("ytmusic.worker.command.completed", event_names)
```

- [ ] **Step 9: Verify Python worker tests**

Run:

```powershell
apps/ytmusic-worker/.venv/Scripts/python.exe -m unittest discover apps/ytmusic-worker/src
```

Expected: PASS.

- [ ] **Step 10: Commit worker diagnostic ingestion**

Run:

```powershell
git status --short
git add apps/api/src/logging/worker-diagnostics.ts apps/api/src/logging/worker-diagnostics.test.ts apps/api/src/services/ytmusic.service.ts apps/api/src/services/ytmusic.service.test.ts apps/ytmusic-worker/src/main.py apps/ytmusic-worker/src/main_test.py
git commit -m "feat: ingest ytmusic worker diagnostics"
```

Expected: commit succeeds.

---

### Task 5: Domain Event Coverage And Final Verification

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/services/conversion.service.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/services/ytmusic.service.test.ts`

- [ ] **Step 1: Pass logger into conversion services**

In `apps/api/src/services/conversion.service.ts`, add imports:

```ts
import {
  type LogEventWriter,
  noopLogEvent,
} from "../logging/logger";
```

Change constructor:

```ts
  constructor(
    private readonly ytmusic = new YtmusicService(),
    private readonly matcher = new MatcherService(),
    private readonly logEvent: LogEventWriter = noopLogEvent,
  ) {}
```

- [ ] **Step 2: Log import and reset lifecycle**

Inside `importSpicetifySnapshot`, before the lock check:

```ts
    this.logEvent("info", "api", "import.spicetify.received", {
      playlistName: snapshot.playlistName,
      playlistUriSuffix: playlistIdFromUri(snapshot.spotifyPlaylistUri),
      snapshotAt: snapshot.snapshotAt,
      trackCount: snapshot.tracks.length,
    });
```

Before throwing `ImportLockedError`, add:

```ts
      this.logEvent("warn", "api", "import.spicetify.locked", {
        existingConversionId: this.latestImport.id,
        existingStatus: this.latestImport.status,
      });
```

After assigning `this.latestImport = conversion`, add:

```ts
    this.logEvent("info", "api", "import.spicetify.accepted", {
      conversionId: conversion.id,
      playlistName: conversion.sourcePlaylistName,
      trackCount: conversion.tracks.length,
    });
```

Inside `resetImport`, before clearing:

```ts
    this.logEvent("info", "api", "import.reset", {
      conversionId: this.latestImport?.id,
      status: this.latestImport?.status,
    });
```

- [ ] **Step 3: Log conversion lookup and match lifecycle**

In `getConversion`, before returning:

```ts
    this.logEvent("debug", "api", "conversion.loaded", {
      conversionId: conversion.id,
      status: conversion.status,
      trackCount: conversion.tracks.length,
    });
```

In `matchConversion`, after creating `matching`:

```ts
    this.logEvent("info", "api", "conversion.match.started", {
      conversionId: matching.id,
      trackCount: matching.tracks.length,
    });
```

After `matched` is created, compute summary and log it:

```ts
    const summary = this.matcher.summarize(matched.matches);
    this.logEvent("info", "api", "conversion.match.completed", {
      conversionId: matched.id,
      ...summary,
    });

    return {
      conversion: matched,
      summary,
    };
```

Remove the existing inline `summary: this.matcher.summarize(matched.matches)` return expression.

- [ ] **Step 4: Log conversion not found**

Inside `requireLatestConversion`, before throwing:

```ts
      this.logEvent("warn", "api", "conversion.not_found", {
        requestedConversionId: id,
        latestConversionId: this.latestImport?.id,
      });
```

- [ ] **Step 5: Wire the conversion logger in `buildApp`**

Modify `apps/api/src/app.ts` conversion construction:

```ts
  const conversions =
    dependencies.conversions ?? new ConversionService(undefined, undefined, logEvent);
```

Keep dependency-provided `conversions` unchanged so tests can inject fakes.

- [ ] **Step 6: Add a focused domain logging test**

In `apps/api/src/app.test.ts`, add:

```ts
it("emits domain logs for import and matching lifecycle", async () => {
  const events: Array<{ event: string; fields?: Record<string, unknown> }> = [];
  const app = buildApp(
    { logger: false },
    {
      logEvent: (_level, _source, event, fields) => {
        events.push({ event, fields });
      },
      conversions: new ConversionService(
        new YtmusicService({
          async findCandidatesForTracks() {
            return [
              {
                trackId: "spotify:track:midnight-city",
                candidates: [],
              },
            ];
          },
        }),
        undefined,
        (_level, _source, event, fields) => {
          events.push({ event, fields });
        },
      ),
    },
  );
  await app.ready();

  const imported = await app.inject({
    method: "POST",
    url: "/imports/spicetify",
    payload: spicetifySnapshot("Road trip", "Midnight City"),
  });
  await app.inject({
    method: "POST",
    url: `/conversions/${imported.json().conversion.id}/match`,
  });

  expect(events.map((item) => item.event)).toEqual(
    expect.arrayContaining([
      "import.spicetify.received",
      "import.spicetify.accepted",
      "conversion.match.started",
      "conversion.match.completed",
    ]),
  );

  await app.close();
});
```

- [ ] **Step 7: Verify API domain coverage tests**

Run:

```powershell
bun run --filter @spottoyt/api test -- src/app.test.ts src/services/ytmusic.service.test.ts
bun run --filter @spottoyt/api typecheck
```

Expected: PASS.

- [ ] **Step 8: Run full focused verification**

Run:

```powershell
bun run typecheck
bun run test
bun run lint
apps/ytmusic-worker/.venv/Scripts/python.exe -m unittest discover apps/ytmusic-worker/src
```

Expected: all commands PASS.

- [ ] **Step 9: Manually verify unified recent log output**

Run the API and web in separate terminals or with `bun run dev`, then trigger one web request and one conversion match. Stop the server after verification.

Inspect:

```powershell
Get-Content .logs/spottoyt-current.jsonl -Tail 50
```

Expected: recent JSON Lines include events with `source` values `api`, `web`, and `ytmusic-worker`.

- [ ] **Step 10: Commit final logging coverage**

Run:

```powershell
git status --short
git add apps/api/src/app.ts apps/api/src/services/conversion.service.ts apps/api/src/app.test.ts apps/api/src/services/ytmusic.service.test.ts
git commit -m "feat: log conversion lifecycle events"
```

Expected: commit succeeds.

---

## Self-Review Notes

- Spec coverage: the plan covers API-owned file logging, `.logs/` retention,
  client log intake, web instrumentation, worker diagnostic ingestion, redaction,
  domain event coverage, and focused verification.
- Scope: the work is split into five independently committable milestones.
- Type consistency: the shared event writer signature is
  `(level, source, event, fields, message)` across API route, services, and
  worker ingestion.
