import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultMatchingSettings,
  MatchingSettingsService,
} from "./matching-settings.service";

const tempDirectories: string[] = [];

function createSettingsPath() {
  const directory = mkdtempSync(join(tmpdir(), "spottoyt-settings-"));
  tempDirectories.push(directory);

  return join(directory, "settings.json");
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("MatchingSettingsService", () => {
  it("should persist matching settings to server-side JSON storage", () => {
    const settingsPath = createSettingsPath();
    const service = new MatchingSettingsService(settingsPath);

    const saved = service.updateSettings({
      autoAcceptThreshold: 0.84,
      reviewThreshold: 0.58,
      searchLimit: 12,
      includeVideos: false,
    });
    const reloaded = new MatchingSettingsService(settingsPath);

    expect(saved).toEqual({
      autoAcceptThreshold: 0.84,
      reviewThreshold: 0.58,
      searchLimit: 12,
      includeVideos: false,
    });
    expect(reloaded.getSettings()).toEqual(saved);
  });

  it("should fall back to default matching settings when no file exists", () => {
    const service = new MatchingSettingsService(createSettingsPath());

    expect(service.getSettings()).toEqual(defaultMatchingSettings);
  });
});
