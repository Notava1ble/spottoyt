import type { SpotifyTrack } from "@spottoyt/shared";
import { describe, expect, it } from "vitest";
import { defaultMatchingSettings } from "./matching-settings.service";
import {
  getDefaultPythonCommand,
  YtmusicService,
  YtmusicWorkerUnavailableError,
  type YtmusicPlaylistCreateClient,
  type YtmusicSearchClient,
} from "./ytmusic.service";

const baseTrack = {
  id: "spotify:track:midnight-city",
  title: "Midnight City",
  artists: ["M83"],
  album: "Hurry Up, We're Dreaming",
  durationMs: 243000,
  explicit: false,
} satisfies SpotifyTrack;

class FakeSearchClient implements YtmusicSearchClient {
  constructor(
    private readonly results: Awaited<
      ReturnType<YtmusicSearchClient["findCandidatesForTracks"]>
    >,
  ) {}

  async findCandidatesForTracks() {
    return this.results;
  }
}

class FakePlaylistClient implements YtmusicPlaylistCreateClient {
  received:
    | {
        description: string;
        privacyStatus: "PRIVATE";
        title: string;
        videoIds: string[];
      }
    | undefined;

  async createPlaylist(input: {
    description: string;
    privacyStatus: "PRIVATE";
    title: string;
    videoIds: string[];
  }) {
    this.received = input;

    return {
      playlistId: "PL123",
      playlistUrl: "https://music.youtube.com/playlist?list=PL123",
    };
  }
}

