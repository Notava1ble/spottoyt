import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type EnvSource = Record<string, string | undefined>;

export function getEnv(cwd = process.cwd()) {
  const envRoot = findNearestDotenvDirectory(cwd) ?? findProjectRoot(cwd);
  const apiRoot = getApiRoot(envRoot);
  const source = getEnvSource(cwd);
  const storagePath = resolveStoragePath(
    source.SPOTTOYT_STORAGE_PATH ??
      storagePathFromDatabaseUrl(source.DATABASE_URL) ??
      "./data/spottoyt-storage.json",
    envRoot,
  );

  return {
    apiPort: Number(source.API_PORT ?? 4317),
    apiHost: source.API_HOST ?? "127.0.0.1",
    webUrl: source.WEB_URL ?? "http://127.0.0.1:5173/",
    logLevel: source.LOG_LEVEL ?? "debug",
    logDir: source.SPOTTOYT_LOG_DIR ?? ".logs",
    logRetain: Number(source.SPOTTOYT_LOG_RETAIN ?? 5),
    nodeEnv: source.NODE_ENV ?? "development",
    storagePath,
    ytmusicAuthPath: resolveApiLocalPath(
      source.YTMUSIC_AUTH_PATH ?? "./auth/ytmusic-browser.json",
      apiRoot,
    ),
  };
}

export function getEnvSource(cwd = process.cwd()): EnvSource {
  return {
    ...loadNearestDotenv(cwd),
    ...process.env,
  };
}

function loadNearestDotenv(cwd: string): EnvSource {
  const envDirectory = findNearestDotenvDirectory(cwd);

  if (!envDirectory) {
    return {};
  }

  return parseDotenv(readFileSync(join(envDirectory, ".env"), "utf8"));
}

function findNearestDotenvDirectory(cwd: string) {
  const root = parse(cwd).root;
  let current = cwd;

  while (true) {
    const envPath = join(current, ".env");

    if (existsSync(envPath)) {
      return current;
    }

    if (current === root) {
      return null;
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

function storagePathFromDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl?.startsWith("file:")) {
    return null;
  }

  return "./data/spottoyt-storage.json";
}

function resolveStoragePath(path: string, root: string) {
  return isAbsolute(path) ? path : resolve(root, path);
}

function resolveApiLocalPath(path: string, apiRoot: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");

  if (isAbsolute(path)) {
    return path;
  }

  if (normalized.startsWith("auth/")) {
    return resolve(apiRoot, normalized);
  }

  return resolve(apiRoot, path);
}

function findProjectRoot(cwd: string) {
  const root = parse(cwd).root;
  let current = cwd;

  while (true) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }

    if (current === root) {
      return cwd;
    }

    current = dirname(current);
  }
}

function getApiRoot(envRoot: string) {
  const apiFromEnvRoot = join(envRoot, "apps", "api");

  if (existsSync(apiFromEnvRoot)) {
    return apiFromEnvRoot;
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export const env = getEnv();
