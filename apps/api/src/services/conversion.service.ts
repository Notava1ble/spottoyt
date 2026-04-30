import {
  type ConversionJob,
  conversionJobSchema,
  type MatchDecision,
  type SpicetifyPlaylistSnapshot,
  type SpotifyTrack,
} from "@spottoyt/shared";
import {
  type LogEventWriter,
  noopLogEvent,
} from "../logging/logger";
import { MatcherService } from "./matcher.service";
import { YtmusicService } from "./ytmusic.service";

export class ConversionService {
  private latestImport?: ConversionJob;
  private readonly ytmusic: YtmusicService;
  private readonly matcher: MatcherService;

  constructor(
    ytmusic?: YtmusicService,
    matcher = new MatcherService(),
    private readonly logEvent: LogEventWriter = noopLogEvent,
  ) {
    this.ytmusic = ytmusic ?? new YtmusicService(undefined, this.logEvent);
    this.matcher = matcher;
  }

  importSpicetifySnapshot(snapshot: SpicetifyPlaylistSnapshot): ConversionJob {
    this.logEvent("info", "api", "import.spicetify.received", {
      playlistName: snapshot.playlistName,
      playlistUriSuffix: playlistIdFromUri(snapshot.spotifyPlaylistUri),
      snapshotAt: snapshot.snapshotAt,
      trackCount: snapshot.tracks.length,
    });

    if (this.latestImport && this.latestImport.status !== "imported") {
      this.logEvent("warn", "api", "import.spicetify.locked", {
        existingConversionId: this.latestImport.id,
        existingStatus: this.latestImport.status,
      });
      throw new ImportLockedError();
    }

    const now = new Date().toISOString();
    const tracks = snapshot.tracks.map(toSpotifyTrack);
    const conversion = conversionJobSchema.parse({
      id: `conversion-${playlistIdFromUri(snapshot.spotifyPlaylistUri)}-${Date.now()}`,
      sourcePlaylistName: snapshot.playlistName,
      targetPlaylistName: `${snapshot.playlistName} - YouTube Music`,
      status: "imported",
      createdAt: now,
      updatedAt: now,
      tracks,
      matches: [],
    });

    this.latestImport = conversion;
    this.logEvent("info", "api", "import.spicetify.accepted", {
      conversionId: conversion.id,
      playlistName: conversion.sourcePlaylistName,
      trackCount: conversion.tracks.length,
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

  async matchConversion(id: string) {
    const conversion = this.requireLatestConversion(id);
    const matching = conversionJobSchema.parse({
      ...conversion,
      status: "matching",
      updatedAt: new Date().toISOString(),
    });
    this.latestImport = matching;

    this.logEvent("info", "api", "conversion.match.started", {
      conversionId: matching.id,
      trackCount: matching.tracks.length,
    });

    let matches: MatchDecision[];
    try {
      matches = await this.ytmusic.findMatchesForTracks(matching.tracks);
    } catch (error) {
      this.logEvent("error", "api", "conversion.match.failed", {
        conversionId: matching.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    const matched = conversionJobSchema.parse({
      ...matching,
      status: "reviewing",
      updatedAt: new Date().toISOString(),
      matches,
    });
    this.latestImport = matched;
    const summary = this.matcher.summarize(matched.matches);

    this.logEvent("info", "api", "conversion.match.completed", {
      conversionId: matched.id,
      ...summary,
    });

    return {
      conversion: matched,
      summary,
    };
  }

  async createPlaylist(id: string) {
    const conversion = this.getConversion(id);
    this.logEvent("info", "api", "conversion.playlist.create_started", {
      conversionId: conversion.id,
      targetPlaylistName: conversion.targetPlaylistName,
    });

    let playlist: Awaited<ReturnType<YtmusicService["createPlaylist"]>>;
    try {
      playlist = await this.ytmusic.createPlaylist();
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

    return {
      ...conversion,
      status: "complete" as const,
      targetPlaylistName: conversion.targetPlaylistName,
      playlist,
    };
  }

  private requireLatestConversion(id: string): ConversionJob {
    if (!this.latestImport || this.latestImport.id !== id) {
      this.logEvent("warn", "api", "conversion.not_found", {
        requestedConversionId: id,
        latestConversionId: this.latestImport?.id,
      });
      throw new ConversionNotFoundError();
    }

    return this.latestImport;
  }
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

function playlistIdFromUri(uri: string) {
  return uri.split(":").at(-1) ?? "spicetify";
}
