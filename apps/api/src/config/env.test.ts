import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getEnvSource } from "./env";

const originalSpotifyEnv = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
};

function clearSpotifyEnv() {
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.SPOTIFY_REDIRECT_URI;
}

function restoreSpotifyEnv() {
  if (originalSpotifyEnv.clientId === undefined) {
    delete process.env.SPOTIFY_CLIENT_ID;
  } else {
    process.env.SPOTIFY_CLIENT_ID = originalSpotifyEnv.clientId;
  }

  if (originalSpotifyEnv.clientSecret === undefined) {
    delete process.env.SPOTIFY_CLIENT_SECRET;
  } else {
    process.env.SPOTIFY_CLIENT_SECRET = originalSpotifyEnv.clientSecret;
  }

  if (originalSpotifyEnv.redirectUri === undefined) {
    delete process.env.SPOTIFY_REDIRECT_URI;
  } else {
    process.env.SPOTIFY_REDIRECT_URI = originalSpotifyEnv.redirectUri;
  }
}

afterEach(() => {
  restoreSpotifyEnv();
});

describe("environment config", () => {
  it("should load Spotify credentials from a parent .env file", () => {
    clearSpotifyEnv();
    const root = mkdtempSync(join(tmpdir(), "spottoyt-env-"));
    const apiCwd = join(root, "apps", "api");

    try {
      mkdirSync(apiCwd, { recursive: true });
      writeFileSync(
        join(root, ".env"),
        [
          "SPOTIFY_CLIENT_ID=test-client-id",
          "SPOTIFY_CLIENT_SECRET=test-client-secret",
          "SPOTIFY_REDIRECT_URI=http://127.0.0.1:4317/auth/spotify/callback",
        ].join("\n"),
      );

      expect(getEnvSource(apiCwd)).toMatchObject({
        SPOTIFY_CLIENT_ID: "test-client-id",
        SPOTIFY_CLIENT_SECRET: "test-client-secret",
        SPOTIFY_REDIRECT_URI: "http://127.0.0.1:4317/auth/spotify/callback",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("should prefer process env over .env values", () => {
    const root = mkdtempSync(join(tmpdir(), "spottoyt-env-"));

    try {
      process.env.SPOTIFY_CLIENT_ID = "runtime-client-id";
      writeFileSync(join(root, ".env"), "SPOTIFY_CLIENT_ID=file-client-id");

      expect(getEnvSource(root).SPOTIFY_CLIENT_ID).toBe("runtime-client-id");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
