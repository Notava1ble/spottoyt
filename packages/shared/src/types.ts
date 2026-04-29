import type { z } from "zod";
import type {
  accountStatusResponseSchema,
  connectionStatusSchema,
  conversionJobSchema,
  matchDecisionSchema,
  spotifyPlaylistSummarySchema,
  spotifyPlaylistsResponseSchema,
  spotifyTrackSchema,
  ytmusicCandidateSchema,
} from "./schemas";

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type AccountStatusResponse = z.infer<typeof accountStatusResponseSchema>;
export type SpotifyTrack = z.infer<typeof spotifyTrackSchema>;
export type SpotifyPlaylistSummary = z.infer<
  typeof spotifyPlaylistSummarySchema
>;
export type SpotifyPlaylistsResponse = z.infer<
  typeof spotifyPlaylistsResponseSchema
>;
export type YtmusicCandidate = z.infer<typeof ytmusicCandidateSchema>;
export type MatchDecision = z.infer<typeof matchDecisionSchema>;
export type ConversionJob = z.infer<typeof conversionJobSchema>;
