import { env } from "../config/env";

export type DatabaseStatus = {
  driver: "json-file";
  configured: boolean;
  url: string;
};

export function getDatabaseStatus(): DatabaseStatus {
  return {
    driver: "json-file",
    configured: true,
    url: env.storagePath,
  };
}
