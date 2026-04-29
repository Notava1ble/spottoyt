import cors from "@fastify/cors";
import {
  accountStatusResponseSchema,
  spotifyPlaylistUrlSchema,
} from "@spottoyt/shared";
import Fastify, { type FastifyServerOptions } from "fastify";
import { ConversionService } from "./services/conversion.service";
import { getDatabaseStatus } from "./storage/db";
import { plannedTables } from "./storage/schema";

type ImportPlaylistBody = {
  playlistUrl: string;
};

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });
  const conversions = new ConversionService();

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "spottoyt-api",
  }));

  app.get("/auth/status", async () =>
    accountStatusResponseSchema.parse({
      spotify: {
        provider: "spotify",
        connected: false,
      },
      youtubeMusic: {
        provider: "youtubeMusic",
        connected: false,
      },
    }),
  );

  app.get("/system/status", async () => ({
    database: getDatabaseStatus(),
    plannedTables,
  }));

  app.post<{ Body: ImportPlaylistBody }>(
    "/playlists/import",
    async (request, reply) => {
      const parsedUrl = spotifyPlaylistUrlSchema.safeParse(
        request.body.playlistUrl,
      );

      if (!parsedUrl.success) {
        reply.code(400);
        return {
          error: "Invalid playlist URL",
          message:
            parsedUrl.error.issues[0]?.message ??
            "Expected a Spotify playlist URL",
        };
      }

      return conversions.importPlaylist(parsedUrl.data);
    },
  );

  app.get<{ Params: { id: string } }>("/conversions/:id", async (request) =>
    conversions.getConversion(request.params.id),
  );

  app.post<{ Params: { id: string } }>(
    "/conversions/:id/match",
    async (request) => conversions.matchConversion(request.params.id),
  );

  app.post<{ Params: { id: string } }>(
    "/conversions/:id/create",
    async (request) => conversions.createPlaylist(request.params.id),
  );

  return app;
}
