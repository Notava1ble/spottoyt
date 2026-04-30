import {
  type MatchingSettings,
  type MatchDecision,
  matchDecisionSchema,
  mockConversionJob,
  type SpotifyTrack,
  type YtmusicCandidate,
} from "@spottoyt/shared";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { platform } from "node:process";
import { fileURLToPath } from "node:url";
import {
  type LogEventWriter,
  noopLogEvent,
} from "../logging/logger";
import { parseWorkerDiagnostics } from "../logging/worker-diagnostics";
import {
  defaultMatchingSettings,
  MatchingSettingsService,
} from "./matching-settings.service";

export type YtmusicCandidateSearchResult = {
  trackId: string;
  candidates: YtmusicCandidate[];
};

export type YtmusicSearchOptions = {
  searchLimit: number;
  includeVideos: boolean;
};

export type YtmusicSearchClient = {
  findCandidatesForTracks(
    tracks: SpotifyTrack[],
    options?: YtmusicSearchOptions,
  ): Promise<YtmusicCandidateSearchResult[]>;
};

type MatchingSettingsProvider = {
  getSettings(): MatchingSettings;
};

const benignVideoTitleTokens = new Set([
  "official",
  "audio",
  "video",
  "music",
  "lyrics",
  "lyric",
  "visualizer",
  "visualiser",
  "hq",
  "hd",
  "explicit",
  "clean",
  "remaster",
  "remastered",
  "remastered",
]);
const editionTokens = new Set([
  "acoustic",
  "cover",
  "edit",
  "extended",
  "instrumental",
  "karaoke",
  "live",
  "mashup",
  "nightcore",
  "remix",
  "reverb",
  "slowed",
  "sped",
]);

export class YtmusicService {
  private readonly searchClient: YtmusicSearchClient;

  constructor(
    searchClient?: YtmusicSearchClient,
    private readonly logEvent: LogEventWriter = noopLogEvent,
    private readonly matchingSettings: MatchingSettingsProvider =
      new MatchingSettingsService(),
  ) {
    this.searchClient =
      searchClient ?? new PythonYtmusicSearchClient(undefined, this.logEvent);
  }

  async findMockMatches(): Promise<MatchDecision[]> {
    return matchDecisionSchema.array().parse(mockConversionJob.matches);
  }

  async findMatchesForTracks(tracks: SpotifyTrack[]): Promise<MatchDecision[]> {
    const settings = this.matchingSettings.getSettings();
    const searchOptions = {
      includeVideos: settings.includeVideos,
      searchLimit: settings.searchLimit,
    };
    const searchResults = await this.searchClient.findCandidatesForTracks(
      tracks,
      searchOptions,
    );
    this.logEvent("info", "api", "conversion.match.worker_results_received", {
      trackCount: tracks.length,
      resultCount: searchResults.length,
    });
    const candidatesByTrackId = new Map(
      searchResults.map((result) => [result.trackId, result.candidates]),
    );

    return matchDecisionSchema.array().parse(
      tracks.map((track) => {
        const decision = decideMatch(
          track,
          candidatesByTrackId.get(track.id) ?? [],
          settings,
        );

        this.logEvent(
          decision.status === "accepted" ? "debug" : "info",
          "api",
          "conversion.match.decision",
          {
            trackId: track.id,
            status: decision.status,
            confidence: decision.confidence,
            candidateVideoId: decision.candidate?.videoId,
          },
        );

        return decision;
      }),
    );
  }

  async createPlaylist(): Promise<{ playlistId: string; playlistUrl: string }> {
    return {
      playlistId: "ytm-demo-playlist",
      playlistUrl: "https://music.youtube.com/playlist?list=ytm-demo-playlist",
    };
  }
}

export class PythonYtmusicSearchClient implements YtmusicSearchClient {
  constructor(
    private readonly pythonCommand = getDefaultPythonCommand(),
    private readonly logEvent: LogEventWriter = noopLogEvent,
  ) {}

  async findCandidatesForTracks(
    tracks: SpotifyTrack[],
    options: YtmusicSearchOptions = {
      includeVideos: defaultMatchingSettings.includeVideos,
      searchLimit: defaultMatchingSettings.searchLimit,
    },
  ): Promise<YtmusicCandidateSearchResult[]> {
    const workerPath = join(getWorkerDirectory(), "src", "main.py");

    return runWorker(this.pythonCommand, workerPath, {
      includeVideos: options.includeVideos,
      limit: options.searchLimit,
      tracks,
    }, this.logEvent);
  }
}

export class YtmusicWorkerUnavailableError extends Error {}

