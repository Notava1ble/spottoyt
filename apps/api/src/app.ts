import cors from "@fastify/cors";
import {
  accountStatusResponseSchema,
  spotifyPlaylistsResponseSchema,
  spotifyPlaylistUrlSchema,
} from "@spottoyt/shared";
import Fastify, { type FastifyServerOptions } from "fastify";
import { getEnv } from "./config/env";
import { ConversionService } from "./services/conversion.service";
import {
  SpotifyAuthError,
  SpotifyAuthService,
} from "./services/spotify-auth.service";
import { getDatabaseStatus } from "./storage/db";
import { plannedTables } from "./storage/schema";

type ImportPlaylistBody = {
  playlistUrl: string;
};

const importPlaylistBodySchema = {
  type: "object",
  required: ["playlistUrl"],
  additionalProperties: false,
  properties: {
    playlistUrl: { type: "string", minLength: 1 },
  },
} as const;

const conversionParamsSchema = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
  },
} as const;

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });
  const conversions = new ConversionService();
  const currentEnv = getEnv();
  const spotifyAuth = new SpotifyAuthService({
    clientId: currentEnv.spotifyClientId,
    clientSecret: currentEnv.spotifyClientSecret,
    redirectUri: currentEnv.spotifyRedirectUri,
  });

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "spottoyt-api",
  }));

  app.get("/auth/status", async () =>
    accountStatusResponseSchema.parse({
      spotify: spotifyAuth.getStatus(),
      youtubeMusic: {
        provider: "youtubeMusic",
        connected: false,
        configured: false,
      },
    }),
  );

  app.get("/auth/spotify/login", async (_request, reply) => {
    try {
      return reply.redirect(spotifyAuth.getAuthorizeUrl());
    } catch (error) {
      return handleSpotifyAuthError(error, reply);
    }
  });

  app.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>("/auth/spotify/callback", async (request, reply) => {
    if (request.query.error) {
      reply.code(400);
      return { error: request.query.error };
    }

    try {
      await spotifyAuth.completeCallback(
        request.query.code,
        request.query.state,
      );
      return reply.redirect(currentEnv.webUrl);
    } catch (error) {
      return handleSpotifyAuthError(error, reply);
    }
  });

  app.post("/auth/spotify/logout", async () => {
    spotifyAuth.logout();
    return { ok: true };
  });

  app.get("/spotify/playlists", async (_request, reply) => {
    try {
      return spotifyPlaylistsResponseSchema.parse({
        playlists: await spotifyAuth.listPlaylists(),
      });
    } catch (error) {
      return handleSpotifyAuthError(error, reply);
    }
  });

  app.get("/system/status", async () => ({
    database: getDatabaseStatus(),
    plannedTables,
  }));

  app.post<{ Body: ImportPlaylistBody }>("/playlists/import", {
    schema: {
      body: importPlaylistBodySchema,
    },
    handler: async (request, reply) => {
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

function handleSpotifyAuthError(
  error: unknown,
  reply: {
    code: (statusCode: number) => void;
  },
) {
  if (error instanceof SpotifyAuthError) {
    reply.code(error.statusCode);
    return { error: error.message };
  }

  throw error;
}
