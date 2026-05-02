import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type EventSourceListener = (event: MessageEvent<string>) => void;
type MaybePromise<T> = T | Promise<T>;

const eventSourceListeners = new Map<string, EventSourceListener[]>();

class MockEventSource {
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: EventSourceListener) {
    const listeners = eventSourceListeners.get(type) ?? [];
    listeners.push(listener);
    eventSourceListeners.set(type, listeners);
  }

  close() {}
}

function mockApi({
  createError = null,
  libraryConversions = [],
  latestConversion = null,
  manualCandidates = [
    {
      videoId: "ytm-track-1-retry",
      title: "M83 - Midnight City (Official Video)",
      artists: ["M83"],
      durationMs: 244000,
      resultType: "video",
    },
  ],
  matchedConversion = null,
  matchingSettingsPatchError = null,
  matchingSettings = {
    autoAcceptThreshold: 0.9,
    reviewThreshold: 0.62,
    searchLimit: 20,
    includeVideos: true,
  },
  youtubeMusicSetupStatus = {
    provider: "youtubeMusic",
    connected: true,
    configured: true,
  },
  youtubeMusicStatus = {
    provider: "youtubeMusic",
    connected: false,
    configured: false,
  },
}: {
  createError?: {
    body: { error: string; message: string };
    status: number;
  } | null;
  libraryConversions?: unknown[] | (() => MaybePromise<unknown[]>);
  latestConversion?: unknown | (() => MaybePromise<unknown>);
  manualCandidates?: unknown[];
  matchedConversion?: unknown | (() => MaybePromise<unknown>);
  matchingSettingsPatchError?: {
    body: { error: string; message: string };
    status: number;
  } | null;
  matchingSettings?: {
    autoAcceptThreshold: number;
    reviewThreshold: number;
    searchLimit: number;
    includeVideos: boolean;
  };
  youtubeMusicSetupStatus?: {
    provider: "youtubeMusic";
    connected: boolean;
    configured?: boolean;
    displayName?: string;
    error?: string;
  };
  youtubeMusicStatus?: {
    provider: "youtubeMusic";
    connected: boolean;
    configured?: boolean;
    displayName?: string;
    error?: string;
  };
} = {}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method =
        init?.method ??
        (typeof input === "object" && "method" in input && input.method
          ? input.method
          : "GET");

      if (url.endsWith("/auth/status")) {
        return new Response(
          JSON.stringify({
            youtubeMusic: youtubeMusicStatus,
          }),
          { status: 200 },
        );
      }

      if (
        method === "POST" &&
        url.endsWith("/auth/youtube-music/browser-headers")
      ) {
        return new Response(
          JSON.stringify({
            youtubeMusic: youtubeMusicSetupStatus,
          }),
          { status: 200 },
        );
      }

      if (method === "DELETE" && url.endsWith("/auth/youtube-music")) {
        youtubeMusicStatus = {
          provider: "youtubeMusic",
          connected: false,
          configured: false,
        };

        return new Response(
          JSON.stringify({
            youtubeMusic: youtubeMusicStatus,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith("/imports/latest")) {
        const conversion = await Promise.resolve(
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion,
        );

        return new Response(JSON.stringify({ conversion }), { status: 200 });
      }

      if (url.endsWith("/settings/matching")) {
        if (method === "PATCH") {
          if (matchingSettingsPatchError) {
            return new Response(
              JSON.stringify(matchingSettingsPatchError.body),
              {
                status: matchingSettingsPatchError.status,
              },
            );
          }

          const patch = init?.body
            ? (JSON.parse(init.body.toString()) as Partial<
                typeof matchingSettings
              >)
            : {};
          matchingSettings = { ...matchingSettings, ...patch };
        }

        return new Response(JSON.stringify({ settings: matchingSettings }), {
          status: 200,
        });
      }

      if (method === "GET" && url.endsWith("/conversions")) {
        const conversions = await Promise.resolve(
          typeof libraryConversions === "function"
            ? libraryConversions()
            : libraryConversions,
        );

        return new Response(JSON.stringify({ conversions }), { status: 200 });
      }

      if (method === "POST" && url.match(/\/conversions\/.+\/match$/)) {
        const conversion = await Promise.resolve(
          typeof matchedConversion === "function"
            ? matchedConversion()
            : matchedConversion,
        );

        return new Response(
          JSON.stringify({
            conversion,
            summary: { accepted: 0, review: 2, skipped: 0, total: 2 },
          }),
          { status: 200 },
        );
      }

      if (method === "POST" && url.match(/\/conversions\/.+\/match\/cancel$/)) {
        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;

        return new Response(
          JSON.stringify({
            conversion,
            summary: { accepted: 0, review: 0, skipped: 0, total: 0 },
          }),
          { status: 200 },
        );
      }

      if (method === "POST" && url.match(/\/conversions\/.+\/create$/)) {
        if (createError) {
          return new Response(JSON.stringify(createError.body), {
            status: createError.status,
          });
        }

        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;
        const body = init?.body
          ? (JSON.parse(init.body.toString()) as {
              targetPlaylistName?: string;
            })
          : {};

        if (conversion && typeof conversion === "object") {
          const nextConversion = {
            ...structuredClone(conversion),
            status: "complete",
            targetPlaylistName:
              body.targetPlaylistName ?? conversion.targetPlaylistName,
            playlist: {
              playlistId: "PLroadtrip",
              playlistUrl: "https://music.youtube.com/playlist?list=PLroadtrip",
              createdTrackCount: 2,
              skippedTrackCount: 0,
            },
          };
          latestConversion = nextConversion;

          return new Response(JSON.stringify(nextConversion), { status: 200 });
        }
      }

      if (
        method === "POST" &&
        url.match(/\/conversions\/.+\/matches\/.+\/candidates$/)
      ) {
        const body = init?.body
          ? (JSON.parse(init.body.toString()) as { query?: string })
          : {};
        const trackId = decodeURIComponent(
          url.match(/\/matches\/([^/]+)\/candidates$/)?.[1] ?? "",
        );

        return new Response(
          JSON.stringify({
            trackId,
            query: body.query ?? "",
            candidates: manualCandidates,
          }),
          { status: 200 },
        );
      }

      if (
        method === "POST" &&
        url.match(/\/conversions\/.+\/matches\/.+\/manual$/)
      ) {
        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;
        const body = init?.body
          ? (JSON.parse(init.body.toString()) as {
              candidate: {
                videoId: string;
                title: string;
                artists: string[];
                album?: string;
                durationMs: number;
                resultType: "song" | "video";
              };
            })
          : null;

        if (
          conversion &&
          typeof conversion === "object" &&
          "matches" in conversion &&
          body
        ) {
          const nextConversion = structuredClone(conversion);
          const firstMatch = nextConversion.matches[0];
          firstMatch.candidate = body.candidate;
          firstMatch.confidence = 1;
          firstMatch.status = "accepted";
          latestConversion = nextConversion;

          return new Response(
            JSON.stringify({
              conversion: nextConversion,
              match: firstMatch,
              summary: { accepted: 1, review: 1, skipped: 0, total: 2 },
            }),
            { status: 200 },
          );
        }
      }

      if (
        method === "POST" &&
        url.match(/\/conversions\/.+\/matches\/.+\/link$/)
      ) {
        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;

        if (
          conversion &&
          typeof conversion === "object" &&
          "matches" in conversion &&
          "tracks" in conversion
        ) {
          const nextConversion = structuredClone(conversion);
          const firstMatch = nextConversion.matches[0];
          const firstTrack = nextConversion.tracks[0];
          firstMatch.candidate = {
            videoId: "dX3k_QDnzHE",
            title: firstTrack.title,
            artists: firstTrack.artists,
            album: firstTrack.album,
            durationMs: firstTrack.durationMs,
            resultType: "video",
          };
          firstMatch.confidence = 1;
          firstMatch.status = "accepted";
          latestConversion = nextConversion;

          return new Response(
            JSON.stringify({
              conversion: nextConversion,
              match: firstMatch,
              summary: { accepted: 1, review: 1, skipped: 0, total: 2 },
            }),
            { status: 200 },
          );
        }
      }

      if (
        method === "POST" &&
        url.match(/\/conversions\/.+\/matches\/.+\/status$/)
      ) {
        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;
        const body = init?.body
          ? (JSON.parse(init.body.toString()) as { status: string })
          : { status: "review" };

        if (
          conversion &&
          typeof conversion === "object" &&
          "matches" in conversion
        ) {
          const nextConversion = structuredClone(conversion);
          const firstMatch = nextConversion.matches[0];
          firstMatch.status = body.status;

          if (body.status === "skipped") {
            firstMatch.candidate = null;
            firstMatch.confidence = 0;
          }

          latestConversion = nextConversion;

          return new Response(
            JSON.stringify({
              conversion: nextConversion,
              match: firstMatch,
              summary: { accepted: 0, review: 1, skipped: 1, total: 2 },
            }),
            { status: 200 },
          );
        }
      }

      if (
        method === "POST" &&
        url.match(/\/conversions\/.+\/matches\/.+\/search$/)
      ) {
        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;

        if (
          conversion &&
          typeof conversion === "object" &&
          "matches" in conversion
        ) {
          const nextConversion = structuredClone(conversion);
          const firstMatch = nextConversion.matches[0];
          firstMatch.candidate = {
            videoId: "ytm-track-1-retry",
            title: "M83 - Midnight City (Official Video)",
            artists: ["M83"],
            durationMs: 244000,
            resultType: "video",
          };
          firstMatch.confidence = 0.94;
          firstMatch.status = "accepted";
          latestConversion = nextConversion;

          return new Response(
            JSON.stringify({
              conversion: nextConversion,
              match: firstMatch,
              summary: { accepted: 1, review: 1, skipped: 0, total: 2 },
            }),
            { status: 200 },
          );
        }
      }

      if (method === "POST" && url.endsWith("/imports/reset")) {
        latestConversion = null;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (method === "POST" && url.endsWith("/logs/client")) {
        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      }

      return new Response("Not found", { status: 404 });
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function importedConversion() {
  return {
    id: "conversion-spicetify-playlist-1",
    sourcePlaylistName: "Road trip",
    targetPlaylistName: "Road trip",
    status: "imported",
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:00:00.000Z",
    tracks: [
      {
        id: "spotify:track:track-1",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        isrc: "FR6V81141061",
        explicit: false,
      },
      {
        id: "spotify:track:track-2",
        title: "Outro",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 247000,
        explicit: false,
      },
    ],
    matches: [],
  };
}

function matchedConversion() {
  const imported = importedConversion();

  return {
    ...imported,
    status: "reviewing",
    matches: imported.tracks.map((track) => ({
      trackId: track.id,
      candidate: {
        videoId: `ytm-${track.id}`,
        title: track.title,
        artists: track.artists,
        album: track.album,
        durationMs: track.durationMs,
        resultType: "song",
      },
      confidence: 0.92,
      status: "review",
    })),
  };
}

function acceptedConversion() {
  const conversion = matchedConversion();

  return {
    ...conversion,
    matches: conversion.matches.map((match) => ({
      ...match,
      status: "accepted",
    })),
  };
}

function partiallyMatchedConversion() {
  const imported = importedConversion();
  const [firstTrack] = imported.tracks;

  if (!firstTrack) {
    throw new Error("Expected imported conversion to include a track.");
  }

  return {
    ...imported,
    status: "reviewing",
    matches: [
      {
        trackId: firstTrack.id,
        candidate: null,
        confidence: 0,
        status: "skipped",
      },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  eventSourceListeners.clear();
});

describe("app shell", () => {
  it("renders convert first and uses top-level product navigation", async () => {
    const user = userEvent.setup();
    mockApi();

    render(<App initialEntries={["/"]} />);

    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /convert/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("link", { name: /review/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /convert/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Spotify Desktop" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "YouTube Music" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/no playlist imported/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /match with ytmusic/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /library/i }));

    expect(
      screen.getByRole("heading", { name: /library/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/converted playlists and future maintenance/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /settings/i }));

    expect(
      screen.getByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("keeps Spotify and YouTube Music connectors in settings", async () => {
    mockApi({ latestConversion: importedConversion() });

    render(<App initialEntries={["/settings"]} />);

    expect(
      await screen.findByRole("heading", { name: "Spotify Desktop" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "YouTube Music" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Spotify import")).toBeInTheDocument();
    expect(screen.getByText("Spicetify bridge")).toBeInTheDocument();
    expect(
      screen.getByText("http://127.0.0.1:4317/imports/spicetify"),
    ).toBeInTheDocument();
  });

  it("shows locally stored conversion history in the library", async () => {
    const conversion = {
      ...acceptedConversion(),
      status: "complete",
      updatedAt: "2026-05-01T10:15:00.000Z",
      playlist: {
        playlistId: "PLroadtrip",
        playlistUrl: "https://music.youtube.com/playlist?list=PLroadtrip",
        createdTrackCount: 2,
        skippedTrackCount: 0,
      },
    };
    mockApi({
      libraryConversions: [conversion],
    });

    render(<App initialEntries={["/library"]} />);

    expect(await screen.findByText("Road trip")).toBeInTheDocument();
    expect(screen.getByText("2 tracks")).toBeInTheDocument();
    expect(screen.getByText("2 accepted")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open youtube music playlist/i }),
    ).toHaveAttribute(
      "href",
      "https://music.youtube.com/playlist?list=PLroadtrip",
    );
  });

  it("loads and saves matching settings in settings", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();

    render(<App initialEntries={["/settings"]} />);

    const autoAccept = await screen.findByLabelText(/auto-accept/i);
    const reviewFloor = screen.getByLabelText(/review floor/i);
    const searchLimit = screen.getByLabelText(/search limit/i);
    const includeVideos = screen.getByLabelText(/include video results/i);

    expect(autoAccept).toHaveValue(90);
    expect(reviewFloor).toHaveValue(62);
    expect(searchLimit).toHaveValue(20);
    expect(includeVideos).toBeChecked();

    await user.clear(autoAccept);
    await user.type(autoAccept, "90");
    await user.clear(searchLimit);
    await user.type(searchLimit, "14");
    await user.click(includeVideos);
    await user.click(
      screen.getByRole("button", { name: /save matching settings/i }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url.toString().endsWith("/settings/matching") &&
            init?.method === "PATCH" &&
            init.body?.toString().includes('"autoAcceptThreshold":0.9') &&
            init.body?.toString().includes('"searchLimit":14') &&
            init.body?.toString().includes('"includeVideos":false')
          );
        }),
      ).toBe(true),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("shows matching settings save errors in settings", async () => {
    const user = userEvent.setup();
    mockApi({
      matchingSettingsPatchError: {
        status: 400,
        body: {
          error: "Invalid matching settings",
          message:
            "Auto-accept threshold must be greater than review threshold.",
        },
      },
    });

    render(<App initialEntries={["/settings"]} />);

    await user.click(
      await screen.findByRole("button", { name: /save matching settings/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Auto-accept threshold must be greater than review threshold.",
    );
  });

  it("connects YouTube Music with pasted browser headers in settings", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();

    render(<App initialEntries={["/settings"]} />);

    await user.click(
      await screen.findByRole("button", { name: /connect youtube music/i }),
    );
    await user.type(
      screen.getByLabelText(/request headers/i),
      "accept: */*\ncookie: secret",
    );
    await user.click(screen.getByRole("button", { name: /save connection/i }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url.toString().endsWith("/auth/youtube-music/browser-headers") &&
            init?.method === "POST" &&
            init.body?.toString().includes("cookie: secret")
          );
        }),
      ).toBe(true),
    );
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });

  it("disconnects YouTube Music in settings", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      youtubeMusicStatus: {
        provider: "youtubeMusic",
        connected: true,
        configured: true,
        displayName: "Visar",
      },
    });

    render(<App initialEntries={["/settings"]} />);

    await user.click(
      await screen.findByRole("button", { name: /disconnect/i }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url.toString().endsWith("/auth/youtube-music") &&
            init?.method === "DELETE"
          );
        }),
      ).toBe(true),
    );
    expect(
      await screen.findByRole("button", { name: /connect youtube music/i }),
    ).toBeInTheDocument();
  });

  it("keeps YouTube Music settings open when pasted headers do not validate", async () => {
    const user = userEvent.setup();
    mockApi({
      youtubeMusicSetupStatus: {
        provider: "youtubeMusic",
        connected: false,
        configured: true,
        error: "Reconnect YouTube Music in Settings before creating.",
      },
    });

    render(<App initialEntries={["/settings"]} />);

    await user.click(
      await screen.findByRole("button", { name: /connect youtube music/i }),
    );
    await user.type(
      screen.getByLabelText(/request headers/i),
      "accept: */*\ncookie: stale",
    );
    await user.click(screen.getByRole("button", { name: /save connection/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reconnect YouTube Music in Settings before creating.",
    );
    expect(
      screen.getByRole("dialog", { name: /connect youtube music/i }),
    ).toBeInTheDocument();
  });

  it("starts from the Spicetify import surface in convert", async () => {
    mockApi();

    render(<App initialEntries={["/"]} />);

    expect(
      await screen.findByText(/no playlist imported/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("42 tracks")).not.toBeInTheDocument();
    expect(screen.getByText("Spicetify bridge")).toBeInTheDocument();
  });

  it("shows imported playlist songs as soon as Spicetify pushes a snapshot", async () => {
    let latestConversion: unknown = null;
    mockApi({ latestConversion: () => latestConversion });
    vi.stubGlobal("EventSource", MockEventSource);

    render(<App initialEntries={["/"]} />);

    expect(
      await screen.findByText(/no playlist imported/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(eventSourceListeners.get("spicetify-imported")).toHaveLength(1),
    );

    await act(async () => {
      latestConversion = importedConversion();
      eventSourceListeners.get("spicetify-imported")?.forEach((listener) => {
        listener(
          new MessageEvent("spicetify-imported", {
            data: JSON.stringify({
              conversionId: "conversion-spicetify-playlist-1",
            }),
          }),
        );
      });
    });

    expect(await screen.findByText("Road trip")).toBeInTheDocument();
    expect(screen.getByText(/2 tracks from Spicetify/i)).toBeInTheDocument();
    expect(screen.getAllByText("Midnight City")).toHaveLength(1);
    expect(screen.getByText("Outro")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /match with ytmusic/i }),
    ).toBeEnabled();
    expect(screen.getAllByText(/awaiting match/i)).toHaveLength(2);
  });

  it("matches an imported playlist and then shows YouTube Music details", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      latestConversion: importedConversion(),
      matchedConversion: matchedConversion(),
    });

    render(<App initialEntries={["/"]} />);

    await user.click(
      await screen.findByRole("button", { name: /match with ytmusic/i }),
    );

    expect(
      fetchMock.mock.calls.some((call) =>
        call[0]
          .toString()
          .endsWith("/conversions/conversion-spicetify-playlist-1/match"),
      ),
    ).toBe(true);
    expect(await screen.findByText(/matching complete/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /view results/i }));

    expect(screen.getByText(/matches ready for review/i)).toBeInTheDocument();
    expect(screen.getAllByText("Midnight City")).toHaveLength(2);
    expect(screen.getAllByText("Outro")).toHaveLength(2);
    expect(screen.getAllByText("92%")).toHaveLength(2);
  });

  it("shows matching progress and logs in a dialog before revealing review results", async () => {
    const user = userEvent.setup();
    let finishMatching: ((conversion: unknown) => void) | undefined;
    const matchingResponse = new Promise<unknown>((resolve) => {
      finishMatching = resolve;
    });

    mockApi({
      latestConversion: importedConversion(),
      matchedConversion: () => matchingResponse,
    });
    vi.stubGlobal("EventSource", MockEventSource);

    render(<App initialEntries={["/"]} />);

    await user.click(
      await screen.findByRole("button", { name: /match with ytmusic/i }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: /matching with youtube music/i,
    });

    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(
      screen.getByText(/starting youtube music match/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 songs queued/i)).toBeInTheDocument();

    const partialConversion = {
      ...importedConversion(),
      status: "matching",
      matches: matchedConversion().matches.slice(0, 1),
    };
    await waitFor(() =>
      expect(
        eventSourceListeners.get("conversion-match-progress"),
      ).toHaveLength(1),
    );
    await act(async () => {
      eventSourceListeners
        .get("conversion-match-progress")
        ?.forEach((listener) => {
          listener(
            new MessageEvent("conversion-match-progress", {
              data: JSON.stringify({
                type: "conversion-match-progress",
                conversionId: partialConversion.id,
                conversion: partialConversion,
                match: partialConversion.matches[0],
                processedTracks: 1,
                totalTracks: 2,
              }),
            }),
          );
        });
    });

    expect(
      await screen.findByText(/matched midnight city/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.queryByText(/matched outro/i)).not.toBeInTheDocument();

    await act(async () => {
      eventSourceListeners
        .get("conversion-match-completed")
        ?.forEach((listener) => {
          listener(
            new MessageEvent("conversion-match-completed", {
              data: JSON.stringify({
                type: "conversion-match-completed",
                conversionId: matchedConversion().id,
                conversion: matchedConversion(),
                processedTracks: 2,
                totalTracks: 2,
              }),
            }),
          );
        });
      finishMatching?.(matchedConversion());
    });

    expect(await screen.findByText(/matched outro/i)).toBeInTheDocument();
    expect(await screen.findByText(/matching complete/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    await user.click(screen.getByRole("button", { name: /view results/i }));

    expect(
      screen.queryByRole("dialog", { name: /matching with youtube music/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Midnight City")).toHaveLength(2);
    expect(screen.getAllByText("Outro")).toHaveLength(2);
  });

  it("hides active matching while keeping a background progress indicator", async () => {
    const user = userEvent.setup();
    const matchingResponse = new Promise<unknown>(() => {});

    mockApi({
      latestConversion: importedConversion(),
      matchedConversion: () => matchingResponse,
    });
    vi.stubGlobal("EventSource", MockEventSource);

    render(<App initialEntries={["/"]} />);

    await user.click(
      await screen.findByRole("button", { name: /match with ytmusic/i }),
    );

    expect(
      await screen.findByRole("dialog", {
        name: /matching with youtube music/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /hide/i }));

    expect(
      screen.queryByRole("dialog", { name: /matching with youtube music/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/matching is running in the background/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show matching progress/i }),
    ).toBeEnabled();

    const partialConversion = {
      ...importedConversion(),
      status: "matching",
      matches: matchedConversion().matches.slice(0, 1),
    };
    await waitFor(() =>
      expect(
        eventSourceListeners.get("conversion-match-progress"),
      ).toHaveLength(1),
    );
    await act(async () => {
      eventSourceListeners
        .get("conversion-match-progress")
        ?.forEach((listener) => {
          listener(
            new MessageEvent("conversion-match-progress", {
              data: JSON.stringify({
                type: "conversion-match-progress",
                conversionId: partialConversion.id,
                conversion: partialConversion,
                match: partialConversion.matches[0],
                processedTracks: 1,
                totalTracks: 2,
              }),
            }),
          );
        });
    });

    expect(
      screen.queryByRole("dialog", { name: /matching with youtube music/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("stops active matching from the progress dialog", async () => {
    const user = userEvent.setup();
    const matchingResponse = new Promise<unknown>(() => {});
    const fetchMock = mockApi({
      latestConversion: importedConversion(),
      matchedConversion: () => matchingResponse,
    });

    render(<App initialEntries={["/"]} />);

    await user.click(
      await screen.findByRole("button", { name: /match with ytmusic/i }),
    );
    await user.click(screen.getByRole("button", { name: /stop matching/i }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          call[0]
            .toString()
            .endsWith(
              "/conversions/conversion-spicetify-playlist-1/match/cancel",
            ),
        ),
      ).toBe(true),
    );
  });

  it("continues matching unmatched songs after stopping", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      latestConversion: partiallyMatchedConversion(),
      matchedConversion: matchedConversion(),
    });

    render(<App initialEntries={["/"]} />);

    await user.click(
      await screen.findByRole("button", { name: /continue matching/i }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          call[0]
            .toString()
            .endsWith("/conversions/conversion-spicetify-playlist-1/match"),
        ),
      ).toBe(true),
    );
    expect(
      await screen.findByRole("dialog", {
        name: /matching with youtube music/i,
      }),
    ).toBeInTheDocument();
  });

  it("lets low-confidence accepted songs be unselected back to review", async () => {
    const user = userEvent.setup();
    const conversion = matchedConversion();
    const firstMatch = conversion.matches[0];

    if (!firstMatch) {
      throw new Error("Expected a match fixture.");
    }

    firstMatch.confidence = 0.72;
    const fetchMock = mockApi({
      latestConversion: conversion,
      matchedConversion: conversion,
    });

    render(<App initialEntries={["/"]} />);

    await screen.findByText(/matches ready for review/i);
    const acceptButton = screen
      .getAllByRole("button", { name: /accept match/i })
      .at(0);

    if (!acceptButton) {
      throw new Error("Expected an accept button.");
    }

    await user.click(acceptButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url
              .toString()
              .includes("/matches/spotify%3Atrack%3Atrack-1/status") &&
            init?.body?.toString().includes('"status":"accepted"')
          );
        }),
      ).toBe(true),
    );

    const unselectButton = screen
      .getAllByRole("button", { name: /unselect match/i })
      .at(0);

    if (!unselectButton) {
      throw new Error("Expected an unselect button.");
    }

    await user.click(unselectButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url
              .toString()
              .includes("/matches/spotify%3Atrack%3Atrack-1/status") &&
            init?.body?.toString().includes('"status":"review"')
          );
        }),
      ).toBe(true),
    );
  });

  it("persists review table skip actions", async () => {
    const user = userEvent.setup();
    const conversion = matchedConversion();
    const fetchMock = mockApi({
      latestConversion: conversion,
      matchedConversion: conversion,
    });

    render(<App initialEntries={["/"]} />);

    await screen.findByText(/matches ready for review/i);
    const skipButton = screen
      .getAllByRole("button", { name: /skip track/i })
      .at(0);

    if (!skipButton) {
      throw new Error("Expected a skip button.");
    }

    await user.click(skipButton);

    expect(
      fetchMock.mock.calls.some((call) =>
        call[0]
          .toString()
          .includes("/matches/spotify%3Atrack%3Atrack-1/status"),
      ),
    ).toBe(true);
    expect(await screen.findByText(/no safe match/i)).toBeInTheDocument();
  });

  it("opens manual search, searches edited text, and selects a replacement", async () => {
    const user = userEvent.setup();
    const conversion = matchedConversion();
    const fetchMock = mockApi({
      latestConversion: conversion,
      matchedConversion: conversion,
    });

    render(<App initialEntries={["/"]} />);

    await screen.findByText(/matches ready for review/i);
    const playlistName = screen.getByLabelText(/playlist name/i);

    await user.clear(playlistName);
    await user.type(playlistName, "Road trip manual verify");

    const searchButton = screen
      .getAllByRole("button", { name: /search replacement/i })
      .at(0);

    if (!searchButton) {
      throw new Error("Expected a search replacement button.");
    }

    await user.click(searchButton);

    const dialog = await screen.findByRole("dialog", {
      name: /manual youtube music search/i,
    });
    const searchInput = screen.getByLabelText(/search string/i);

    expect(dialog).toBeInTheDocument();
    expect(searchInput).toHaveValue("Midnight City M83");
    expect(
      await screen.findByText("M83 - Midnight City (Official Video)"),
    ).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "midnight city official audio");
    await user.click(
      screen.getByRole("button", { name: /search youtube music/i }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url
              .toString()
              .includes("/matches/spotify%3Atrack%3Atrack-1/candidates") &&
            init?.body
              ?.toString()
              .includes('"query":"midnight city official audio"')
          );
        }),
      ).toBe(true),
    );

    await user.click(
      screen.getByRole("button", {
        name: /select M83 - Midnight City \(Official Video\)/i,
      }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          call[0]
            .toString()
            .includes("/matches/spotify%3Atrack%3Atrack-1/manual"),
        ),
      ).toBe(true),
    );
    expect(
      screen.queryByRole("dialog", {
        name: /manual youtube music search/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText("M83 - Midnight City (Official Video)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/playlist name/i)).toHaveValue(
      "Road trip manual verify",
    );
  });

  it("accepts a pasted YouTube Music link for a manual match", async () => {
    const user = userEvent.setup();
    const conversion = matchedConversion();
    const fetchMock = mockApi({
      latestConversion: conversion,
      matchedConversion: conversion,
    });

    render(<App initialEntries={["/"]} />);

    await screen.findByText(/matches ready for review/i);
    const searchButton = screen
      .getAllByRole("button", { name: /search replacement/i })
      .at(0);

    if (!searchButton) {
      throw new Error("Expected a search replacement button.");
    }

    await user.click(searchButton);
    await user.type(
      await screen.findByLabelText(/youtube music link/i),
      "https://music.youtube.com/watch?v=dX3k_QDnzHE&si=abc123",
    );
    await user.click(screen.getByRole("button", { name: /use link/i }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url
              .toString()
              .includes("/matches/spotify%3Atrack%3Atrack-1/link") &&
            init?.body?.toString().includes("dX3k_QDnzHE")
          );
        }),
      ).toBe(true),
    );
    expect(
      screen.queryByRole("dialog", {
        name: /manual youtube music search/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("creates a YouTube Music playlist after review", async () => {
    const user = userEvent.setup();
    const conversion = acceptedConversion();
    const fetchMock = mockApi({
      latestConversion: conversion,
      matchedConversion: conversion,
      youtubeMusicStatus: {
        provider: "youtubeMusic",
        connected: true,
        configured: true,
        displayName: "Visar",
      },
    });

    render(<App initialEntries={["/"]} />);

    const playlistName = await screen.findByLabelText(/playlist name/i);

    expect(playlistName).toHaveValue("Road trip");

    await user.clear(playlistName);
    await user.type(playlistName, "Road trip live archive");
    await user.click(
      await screen.findByRole("button", { name: /create playlist/i }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [url, init] = call;

          return (
            url
              .toString()
              .endsWith(
                "/conversions/conversion-spicetify-playlist-1/create",
              ) &&
            init?.body
              ?.toString()
              .includes('"targetPlaylistName":"Road trip live archive"')
          );
        }),
      ).toBe(true),
    );
    expect(
      await screen.findByRole("link", { name: /open youtube music playlist/i }),
    ).toHaveAttribute(
      "href",
      "https://music.youtube.com/playlist?list=PLroadtrip",
    );
  });

  it("shows the YouTube Music auth failure when playlist creation is rejected", async () => {
    const user = userEvent.setup();
    const conversion = acceptedConversion();
    mockApi({
      createError: {
        status: 503,
        body: {
          error: "YouTube Music unavailable",
          message: "Reconnect YouTube Music in Settings before creating.",
        },
      },
      latestConversion: conversion,
      matchedConversion: conversion,
      youtubeMusicStatus: {
        provider: "youtubeMusic",
        connected: true,
        configured: true,
        displayName: "Visar",
      },
    });

    render(<App initialEntries={["/"]} />);

    await user.click(
      await screen.findByRole("button", { name: /create playlist/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reconnect YouTube Music in Settings before creating.",
    );
  });
});
