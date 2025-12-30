import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? "",
  mongoDb: process.env.MONGODB_DB ?? "shortstay",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};

if (!config.mongoUri) {
  // allow app to start in tests? here we fail fast
  throw new Error("Missing MONGODB_URI env var");
}
