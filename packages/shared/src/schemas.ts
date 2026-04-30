import { z } from "zod";

export const providerSchema = z.enum(["youtubeMusic"]);

export const connectionStatusSchema = z.object({
  provider: providerSchema,
  connected: z.boolean(),
  configured: z.boolean().optional(),
  displayName: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export const accountStatusResponseSchema = z.object({
  youtubeMusic: connectionStatusSchema,
});

export const spotifyTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.array(z.string()).min(1),
  album: z.string(),
  durationMs: z.number().int().positive(),
  isrc: z.string().optional(),
  explicit: z.boolean(),
});

export const spicetifyPlaylistTrackSchema = z.object({
  spotifyUri: z.string().min(1),
  title: z.string().min(1),
  artists: z.array(z.string().min(1)).min(1),
  album: z.string().min(1).optional(),
  durationMs: z.number().int().positive(),
  isrc: z.string().min(1).optional(),
  explicit: z.boolean().optional(),
  position: z.number().int().nonnegative(),
});

export const spicetifyPlaylistSnapshotSchema = z.object({
  source: z.literal("spicetify"),
  spotifyPlaylistUri: z.string().min(1),
  playlistName: z.string().min(1),
  snapshotAt: z.string().datetime(),
  tracks: z.array(spicetifyPlaylistTrackSchema).min(1),
});

export const ytmusicCandidateSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  artists: z.array(z.string()).min(1),
  album: z.string().optional(),
  durationMs: z.number().int().positive(),
  resultType: z.enum(["song", "video"]),
});

export const matchDecisionSchema = z.object({
  trackId: z.string(),
  candidate: ytmusicCandidateSchema,
  confidence: z.number().min(0).max(1),
  status: z.enum(["accepted", "review", "skipped"]),
});

export const conversionJobSchema = z.object({
  id: z.string(),
  sourcePlaylistName: z.string(),
  targetPlaylistName: z.string(),
  status: z.enum([
    "imported",
    "importing",
    "matching",
    "reviewing",
    "creating",
    "complete",
    "failed",
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tracks: z.array(spotifyTrackSchema),
  matches: z.array(matchDecisionSchema),
});

export const latestImportResponseSchema = z.object({
  conversion: conversionJobSchema.nullable(),
});

export const spicetifyImportResponseSchema = z.object({
  ok: z.literal(true),
  conversion: conversionJobSchema,
});

export const importEventSchema = z.object({
  type: z.literal("spicetify-imported"),
  conversionId: z.string(),
});

export const mockConversionJob = {
  id: "demo-conversion",
  sourcePlaylistName: "Liked From The Other Side",
  targetPlaylistName: "Liked From The Other Side - YouTube Music",
  status: "reviewing",
  createdAt: "2026-04-29T12:00:00.000Z",
  updatedAt: "2026-04-29T12:05:00.000Z",
  tracks: [
    {
      id: "sp-001",
      title: "Midnight City",
      artists: ["M83"],
      album: "Hurry Up, We're Dreaming",
      durationMs: 243000,
      isrc: "FR6V81141061",
      explicit: false,
    },
    {
      id: "sp-002",
      title: "Sweet Disposition",
      artists: ["The Temper Trap"],
      album: "Conditions",
      durationMs: 231000,
      isrc: "AUUM70900059",
      explicit: false,
    },
    {
      id: "sp-003",
      title: "Nights",
      artists: ["Frank Ocean"],
      album: "Blonde",
      durationMs: 307000,
      explicit: true,
    },
    {
      id: "sp-004",
      title: "A Moment Apart",
      artists: ["ODESZA"],
      album: "A Moment Apart",
      durationMs: 235000,
      explicit: false,
    },
  ],
  matches: [
    {
      trackId: "sp-001",
      candidate: {
        videoId: "ytm-001",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        resultType: "song",
      },
      confidence: 0.97,
      status: "accepted",
    },
    {
      trackId: "sp-002",
      candidate: {
        videoId: "ytm-002",
        title: "Sweet Disposition",
        artists: ["The Temper Trap"],
        album: "Conditions",
        durationMs: 230000,
        resultType: "song",
      },
      confidence: 0.94,
      status: "accepted",
    },
    {
      trackId: "sp-003",
      candidate: {
        videoId: "ytm-003",
        title: "Nights",
        artists: ["Frank Ocean"],
        album: "Blonde",
        durationMs: 309000,
        resultType: "song",
      },
      confidence: 0.82,
      status: "review",
    },
    {
      trackId: "sp-004",
      candidate: {
        videoId: "ytm-004",
        title: "A Moment Apart",
        artists: ["ODESZA"],
        album: "A Moment Apart",
        durationMs: 235000,
        resultType: "song",
      },
      confidence: 0.9,
      status: "review",
    },
  ],
} as const;
