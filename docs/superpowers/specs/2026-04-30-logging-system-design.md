# Logging System Design

## Context

SpottoYT needs full local logging coverage across the React web app, the
Fastify API, and the Python YouTube Music worker. The logs are primarily for
future debugging by agents and developers working locally. Logs should be easy
to inspect, recent by default, and kept out of source control.

The product is local-first, so logging can be more detailed than a hosted
multi-user service, but it still must avoid secrets and auth material. The
logging system should make uncertain behavior visible without filling the
codebase with permanent generated artifacts.

## Goals

- Write structured logs from web, API, and YouTube worker activity into one
  local file location.
- Keep only recent logs so the repository is not littered with old runtime
  output.
- Make logs useful for debugging conversion, matching, import, and worker
  failures.
- Capture boundaries, state transitions, decisions, fallbacks, failures, and
  uncertain match outcomes.
- Keep log entries machine-readable so agents can filter them reliably.
- Avoid leaking credentials, cookies, auth headers, tokens, or raw environment
  values.

## Non-Goals

- No hosted log aggregation service.
- No browser-side direct file writes.
- No exhaustive per-render React logging.
- No logging of full auth payloads, request headers, cookies, tokens, or raw
  `.env` values.
- No permanent tracked log files in the repository.

## Recommended Architecture

The API should own the physical log file. It is the only long-running local
process that can safely write to disk and can receive logs from both the web
client and YouTube worker bridge.

All logs should be emitted as JSON Lines. Each line is one event object:

```json
{"time":"2026-04-30T12:00:00.000Z","level":"info","source":"api","event":"conversion.match.started","conversionId":"conversion-demo","trackCount":42}
```

Every event should include:

- `time`: ISO timestamp.
- `level`: `trace`, `debug`, `info`, `warn`, or `error`.
- `source`: `api`, `web`, or `ytmusic-worker`.
- `event`: stable dot-separated event name.
- `message`: optional human summary when useful.
- Context fields such as `requestId`, `conversionId`, `trackId`,
  `playlistName`, `trackCount`, `candidateCount`, `durationMs`, and
  `statusCode` when safe and relevant.

## Log File Location And Retention

Use an ignored local directory:

```text
.logs/
  spottoyt-current.jsonl
  spottoyt-previous-1.jsonl
  spottoyt-previous-2.jsonl
```

The implementation should add `.logs/` to `.gitignore`.

On API startup:

- Ensure `.logs/` exists.
- Rotate the current file before writing a new session.
- Keep a small recent history, initially current plus 5 previous files.
- Delete older rotated files.

The default log file should be `.logs/spottoyt-current.jsonl`. An environment
override can be added as `SPOTTOYT_LOG_DIR` if useful, but the default should be
good enough for local development.

## API Logging

The Fastify API should use Pino as the root logger. The logger should write JSON
events to the unified file and keep console output readable during development.

API coverage should include:

- Server startup and shutdown.
- Request start and completion with method, route, status code, elapsed time,
  and request ID.
- Validation failures with safe schema and route context.
- Route errors with serialized error name, message, stack, route, and request
  ID.
- Spicetify import received, accepted, rejected, and locked.
- Conversion created, reset, loaded, not found, and state transitions.
- Matching started, completed, failed, and summarized.
- Match scoring outcomes at debug level, especially skipped or review-needed
  decisions.
- YouTube worker spawn, payload summary, exit code, stderr diagnostic parsing,
  invalid JSON, and unavailable worker errors.
- Playlist creation start, success, and failure.

API logs should avoid full request bodies by default. Import routes can log
safe summaries such as playlist name, playlist URI hash or suffix, track count,
and snapshot timestamp. Full track metadata should only appear at debug level if
explicitly safe and useful.

## Web Logging

The web app cannot write directly to the file. It should send structured client
events to the API through a new endpoint:

```text
POST /logs/client
```

The endpoint accepts an array or single event with a strict shared schema. The
API stamps server time, source, and remote request context before writing.

Web coverage should include:

- App startup with route and API URL origin.
- API request start, success, and failure from the shared API client.
- React Query failures for account status and latest import.
- SSE connection opened, import event received, error, reconnect, and close.
- User actions that trigger uncertain work: match conversion, reset import,
  accept match, mark review, skip track.
