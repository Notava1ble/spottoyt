import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";
import { ConversionService } from "./services/conversion.service";
import {
  YtmusicService,
  YtmusicWorkerUnavailableError,
} from "./services/ytmusic.service";

afterEach(() => {
  vi.unstubAllGlobals();
});

function spicetifySnapshot(
  playlistName = "Road trip",
  trackTitle = "Midnight City",
) {
  return {
    source: "spicetify",
    spotifyPlaylistUri: `spotify:playlist:${playlistName.toLowerCase().replaceAll(" ", "-")}`,
    playlistName,
    snapshotAt: "2026-04-30T12:00:00.000Z",
    tracks: [
      {
        spotifyUri: `spotify:track:${trackTitle.toLowerCase().replaceAll(" ", "-")}`,
        title: trackTitle,
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        isrc: "FR6V81141061",
        explicit: false,
        position: 1,
      },
    ],
  };
}

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

  it("imports Spicetify playlist snapshots and exposes the latest import", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot(),
    });
    const latest = await app.inject({
      method: "GET",
      url: "/imports/latest",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().conversion.sourcePlaylistName).toBe("Road trip");
    expect(response.json().conversion.status).toBe("imported");
    expect(response.json().conversion.tracks).toEqual([
      {
        id: "spotify:track:midnight-city",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        isrc: "FR6V81141061",
        explicit: false,
      },
    ]);
    expect(response.json().conversion.matches).toEqual([]);
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

  it("allows Spicetify imports to replace the current imported playlist before matching", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const first = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Road trip", "Midnight City"),
    });
    const second = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Gym rotation", "A Moment Apart"),
    });
    const latest = await app.inject({ method: "GET", url: "/imports/latest" });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(latest.json().conversion.sourcePlaylistName).toBe("Gym rotation");
    expect(latest.json().conversion.tracks[0].title).toBe("A Moment Apart");

    await app.close();
  });

  it("matches the latest imported playlist with YouTube Music details", async () => {
    const app = buildApp(
      { logger: false },
      {
        conversions: new ConversionService(
          new YtmusicService({
            async findCandidatesForTracks() {
              return [
                {
                  trackId: "spotify:track:midnight-city",
                  candidates: [
                    {
                      videoId: "ytm-midnight-city",
                      title: "Midnight City",
                      artists: ["M83"],
                      album: "Hurry Up, We're Dreaming",
                      durationMs: 243000,
                      resultType: "song",
                    },
                  ],
                },
              ];
            },
          }),
        ),
      },
    );
    await app.ready();

    const imported = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Road trip", "Midnight City"),
    });
    const matched = await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/match`,
    });

    expect(matched.statusCode).toBe(200);
    expect(matched.json().conversion.status).toBe("reviewing");
    expect(matched.json().conversion.matches).toHaveLength(1);
    expect(matched.json().conversion.matches[0].trackId).toBe(
      "spotify:track:midnight-city",
    );
    expect(matched.json().conversion.matches[0].candidate.title).toBe(
      "Midnight City",
    );
    expect(matched.json().summary.total).toBe(1);

    await app.close();
  });

  it("returns service unavailable when the YouTube Music worker is not ready", async () => {
    const app = buildApp(
      { logger: false },
      {
        conversions: new ConversionService(
          new YtmusicService({
            async findCandidatesForTracks() {
              throw new YtmusicWorkerUnavailableError(
                "Install ytmusicapi before matching.",
              );
            },
          }),
        ),
      },
    );
    await app.ready();

    const imported = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Road trip", "Midnight City"),
    });
    const matched = await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/match`,
    });

    expect(matched.statusCode).toBe(503);
    expect(matched.json()).toEqual({
      error: "YouTube Music unavailable",
      message: "Install ytmusicapi before matching.",
    });

    await app.close();
  });

  it("blocks replacing a matched import until the import is reset", async () => {
    const app = buildApp(
      { logger: false },
      {
        conversions: new ConversionService(
          new YtmusicService({
            async findCandidatesForTracks() {
              return [];
            },
          }),
        ),
      },
    );
    await app.ready();

    const imported = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Road trip", "Midnight City"),
    });
    await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/match`,
    });

    const blocked = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Gym rotation", "A Moment Apart"),
    });
    const reset = await app.inject({
      method: "POST",
      url: "/imports/reset",
    });
    const replacement = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshot("Gym rotation", "A Moment Apart"),
    });

    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toBe("Import is locked");
    expect(reset.statusCode).toBe(200);
    expect(replacement.statusCode).toBe(200);
    expect(replacement.json().conversion.sourcePlaylistName).toBe(
      "Gym rotation",
    );

    await app.close();
  });

  it("accepts structured client log events", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/logs/client",
      payload: {
        level: "info",
        event: "web.api.request.started",
        fields: { path: "/auth/status", token: "secret" },
        message: "Client request started",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it("rejects malformed client log events", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/logs/client",
      payload: { level: "loud", event: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid client log event");

    await app.close();
  });
});
