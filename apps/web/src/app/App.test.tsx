import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function mockApi({
  spotifyConnected = false,
  spotifyConfigured = true,
}: {
  spotifyConnected?: boolean;
  spotifyConfigured?: boolean;
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
      screen.getByRole("heading", { name: "Spotify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "YouTube Music" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /import playlist link/i }),
    );

    expect(
      screen.getByRole("heading", { name: /matching review/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset conversion/i }),
    ).toBeInTheDocument();

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

  it("shows Spotify configuration status in settings", async () => {
    mockApi({ spotifyConfigured: false });

    render(<App initialEntries={["/settings"]} />);

    expect(await screen.findByText("Spotify credentials")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(
      screen.getByText("http://127.0.0.1:4317/auth/spotify/callback"),
    ).toBeInTheDocument();
  });

  it("shows Spotify playlists in convert after connecting", async () => {
    mockApi({ spotifyConnected: true });

    render(<App initialEntries={["/"]} />);

    expect(await screen.findByText("Road trip")).toBeInTheDocument();
    expect(screen.getByText("42 tracks")).toBeInTheDocument();
    expect(screen.queryByText("Demo preview")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /use playlist road trip/i }),
      ).toBeInTheDocument(),
    );
  });
});
