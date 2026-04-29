export function getEnv() {
  return {
    apiPort: Number(process.env.API_PORT ?? 4317),
    apiHost: process.env.API_HOST ?? "127.0.0.1",
    webUrl: process.env.WEB_URL ?? "http://127.0.0.1:5173/",
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    spotifyRedirectUri:
      process.env.SPOTIFY_REDIRECT_URI ??
      "http://127.0.0.1:4317/auth/spotify/callback",
  };
}

export const env = getEnv();
