import {
  type ConversionJob,
  conversionJobSchema,
  type MatchDecision,
  type MatchDecisionStatus,
  matchDecisionSchema,
  type SpicetifyPlaylistSnapshot,
  type SpotifyTrack,
  type YtmusicCandidate,
} from "@spottoyt/shared";
import { type LogEventWriter, noopLogEvent } from "../logging/logger";
import type { ConversionStore } from "../storage/conversion-store";
import { MatcherService } from "./matcher.service";
import { YtmusicService } from "./ytmusic.service";

type MatchConversionOptions = {
  onProgress?: (progress: {
    conversion: ConversionJob;
    match: MatchDecision;
    processedTracks: number;
    totalTracks: number;
  }) => void | Promise<void>;
};

type MatchCancellation = {
  cancelled: boolean;
};

export class ConversionService {
  private activeMatchCancellations = new Map<string, MatchCancellation>();
  private latestImport?: ConversionJob;
  private readonly ytmusic: YtmusicService;
  private readonly matcher: MatcherService;

  constructor(
    ytmusic?: YtmusicService,
    matcher = new MatcherService(),
    private readonly logEvent: LogEventWriter = noopLogEvent,
    private readonly store?: ConversionStore,
  ) {
    this.ytmusic = ytmusic ?? new YtmusicService(undefined, this.logEvent);
    this.matcher = matcher;
    this.latestImport = this.normalizeRestoredConversion(
      this.store?.getLatestImport() ?? null,
    );
  }

  importSpicetifySnapshot(snapshot: SpicetifyPlaylistSnapshot): ConversionJob {
    this.logEvent("info", "api", "import.spicetify.received", {
      playlistName: snapshot.playlistName,
      playlistUriSuffix: playlistIdFromUri(snapshot.spotifyPlaylistUri),
      snapshotAt: snapshot.snapshotAt,
      trackCount: snapshot.tracks.length,
    });

    const existingConversion =
      this.store?.getBySpotifyPlaylistUri(snapshot.spotifyPlaylistUri) ??
      (this.latestImport?.sourcePlaylistUri === snapshot.spotifyPlaylistUri
        ? this.latestImport
        : null);

    if (
      this.latestImport &&
      this.latestImport.status !== "imported" &&
      this.latestImport.sourcePlaylistUri !== snapshot.spotifyPlaylistUri
    ) {
      this.logEvent("warn", "api", "import.spicetify.locked", {
        existingConversionId: this.latestImport.id,
        existingStatus: this.latestImport.status,
      });
      throw new ImportLockedError();
    }

    const now = new Date().toISOString();
    const tracks = snapshot.tracks.map(toSpotifyTrack);
    const matches = matchesByTrackOrder(
      tracks,
      existingConversion?.matches ?? [],
    );
    const conversion = conversionJobSchema.parse({
      id:
        existingConversion?.id ??
        `conversion-${slugifyId(playlistIdFromUri(snapshot.spotifyPlaylistUri))}`,
      sourcePlaylistUri: snapshot.spotifyPlaylistUri,
      sourceSnapshotAt: snapshot.snapshotAt,
      sourcePlaylistName: snapshot.playlistName,
      targetPlaylistName:
        existingConversion?.targetPlaylistName ?? snapshot.playlistName,
      status: statusForImportedSnapshot(existingConversion, tracks, matches),
      createdAt: existingConversion?.createdAt ?? now,
      updatedAt: now,
      tracks,
      matches,
      playlist: existingConversion?.playlist,
    });

    this.saveLatestImport(conversion);
    this.logEvent("info", "api", "import.spicetify.accepted", {
      conversionId: conversion.id,
      playlistName: conversion.sourcePlaylistName,
      trackCount: conversion.tracks.length,
      preservedMatchCount: conversion.matches.length,
    });
    return conversion;
  }

  getLatestImport(): ConversionJob | null {
    return this.latestImport ?? null;
  }

  resetImport() {
    this.logEvent("info", "api", "import.reset", {
      conversionId: this.latestImport?.id,
      status: this.latestImport?.status,
    });
    this.latestImport = undefined;
    this.store?.clearLatestImport();
    return { ok: true };
  }

  getConversion(id: string): ConversionJob {
    const conversion = this.requireLatestConversion(id);
    this.logEvent("debug", "api", "conversion.loaded", {
      conversionId: conversion.id,
      status: conversion.status,
      trackCount: conversion.tracks.length,
    });
    return conversionJobSchema.parse(conversion);
  }

