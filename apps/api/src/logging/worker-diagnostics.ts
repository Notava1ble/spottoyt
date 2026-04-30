export type WorkerDiagnostic = {
  event: string;
  fields: Record<string, unknown>;
};

export function parseWorkerDiagnostics(stderr: string): WorkerDiagnostic[] {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseWorkerDiagnosticLine(line));
}

function parseWorkerDiagnosticLine(line: string): WorkerDiagnostic {
  try {
    const parsed = JSON.parse(line) as unknown;

    if (
      parsed &&
      typeof parsed === "object" &&
      "event" in parsed &&
      typeof parsed.event === "string"
    ) {
      const { event, ...fields } = parsed as {
        event: string;
        [key: string]: unknown;
      };

      return { event, fields };
    }
  } catch {
    return { event: "ytmusic.worker.stderr", fields: { line } };
  }

  return { event: "ytmusic.worker.stderr", fields: { line } };
}
