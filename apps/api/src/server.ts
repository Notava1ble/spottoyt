import { buildApp } from "./app";
import { env } from "./config/env";
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
