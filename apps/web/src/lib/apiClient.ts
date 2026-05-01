import type {
  AccountStatusResponse,
  BrowserHeadersAuthRequest,
  ConversionJob,
  LatestImportResponse,
  ManualMatchSearchResponse,
  MatchDecision,
  MatchDecisionStatus,
  MatchingSettingsPatch,
  MatchingSettingsResponse,
  PlaylistCreateRequest,
  YtmusicCandidate,
} from "@spottoyt/shared";
import { logClientEvent } from "./logger";

export const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4317";

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "POST" });
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function apiPatchJson<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const startedAt = performance.now();
  const method = init?.method ?? "GET";

  logClientEvent("debug", "web.api.request.started", { method, path });

  try {
    const response = await fetch(`${apiUrl}${path}`, init);
    const durationMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      logClientEvent("warn", "web.api.request.failed", {
        method,
        path,
        statusCode: response.status,
        durationMs,
      });
      throw new Error(`Request failed: ${response.status}`);
    }

    logClientEvent("debug", "web.api.request.completed", {
      method,
      path,
      statusCode: response.status,
      durationMs,
    });

    return response.json() as Promise<T>;
  } catch (error) {
    logClientEvent("error", "web.api.request.error", {
      method,
      path,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function getAccountStatus() {
  return apiGet<AccountStatusResponse>("/auth/status");
}

export function setupYoutubeMusicBrowserHeaders(
  request: BrowserHeadersAuthRequest,
) {
  return apiPostJson<AccountStatusResponse>(
    "/auth/youtube-music/browser-headers",
    request,
  );
}

export function disconnectYoutubeMusic() {
  return apiRequest<AccountStatusResponse>("/auth/youtube-music", {
    method: "DELETE",
  });
}

export function getLatestImport() {
  return apiGet<LatestImportResponse>("/imports/latest");
}

export function getEventsUrl() {
  return `${apiUrl}/events`;
}

export function getMatchingSettings() {
  return apiGet<MatchingSettingsResponse>("/settings/matching");
}

export function updateMatchingSettings(patch: MatchingSettingsPatch) {
  return apiPatchJson<MatchingSettingsResponse>("/settings/matching", patch);
}

export function matchConversion(id: string) {
  return apiPost<{
    conversion: ConversionJob;
    summary: {
      accepted: number;
      review: number;
      skipped: number;
      total: number;
    };
  }>(`/conversions/${id}/match`);
}

export function updateMatchStatus(
  conversionId: string,
  trackId: string,
  status: MatchDecisionStatus,
) {
  return apiPostJson<{
    conversion: ConversionJob;
    match: MatchDecision;
    summary: {
      accepted: number;
      review: number;
      skipped: number;
      total: number;
    };
  }>(
    `/conversions/${conversionId}/matches/${encodeURIComponent(trackId)}/status`,
    { status },
  );
}

export function searchTrackMatch(conversionId: string, trackId: string) {
  return apiPost<{
    conversion: ConversionJob;
    match: MatchDecision;
    summary: {
      accepted: number;
      review: number;
      skipped: number;
      total: number;
    };
  }>(
    `/conversions/${conversionId}/matches/${encodeURIComponent(trackId)}/search`,
  );
}

export function searchManualTrackCandidates(
  conversionId: string,
  trackId: string,
  query: string,
) {
  return apiPostJson<ManualMatchSearchResponse>(
    `/conversions/${conversionId}/matches/${encodeURIComponent(trackId)}/candidates`,
    { query },
  );
}

export function selectManualTrackMatch(
  conversionId: string,
  trackId: string,
  candidate: YtmusicCandidate,
) {
  return apiPostJson<{
    conversion: ConversionJob;
    match: MatchDecision;
    summary: {
      accepted: number;
      review: number;
      skipped: number;
      total: number;
    };
  }>(
    `/conversions/${conversionId}/matches/${encodeURIComponent(trackId)}/manual`,
    { candidate },
  );
}

export function createPlaylist(
  conversionId: string,
  request: PlaylistCreateRequest = {},
) {
  return apiPostJson<ConversionJob>(
    `/conversions/${conversionId}/create`,
    request,
  );
}

export function resetImport() {
  return apiPost<{ ok: boolean }>("/imports/reset");
}