describe("YtmusicService", () => {
  it("should auto-accept high-confidence YouTube Music song candidates", async () => {
    const service = new YtmusicService(
      new FakeSearchClient([
        {
          trackId: baseTrack.id,
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
      ]),
    );

    const matches = await service.findMatchesForTracks([baseTrack]);

    expect(matches).toEqual([
      {
        trackId: baseTrack.id,
        candidate: {
          videoId: "ytm-midnight-city",
          title: "Midnight City",
          artists: ["M83"],
          album: "Hurry Up, We're Dreaming",
          durationMs: 243000,
          resultType: "song",
        },
        confidence: 1,
        status: "accepted",
      },
    ]);
  });

  it("should auto-accept official lyric or video candidates when title, artist, and duration agree", async () => {
    const track = {
      ...baseTrack,
      id: "spotify:track:where-have-you-been",
      title: "Where Have You Been",
      artists: ["Rihanna"],
      album: "Talk That Talk",
      durationMs: 243000,
    } satisfies SpotifyTrack;
    const service = new YtmusicService(
      new FakeSearchClient([
        {
          trackId: track.id,
          candidates: [
            {
              videoId: "ytm-where-have-you-been-lyrics",
              title: "Rihanna - Where Have You Been (Lyrics)",
              artists: ["Rihanna"],
              durationMs: 243000,
              resultType: "video",
            },
          ],
        },
      ]),
    );

    const matches = await service.findMatchesForTracks([track]);

    expect(matches[0]).toMatchObject({
      trackId: track.id,
      candidate: {
        videoId: "ytm-where-have-you-been-lyrics",
      },
      status: "accepted",
    });
    expect(matches[0]?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("should honor configured auto-accept thresholds", async () => {
    const service = new YtmusicService(
      new FakeSearchClient([
        {
          trackId: baseTrack.id,
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
      ]),
      undefined,
      {
        getSettings: () => ({
          ...defaultMatchingSettings,
          autoAcceptThreshold: 0.99,
        }),
      },
    );

    const matches = await service.findMatchesForTracks([baseTrack]);

    expect(matches[0]).toMatchObject({
      candidate: {
        videoId: "ytm-midnight-city-lyrics",
      },
      status: "review",
    });
    expect(matches[0]?.confidence).toBeLessThan(0.99);
  });

  it("should pass configured search options to the YouTube Music search client", async () => {
    let receivedOptions: unknown;
    const service = new YtmusicService(
      {
        async findCandidatesForTracks(_tracks, options) {
          receivedOptions = options;

          return [];
        },
      },
      undefined,
      {
        getSettings: () => ({
          ...defaultMatchingSettings,
          searchLimit: 14,
          includeVideos: false,
        }),
      },
    );

    await service.findMatchesForTracks([baseTrack]);

    expect(receivedOptions).toEqual({
      includeVideos: false,
      searchLimit: 14,
    });
  });

  it("should send medium-confidence matches to review", async () => {
    const service = new YtmusicService(
      new FakeSearchClient([
        {
          trackId: baseTrack.id,
          candidates: [
            {
              videoId: "ytm-cover",
              title: "Midnight City",
              artists: ["Other Artist"],
              album: "Compilation",
              durationMs: 250000,
              resultType: "song",
            },
          ],
        },
      ]),
    );

    const matches = await service.findMatchesForTracks([baseTrack]);

    expect(matches[0]).toMatchObject({
      trackId: baseTrack.id,
      confidence: 0.7,
      status: "review",
    });
  });

  it("should skip low-confidence and empty worker results", async () => {
    const unmatchedTrack = {
      ...baseTrack,
      id: "spotify:track:no-results",
    } satisfies SpotifyTrack;
    const service = new YtmusicService(
      new FakeSearchClient([
        {
          trackId: baseTrack.id,
          candidates: [
            {
              videoId: "ytm-unrelated",
              title: "Different Song",
              artists: ["Other Artist"],
              album: "Other Album",
              durationMs: 180000,
              resultType: "song",
            },
          ],
        },
        {
          trackId: unmatchedTrack.id,
          candidates: [],
        },
      ]),
    );

    const matches = await service.findMatchesForTracks([
      baseTrack,
      unmatchedTrack,
    ]);

    expect(matches[0]).toMatchObject({
      trackId: baseTrack.id,
      candidate: null,
      status: "skipped",
    });
    expect(matches[0]?.confidence).toBeLessThan(0.2);
    expect(matches[1]).toEqual({
      trackId: unmatchedTrack.id,
      candidate: null,
      confidence: 0,
      status: "skipped",
    });
  });

  it("should report worker setup failures as service unavailable errors", async () => {
    const service = new YtmusicService({
      async findCandidatesForTracks() {
        throw new YtmusicWorkerUnavailableError("Python worker unavailable");
      },
    });

    await expect(service.findMatchesForTracks([baseTrack])).rejects.toThrow(
      YtmusicWorkerUnavailableError,
    );
  });

  it("should create a private playlist through the YouTube Music playlist client", async () => {
    const playlistClient = new FakePlaylistClient();
    const service = new YtmusicService(
      new FakeSearchClient([]),
      undefined,
      undefined,
      playlistClient,
    );

    const playlist = await service.createPlaylist({
      description: "Converted from Spotify by SpottoYT.",
      title: "Road trip - YouTube Music",
      videoIds: ["song-1", "song-2"],
    });

    expect(playlist).toEqual({
      playlistId: "PL123",
      playlistUrl: "https://music.youtube.com/playlist?list=PL123",
    });
    expect(playlistClient.received).toEqual({
      description: "Converted from Spotify by SpottoYT.",
      privacyStatus: "PRIVATE",
      title: "Road trip - YouTube Music",
      videoIds: ["song-1", "song-2"],
    });
  });

  it("should prefer the worker-local uv virtual environment python", () => {
    const command = getDefaultPythonCommand({
      platform: "win32",
      existsSync: (path) => path.endsWith("apps\\ytmusic-worker\\.venv\\Scripts\\python.exe"),
      workerDirectory: "C:\\repo\\apps\\ytmusic-worker",
    });

    expect(command).toBe(
      "C:\\repo\\apps\\ytmusic-worker\\.venv\\Scripts\\python.exe",
    );
  });
});
