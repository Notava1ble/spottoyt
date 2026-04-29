export type DatabaseStatus = {
  driver: "sqlite";
  configured: boolean;
  url: string;
};

export function getDatabaseStatus(): DatabaseStatus {
  return {
    driver: "sqlite",
    configured: Boolean(process.env.DATABASE_URL),
    url: process.env.DATABASE_URL ?? "file:./data/spottoyt.sqlite",
  };
}
