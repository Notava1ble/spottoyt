import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareLogFile } from "./file-log-store";

describe("prepareLogFile", () => {
  it("rotates the current log and keeps only recent files", () => {
    const dir = mkdtempSync(join(tmpdir(), "spottoyt-logs-"));

    try {
      writeFileSync(join(dir, "spottoyt-current.jsonl"), "current\n");
      writeFileSync(join(dir, "spottoyt-previous-1.jsonl"), "previous-1\n");
      writeFileSync(join(dir, "spottoyt-previous-2.jsonl"), "previous-2\n");

      const currentPath = prepareLogFile({ logDir: dir, retain: 2 });

      expect(currentPath).toBe(join(dir, "spottoyt-current.jsonl"));
      expect(existsSync(currentPath)).toBe(false);
      expect(readFileSync(join(dir, "spottoyt-previous-1.jsonl"), "utf8")).toBe(
        "current\n",
      );
      expect(readFileSync(join(dir, "spottoyt-previous-2.jsonl"), "utf8")).toBe(
        "previous-1\n",
      );
      expect(existsSync(join(dir, "spottoyt-previous-3.jsonl"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates the log directory when it is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "spottoyt-logs-root-"));
    const dir = join(root, "nested", "logs");

    try {
      const currentPath = prepareLogFile({ logDir: dir, retain: 5 });

      expect(currentPath).toBe(join(dir, "spottoyt-current.jsonl"));
      expect(existsSync(dir)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
