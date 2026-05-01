import cors from "@fastify/cors";
import {
  accountStatusResponseSchema,
  browserHeadersAuthRequestSchema,
  type ConversionJob,
  latestImportResponseSchema,
  manualMatchSearchRequestSchema,
  manualMatchSearchResponseSchema,
  manualMatchSelectRequestSchema,
  matchDecisionUpdateRequestSchema,
  matchingSettingsPatchSchema,
  matchingSettingsResponseSchema,
  matchingSettingsSchema,
  playlistCreateRequestSchema,
  spicetifyImportResponseSchema,
  spicetifyPlaylistSnapshotSchema,
} from "@spottoyt/shared";
import Fastify, { type FastifyServerOptions } from "fastify";
import { env } from "./config/env";
import { registerClientLogRoutes } from "./logging/client-log.routes";
import {
  createApiLoggerOptions,
  createLogEventWriter,
  type LogEventWriter,
} from "./logging/logger";
import {
  ConversionNotFoundError,
  ConversionService,
  InvalidConversionStateError,
  ImportLockedError,
  InvalidMatchDecisionError,
  MatchNotFoundError,
  NoAcceptedMatchesError,
  TrackNotFoundError,
} from "./services/conversion.service";
import { ImportEventsService } from "./services/import-events.service";
import { MatchingSettingsService } from "./services/matching-settings.service";
import {
  type YtmusicSearchClient,
  YtmusicService,
  type YtmusicAuthClient,
  YtmusicWorkerUnavailableError,
} from "./services/ytmusic.service";
import { getDatabaseStatus } from "./storage/db";
import { plannedTables } from "./storage/schema";

type SpicetifyImportBody = unknown;

type AppDependencies = {
  conversions?: ConversionService;
  logEvent?: LogEventWriter;
  matchingSettings?: MatchingSettingsService;
  ytmusicAuth?: Partial<YtmusicAuthClient>;
  ytmusicSearchClient?: YtmusicSearchClient;
};

const conversionParamsSchema = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
  },
} as const;

const matchParamsSchema = {
  type: "object",
  required: ["id", "trackId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    trackId: { type: "string", minLength: 1 },
  },
} as const;

const spicetifyImportBodySchema = {
  type: "object",
  required: [
    "source",
    "spotifyPlaylistUri",
    "playlistName",
    "snapshotAt",
    "tracks",
  ],
  additionalProperties: false,
  properties: {
    source: { const: "spicetify" },
    spotifyPlaylistUri: { type: "string", minLength: 1 },
    playlistName: { type: "string", minLength: 1 },
    snapshotAt: { type: "string", minLength: 1 },
    tracks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["spotifyUri", "title", "artists", "durationMs", "position"],
        additionalProperties: false,
        properties: {
          spotifyUri: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          artists: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          album: { type: "string", minLength: 1 },
          durationMs: { type: "integer", minimum: 1 },
          isrc: { type: "string", minLength: 1 },
          explicit: { type: "boolean" },
          position: { type: "integer", minimum: 0 },
        },
      },
    },
  },
} as const;

const browserHeadersAuthBodySchema = {
  type: "object",
  required: ["headersRaw"],
  additionalProperties: false,
  properties: {
    headersRaw: { type: "string", minLength: 1 },
  },
} as const;

