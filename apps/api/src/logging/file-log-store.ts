import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const currentLogFile = "spottoyt-current.jsonl";

export type PrepareLogFileOptions = {
  logDir: string;
  retain: number;
};

export function prepareLogFile({ logDir, retain }: PrepareLogFileOptions) {
  mkdirSync(logDir, { recursive: true });

  const normalizedRetain = Math.max(0, Math.floor(retain));
  const currentPath = join(logDir, currentLogFile);

  if (normalizedRetain === 0) {
    if (existsSync(currentPath)) {
      rmSync(currentPath, { force: true });
    }

    return currentPath;
  }

  const oldest = join(logDir, `spottoyt-previous-${normalizedRetain}.jsonl`);

  if (existsSync(oldest)) {
    rmSync(oldest, { force: true });
  }

  for (let index = normalizedRetain - 1; index >= 1; index -= 1) {
    const source = join(logDir, `spottoyt-previous-${index}.jsonl`);
    const target = join(logDir, `spottoyt-previous-${index + 1}.jsonl`);

    if (existsSync(source)) {
      renameSync(source, target);
    }
  }

  if (existsSync(currentPath)) {
    renameSync(currentPath, join(logDir, "spottoyt-previous-1.jsonl"));
  }

  return currentPath;
}