type PythonCommandOptions = {
  existsSync: (path: string) => boolean;
  platform: NodeJS.Platform;
  workerDirectory: string;
};

export function getDefaultPythonCommand(
  options: PythonCommandOptions = {
    existsSync,
    platform,
    workerDirectory: getWorkerDirectory(),
  },
) {
  const venvPython = join(
    options.workerDirectory,
    ".venv",
    options.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );

  return options.existsSync(venvPython) ? venvPython : "python";
}

function decideMatch(
  track: SpotifyTrack,
  candidates: YtmusicCandidate[],
  settings: MatchingSettings = defaultMatchingSettings,
): MatchDecision {
  if (candidates.length === 0) {
    return {
      trackId: track.id,
      candidate: null,
      confidence: 0,
      status: "skipped",
    };
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      confidence: scoreCandidate(track, candidate),
    }))
    .sort((left, right) => right.confidence - left.confidence);
  const best = scored[0];
  const second = scored[1];

  if (!best || best.confidence < settings.reviewThreshold) {
    return {
      trackId: track.id,
      candidate: null,
      confidence: best ? roundConfidence(best.confidence) : 0,
      status: "skipped",
    };
  }

  return {
    trackId: track.id,
    candidate: best.candidate,
    confidence: roundConfidence(best.confidence),
    status:
      best.confidence >= settings.autoAcceptThreshold &&
      isClearWinner(best.confidence, second?.confidence)
        ? "accepted"
        : "review",
  };
}

