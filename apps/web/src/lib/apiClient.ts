import type {
  AccountStatusResponse,
  ConversionJob,
  LatestImportResponse,
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

export function getLatestImport() {
  return apiGet<LatestImportResponse>("/imports/latest");
}

export function getEventsUrl() {
  return `${apiUrl}/events`;
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

export function resetImport() {
  return apiPost<{ ok: boolean }>("/imports/reset");
}
