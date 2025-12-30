import { MongoClient, Db, Collection, Document as MongoDocument } from "mongodb";
import { config } from "../config";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(config.mongoUri, {
    maxPoolSize: 10,
  });

  try {
    await client.connect();
    db = client.db(config.mongoDb);
    return db;
  } catch (err: any) {
    // Log with a clear, searchable tag so alerts can be created from logs
    console.error(`MONGO_CONN_FAILED: MongoDB connection failed: ${err?.message ?? err}`);

    // If configured, POST an alert to a webhook (useful to integrate with Slack/Teams/alerting)
    if (process.env.ERROR_ALERT_WEBHOOK) {
      try {
        sendAlert(process.env.ERROR_ALERT_WEBHOOK, {
          event: "mongodb_connection_failed",
          message: err?.message ?? String(err),
          time: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Failed to send DB alert:", e);
      }
    }

    throw err;
  }
}

async function sendAlert(webhookUrl: string, payload: object) {
  try {
    const urlObj = new URL(webhookUrl);
    const data = JSON.stringify(payload);
    const https = require("https");

    const options: any = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + (urlObj.search || ""),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res: any) => {
      // consume response
      res.on("data", () => {});
    });

    req.on("error", (e: any) => {
      console.error("Alert webhook error:", e);
    });

    req.write(data);
    req.end();
  } catch (e) {
    console.error("sendAlert failed:", e);
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    const database = await getDb();
    // ping command will throw if not reachable/auth fails
    await database.command({ ping: 1 });
    return true;
  } catch (err) {
    console.error("MONGO_PING_FAILED:", err);
    return false;
  }
}

export async function getCollection<T extends MongoDocument>(name: string): Promise<Collection<T>> {
   const database = await getDb();
   return database.collection<T>(name);
  }

export async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
}
