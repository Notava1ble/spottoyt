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

    if (queue.length > 0) {
      void flushClientLogs();
    }
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
