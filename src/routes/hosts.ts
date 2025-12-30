import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getCollection } from "../db/mongo";
import { recomputeHostStats } from "../utils/hostStats";

type UserDoc = {
  _id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  hostStats?: { hostScore: number; avgRating: number; recsCount: number; updatedAt: Date };
};

type RecommendationDoc = {
  _id: ObjectId;
  hostId: string;
  authorId: string;
  ratings: { overall: number; trust: number; accuracy: number; experience: number };
  text?: string;
  hidden: boolean;
  createdAt: Date;
};

export const hostsRouter = Router();

hostsRouter.get("/hosts/:hostId", async (req, res) => {
  const hostId = req.params.hostId;
  const usersCol = await getCollection<UserDoc>("users");
  const host = await usersCol.findOne({ _id: hostId }, { projection: { email: 1, name: 1, avatarUrl: 1, hostStats: 1, createdAt: 1 } });

  if (!host) {
    // allow showing host with no mongo profile yet
    return res.json({
      host: { id: hostId, name: null, avatarUrl: null, hostStats: { hostScore: 0, avgRating: 0, recsCount: 0 } },
    });
  }

  return res.json({
    host: {
      id: host._id,
      name: host.name ?? null,
      avatarUrl: host.avatarUrl ?? null,
      createdAt: host.createdAt,
      hostStats: host.hostStats ?? { hostScore: 0, avgRating: 0, recsCount: 0 },
    },
  });
});

hostsRouter.get("/hosts/:hostId/recommendations", async (req, res) => {
  const hostId = req.params.hostId;
  const col = await getCollection<RecommendationDoc>("recommendations");
  const docs = await col.find({ hostId, hidden: false }).sort({ createdAt: -1 }).limit(100).toArray();

  return res.json({
    items: docs.map((d) => ({
      id: d._id.toString(),
      hostId: d.hostId,
      authorId: d.authorId,
      ratings: d.ratings,
      text: d.text ?? null,
      createdAt: d.createdAt,
    })),
  });
});

const CreateRecSchema = z.object({
  ratings: z.object({
    overall: z.number().int().min(1).max(5),
    trust: z.number().int().min(1).max(5),
    accuracy: z.number().int().min(1).max(5),
    experience: z.number().int().min(1).max(5),
  }),
  text: z.string().max(500).optional(),
});

hostsRouter.post("/hosts/:hostId/recommendations", requireAuth, async (req, res) => {
  const hostId = req.params.hostId;
  const u = req.user!;
  if (hostId === u.uid) return res.status(400).json({ error: "Cannot recommend yourself" });

  const body = CreateRecSchema.parse(req.body);

  const col = await getCollection<RecommendationDoc>("recommendations");

  // enforce one recommendation per (host, author)
  const existing = await col.findOne({ hostId, authorId: u.uid });
  if (existing) return res.status(409).json({ error: "Already recommended this host" });

  const doc: Omit<RecommendationDoc, "_id"> = {
    hostId,
    authorId: u.uid,
    ratings: body.ratings,
    text: body.text,
    hidden: false,
    createdAt: new Date(),
  };

  const ins = await col.insertOne(doc as any);

  // update host stats (on write)
  const stats = await recomputeHostStats(hostId);

  return res.status(201).json({ id: ins.insertedId.toString(), hostStats: stats });
});