- Mutation success and failure.
- Local conversion state changes when live import data replaces cached query
  data.
- Unexpected client errors captured by a React error boundary.
- Unhandled browser promise rejections and `window.error` events.

Client logging should be best-effort. Failed log delivery must not break the UI
or create loops. The logging client should batch or debounce where simple, but a
small direct send is acceptable for the first implementation.

## YouTube Worker Logging

The Python worker already emits diagnostic events to stderr. That should become
a formal contract:

- Worker stdout remains reserved for the command result JSON.
- Worker stderr emits JSON Lines diagnostic events.
- The TypeScript `YtmusicService` reads stderr, parses each JSON line, and
  re-emits it to the unified API log with `source: "ytmusic-worker"`.
- Unparseable stderr lines are still logged as worker diagnostics at `warn`.

Worker coverage should include:

- Worker command start and completion.
- Payload summary with track count and search limit.
- Per-track search start and completion.
- YouTube Music search errors.
- YouTube fallback start, unavailable, completion, and error.
- Candidate normalization counts.
- Empty candidate outcomes.
- Total elapsed time.

Worker logs can include track IDs, titles, primary artists, query strings, and
candidate counts because the app is local-first. They should not include auth
headers, cookies, OAuth data, or raw library internals.

## Data Safety

The logger should redact common sensitive keys anywhere they appear:

- `authorization`
- `cookie`
- `set-cookie`
- `token`
- `accessToken`
- `refreshToken`
- `secret`
- `password`
- `headers`
- `env`

The implementation should prefer explicit safe summaries over logging raw
objects. Error logging may include stack traces, but not attached request
headers or full payloads.

## Event Naming

Use stable dot-separated event names:

```text
api.request.started
api.request.completed
import.spicetify.received
import.spicetify.accepted
conversion.match.started
conversion.match.completed
conversion.match.failed
ytmusic.worker.spawned
ytmusic.worker.exited
ytmusic.search.started
ytmusic.search.completed
web.api.request.started
web.api.request.failed
web.sse.connected
web.sse.error
web.decision.changed
```

Keep event names stable so agents can search historical logs even as message
text changes.

## Configuration

Initial configuration:

- `LOG_LEVEL`: default `debug` in development, `info` otherwise.
- `SPOTTOYT_LOG_DIR`: optional override for the log directory.
- `SPOTTOYT_LOG_RETAIN`: optional number of rotated files to keep, default `5`.

Test mode should disable file logging unless a test explicitly passes a log
sink. This prevents test runs from polluting local logs.

## Implementation Boundaries

Suggested modules:

- `apps/api/src/logging/logger.ts`: create and configure the API logger, file
  stream, rotation, redaction, and helper event method.
- `apps/api/src/logging/client-log.schema.ts`: validate client log submissions.
- `apps/api/src/logging/client-log.routes.ts`: `POST /logs/client`.
- `apps/api/src/logging/worker-diagnostics.ts`: parse worker stderr JSON Lines.
- `apps/web/src/lib/logger.ts`: best-effort client logger and global error
  hooks.
- `apps/ytmusic-worker/src/main.py`: formalize stderr JSON Lines event output.

Shared event schemas can move to `packages/shared` once the event shape is
stable. For the first implementation, API-owned validation is enough.

## Testing And Verification

Focused verification should cover:

- Log directory creation and rotation keeps only recent files.
- Redaction removes sensitive fields.
- API request logs include request IDs and completion status.
- `POST /logs/client` accepts valid client events and rejects malformed input.
- Web logger does not throw when the API is unavailable.
- Worker diagnostic parser handles valid JSON Lines, blank lines, and plain
  stderr.
- Matching failures include useful worker context without leaking secrets.

Manual verification should include running the API, triggering a web action,
running a match, and inspecting `.logs/spottoyt-current.jsonl` for `web`, `api`,
and `ytmusic-worker` events.

## Rollout

Implement in small milestones:

1. API file logger, rotation, redaction, and request/error logging.
2. Client log endpoint and web logger instrumentation.
3. Worker stderr diagnostic ingestion and worker event cleanup.
4. Domain event coverage across conversion, matching, import, reset, and
   decisions.
5. Tests and focused verification.

This keeps the system useful early while preventing a broad, noisy logging pass
from spreading inconsistent patterns across the codebase.
