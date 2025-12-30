import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config";
import { meRouter } from "./routes/me";
import { listingsRouter } from "./routes/listings";
import { hostsRouter } from "./routes/hosts";
import { requestsRouter } from "./routes/requests";
import { ZodError } from "zod";
import { pingDb } from "./db/mongo";

const app = express();
// Health check (Cloud Run / Monitoring) — includes DB readiness (returns 503 if DB is down)
app.get("/health", async (_req: Request, res: Response) => {
  try {
    const dbOk = await pingDb();
    if (!dbOk) {
      return res.status(503).json({ ok: false, service: "shortstay-api", db: "unreachable", timestamp: new Date().toISOString() });
    }
    return res.status(200).json({ ok: true, service: "shortstay-api", db: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Health check error:", err);
    return res.status(500).json({ ok: false, service: "shortstay-api", error: "Internal server error" });
  }
});

app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: (origin: string | undefined, cb: (err: Error | null, origin?: boolean | string | RegExp) => void) => {
      // allow non-browser requests (no origin) + Postman / curl וכו'
      if (!origin) return cb(null, true);

      // אם config.corsOrigin הוא "*", אפשר הכל
      if (config.corsOrigin === "*" || origin === config.corsOrigin) {
        return cb(null, true);
      }

      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

// duplicate health endpoint removed; /health now checks DB readiness

// routes
app.use(meRouter);
app.use(listingsRouter);
app.use(hostsRouter);
app.use(requestsRouter);

// global error handler (zod validation וכו')
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err); // טוב ל-log בפרודקשן

  // Zod validation errors are client errors
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.message });
  }

  // Do not leak internal error messages (e.g. DB auth failures) to clients
  res.status(500).json({ error: "Internal server error" });
});

// חשוב: Cloud Run מצפה ל-0.0.0.0 + process.env.PORT
const port = config.port || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${port}`);
});