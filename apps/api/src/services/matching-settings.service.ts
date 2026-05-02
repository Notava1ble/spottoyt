import {
  type MatchingSettings,
  type MatchingSettingsPatch,
  matchingSettingsSchema,
} from "@spottoyt/shared";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const defaultMatchingSettings = {
  autoAcceptThreshold: 0.9,
  reviewThreshold: 0.62,
  searchLimit: 20,
  includeVideos: true,
} satisfies MatchingSettings;

export class MatchingSettingsService {
  private cachedSettings?: MatchingSettings;

  constructor(private readonly settingsPath = getDefaultSettingsPath()) {}

  getSettings(): MatchingSettings {
    if (!this.cachedSettings) {
      this.cachedSettings = this.loadSettings();
    }

    return this.cachedSettings;
  }

  updateSettings(patch: MatchingSettingsPatch): MatchingSettings {
    const settings = matchingSettingsSchema.parse({
      ...this.getSettings(),
      ...patch,
    });

    mkdirSync(dirname(this.settingsPath), { recursive: true });
    writeFileSync(this.settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    this.cachedSettings = settings;

    return settings;
  }

  private loadSettings(): MatchingSettings {
    if (!existsSync(this.settingsPath)) {
      return defaultMatchingSettings;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.settingsPath, "utf8")) as unknown;

      return matchingSettingsSchema.parse({
        ...defaultMatchingSettings,
        ...(typeof parsed === "object" && parsed ? parsed : {}),
      });
    } catch {
      return defaultMatchingSettings;
    }
  }
}

function getDefaultSettingsPath() {
  return (
    process.env.SPOTTOYT_SETTINGS_PATH ??
    resolve(process.cwd(), "data", "spottoyt-settings.json")
  );
}
