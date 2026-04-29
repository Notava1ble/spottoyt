import type {
  AccountStatusResponse,
  LatestImportResponse,
  SpotifyPlaylistsResponse,
} from "@spottoyt/shared";

export const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4317";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getAccountStatus() {
  return apiGet<AccountStatusResponse>("/auth/status");
}

export function getSpotifyPlaylists() {
  return apiGet<SpotifyPlaylistsResponse>("/spotify/playlists");
}

export function getLatestImport() {
  return apiGet<LatestImportResponse>("/imports/latest");
}

export function getEventsUrl() {
  return `${apiUrl}/events`;
}

export function getSpotifyLoginUrl() {
  return `${apiUrl}/auth/spotify/login`;
}

export function logoutSpotify() {
  return apiPost<{ ok: boolean }>("/auth/spotify/logout");
}
