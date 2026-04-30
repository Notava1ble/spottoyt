import {
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

export type YtmusicCandidateSearchResult = {
  trackId: string;
  candidates: YtmusicCandidate[];
};

export type YtmusicSearchClient = {
  findCandidatesForTracks(
    tracks: SpotifyTrack[],
  ): Promise<YtmusicCandidateSearchResult[]>;
};

const searchLimit = 5;

export class YtmusicService {
  constructor(
    private readonly searchClient: YtmusicSearchClient = new PythonYtmusicSearchClient(),
  ) {}

  async findMockMatches(): Promise<MatchDecision[]> {
    return matchDecisionSchema.array().parse(mockConversionJob.matches);
  }

  async findMatchesForTracks(tracks: SpotifyTrack[]): Promise<MatchDecision[]> {
    const searchResults = await this.searchClient.findCandidatesForTracks(
      tracks,
    );
    const candidatesByTrackId = new Map(
      searchResults.map((result) => [result.trackId, result.candidates]),
    );

    return matchDecisionSchema.array().parse(
      tracks.map((track) =>
        decideMatch(track, candidatesByTrackId.get(track.id) ?? []),
      ),
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
  constructor(private readonly pythonCommand = getDefaultPythonCommand()) {}

  async findCandidatesForTracks(
    tracks: SpotifyTrack[],
  ): Promise<YtmusicCandidateSearchResult[]> {
    const workerPath = join(getWorkerDirectory(), "src", "main.py");

    return runWorker(this.pythonCommand, workerPath, {
      limit: searchLimit,
      tracks,
    });
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

  if (!best || best.confidence < 0.7) {
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
    status: best.confidence >= 0.93 ? "accepted" : "review",
  };
}

function scoreCandidate(track: SpotifyTrack, candidate: YtmusicCandidate) {
  let score = 0;
  const trackTitle = normalizeText(track.title);
  const candidateTitle = normalizeText(candidate.title);
  const primaryArtist = normalizeText(track.artists[0] ?? "");
  const candidateArtists = candidate.artists.map(normalizeText);

  if (candidateTitle === trackTitle) {
    score += 0.45;
  } else if (
    candidateTitle.includes(trackTitle) ||
    trackTitle.includes(candidateTitle)
  ) {
    score += 0.35;
  }

  if (candidateArtists.includes(primaryArtist)) {
    score += 0.35;
  }

  if (
    candidate.album &&
    track.album !== "Unknown album" &&
    normalizeText(candidate.album) === normalizeText(track.album)
  ) {
    score += 0.1;
  }

  const durationDelta = Math.abs(track.durationMs - candidate.durationMs);
  if (durationDelta <= 2000) {
    score += 0.08;
  } else if (durationDelta <= 10000) {
    score += 0.05;
  }

  if (candidate.resultType === "song") {
    score += 0.2;
  }

  return Math.min(score, 1);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roundConfidence(confidence: number) {
  return Math.round(confidence * 100) / 100;
}

async function runWorker(
  pythonCommand: string,
  workerPath: string,
  payload: { limit: number; tracks: SpotifyTrack[] },
): Promise<YtmusicCandidateSearchResult[]> {
  return new Promise((resolvePromise, reject) => {
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
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();

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
        logWorkerDiagnostics(errorOutput);
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

function logWorkerDiagnostics(diagnostics: string) {
  if (diagnostics) {
    console.info(diagnostics);
  }
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
