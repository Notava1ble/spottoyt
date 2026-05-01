import type { z } from "zod";
import type {
  accountStatusResponseSchema,
  browserHeadersAuthRequestSchema,
  connectionStatusSchema,
  conversionJobSchema,
  importEventSchema,
  latestImportResponseSchema,
  matchDecisionSchema,
  matchDecisionStatusSchema,
  matchDecisionUpdateRequestSchema,
  matchingSettingsPatchSchema,
  matchingSettingsResponseSchema,
  matchingSettingsSchema,
  playlistCreationResultSchema,
  spicetifyImportResponseSchema,
  spicetifyPlaylistSnapshotSchema,
  spicetifyPlaylistTrackSchema,
  spotifyTrackSchema,
  ytmusicCandidateSchema,
} from "./schemas";

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type AccountStatusResponse = z.infer<typeof accountStatusResponseSchema>;
export type BrowserHeadersAuthRequest = z.infer<
  typeof browserHeadersAuthRequestSchema
>;
export type PlaylistCreationResult = z.infer<
  typeof playlistCreationResultSchema
>;
export type SpotifyTrack = z.infer<typeof spotifyTrackSchema>;
export type SpicetifyPlaylistTrack = z.infer<
  typeof spicetifyPlaylistTrackSchema
>;
export type SpicetifyPlaylistSnapshot = z.infer<
  typeof spicetifyPlaylistSnapshotSchema
>;
export type YtmusicCandidate = z.infer<typeof ytmusicCandidateSchema>;
export type MatchDecision = z.infer<typeof matchDecisionSchema>;
export type MatchDecisionStatus = z.infer<typeof matchDecisionStatusSchema>;
export type MatchDecisionUpdateRequest = z.infer<
  typeof matchDecisionUpdateRequestSchema
>;
export type MatchingSettings = z.infer<typeof matchingSettingsSchema>;
export type MatchingSettingsPatch = z.infer<
  typeof matchingSettingsPatchSchema
>;
export type MatchingSettingsResponse = z.infer<
  typeof matchingSettingsResponseSchema
>;
export type ConversionJob = z.infer<typeof conversionJobSchema>;
export type LatestImportResponse = z.infer<typeof latestImportResponseSchema>;
export type SpicetifyImportResponse = z.infer<
  typeof spicetifyImportResponseSchema
>;
export type ImportEvent = z.infer<typeof importEventSchema>;
