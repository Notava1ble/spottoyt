import type { SpotifyTrack } from "@spottoyt/shared";
import { describe, expect, it } from "vitest";
import {
  getDefaultPythonCommand,
  YtmusicService,
  YtmusicWorkerUnavailableError,
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

    expect(matches).toEqual([
      {
        trackId: baseTrack.id,
        candidate: null,
        confidence: 0.2,
        status: "skipped",
      },
      {
        trackId: unmatchedTrack.id,
        candidate: null,
        confidence: 0,
        status: "skipped",
      },
    ]);
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
