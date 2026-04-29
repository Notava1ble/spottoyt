import { z } from "zod";

export const providerSchema = z.enum(["spotify", "youtubeMusic"]);

export const connectionStatusSchema = z.object({
  provider: providerSchema,
  connected: z.boolean(),
  configured: z.boolean().optional(),
  displayName: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export const accountStatusResponseSchema = z.object({
  spotify: connectionStatusSchema,
  youtubeMusic: connectionStatusSchema,
});

export const spotifyPlaylistUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+/.test(value),
    {
      message: "Expected a Spotify playlist URL",
    },
  );

export const spotifyTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.array(z.string()).min(1),
  album: z.string(),
  durationMs: z.number().int().positive(),
  isrc: z.string().optional(),
  explicit: z.boolean(),
});

export const spotifyPlaylistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  trackCount: z.number().int().nonnegative(),
  public: z.boolean().nullable(),
  collaborative: z.boolean(),
  ownerName: z.string().optional(),
  externalUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

export const spotifyPlaylistsResponseSchema = z.object({
  playlists: z.array(spotifyPlaylistSummarySchema),
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
