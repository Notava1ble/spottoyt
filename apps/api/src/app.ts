import cors from "@fastify/cors";
import {
  accountStatusResponseSchema,
  latestImportResponseSchema,
  spicetifyImportResponseSchema,
  spicetifyPlaylistSnapshotSchema,
} from "@spottoyt/shared";
import Fastify, { type FastifyServerOptions } from "fastify";
import { ConversionService } from "./services/conversion.service";
import { ImportEventsService } from "./services/import-events.service";
import { getDatabaseStatus } from "./storage/db";
import { plannedTables } from "./storage/schema";

type SpicetifyImportBody = unknown;

const conversionParamsSchema = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
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

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });
  const conversions = new ConversionService();
  const importEvents = new ImportEventsService();

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "spottoyt-api",
  }));

  app.get("/auth/status", async () =>
    accountStatusResponseSchema.parse({
      youtubeMusic: {
        provider: "youtubeMusic",
        connected: false,
        configured: false,
      },
    }),
  );

  app.get("/system/status", async () => ({
    database: getDatabaseStatus(),
    plannedTables,
  }));

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

      const conversion = conversions.importSpicetifySnapshot(parsed.data);
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

  app.get<{ Params: { id: string } }>("/conversions/:id", {
    schema: {
      params: conversionParamsSchema,
    },
    handler: async (request) => conversions.getConversion(request.params.id),
  });

  app.post<{ Params: { id: string } }>("/conversions/:id/match", {
    schema: {
      params: conversionParamsSchema,
    },
    handler: async (request) => conversions.matchConversion(request.params.id),
  });

  app.post<{ Params: { id: string } }>("/conversions/:id/create", {
    schema: {
      params: conversionParamsSchema,
    },
    handler: async (request) => conversions.createPlaylist(request.params.id),
  });

  return app;
}
