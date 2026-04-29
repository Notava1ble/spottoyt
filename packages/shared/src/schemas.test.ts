import { describe, expect, it } from "vitest";
import {
  conversionJobSchema,
  mockConversionJob,
  spotifyPlaylistUrlSchema,
} from "./schemas";

describe("shared schemas", () => {
  it("validates the mock conversion job used by the shell", () => {
    const parsed = conversionJobSchema.parse(mockConversionJob);

    expect(parsed.status).toBe("reviewing");
    expect(parsed.tracks).toHaveLength(4);
    expect(parsed.matches[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("rejects non-Spotify playlist URLs", () => {
    expect(() =>
      spotifyPlaylistUrlSchema.parse("https://example.com/nope"),
    ).toThrow();
  });
});
