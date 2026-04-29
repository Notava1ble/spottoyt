import {
  type ConversionJob,
  conversionJobSchema,
  mockConversionJob,
} from "@spottoyt/shared";
import { MatcherService } from "./matcher.service";
import { SpotifyService } from "./spotify.service";
import { YtmusicService } from "./ytmusic.service";

export class ConversionService {
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