  async matchConversion(id: string, options: MatchConversionOptions = {}) {
    const conversion = this.requireLatestConversion(id);
    const cancellation: MatchCancellation = { cancelled: false };
    this.activeMatchCancellations.set(id, cancellation);
    const existingMatches = matchesByTrackOrder(
      conversion.tracks,
      conversion.matches,
    );
    const existingTrackIds = new Set(
      existingMatches.map((match) => match.trackId),
    );
    const remainingTracks = conversion.tracks.filter(
      (track) => !existingTrackIds.has(track.id),
    );
    const matching = conversionJobSchema.parse({
      ...conversion,
      status: "matching",
      matches: existingMatches,
      updatedAt: new Date().toISOString(),
    });
    this.saveLatestImport(matching);

    this.logEvent("info", "api", "conversion.match.started", {
      conversionId: matching.id,
      trackCount: remainingTracks.length,
    });

    let matches: MatchDecision[];
    try {
      matches = await this.ytmusic.findMatchesForTracks(
        remainingTracks,
        async ({ decision, processedTracks }) => {
          const progressConversion = conversionJobSchema.parse({
            ...matching,
            matches: matchesByTrackOrder(matching.tracks, [
              ...(this.latestImport?.matches ?? []),
              decision,
            ]),
            updatedAt: new Date().toISOString(),
          });
          this.saveLatestImport(progressConversion);

          await options.onProgress?.({
            conversion: progressConversion,
            match: decision,
            processedTracks: existingMatches.length + processedTracks,
            totalTracks: matching.tracks.length,
          });
        },
        () => cancellation.cancelled,
      );
    } catch (error) {
      this.logEvent("error", "api", "conversion.match.failed", {
        conversionId: matching.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      this.activeMatchCancellations.delete(id);
    }

    if (cancellation.cancelled) {
      const cancelled = this.finalizeCancelledMatch(
        matching,
        this.latestImport?.matches ?? [...existingMatches, ...matches],
      );

      return {
        cancelled: true,
        conversion: cancelled,
        summary: this.matcher.summarize(cancelled.matches),
      };
    }

    const matched = conversionJobSchema.parse({
      ...matching,
      status: "reviewing",
      updatedAt: new Date().toISOString(),
      matches: matchesByTrackOrder(matching.tracks, [
        ...existingMatches,
        ...matches,
      ]),
    });
    this.saveLatestImport(matched);
    const summary = this.matcher.summarize(matched.matches);

    this.logEvent("info", "api", "conversion.match.completed", {
      conversionId: matched.id,
      ...summary,
    });

    return {
      cancelled: false,
      conversion: matched,
      summary,
    };
  }

  cancelMatchConversion(id: string) {
    const conversion = this.requireLatestConversion(id);
    const cancellation = this.activeMatchCancellations.get(id);

    if (cancellation) {
      cancellation.cancelled = true;
    }

    if (!cancellation && conversion.status !== "matching") {
      return {
        conversion,
        summary: this.matcher.summarize(conversion.matches),
      };
    }

    const cancelled = this.finalizeCancelledMatch(
      conversion,
      conversion.matches,
    );

    return {
      conversion: cancelled,
      summary: this.matcher.summarize(cancelled.matches),
    };
  }

  updateMatchStatus(id: string, trackId: string, status: MatchDecisionStatus) {
    const conversion = this.requireLatestConversion(id);
    const existing = conversion.matches.find(
      (match) => match.trackId === trackId,
    );

    if (!existing && status !== "skipped") {
      throw new MatchNotFoundError();
    }

    if (existing?.candidate === null && status !== "skipped") {
      throw new InvalidMatchDecisionError();
    }

    const match = matchDecisionSchema.parse(
      status === "skipped"
        ? {
            trackId,
            candidate: null,
            confidence: 0,
            status,
          }
        : {
            ...existing,
            status,
          },
    );

    return this.replaceMatch(conversion, match);
  }

  async searchTrackCandidates(id: string, trackId: string, query: string) {
    const conversion = this.requireLatestConversion(id);
    const track = conversion.tracks.find((item) => item.id === trackId);
    const trimmedQuery = query.trim();

    if (!track) {
      throw new TrackNotFoundError();
    }

    const candidates = await this.ytmusic.searchCandidates(trimmedQuery);

    this.logEvent("info", "api", "conversion.manual_search.requested", {
      conversionId: conversion.id,
      trackId,
      query: trimmedQuery,
      candidateCount: candidates.length,
    });

    return {
      trackId,
      query: trimmedQuery,
      candidates,
    };
  }

  selectManualMatch(id: string, trackId: string, candidate: YtmusicCandidate) {
    const conversion = this.requireLatestConversion(id);
    const track = conversion.tracks.find((item) => item.id === trackId);

    if (!track) {
      throw new TrackNotFoundError();
    }

    const match = matchDecisionSchema.parse({
      trackId,
      candidate,
      confidence: 1,
      status: "accepted",
    });

    return this.replaceMatch(conversion, match);
  }

  async searchTrackMatch(id: string, trackId: string) {
    const conversion = this.requireLatestConversion(id);
    const track = conversion.tracks.find((item) => item.id === trackId);

    if (!track) {
      throw new TrackNotFoundError();
    }

    const [match] = await this.ytmusic.findMatchesForTracks([track]);

    if (!match) {
      throw new MatchNotFoundError();
    }

    return this.replaceMatch(conversion, match);
  }

  async createPlaylist(
    id: string,
    input: { targetPlaylistName?: string } = {},
  ) {
    const conversion = this.getConversion(id);
    const acceptedMatches = conversion.matches.filter(
      (match) => match.status === "accepted" && match.candidate,
    );
    const unsyncedAcceptedMatches = acceptedMatches.filter(
      (match) => !match.syncedAt,
    );
    const skippedTrackCount = conversion.tracks.length - acceptedMatches.length;
    const targetPlaylistName =
      input.targetPlaylistName?.trim() || conversion.targetPlaylistName;

    if (conversion.status !== "reviewing" && conversion.status !== "complete") {
      throw new InvalidConversionStateError();
    }

    if (acceptedMatches.length === 0) {
      throw new NoAcceptedMatchesError();
    }

    if (unsyncedAcceptedMatches.length === 0) {
      const unchanged = conversionJobSchema.parse({
        ...conversion,
        status: "complete" as const,
        targetPlaylistName,
        updatedAt: new Date().toISOString(),
      });
      this.saveLatestImport(unchanged);

      return unchanged;
    }

    this.logEvent("info", "api", "conversion.playlist.create_started", {
      conversionId: conversion.id,
      acceptedTrackCount: unsyncedAcceptedMatches.length,
      targetPlaylistName,
    });

    let playlist: Awaited<ReturnType<YtmusicService["createPlaylist"]>>;
    try {
      const videoIds = unsyncedAcceptedMatches.flatMap((match) =>
        match.candidate ? [match.candidate.videoId] : [],
      );
      playlist = conversion.playlist
        ? await this.ytmusic.addPlaylistItems({
            playlistId: conversion.playlist.playlistId,
            videoIds,
          })
        : await this.ytmusic.createPlaylist({
            description: "Converted from Spotify by SpottoYT.",
            title: targetPlaylistName,
            videoIds,
          });
    } catch (error) {
      this.logEvent("error", "api", "conversion.playlist.create_failed", {
        conversionId: conversion.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    this.logEvent("info", "api", "conversion.playlist.create_completed", {
      conversionId: conversion.id,
      playlistId: playlist.playlistId,
    });

    const syncedAt = new Date().toISOString();
    const syncedTrackIds = new Set(
      unsyncedAcceptedMatches.map((match) => match.trackId),
    );
    const completed = conversionJobSchema.parse({
      ...conversion,
      status: "complete" as const,
      targetPlaylistName,
      updatedAt: new Date().toISOString(),
      matches: matchesByTrackOrder(
        conversion.tracks,
        conversion.matches.map((match) =>
          syncedTrackIds.has(match.trackId) ? { ...match, syncedAt } : match,
        ),
      ),
      playlist: {
        ...playlist,
        createdTrackCount: unsyncedAcceptedMatches.length,
        skippedTrackCount,
      },
    });
    this.saveLatestImport(completed);

    return completed;
  }

  private requireLatestConversion(id: string): ConversionJob {
    const conversion =
      this.latestImport?.id === id
        ? this.latestImport
        : this.normalizeRestoredConversion(this.store?.getConversion(id) ?? null);

    if (!conversion) {
      this.logEvent("warn", "api", "conversion.not_found", {
        requestedConversionId: id,
        latestConversionId: this.latestImport?.id,
      });
      throw new ConversionNotFoundError();
    }

    return conversion;
  }

  private saveLatestImport(conversion: ConversionJob) {
    const saved = this.store?.saveConversion(conversion) ?? conversion;
    this.latestImport = saved;

    return saved;
  }

  private normalizeRestoredConversion(conversion: ConversionJob | null) {
    if (!conversion) {
      return undefined;
    }

    if (conversion.status === "matching") {
      return conversionJobSchema.parse({
        ...conversion,
        status: conversion.matches.length > 0 ? "reviewing" : "imported",
      });
    }

    return conversionJobSchema.parse(conversion);
  }

  private replaceMatch(conversion: ConversionJob, match: MatchDecision) {
    const matches = matchesByTrackOrder(conversion.tracks, [
      ...conversion.matches,
      match,
    ]);
    const updated = conversionJobSchema.parse({
      ...conversion,
      status: "reviewing",
      updatedAt: new Date().toISOString(),
      matches,
    });
    this.saveLatestImport(updated);
    const summary = this.matcher.summarize(updated.matches);

    this.logEvent("info", "api", "conversion.match.updated", {
      conversionId: updated.id,
      trackId: match.trackId,
      status: match.status,
      ...summary,
    });

    return {
      conversion: updated,
      match,
      summary,
    };
  }

  private finalizeCancelledMatch(
    conversion: ConversionJob,
    matches: MatchDecision[],
  ) {
    const cancelled = conversionJobSchema.parse({
      ...conversion,
      status: matches.length > 0 ? "reviewing" : "imported",
      updatedAt: new Date().toISOString(),
      matches: matchesByTrackOrder(conversion.tracks, matches),
    });
    this.saveLatestImport(cancelled);
    const summary = this.matcher.summarize(cancelled.matches);

    this.logEvent("info", "api", "conversion.match.cancelled", {
      conversionId: cancelled.id,
      ...summary,
    });

    return cancelled;
  }
}

function matchesByTrackOrder(
  tracks: ConversionJob["tracks"],
  matches: MatchDecision[],
) {
  const matchesByTrackId = new Map(matches.map((item) => [item.trackId, item]));

  return tracks.flatMap((track) => {
    const nextMatch = matchesByTrackId.get(track.id);

    return nextMatch ? [nextMatch] : [];
  });
}

export class ImportLockedError extends Error {
  constructor() {
    super("Import is locked");
  }
}

export class ConversionNotFoundError extends Error {
  constructor() {
    super("Conversion not found");
  }
}

export class TrackNotFoundError extends Error {
  constructor() {
    super("Track not found");
  }
}

export class MatchNotFoundError extends Error {
  constructor() {
    super("Match not found");
  }
}

export class InvalidMatchDecisionError extends Error {
  constructor() {
    super("Match decision is not valid for the current track");
  }
}

export class InvalidConversionStateError extends Error {
  constructor() {
    super("Conversion must be ready for review before creating a playlist");
  }
}

export class NoAcceptedMatchesError extends Error {
  constructor() {
    super("No accepted matches");
  }
}

function toSpotifyTrack(track: SpicetifyPlaylistSnapshot["tracks"][number]) {
  return {
    id: track.spotifyUri,
    title: track.title,
    artists: track.artists,
    album: track.album ?? "Unknown album",
    durationMs: track.durationMs,
    isrc: track.isrc,
    explicit: track.explicit ?? false,
  } satisfies SpotifyTrack;
}

function statusForImportedSnapshot(
  existingConversion: ConversionJob | null,
  tracks: SpotifyTrack[],
  matches: MatchDecision[],
): ConversionJob["status"] {
  if (!existingConversion) {
    return "imported";
  }

  if (matches.length < tracks.length) {
    return matches.length > 0 ? "reviewing" : "imported";
  }

  if (
    existingConversion.status === "matching" ||
    existingConversion.status === "creating"
  ) {
    return "reviewing";
  }

  return existingConversion.status;
}

function playlistIdFromUri(uri: string) {
  return uri.split(":").at(-1) ?? "spicetify";
}

function slugifyId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-") || "spicetify";
}
