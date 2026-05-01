import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { type ConversionJob, conversionJobSchema } from "@spottoyt/shared";
import { env } from "../config/env";

export type ConversionStore = {
  clearLatestImport(): void;
  getBySpotifyPlaylistUri(spotifyPlaylistUri: string): ConversionJob | null;
  getConversion(id: string): ConversionJob | null;
  getLatestImport(): ConversionJob | null;
  saveConversion(conversion: ConversionJob): ConversionJob;
};

type StoreFile = {
  conversions: Record<string, ConversionJob>;
  latestConversionId?: string;
  version: 1;
};

export class FileConversionStore implements ConversionStore {
  constructor(private readonly filePath = env.storagePath) {}

  clearLatestImport() {
    const data = this.read();
    delete data.latestConversionId;
    this.write(data);
  }

  getBySpotifyPlaylistUri(spotifyPlaylistUri: string) {
    const data = this.read();

    return (
      Object.values(data.conversions).find(
        (conversion) => conversion.sourcePlaylistUri === spotifyPlaylistUri,
      ) ?? null
    );
  }

  getConversion(id: string) {
    return this.read().conversions[id] ?? null;
  }

  getLatestImport() {
    const data = this.read();

    if (!data.latestConversionId) {
      return null;
    }

    return data.conversions[data.latestConversionId] ?? null;
  }

  saveConversion(conversion: ConversionJob) {
    const parsed = conversionJobSchema.parse(conversion);
    const data = this.read();
    data.conversions[parsed.id] = parsed;
    data.latestConversionId = parsed.id;
    this.write(data);

    return parsed;
  }

  private read(): StoreFile {
    if (!existsSync(this.filePath)) {
      return {
        version: 1,
        conversions: {},
      };
    }

    return parseStoreFile(JSON.parse(readFileSync(this.filePath, "utf8")));
  }

  private write(data: StoreFile) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
  }
}

function parseStoreFile(value: unknown): StoreFile {
  if (!value || typeof value !== "object" || !("conversions" in value)) {
    throw new Error("Conversion storage file is invalid.");
  }

  const file = value as {
    conversions: Record<string, unknown>;
    latestConversionId?: unknown;
    version?: unknown;
  };
  const conversions = Object.fromEntries(
    Object.entries(file.conversions ?? {}).map(([id, conversion]) => [
      id,
      conversionJobSchema.parse(conversion),
    ]),
  );
  const latestConversionId =
    typeof file.latestConversionId === "string"
      ? file.latestConversionId
      : undefined;

  return {
    version: 1,
    conversions,
    latestConversionId,
  };
}
