import { describe, expect, it } from "vitest";
import {
  accountStatusResponseSchema,
  conversionJobSchema,
  mockConversionJob,
  spicetifyPlaylistSnapshotSchema,
  spotifyPlaylistsResponseSchema,
  spotifyPlaylistUrlSchema,
} from "./schemas";

describe("shared schemas", () => {
  it("validates the mock conversion job used by the shell", () => {
    const parsed = conversionJobSchema.parse(mockConversionJob);

    expect(parsed.status).toBe("reviewing");
    expect(parsed.tracks).toHaveLength(4);
    expect(parsed.matches[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("rejects non-Spotify playlist URLs", () => {
    expect(() =>
      spotifyPlaylistUrlSchema.parse("https://example.com/nope"),
    ).toThrow();
  });

  it("parses account status with configuration and provider errors", () => {
    const parsed = accountStatusResponseSchema.parse({
      spotify: {
        provider: "spotify",
        connected: false,
        configured: true,
        error: "Spotify returned 403 Forbidden",
      },
      youtubeMusic: {
        provider: "youtubeMusic",
        connected: false,
        configured: false,
      },
    });

    expect(parsed.spotify.configured).toBe(true);
    expect(parsed.spotify.error).toBe("Spotify returned 403 Forbidden");
    expect(parsed.youtubeMusic.configured).toBe(false);
  });

  it("parses normalized Spotify playlist summaries", () => {
    const parsed = spotifyPlaylistsResponseSchema.parse({
      playlists: [
        {
          id: "playlist-1",
          name: "Road trip",
          trackCount: 42,
          public: false,
          collaborative: false,
          ownerName: "V",
          externalUrl: "https://open.spotify.com/playlist/playlist-1",
        },
      ],
    });

    expect(parsed.playlists).toHaveLength(1);
    expect(parsed.playlists[0]?.trackCount).toBe(42);
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
});