export function buildApp(
  options: FastifyServerOptions = {},
  dependencies: AppDependencies = {},
) {
  const logger =
    options.logger === undefined ? createApiLoggerOptions(env) : options.logger;
  const app = Fastify({
    disableRequestLogging: true,
    logger,
    ...options,
  });
  const logEvent =
    dependencies.logEvent ?? createLogEventWriter(app.log || false);
  const matchingSettings =
    dependencies.matchingSettings ?? new MatchingSettingsService();
  const ytmusic = new YtmusicService(
    dependencies.ytmusicSearchClient,
    logEvent,
    matchingSettings,
  );
  const ytmusicAuth = {
    disconnectAuth:
      dependencies.ytmusicAuth?.disconnectAuth?.bind(
        dependencies.ytmusicAuth,
      ) ?? ytmusic.disconnectAuth.bind(ytmusic),
    getAuthStatus:
      dependencies.ytmusicAuth?.getAuthStatus?.bind(dependencies.ytmusicAuth) ??
      ytmusic.getAuthStatus.bind(ytmusic),
    setupBrowserHeaders:
      dependencies.ytmusicAuth?.setupBrowserHeaders?.bind(
        dependencies.ytmusicAuth,
      ) ?? ytmusic.setupBrowserHeaders.bind(ytmusic),
  };
  const conversions =
    dependencies.conversions ??
    new ConversionService(ytmusic, undefined, logEvent);
  const importEvents = new ImportEventsService();

  app.register(cors, {
    origin: true,
  });

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
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    reply.send(error);
  });

  registerClientLogRoutes(app, logEvent);

  app.get("/health", async () => ({
    status: "ok",
    service: "spottoyt-api",
  }));

  app.get("/auth/status", async (_request, reply) => {
    try {
      return accountStatusResponseSchema.parse({
        youtubeMusic: await ytmusicAuth.getAuthStatus(),
      });
    } catch (error) {
      return handleConversionError(error, reply);
    }
  });

  app.post<{ Body: unknown }>("/auth/youtube-music/browser-headers", {
    schema: {
      body: browserHeadersAuthBodySchema,
    },
    handler: async (request, reply) => {
      const parsed = browserHeadersAuthRequestSchema.safeParse(request.body);

      if (!parsed.success || parsed.data.headersRaw.trim().length === 0) {
        reply.code(400);
        return {
          error: "Invalid YouTube Music auth headers",
          message: "Paste copied YouTube Music browser request headers.",
        };
      }

      try {
        return accountStatusResponseSchema.parse({
          youtubeMusic: await ytmusicAuth.setupBrowserHeaders(
            parsed.data.headersRaw,
          ),
        });
      } catch (error) {
        return handleConversionError(error, reply);
      }
    },
  });

  app.delete("/auth/youtube-music", async (_request, reply) => {
    try {
      return accountStatusResponseSchema.parse({
        youtubeMusic: await ytmusicAuth.disconnectAuth(),
      });
    } catch (error) {
      return handleConversionError(error, reply);
    }
  });

  app.get("/system/status", async () => ({
    database: getDatabaseStatus(),
    plannedTables,
  }));

  app.get("/settings/matching", async () =>
    matchingSettingsResponseSchema.parse({
      settings: matchingSettings.getSettings(),
    }),
  );

  app.patch<{ Body: unknown }>("/settings/matching", async (request, reply) => {
    const parsedPatch = matchingSettingsPatchSchema.safeParse(
      request.body ?? {},
    );

    if (!parsedPatch.success) {
      reply.code(400);
      return {
        error: "Invalid matching settings",
        message:
          parsedPatch.error.issues[0]?.message ??
          "Expected matching settings patch.",
      };
    }

    const parsedSettings = matchingSettingsSchema.safeParse({
      ...matchingSettings.getSettings(),
      ...parsedPatch.data,
    });

    if (!parsedSettings.success) {
      reply.code(400);
      return {
        error: "Invalid matching settings",
        message:
          parsedSettings.error.issues[0]?.message ??
          "Expected matching settings.",
      };
    }

    return matchingSettingsResponseSchema.parse({
      settings: matchingSettings.updateSettings(parsedSettings.data),
    });
  });

  app.get("/events", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    const unsubscribe = importEvents.subscribe((event) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.raw.on("close", unsubscribe);
    return reply;
  });

  app.get("/imports/latest", async () =>
    latestImportResponseSchema.parse({
      conversion: conversions.getLatestImport(),
    }),
  );

  app.post<{ Body: SpicetifyImportBody }>("/imports/spicetify", {
    schema: {
      body: spicetifyImportBodySchema,
    },
    handler: async (request, reply) => {
      const parsed = spicetifyPlaylistSnapshotSchema.safeParse(request.body);

      if (!parsed.success) {
        reply.code(400);
        return {
          error: "Invalid Spicetify import",
          message:
            parsed.error.issues[0]?.message ??
            "Expected a Spicetify playlist snapshot",
        };
      }

      let conversion: ConversionJob;
      try {
        conversion = conversions.importSpicetifySnapshot(parsed.data);
      } catch (error) {
        if (error instanceof ImportLockedError) {
          reply.code(409);
          return {
            error: "Import is locked",
            message:
              "Reset the current conversion before importing another playlist.",
          };
        }

        throw error;
      }
      importEvents.publish({
        type: "spicetify-imported",
        conversionId: conversion.id,
      });

      return spicetifyImportResponseSchema.parse({
        ok: true,
        conversion,
      });
    },
  });

  app.post("/imports/reset", async () => conversions.resetImport());

  app.get<{ Params: { id: string } }>("/conversions/:id", {
    schema: {
      params: conversionParamsSchema,
    },
    handler: async (request, reply) => {
      try {
        return conversions.getConversion(request.params.id);
      } catch (error) {
        return handleConversionError(error, reply);
      }
    },
  });

  app.post<{ Params: { id: string } }>("/conversions/:id/match", {
    schema: {
      params: conversionParamsSchema,
    },
    handler: async (request, reply) => {
      try {
        const conversion = conversions.getConversion(request.params.id);
        importEvents.publish({
          type: "conversion-match-started",
          conversionId: conversion.id,
          totalTracks: conversion.tracks.length,
        });

        const result = await conversions.matchConversion(request.params.id, {
          onProgress: (progress) => {
            importEvents.publish({
              type: "conversion-match-progress",
              conversionId: progress.conversion.id,
              conversion: progress.conversion,
              match: progress.match,
              processedTracks: progress.processedTracks,
              totalTracks: progress.totalTracks,
            });
          },
        });

        if (result.cancelled) {
          importEvents.publish({
            type: "conversion-match-cancelled",
            conversionId: result.conversion.id,
            conversion: result.conversion,
            processedTracks: result.conversion.matches.length,
            totalTracks: result.conversion.tracks.length,
          });
        } else {
          importEvents.publish({
            type: "conversion-match-completed",
            conversionId: result.conversion.id,
            conversion: result.conversion,
            processedTracks: result.conversion.matches.length,
            totalTracks: result.conversion.tracks.length,
          });
        }

        return result;
      } catch (error) {
        importEvents.publish({
          type: "conversion-match-failed",
          conversionId: request.params.id,
          message: error instanceof Error ? error.message : String(error),
        });
        return handleConversionError(error, reply);
      }
    },
  });

  app.post<{ Params: { id: string } }>("/conversions/:id/match/cancel", {
    schema: {
      params: conversionParamsSchema,
    },
    handler: async (request, reply) => {
      try {
        return conversions.cancelMatchConversion(request.params.id);
      } catch (error) {
        return handleConversionError(error, reply);
      }
    },
  });

  app.post<{
    Body: unknown;
    Params: { id: string; trackId: string };
  }>("/conversions/:id/matches/:trackId/status", {
    schema: {
      params: matchParamsSchema,
    },
    handler: async (request, reply) => {
      const parsed = matchDecisionUpdateRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        reply.code(400);
        return {
          error: "Invalid match decision",
          message:
            parsed.error.issues[0]?.message ??
            "Expected a match decision status.",
        };
      }

      try {
        return conversions.updateMatchStatus(
          request.params.id,
          request.params.trackId,
          parsed.data.status,
        );
      } catch (error) {
        return handleConversionError(error, reply);
      }
    },
  });

  app.post<{
    Body: unknown;
    Params: { id: string; trackId: string };
  }>("/conversions/:id/matches/:trackId/candidates", {
    schema: {
      params: matchParamsSchema,
    },
    handler: async (request, reply) => {
      const parsed = manualMatchSearchRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        reply.code(400);
        return {
          error: "Invalid manual match search",
          message:
            parsed.error.issues[0]?.message ??
            "Expected a manual search query.",
        };
      }

      try {
        return manualMatchSearchResponseSchema.parse(
          await conversions.searchTrackCandidates(
            request.params.id,
            request.params.trackId,
            parsed.data.query,
          ),
        );
      } catch (error) {
        return handleConversionError(error, reply);
      }
    },
  });

  app.post<{
    Body: unknown;
    Params: { id: string; trackId: string };
  }>("/conversions/:id/matches/:trackId/manual", {
    schema: {
      params: matchParamsSchema,
    },
    handler: async (request, reply) => {
      const parsed = manualMatchSelectRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        reply.code(400);
        return {
          error: "Invalid manual match selection",
          message:
            parsed.error.issues[0]?.message ??
            "Expected a YouTube Music candidate.",
        };
      }

      try {
        return conversions.selectManualMatch(
          request.params.id,
          request.params.trackId,
          parsed.data.candidate,
        );
      } catch (error) {
        return handleConversionError(error, reply);
      }
    },
  });

  app.post<{ Params: { id: string; trackId: string } }>(
    "/conversions/:id/matches/:trackId/search",
    {
      schema: {
        params: matchParamsSchema,
      },
      handler: async (request, reply) => {
        try {
          return await conversions.searchTrackMatch(
            request.params.id,
            request.params.trackId,
          );
        } catch (error) {
          return handleConversionError(error, reply);
        }
      },
    },
  );

  app.post<{ Body: unknown; Params: { id: string } }>(
    "/conversions/:id/create",
    {
      schema: {
        params: conversionParamsSchema,
      },
      handler: async (request, reply) => {
        const parsed = playlistCreateRequestSchema.safeParse(
          request.body ?? {},
        );

        if (!parsed.success) {
          reply.code(400);
          return {
            error: "Invalid playlist creation request",
            message:
              parsed.error.issues[0]?.message ??
              "Expected playlist creation options.",
          };
        }

        try {
          return await conversions.createPlaylist(
            request.params.id,
            parsed.data,
          );
        } catch (error) {
          return handleConversionError(error, reply);
        }
      },
    },
  );

  return app;
}

function handleConversionError(
  error: unknown,
  reply: {
    code: (statusCode: number) => void;
  },
) {
  if (error instanceof ConversionNotFoundError) {
    reply.code(404);
    return { error: "Conversion not found" };
  }

  if (
    error instanceof TrackNotFoundError ||
    error instanceof MatchNotFoundError
  ) {
    reply.code(404);
    return { error: error.message };
  }

  if (error instanceof InvalidMatchDecisionError) {
    reply.code(409);
    return { error: "Invalid match decision", message: error.message };
  }

  if (error instanceof InvalidConversionStateError) {
    reply.code(409);
    return { error: "Invalid conversion state", message: error.message };
  }

  if (error instanceof NoAcceptedMatchesError) {
    reply.code(409);
    return { error: "No accepted matches", message: error.message };
  }

  if (error instanceof YtmusicWorkerUnavailableError) {
    reply.code(503);
    return {
      error: "YouTube Music unavailable",
      message: error.message,
    };
  }

  throw error;
}
