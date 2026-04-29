import {
  type ConversionJob,
  conversionJobSchema,
  type MatchDecision,
  mockConversionJob,
  type SpicetifyPlaylistSnapshot,
  type SpotifyTrack,
} from "@spottoyt/shared";
import { MatcherService } from "./matcher.service";
import { SpotifyService } from "./spotify.service";
import { YtmusicService } from "./ytmusic.service";

export class ConversionService {
  private latestImport?: ConversionJob;

  constructor(
    private readonly spotify = new SpotifyService(),
    private readonly ytmusic = new YtmusicService(),
    private readonly matcher = new MatcherService(),
  ) {}

  async importPlaylist(playlistUrl: string): Promise<ConversionJob> {
    const tracks = await this.spotify.importPlaylist(playlistUrl);
    const matches = await this.ytmusic.findMockMatches();
    const now = new Date().toISOString();

    return conversionJobSchema.parse({
      ...mockConversionJob,
      id: `conversion-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      tracks,
      matches,
      status: "reviewing",
    });
  }

  importSpicetifySnapshot(snapshot: SpicetifyPlaylistSnapshot): ConversionJob {
    const now = new Date().toISOString();
    const tracks = snapshot.tracks.map(toSpotifyTrack);
    const conversion = conversionJobSchema.parse({
      id: `conversion-${playlistIdFromUri(snapshot.spotifyPlaylistUri)}-${Date.now()}`,
      sourcePlaylistName: snapshot.playlistName,
      targetPlaylistName: `${snapshot.playlistName} - YouTube Music`,
      status: "reviewing",
      createdAt: now,
      updatedAt: now,
      tracks,
      matches: tracks.map(toPendingMatch),
    });

    this.latestImport = conversion;
    return conversion;
  }

  getLatestImport(): ConversionJob | null {
    return this.latestImport ?? null;
  }

  async getConversion(id: string): Promise<ConversionJob> {
    return conversionJobSchema.parse({
      ...mockConversionJob,
      id,
    });
  }

  async matchConversion(id: string) {
    const conversion = await this.getConversion(id);
    return {
      conversion,
      summary: this.matcher.summarize(conversion.matches),
    };
  }

  async createPlaylist(id: string) {
    const conversion = await this.getConversion(id);
    const playlist = await this.ytmusic.createPlaylist();

    return {
      ...conversion,
      status: "complete" as const,
      targetPlaylistName: conversion.targetPlaylistName,
      playlist,
    };
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

function toPendingMatch(track: SpotifyTrack): MatchDecision {
  return {
    trackId: track.id,
    candidate: {
      videoId: `pending-${track.id}`,
      title: track.title,
      artists: track.artists,
      album: track.album,
      durationMs: track.durationMs,
      resultType: "song",
    },
    confidence: 0.5,
    status: "review",
  };
}

function playlistIdFromUri(uri: string) {
  return uri.split(":").at(-1) ?? "spicetify";
}
