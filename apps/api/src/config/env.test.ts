import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getEnvSource } from "./env";

describe("environment config", () => {
  it("should load local app settings from a parent .env file", () => {
    const root = mkdtempSync(join(tmpdir(), "spottoyt-env-"));
    const apiCwd = join(root, "apps", "api");

    try {
      mkdirSync(apiCwd, { recursive: true });
      writeFileSync(
        join(root, ".env"),
        ["API_PORT=4318", "WEB_URL=http://127.0.0.1:5174/"].join("\n"),
      );

      expect(getEnvSource(apiCwd)).toMatchObject({
        API_PORT: "4318",
        WEB_URL: "http://127.0.0.1:5174/",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("should prefer process env over .env values", () => {
    const root = mkdtempSync(join(tmpdir(), "spottoyt-env-"));

    try {
      process.env.API_PORT = "4400";
      writeFileSync(join(root, ".env"), "API_PORT=4300");

      expect(getEnvSource(root).API_PORT).toBe("4400");
    } finally {
      delete process.env.API_PORT;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
