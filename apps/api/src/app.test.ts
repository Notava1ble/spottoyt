import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

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
});
