import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpotifyTrack, YtmusicCandidate } from "@spottoyt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { FileConversionStore } from "../storage/conversion-store";
import { ConversionService } from "./conversion.service";
import {
  type YtmusicPlaylistCreateClient,
  type YtmusicSearchClient,
  YtmusicService,
} from "./ytmusic.service";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createStorePath() {
  const directory = mkdtempSync(join(tmpdir(), "spottoyt-conversions-"));
  tempDirectories.push(directory);

  return join(directory, "conversions.json");
}

function snapshotWithTracks(trackTitles: string[]) {
  return {
    source: "spicetify" as const,
    spotifyPlaylistUri: "spotify:playlist:road-trip",
    playlistName: "Road trip",
    snapshotAt: "2026-04-30T12:00:00.000Z",
    tracks: trackTitles.map((title, index) => ({
      spotifyUri: `spotify:track:${title.toLowerCase().replaceAll(" ", "-")}`,
      title,
      artists: ["M83"],
      album: "Hurry Up, We're Dreaming",
      durationMs: 243000 + index * 1000,
      explicit: false,
      position: index + 1,
    })),
  };
}

class FakeSearchClient implements YtmusicSearchClient {
  searchedTitles: string[] = [];

  async findCandidatesForTracks(tracks: SpotifyTrack[]) {
    this.searchedTitles.push(...tracks.map((track) => track.title));

    return tracks.map((track) => ({
      trackId: track.id,
      candidates: [candidateForTrack(track)],
    }));
  }
}

class RecordingPlaylistClient implements YtmusicPlaylistCreateClient {
  addedRequests: Array<{ playlistId: string; videoIds: string[] }> = [];
  createdRequests: Array<{ title: string; videoIds: string[] }> = [];

  async addPlaylistItems(input: { playlistId: string; videoIds: string[] }) {
    this.addedRequests.push({
      playlistId: input.playlistId,
      videoIds: input.videoIds,
    });

    return {
      playlistId: input.playlistId,
      playlistUrl: `https://music.youtube.com/playlist?list=${input.playlistId}`,
    };
  }

  async createPlaylist(input: {
    description: string;
    privacyStatus: "PRIVATE";
    title: string;
    videoIds: string[];
  }) {
    this.createdRequests.push({
      title: input.title,
      videoIds: input.videoIds,
    });

    return {
      playlistId: "PLroadtrip",
      playlistUrl: "https://music.youtube.com/playlist?list=PLroadtrip",
    };
  }
}

describe("ConversionService storage", () => {
  it("should restore the latest import and match decisions from local storage", async () => {
    const storePath = createStorePath();
    const firstSearch = new FakeSearchClient();
    const firstService = new ConversionService(
      new YtmusicService(firstSearch),
      undefined,
      undefined,
      new FileConversionStore(storePath),
    );
    const imported = firstService.importSpicetifySnapshot(
      snapshotWithTracks(["Midnight City"]),
    );

    await firstService.matchConversion(imported.id);
    firstService.updateMatchStatus(
      imported.id,
      "spotify:track:midnight-city",
      "skipped",
    );

    const reloadedService = new ConversionService(
      new YtmusicService(new FakeSearchClient()),
      undefined,
      undefined,
      new FileConversionStore(storePath),
    );
    const latestImport = reloadedService.getLatestImport();

    expect(latestImport?.sourcePlaylistUri).toBe("spotify:playlist:road-trip");
    expect(latestImport?.tracks).toHaveLength(1);
    expect(latestImport?.matches).toEqual([
      {
        trackId: "spotify:track:midnight-city",
        candidate: null,
        confidence: 0,
        status: "skipped",
      },
    ]);
  });

  it("should refresh an already synced Spotify playlist with only new songs unmatched", async () => {
    const storePath = createStorePath();
    const searchClient = new FakeSearchClient();
    const playlistClient = new RecordingPlaylistClient();
    const service = new ConversionService(
      new YtmusicService(searchClient, undefined, undefined, playlistClient),
      undefined,
      undefined,
      new FileConversionStore(storePath),
    );
    const imported = service.importSpicetifySnapshot(
      snapshotWithTracks(["Midnight City"]),
    );

    await service.matchConversion(imported.id);
    const completed = await service.createPlaylist(imported.id, {
      targetPlaylistName: "Road trip",
    });
    const refreshed = service.importSpicetifySnapshot(
      snapshotWithTracks(["Midnight City", "Outro"]),
    );

    expect(refreshed.id).toBe(imported.id);
    expect(refreshed.status).toBe("reviewing");
    expect(refreshed.playlist).toEqual(completed.playlist);
    expect(refreshed.tracks.map((track) => track.title)).toEqual([
      "Midnight City",
      "Outro",
    ]);
    expect(refreshed.matches).toEqual([
      expect.objectContaining({
        trackId: "spotify:track:midnight-city",
        status: "accepted",
        syncedAt: expect.any(String),
      }),
    ]);

    await service.matchConversion(refreshed.id);
    await service.createPlaylist(refreshed.id, {
      targetPlaylistName: "Road trip",
    });

    expect(searchClient.searchedTitles).toEqual(["Midnight City", "Outro"]);
    expect(playlistClient.createdRequests).toEqual([
      {
        title: "Road trip",
        videoIds: ["ytm-midnight-city"],
      },
    ]);
    expect(playlistClient.addedRequests).toEqual([
      {
        playlistId: "PLroadtrip",
        videoIds: ["ytm-outro"],
      },
    ]);
  });

  it("should list stored conversions with the most recently updated first", async () => {
    const storePath = createStorePath();
    const service = new ConversionService(
      new YtmusicService(
        new FakeSearchClient(),
        undefined,
        undefined,
        new RecordingPlaylistClient(),
      ),
      undefined,
      undefined,
      new FileConversionStore(storePath),
    );

    const older = service.importSpicetifySnapshot(
      snapshotWithTracks(["Midnight City"]),
    );
    await service.matchConversion(older.id);
    const completed = await service.createPlaylist(older.id, {
      targetPlaylistName: "Road trip",
    });
    service.resetImport();
    const newer = service.importSpicetifySnapshot({
      ...snapshotWithTracks(["Outro"]),
      spotifyPlaylistUri: "spotify:playlist:night-drive",
      playlistName: "Night drive",
    });

    const conversions = service.listConversions();

    expect(conversions.map((conversion) => conversion.id)).toEqual([
      newer.id,
      completed.id,
    ]);
  });

  it("should accept a manual YouTube Music watch link as the selected match", () => {
    const service = new ConversionService(
      new YtmusicService(new FakeSearchClient()),
      undefined,
      undefined,
      new FileConversionStore(createStorePath()),
    );
    const imported = service.importSpicetifySnapshot(
      snapshotWithTracks(["Midnight City"]),
    );

    const selected = service.selectManualMatchFromUrl(
      imported.id,
      "spotify:track:midnight-city",
      "https://music.youtube.com/watch?v=dX3k_QDnzHE&si=abc123",
    );

    expect(selected.match).toEqual({
      trackId: "spotify:track:midnight-city",
      candidate: {
        videoId: "dX3k_QDnzHE",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        resultType: "video",
      },
      confidence: 1,
      status: "accepted",
    });
  });
});

function candidateForTrack(track: SpotifyTrack): YtmusicCandidate {
  return {
    videoId: `ytm-${track.title.toLowerCase().replaceAll(" ", "-")}`,
    title: track.title,
    artists: track.artists,
    album: track.album,
    durationMs: track.durationMs,
    resultType: "song",
  };
}
