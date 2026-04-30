import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type EventSourceListener = (event: MessageEvent<string>) => void;

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
  latestConversion = null,
  matchedConversion = null,
}: {
  latestConversion?: unknown | (() => unknown);
  matchedConversion?: unknown | (() => unknown);
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
            youtubeMusic: {
              provider: "youtubeMusic",
              connected: false,
              configured: false,
            },
          }),
          { status: 200 },
        );
      }

      if (url.endsWith("/imports/latest")) {
        const conversion =
          typeof latestConversion === "function"
            ? latestConversion()
            : latestConversion;

        return new Response(JSON.stringify({ conversion }), { status: 200 });
      }

      if (method === "POST" && url.match(/\/conversions\/.+\/match$/)) {
        const conversion =
          typeof matchedConversion === "function"
            ? matchedConversion()
            : matchedConversion;

        return new Response(
          JSON.stringify({
            conversion,
            summary: { accepted: 0, review: 2, skipped: 0, total: 2 },
          }),
          { status: 200 },
        );
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
    targetPlaylistName: "Road trip - YouTube Music",
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
      screen.getByRole("heading", { name: "Spotify Desktop" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "YouTube Music" }),
    ).toBeInTheDocument();
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

  it("shows Spicetify bridge status in settings", async () => {
    mockApi();

    render(<App initialEntries={["/settings"]} />);

    expect(await screen.findByText("Spotify import")).toBeInTheDocument();
    expect(screen.getByText("Spicetify bridge")).toBeInTheDocument();
    expect(
      screen.getByText("http://127.0.0.1:4317/imports/spicetify"),
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
    expect(
      await screen.findByText(/matches ready for review/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Midnight City")).toHaveLength(2);
    expect(screen.getAllByText("Outro")).toHaveLength(2);
    expect(screen.getAllByText("92%")).toHaveLength(2);
  });
});
