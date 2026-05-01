import { describe, expect, it } from "vitest";
import {
  accountStatusResponseSchema,
  conversionJobSchema,
  manualMatchSearchRequestSchema,
  manualMatchSelectRequestSchema,
  mockConversionJob,
  playlistCreateRequestSchema,
  spicetifyPlaylistSnapshotSchema,
} from "./schemas";

describe("shared schemas", () => {
  it("validates the mock conversion job used by the shell", () => {
    const parsed = conversionJobSchema.parse(mockConversionJob);

    expect(parsed.status).toBe("reviewing");
    expect(parsed.tracks).toHaveLength(4);
    expect(parsed.matches[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("allows imported conversions before matching starts", () => {
    const parsed = conversionJobSchema.parse({
      ...mockConversionJob,
      status: "imported",
      matches: [],
    });

    expect(parsed.status).toBe("imported");
    expect(parsed.matches).toHaveLength(0);
  });

  it("allows skipped match decisions without a YouTube Music candidate", () => {
    const parsed = conversionJobSchema.parse({
      ...mockConversionJob,
      matches: [
        {
          trackId: "spotify:track:missing",
          candidate: null,
          confidence: 0,
          status: "skipped",
        },
      ],
    });

    expect(parsed.matches[0]).toEqual({
      trackId: "spotify:track:missing",
      candidate: null,
      confidence: 0,
      status: "skipped",
    });
  });

  it("parses account status for YouTube Music only", () => {
    const parsed = accountStatusResponseSchema.parse({
      youtubeMusic: {
        provider: "youtubeMusic",
        connected: false,
        configured: false,
      },
    });

    expect(parsed.youtubeMusic.configured).toBe(false);
    expect("spotify" in parsed).toBe(false);
  });

  it("parses Spicetify playlist snapshots from the desktop bridge", () => {
    const parsed = spicetifyPlaylistSnapshotSchema.parse({
      source: "spicetify",
      spotifyPlaylistUri: "spotify:playlist:playlist-1",
      playlistName: "Road trip",
      snapshotAt: "2026-04-30T12:00:00.000Z",
      tracks: [
        {
          spotifyUri: "spotify:track:track-1",
          title: "Midnight City",
          artists: ["M83"],
          album: "Hurry Up, We're Dreaming",
          durationMs: 243000,
          isrc: "FR6V81141061",
          explicit: false,
          position: 1,
        },
      ],
    });

    expect(parsed.tracks[0]?.spotifyUri).toBe("spotify:track:track-1");
    expect(parsed.tracks[0]?.position).toBe(1);
  });

  it("parses playlist creation requests with a custom name", () => {
    const parsed = playlistCreateRequestSchema.parse({
      targetPlaylistName: "Road trip",
    });

    expect(parsed.targetPlaylistName).toBe("Road trip");
  });

  it("parses manual match search and selection requests", () => {
    const search = manualMatchSearchRequestSchema.parse({
      query: "Midnight City M83",
    });
    const selection = manualMatchSelectRequestSchema.parse({
      candidate: {
        videoId: "ytm-midnight-city",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        resultType: "song",
      },
    });

    expect(search.query).toBe("Midnight City M83");
    expect(selection.candidate.videoId).toBe("ytm-midnight-city");
  });
});
