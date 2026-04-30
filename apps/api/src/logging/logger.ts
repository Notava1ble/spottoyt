import { createWriteStream } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
    logDir: resolveLogDir(config.logDir),
    retain: config.logRetain,
  });

  return {
    level: config.logLevel,
    base: { service: "spottoyt-api" },
    stream: createWriteStream(logPath, { flags: "a" }),
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  };
}

export function resolveLogDir(logDir: string) {
  if (isAbsolute(logDir)) {
    return logDir;
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../../", logDir);
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
