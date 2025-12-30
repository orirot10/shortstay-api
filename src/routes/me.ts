import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getCollection } from "../db/mongo";

type UserDoc = {
  _id: string; // firebase uid
  email?: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  hostStats?: any;
};

export const meRouter = Router();

meRouter.get("/me", requireAuth, async (req, res) => {
  const u = req.user!;
  const usersCol = await getCollection<UserDoc>("users");

  // Bootstrap user in Mongo if missing
  const now = new Date();
  await usersCol.updateOne(
    { _id: u.uid },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        updatedAt: now,
        email: u.email,
        name: u.name,
        avatarUrl: u.picture,
      },
    },
    { upsert: true }
  );

  const userDoc = await usersCol.findOne({ _id: u.uid }, { projection: { email: 1, name: 1, avatarUrl: 1, hostStats: 1, createdAt: 1 } });

  return res.json({
    user: {
      id: u.uid,
      email: userDoc?.email ?? u.email,
      name: userDoc?.name ?? u.name,
      avatarUrl: userDoc?.avatarUrl ?? u.picture,
      hostStats: userDoc?.hostStats ?? { hostScore: 0, avgRating: 0, recsCount: 0 },
      createdAt: userDoc?.createdAt,
    },
  });
});
