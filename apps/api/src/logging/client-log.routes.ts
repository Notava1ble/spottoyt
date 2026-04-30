import type { FastifyInstance } from "fastify";
import type { LogEventWriter, LogFields, LogLevel } from "./logger";

const allowedLevels = new Set(["trace", "debug", "info", "warn", "error"]);

type ClientLogEvent = {
  level: LogLevel;
  event: string;
  message?: string;
  fields?: LogFields;
};

export function registerClientLogRoutes(
  app: FastifyInstance,
  logEvent: LogEventWriter,
) {
  app.post<{ Body: unknown }>("/logs/client", async (request, reply) => {
    const events = Array.isArray(request.body) ? request.body : [request.body];

    for (const event of events) {
      if (!isClientLogEvent(event)) {
        reply.code(400);
        return { error: "Invalid client log event" };
      }
    }

    for (const event of events) {
      logEvent(
        event.level,
        "web",
        event.event,
        {
          ...event.fields,
          requestId: request.id,
          userAgent: request.headers["user-agent"],
        },
        event.message,
      );
    }

    reply.code(202);
    return { ok: true };
  });
}

function isClientLogEvent(event: unknown): event is ClientLogEvent {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return false;
  }

  const candidate = event as {
    level?: unknown;
    event?: unknown;
    message?: unknown;
    fields?: unknown;
  };

  return (
    typeof candidate.event === "string" &&
    candidate.event.length > 0 &&
    typeof candidate.level === "string" &&
    allowedLevels.has(candidate.level) &&
    (candidate.message === undefined || typeof candidate.message === "string") &&
    (candidate.fields === undefined ||
      (candidate.fields !== null &&
        typeof candidate.fields === "object" &&
        !Array.isArray(candidate.fields)))
  );
}