function scoreCandidate(track: SpotifyTrack, candidate: YtmusicCandidate) {
  const title = scoreTitle(track, candidate);
  const artist = scoreArtist(track, candidate);
  const duration = scoreDuration(track.durationMs, candidate.durationMs);
  const resultType = scoreResultType(candidate);
  const album = scoreAlbum(track, candidate);
  const penalty = scoreEditionPenalty(track.title, candidate.title);
  let confidence =
    title * 0.47 +
    artist * 0.25 +
    duration * 0.18 +
    resultType * 0.06 +
    album * 0.04;

  confidence *= penalty;

  if (title < 0.55) {
    confidence = Math.min(confidence, 0.55);
  }

  if (artist < 0.35 && candidate.resultType === "video") {
    confidence = Math.min(confidence, 0.84);
  }

  return clamp(confidence, 0, 1);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreTitle(track: SpotifyTrack, candidate: YtmusicCandidate) {
  const trackTitle = normalizeSongTitle(track.title);
  const candidateTitle = normalizeSongTitle(candidate.title);
  const trackTokens = tokenize(trackTitle);
  const candidateTokens = tokenize(candidateTitle);

  if (trackTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  if (candidateTitle === trackTitle) {
    return 1;
  }

  if (candidateTitle.includes(trackTitle)) {
    return 0.98;
  }

  const shared = intersectionCount(trackTokens, candidateTokens);
  const containment = shared / trackTokens.length;
  const dice = (shared * 2) / (trackTokens.length + candidateTokens.length);

  if (containment >= 0.95) {
    return 0.96;
  }

  if (containment >= 0.75) {
    return Math.max(0.86, dice);
  }

  return Math.max(dice, containment * 0.82);
}

function scoreArtist(track: SpotifyTrack, candidate: YtmusicCandidate) {
  const candidateTokens = tokenize(
    normalizeText(`${candidate.artists.join(" ")} ${candidate.title}`),
  );
  const primaryArtistScore = scoreArtistName(track.artists[0] ?? "", candidateTokens);
  const featuredArtistScores = track.artists
    .slice(1)
    .map((artist) => scoreArtistName(artist, candidateTokens));
  if (featuredArtistScores.length === 0) {
    return primaryArtistScore;
  }

  const featuredArtistScore =
    featuredArtistScores.reduce((total, score) => total + score, 0) /
    featuredArtistScores.length;
  return clamp(primaryArtistScore * 0.78 + featuredArtistScore * 0.22, 0, 1);
}

function scoreArtistName(artist: string, candidateTokens: string[]) {
  const artistTokens = tokenize(normalizeText(artist));

  if (artistTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const shared = intersectionCount(artistTokens, candidateTokens);

  if (shared === artistTokens.length) {
    return 1;
  }

  return shared / artistTokens.length;
}

function scoreDuration(trackDurationMs: number, candidateDurationMs: number) {
  const deltaSeconds = Math.abs(trackDurationMs - candidateDurationMs) / 1000;

  if (deltaSeconds <= 2) {
    return 1;
  }

  if (deltaSeconds <= 10) {
    return 0.95;
  }

  if (deltaSeconds <= 20) {
    return 0.82;
  }

  if (deltaSeconds <= 45) {
    return 0.55;
  }

  if (deltaSeconds <= 90) {
    return 0.18;
  }

  return 0;
}

function scoreResultType(candidate: YtmusicCandidate) {
  if (candidate.resultType === "song") {
    return 1;
  }

  const tokens = new Set(tokenize(normalizeText(candidate.title)));

  return [
    "official",
    "audio",
    "video",
    "lyrics",
    "lyric",
    "visualizer",
    "visualiser",
  ].some((token) => tokens.has(token))
    ? 0.9
    : 0.74;
}

function scoreAlbum(track: SpotifyTrack, candidate: YtmusicCandidate) {
  if (!candidate.album || track.album === "Unknown album") {
    return 0;
  }

  return normalizeText(candidate.album) === normalizeText(track.album) ? 1 : 0;
}

function scoreEditionPenalty(trackTitle: string, candidateTitle: string) {
  const trackTokens = new Set(tokenize(normalizeText(trackTitle)));
  const candidateTokens = new Set(tokenize(normalizeText(candidateTitle)));
  let penalty = 1;

  for (const token of editionTokens) {
    if (candidateTokens.has(token) && !trackTokens.has(token)) {
      penalty -= token === "cover" || token === "karaoke" ? 0.24 : 0.13;
    }
  }

  return clamp(penalty, 0.55, 1);
}

function normalizeSongTitle(value: string) {
  return tokenize(
    normalizeText(
      value
        .replace(/\((?:feat|ft|with|prod)\.?[^)]*\)/gi, " ")
        .replace(/\[(?:feat|ft|with|prod)\.?[^\]]*]/gi, " "),
    ),
  )
    .filter((token) => !benignVideoTitleTokens.has(token))
    .join(" ");
}

function tokenize(value: string) {
  return value.split(" ").filter(Boolean);
}

function intersectionCount(left: string[], right: string[]) {
  const rightTokens = new Set(right);

  return left.filter((token) => rightTokens.has(token)).length;
}

function isClearWinner(best: number, second = 0) {
  return best >= 0.94 || best - second >= 0.04;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundConfidence(confidence: number) {
  return Math.round(confidence * 100) / 100;
}

async function runWorker(
  pythonCommand: string,
  workerPath: string,
  payload: { includeVideos: boolean; limit: number; tracks: SpotifyTrack[] },
  logEvent: LogEventWriter,
): Promise<YtmusicCandidateSearchResult[]> {
  return new Promise((resolvePromise, reject) => {
    logEvent("info", "api", "ytmusic.worker.spawned", {
      workerPath,
      trackCount: payload.tracks.length,
      includeVideos: payload.includeVideos,
      limit: payload.limit,
    });
    const child = spawn(pythonCommand, [workerPath, "match"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      reject(
        new YtmusicWorkerUnavailableError(
          `Unable to start YouTube Music worker: ${error.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      const stderrOutput = Buffer.concat(stderr);
      const errorOutput = stderrOutput.toString("utf8").trim();
      logEvent("info", "api", "ytmusic.worker.exited", {
        exitCode: code,
        stderrBytes: stderrOutput.byteLength,
      });

      for (const diagnostic of parseWorkerDiagnostics(errorOutput)) {
        logEvent("debug", "ytmusic-worker", diagnostic.event, diagnostic.fields);
      }

      if (code !== 0) {
        reject(
          new YtmusicWorkerUnavailableError(
            errorOutput ||
              "YouTube Music worker failed. Install ytmusicapi before matching.",
          ),
        );
        return;
      }

      try {
        resolvePromise(
          parseWorkerResults(Buffer.concat(stdout).toString("utf8")),
        );
      } catch (error) {
        reject(
          new YtmusicWorkerUnavailableError(
            error instanceof Error
              ? `YouTube Music worker returned invalid JSON: ${error.message}`
              : "YouTube Music worker returned invalid JSON.",
          ),
        );
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

function getWorkerDirectory() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../ytmusic-worker");
}

function parseWorkerResults(output: string): YtmusicCandidateSearchResult[] {
  const parsed = JSON.parse(output) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of track results.");
  }

  return parsed.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("trackId" in item) ||
      typeof item.trackId !== "string" ||
      !("candidates" in item) ||
      !Array.isArray(item.candidates)
    ) {
      throw new Error("Expected trackId and candidates for each result.");
    }

    return {
      trackId: item.trackId,
      candidates: item.candidates,
    };
  });
}
