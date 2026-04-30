import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLogDir } from "./logger";

describe("resolveLogDir", () => {
  it("resolves relative log paths from the workspace root", () => {
    expect(resolveLogDir(".logs").replaceAll("\\", "/")).toMatch(
      /spottoyt\/\.logs$/,
    );
  });

  it("keeps absolute log paths unchanged", () => {
    const logDir = join(tmpdir(), "spottoyt-logs");

    expect(resolveLogDir(logDir)).toBe(logDir);
  });
});
