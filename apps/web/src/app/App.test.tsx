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
  spotifyConnected = false,
  spotifyConfigured = true,
  latestConversion = null,
}: {
  spotifyConnected?: boolean;
  spotifyConfigured?: boolean;
  latestConversion?: unknown | (() => unknown);
} = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.endsWith("/auth/status")) {
      return new Response(
        JSON.stringify({
          spotify: {
            provider: "spotify",
            connected: spotifyConnected,
            configured: spotifyConfigured,
            displayName: spotifyConnected ? "Visar" : undefined,
          },
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

    if (url.endsWith("/spotify/playlists")) {
      return new Response(
        JSON.stringify({
          playlists: [
            {
              id: "playlist-1",
              name: "Road trip",
              trackCount: 42,
              public: false,
              collaborative: false,
              ownerName: "Visar",
              externalUrl: "https://open.spotify.com/playlist/playlist-1",
            },
          ],
        }),
        { status: 200 },
      );
    }

    return new Response("Not found", { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

    expect(
      screen.getByRole("button", { name: /review latest import/i }),
    ).toBeDisabled();
    expect(screen.getAllByText(/waiting for spotify desktop/i).length).toBe(2);

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
    mockApi({ spotifyConfigured: false });

    render(<App initialEntries={["/settings"]} />);

    expect(await screen.findByText("Spotify import")).toBeInTheDocument();
    expect(screen.getByText("Spicetify bridge")).toBeInTheDocument();
    expect(screen.getByText("Web API deprecated")).toBeInTheDocument();
    expect(
      screen.getByText("http://127.0.0.1:4317/imports/spicetify"),
    ).toBeInTheDocument();
  });

  it("keeps Spotify Web API playlist picking deprecated in convert", async () => {
    const fetchMock = mockApi({ spotifyConnected: true });

    render(<App initialEntries={["/"]} />);

    expect(await screen.findByText("Spicetify bridge")).toBeInTheDocument();
    expect(screen.queryByText("42 tracks")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        call[0].toString().endsWith("/spotify/playlists"),
      ),
    ).toBe(false);
    expect(
      screen.getByText(/spotify web api playlist picking is deprecated/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Spotify Web API")).toBeInTheDocument();
  });

  it("updates Convert when Spicetify pushes a playlist snapshot", async () => {
    let latestConversion: unknown = null;
    const pushedConversion = {
      id: "conversion-spicetify-playlist-1",
      sourcePlaylistName: "Road trip",
      targetPlaylistName: "Road trip - YouTube Music",
      status: "reviewing",
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
      matches: [
        {
          trackId: "spotify:track:track-1",
          candidate: {
            videoId: "pending-spotify:track:track-1",
            title: "Midnight City",
            artists: ["M83"],
            album: "Hurry Up, We're Dreaming",
            durationMs: 243000,
            resultType: "song",
          },
          confidence: 0.5,
          status: "review",
        },
      ],
    };
    mockApi({ latestConversion: () => latestConversion });
    vi.stubGlobal("EventSource", MockEventSource);

    render(<App initialEntries={["/"]} />);

    expect(
      (await screen.findAllByText(/waiting for spotify desktop/i)).length,
    ).toBe(2);
    await waitFor(() =>
      expect(eventSourceListeners.get("spicetify-imported")).toHaveLength(1),
    );

    await act(async () => {
      latestConversion = pushedConversion;
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
    expect(screen.getAllByText("Midnight City").length).toBe(2);
    expect(screen.getByText("Outro")).toBeInTheDocument();
  });
});
