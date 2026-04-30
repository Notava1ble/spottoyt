import {
  type ConversionJob,
  conversionJobSchema,
  type SpicetifyPlaylistSnapshot,
  type SpotifyTrack,
} from "@spottoyt/shared";
import { MatcherService } from "./matcher.service";
import { YtmusicService } from "./ytmusic.service";

export class ConversionService {
  private latestImport?: ConversionJob;

  constructor(
    private readonly ytmusic = new YtmusicService(),
    private readonly matcher = new MatcherService(),
  ) {}

  importSpicetifySnapshot(snapshot: SpicetifyPlaylistSnapshot): ConversionJob {
    if (this.latestImport && this.latestImport.status !== "imported") {
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
    return conversion;
  }

  getLatestImport(): ConversionJob | null {
    return this.latestImport ?? null;
  }

  resetImport() {
    this.latestImport = undefined;
    return { ok: true };
  }

  getConversion(id: string): ConversionJob {
    const conversion = this.requireLatestConversion(id);
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

    const matches = await this.ytmusic.findMatchesForTracks(matching.tracks);
    const matched = conversionJobSchema.parse({
      ...matching,
      status: "reviewing",
      updatedAt: new Date().toISOString(),
      matches,
    });
    this.latestImport = matched;

    return {
      conversion: matched,
      summary: this.matcher.summarize(matched.matches),
    };
  }

  async createPlaylist(id: string) {
    const conversion = this.getConversion(id);
    const playlist = await this.ytmusic.createPlaylist();

    return {
      ...conversion,
      status: "complete" as const,
      targetPlaylistName: conversion.targetPlaylistName,
      playlist,
    };
  }

  private requireLatestConversion(id: string): ConversionJob {
    if (!this.latestImport || this.latestImport.id !== id) {
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
