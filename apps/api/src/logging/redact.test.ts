import { describe, expect, it } from "vitest";
import { redactLogFields } from "./redact";

describe("redactLogFields", () => {
  it("redacts sensitive keys recursively without mutating input", () => {
    const input = {
      token: "abc",
      nested: {
        authorization: "Bearer secret",
        safe: "value",
      },
      list: [{ refreshToken: "refresh", trackId: "spotify:track:1" }],
    };

    expect(redactLogFields(input)).toEqual({
      token: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        safe: "value",
      },
      list: [{ refreshToken: "[REDACTED]", trackId: "spotify:track:1" }],
    });
    expect(input.nested.authorization).toBe("Bearer secret");
  });
});
