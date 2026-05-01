import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";
import { ConversionService } from "./services/conversion.service";
import {
  defaultMatchingSettings,
  MatchingSettingsService,
} from "./services/matching-settings.service";
import {
  type YtmusicSearchClient,
  YtmusicService,
  YtmusicWorkerUnavailableError,
} from "./services/ytmusic.service";

const tempDirectories: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();

  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createSettingsPath() {
  const directory = mkdtempSync(join(tmpdir(), "spottoyt-api-settings-"));
  tempDirectories.push(directory);

  return join(directory, "settings.json");
}

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

function spicetifySnapshotWithTracks(
  playlistName: string,
  trackTitles: string[],
) {
  return {
    ...spicetifySnapshot(playlistName, trackTitles[0]),
    tracks: trackTitles.map((title, index) => ({
      spotifyUri: `spotify:track:${title.toLowerCase().replaceAll(" ", "-")}`,
      title,
      artists: ["M83"],
      album: "Hurry Up, We're Dreaming",
      durationMs: 243000 + index * 1000,
      isrc: `ISRC${index}`,
      explicit: false,
      position: index + 1,
    })),
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
    const app = buildApp(
      { logger: false },
      {
        ytmusicAuth: {
          async getAuthStatus() {
            return {
              provider: "youtubeMusic" as const,
              connected: false,
              configured: false,
            };
          },
        },
      },
    );
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/auth/status" });

    expect(response.statusCode).toBe(200);
    expect("spotify" in response.json()).toBe(false);
    expect(response.json().youtubeMusic.connected).toBe(false);

    await app.close();
  });

  it("saves YouTube Music browser headers through the auth API", async () => {
    const service = {
      async getAuthStatus() {
        return {
          provider: "youtubeMusic" as const,
          connected: false,
          configured: false,
        };
      },
      async setupBrowserHeaders(headersRaw: string) {
        expect(headersRaw).toBe("accept: */*\ncookie: secret");

        return {
          provider: "youtubeMusic" as const,
          connected: true,
          configured: true,
        };
      },
    };
    const app = buildApp(
      { logger: false },
      { ytmusicAuth: service },
    );
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/youtube-music/browser-headers",
      payload: { headersRaw: "accept: */*\ncookie: secret" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      youtubeMusic: {
        provider: "youtubeMusic",
        connected: true,
        configured: true,
      },
    });

    await app.close();
  });

  it("rejects empty YouTube Music browser headers", async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/youtube-music/browser-headers",
      payload: { headersRaw: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid YouTube Music auth headers");

    await app.close();
  });

  it("reads and saves matching settings through the API", async () => {
    const settingsPath = createSettingsPath();
    const settings = new MatchingSettingsService(settingsPath);
    const app = buildApp(
      { logger: false },
      {
        matchingSettings: settings,
      },
    );
    await app.ready();

    const initial = await app.inject({
      method: "GET",
      url: "/settings/matching",
    });
    const updated = await app.inject({
      method: "PATCH",
      url: "/settings/matching",
      payload: {
        autoAcceptThreshold: 0.9,
        reviewThreshold: 0.65,
        searchLimit: 14,
        includeVideos: false,
      },
    });

    expect(initial.statusCode).toBe(200);
    expect(initial.json().settings).toEqual(defaultMatchingSettings);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().settings).toEqual({
      autoAcceptThreshold: 0.9,
      reviewThreshold: 0.65,
      searchLimit: 14,
      includeVideos: false,
    });

    await app.close();

    const reloadedApp = buildApp(
      { logger: false },
      {
        matchingSettings: new MatchingSettingsService(settingsPath),
      },
    );
    await reloadedApp.ready();

    const reloaded = await reloadedApp.inject({
      method: "GET",
      url: "/settings/matching",
    });

    expect(reloaded.statusCode).toBe(200);
    expect(reloaded.json().settings).toEqual(updated.json().settings);

    await reloadedApp.close();
  });

  it("rejects invalid matching settings", async () => {
    const app = buildApp(
      { logger: false },
      {
        matchingSettings: new MatchingSettingsService(createSettingsPath()),
      },
    );
    await app.ready();

    const response = await app.inject({
      method: "PATCH",
      url: "/settings/matching",
      payload: {
        autoAcceptThreshold: 0.55,
        reviewThreshold: 0.75,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid matching settings");

    await app.close();
  });

  it("uses saved matching settings when matching conversions", async () => {
    const searchClient = {
      async findCandidatesForTracks() {
        return [
          {
            trackId: "spotify:track:midnight-city",
            candidates: [
              {
                videoId: "ytm-midnight-city-lyrics",
                title: "M83 - Midnight City (Lyrics)",
                artists: ["M83"],
                durationMs: 243000,
                resultType: "video",
              },
            ],
          },
        ];
      },
    } satisfies YtmusicSearchClient;
    const app = buildApp(
      { logger: false },
      {
        matchingSettings: new MatchingSettingsService(createSettingsPath()),
        ytmusicSearchClient: searchClient,
      },
    );
    await app.ready();

    await app.inject({
      method: "PATCH",
      url: "/settings/matching",
      payload: { autoAcceptThreshold: 0.99 },
    });
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
    expect(matched.json().conversion.matches[0]).toMatchObject({
      candidate: {
        videoId: "ytm-midnight-city-lyrics",
      },
      status: "review",
    });

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

  it("emits per-track match decisions before the full match request completes", async () => {
    let releaseSecondTrack: (() => void) | undefined;
    let markSecondTrackStarted: (() => void) | undefined;
    const secondTrackStarted = new Promise<void>((resolveStarted) => {
      markSecondTrackStarted = resolveStarted;
    });
    const releaseSecondTrackPromise = new Promise<void>((resolveRelease) => {
      releaseSecondTrack = resolveRelease;
    });
    const events: Array<{ event: string; fields?: Record<string, unknown> }> =
      [];
    const captureEvent = (
      _level: string,
      _source: string,
      event: string,
      fields?: Record<string, unknown>,
    ) => {
      events.push({ event, fields });
    };
    const app = buildApp(
      { logger: false },
      {
        conversions: new ConversionService(
          new YtmusicService(
            {
              async findCandidatesForTracks(tracks) {
                const [track] = tracks;

                if (track?.title === "Outro") {
                  markSecondTrackStarted?.();
                  await releaseSecondTrackPromise;
                }

                return tracks.map((item) => ({
                  trackId: item.id,
                  candidates: [
                    {
                      videoId: `ytm-${item.title.toLowerCase().replaceAll(" ", "-")}`,
                      title: item.title,
                      artists: item.artists,
                      album: item.album,
                      durationMs: item.durationMs,
                      resultType: "song" as const,
                    },
                  ],
                }));
              },
            },
            captureEvent,
          ),
          undefined,
          captureEvent,
        ),
      },
    );
    await app.ready();

    const imported = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshotWithTracks("Road trip", [
        "Midnight City",
        "Outro",
      ]),
    });
    const matchRequest = app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/match`,
    });

    const reachedSecondTrackBeforeCompletion = await Promise.race([
      secondTrackStarted.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ]);

    expect(reachedSecondTrackBeforeCompletion).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({
        event: "conversion.match.decision",
        fields: expect.objectContaining({
          trackId: "spotify:track:midnight-city",
        }),
      }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({
        event: "conversion.match.completed",
      }),
    );

    releaseSecondTrack?.();
    const matched = await matchRequest;

    expect(matched.statusCode).toBe(200);
    expect(matched.json().conversion.matches).toHaveLength(2);

    await app.close();
  });

  it("persists match decision status changes through the API", async () => {
    const app = buildApp(
      { logger: false },
      {
        ytmusicSearchClient: {
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
        },
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
    const skipped = await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/matches/${encodeURIComponent("spotify:track:midnight-city")}/status`,
      payload: { status: "skipped" },
    });
    const latest = await app.inject({
      method: "GET",
      url: "/imports/latest",
    });

    expect(skipped.statusCode).toBe(200);
    expect(skipped.json().conversion.matches[0]).toEqual({
      trackId: "spotify:track:midnight-city",
      candidate: null,
      confidence: 0,
      status: "skipped",
    });
    expect(skipped.json().summary.skipped).toBe(1);
    expect(latest.json().conversion.matches[0]).toEqual(
      skipped.json().conversion.matches[0],
    );

    await app.close();
  });

  it("reruns search for one track and persists the replacement match", async () => {
    let searchCount = 0;
    const app = buildApp(
      { logger: false },
      {
        ytmusicSearchClient: {
          async findCandidatesForTracks() {
            searchCount += 1;

            return [
              {
                trackId: "spotify:track:midnight-city",
                candidates:
                  searchCount === 1
                    ? []
                    : [
                        {
                          videoId: "ytm-midnight-city-retry",
                          title: "M83 - Midnight City (Official Video)",
                          artists: ["M83"],
                          durationMs: 244000,
                          resultType: "video",
                        },
                      ],
              },
            ];
          },
        },
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
    const searched = await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/matches/${encodeURIComponent("spotify:track:midnight-city")}/search`,
    });

    expect(searched.statusCode).toBe(200);
    expect(searched.json().match).toMatchObject({
      trackId: "spotify:track:midnight-city",
      candidate: {
        videoId: "ytm-midnight-city-retry",
      },
      status: "accepted",
    });
    expect(searched.json().conversion.matches[0]).toEqual(
      searched.json().match,
    );

    await app.close();
  });

  it("creates a YouTube Music playlist from accepted matches in track order", async () => {
    const playlistRequests: Array<{
      title: string;
      videoIds: string[];
    }> = [];
    const app = buildApp(
      { logger: false },
      {
        conversions: new ConversionService(
          new YtmusicService(
            {
              async findCandidatesForTracks(tracks) {
                return tracks.map((track, index) => ({
                  trackId: track.id,
                  candidates: [
                    {
                      videoId: `ytm-${index + 1}`,
                      title: track.title,
                      artists: track.artists,
                      album: track.album,
                      durationMs: track.durationMs,
                      resultType: "song" as const,
                    },
                  ],
                }));
              },
            },
            undefined,
            undefined,
            {
              async createPlaylist(input) {
                playlistRequests.push({
                  title: input.title,
                  videoIds: input.videoIds,
                });

                return {
                  playlistId: "PLroadtrip",
                  playlistUrl:
                    "https://music.youtube.com/playlist?list=PLroadtrip",
                };
              },
            },
          ),
        ),
      },
    );
    await app.ready();

    const imported = await app.inject({
      method: "POST",
      url: "/imports/spicetify",
      payload: spicetifySnapshotWithTracks("Road trip", [
        "Midnight City",
        "Outro",
      ]),
    });
    await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/match`,
    });
    await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/matches/${encodeURIComponent("spotify:track:outro")}/status`,
      payload: { status: "skipped" },
    });

    const created = await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/create`,
    });

    expect(created.statusCode).toBe(200);
    expect(created.json().status).toBe("complete");
    expect(created.json().playlist).toEqual({
      playlistId: "PLroadtrip",
      playlistUrl: "https://music.youtube.com/playlist?list=PLroadtrip",
      createdTrackCount: 1,
      skippedTrackCount: 1,
    });
    expect(playlistRequests).toEqual([
      {
        title: "Road trip - YouTube Music",
        videoIds: ["ytm-1"],
      },
    ]);

    await app.close();
  });

  it("rejects playlist creation when there are no accepted matches", async () => {
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
    const created = await app.inject({
      method: "POST",
      url: `/conversions/${imported.json().conversion.id}/create`,
    });

    expect(created.statusCode).toBe(409);
    expect(created.json().error).toBe("No accepted matches");

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

  it("emits domain logs for import and matching lifecycle", async () => {
    const events: Array<{ event: string; fields?: Record<string, unknown> }> =
      [];
    const captureEvent = (
      _level: string,
      _source: string,
      event: string,
      fields?: Record<string, unknown>,
    ) => {
      events.push({ event, fields });
    };
    const app = buildApp(
      { logger: false },
      {
        logEvent: captureEvent,
        conversions: new ConversionService(
          new YtmusicService({
            async findCandidatesForTracks() {
              return [
                {
                  trackId: "spotify:track:midnight-city",
                  candidates: [],
                },
              ];
            },
          }),
          undefined,
          captureEvent,
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

    expect(events.map((item) => item.event)).toEqual(
      expect.arrayContaining([
        "import.spicetify.received",
        "import.spicetify.accepted",
        "conversion.match.started",
        "conversion.match.completed",
      ]),
    );

    await app.close();
  });
});
