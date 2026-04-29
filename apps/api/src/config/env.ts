import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

type EnvSource = Record<string, string | undefined>;

export function getEnv() {
  const source = getEnvSource();

  return {
    apiPort: Number(source.API_PORT ?? 4317),
    apiHost: source.API_HOST ?? "127.0.0.1",
    webUrl: source.WEB_URL ?? "http://127.0.0.1:5173/",
    spotifyClientId: source.SPOTIFY_CLIENT_ID ?? "",
    spotifyClientSecret: source.SPOTIFY_CLIENT_SECRET ?? "",
    spotifyRedirectUri:
      source.SPOTIFY_REDIRECT_URI ??
      "http://127.0.0.1:4317/auth/spotify/callback",
  };
}

export function getEnvSource(cwd = process.cwd()): EnvSource {
  return {
    ...loadNearestDotenv(cwd),
    ...process.env,
  };
}

function loadNearestDotenv(cwd: string): EnvSource {
  const root = parse(cwd).root;
  let current = cwd;

  while (true) {
    const envPath = join(current, ".env");

    if (existsSync(envPath)) {
      return parseDotenv(readFileSync(envPath, "utf8"));
    }

    if (current === root) {
      return {};
    }

    current = dirname(current);
  }
}

function parseDotenv(contents: string): EnvSource {
  const env: EnvSource = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(rawValue);
  }

  return env;
}

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export const env = getEnv();
