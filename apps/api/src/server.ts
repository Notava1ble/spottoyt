import { buildApp } from "./app";
import { env } from "./config/env";

const app = buildApp();

try {
  await app.listen({ port: env.apiPort, host: env.apiHost });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
