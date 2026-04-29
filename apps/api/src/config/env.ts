export const env = {
  apiPort: Number(process.env.API_PORT ?? 4317),
  apiHost: process.env.API_HOST ?? "127.0.0.1",
};
