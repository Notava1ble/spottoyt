import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api shell", () => {
  it("reports health", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "spottoyt-api" });

    await app.close();
  });

  it("returns account connection status", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/auth/status" });

    expect(response.statusCode).toBe(200);
    expect("spotify" in response.json()).toBe(false);
    expect(response.json().youtubeMusic.connected).toBe(false);

    await app.close();
  });

  it("does not expose Spotify Web API routes", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const login = await app.inject({ method: "GET", url: "/auth/spotify/login" });
    const callback = await app.inject({
      method: "GET",
      url: "/auth/spotify/callback?code=abc&state=state",
    });
    const logout = await app.inject({
      method: "POST",
      url: "/auth/spotify/logout",
    });
    const playlists = await app.inject({ method: "GET", url: "/spotify/playlists" });
    const importByUrl = await app.inject({
      method: "POST",
      url: "/playlists/import",
      payload: {
        playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      },
    });

    expect(login.statusCode).toBe(404);
    expect(callback.statusCode).toBe(404);
    expect(logout.statusCode).toBe(404);
    expect(playlists.statusCode).toBe(404);
    expect(importByUrl.statusCode).toBe(404);

    await app.close();
  });

  it("imports Spicetify playlist snapshots and exposes the latest import", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: {
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
      },
    });
    const latest = await app.inject({
      method: "GET",
      url: "/imports/latest",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().conversion.sourcePlaylistName).toBe("Road trip");
    expect(response.json().conversion.tracks).toEqual([
      {
        id: "spotify:track:track-1",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        isrc: "FR6V81141061",
        explicit: false,
      },
    ]);
    expect(latest.statusCode).toBe(200);
    expect(latest.json().conversion.id).toBe(response.json().conversion.id);

    await app.close();
  });

  it("rejects invalid Spicetify playlist snapshots", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: {
        source: "spicetify",
        playlistName: "Broken",
        tracks: [],
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});
