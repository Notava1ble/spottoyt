const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "password",
  "headers",
  "env",
]);

export function redactLogFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactLogFields(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKeys.has(key) ? "[REDACTED]" : redactLogFields(nested),
    ]),
  );
}
