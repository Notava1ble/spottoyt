import { describe, expect, it } from "vitest";
import { parseWorkerDiagnostics } from "./worker-diagnostics";

describe("parseWorkerDiagnostics", () => {
  it("parses worker stderr JSON Lines diagnostics", () => {
    expect(
      parseWorkerDiagnostics(
        [
          '{"event":"ytmusic.search.started","trackId":"spotify:track:1"}',
          '{"event":"ytmusic.search.completed","candidateCount":2}',
        ].join("\n"),
      ),
    ).toEqual([
      {
        event: "ytmusic.search.started",
        fields: { trackId: "spotify:track:1" },
      },
      {
        event: "ytmusic.search.completed",
        fields: { candidateCount: 2 },
      },
    ]);
  });

  it("keeps plain stderr lines as warning diagnostics", () => {
    expect(parseWorkerDiagnostics("plain failure")).toEqual([
      {
        event: "ytmusic.worker.stderr",
        fields: { line: "plain failure" },
      },
    ]);
  });
});
