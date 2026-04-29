import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";

const originalSpotifyEnv = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
};

function setSpotifyEnv() {
  process.env.SPOTIFY_CLIENT_ID = "test-client-id";
  process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
  process.env.SPOTIFY_REDIRECT_URI =
    "http://127.0.0.1:4317/auth/spotify/callback";
}

function restoreSpotifyEnv() {
  if (originalSpotifyEnv.clientId === undefined) {
    delete process.env.SPOTIFY_CLIENT_ID;
  } else {
    process.env.SPOTIFY_CLIENT_ID = originalSpotifyEnv.clientId;
  }

  if (originalSpotifyEnv.clientSecret === undefined) {
    delete process.env.SPOTIFY_CLIENT_SECRET;
  } else {
    process.env.SPOTIFY_CLIENT_SECRET = originalSpotifyEnv.clientSecret;
  }

  if (originalSpotifyEnv.redirectUri === undefined) {
    delete process.env.SPOTIFY_REDIRECT_URI;
  } else {
    process.env.SPOTIFY_REDIRECT_URI = originalSpotifyEnv.redirectUri;
  }
}

afterEach(() => {
  restoreSpotifyEnv();
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
    expect(response.json().spotify.connected).toBe(false);
    expect(response.json().youtubeMusic.connected).toBe(false);

    await app.close();
  });

  it("reports configured Spotify credentials from server environment", async () => {
    setSpotifyEnv();
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/auth/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spotify).toMatchObject({
      provider: "spotify",
      connected: false,
      configured: true,
    });

    await app.close();
  });

  it("redirects Spotify login requests to the authorization endpoint", async () => {
    setSpotifyEnv();
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/auth/spotify/login",
    });
    const location = response.headers.location;

    expect(response.statusCode).toBe(302);
    expect(location).toContain("https://accounts.spotify.com/authorize");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain(
      "redirect_uri=http%3A%2F%2F127.0.0.1%3A4317%2Fauth%2Fspotify%2Fcallback",
    );
    expect(location).toContain("playlist-read-private");

    await app.close();
  });

  it("rejects Spotify callbacks with an invalid state", async () => {
    setSpotifyEnv();
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/auth/spotify/callback?code=abc&state=wrong",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid Spotify authorization state",
    });

    await app.close();
  });

  it("stores a Spotify token from callback and lists playlists", async () => {
    setSpotifyEnv();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === "https://accounts.spotify.com/api/token") {
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200 },
        );
      }

      if (url === "https://api.spotify.com/v1/me") {
        return new Response(
          JSON.stringify({
            display_name: "Visar",
            id: "spotify-user",
            product: "free",
          }),
          { status: 200 },
        );
      }

      if (url.startsWith("https://api.spotify.com/v1/me/playlists")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "playlist-1",
                name: "Road trip",
                public: false,
                collaborative: false,
                owner: { display_name: "Visar" },
                tracks: { total: 42 },
                external_urls: {
                  spotify: "https://open.spotify.com/playlist/playlist-1",
                },
                images: [{ url: "https://i.scdn.co/image/abc" }],
              },
            ],
            next: null,
          }),
          { status: 200 },
        );
      }

      return new Response("Unexpected request", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp({ logger: false });
    await app.ready();

    const login = await app.inject({
      method: "GET",
      url: "/auth/spotify/login",
    });
    const state = new URL(login.headers.location as string).searchParams.get(
      "state",
    );
    const callback = await app.inject({
      method: "GET",
      url: `/auth/spotify/callback?code=abc&state=${state}`,
    });
    const playlists = await app.inject({
      method: "GET",
      url: "/spotify/playlists",
    });

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("http://127.0.0.1:5173/");
    expect(playlists.statusCode).toBe(200);
    expect(playlists.json().playlists).toEqual([
      {
        id: "playlist-1",
        name: "Road trip",
        trackCount: 42,
        public: false,
        collaborative: false,
        ownerName: "Visar",
        externalUrl: "https://open.spotify.com/playlist/playlist-1",
        imageUrl: "https://i.scdn.co/image/abc",
      },
    ]);

    await app.close();
  });

  it("clears the Spotify token on logout", async () => {
    setSpotifyEnv();
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/spotify/logout",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it("imports a Spotify playlist into a mock conversion job", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/playlists/import",
      payload: {
        playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("reviewing");
    expect(response.json().tracks).toHaveLength(4);

    await app.close();
  });

  it("validates playlist import request bodies before parsing URLs", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/playlists/import",
      payload: {},
    });

    expect(response.statusCode).toBe(400);

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
