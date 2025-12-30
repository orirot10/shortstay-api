import { ObjectId } from "mongodb";
import { getCollection } from "../db/mongo";

type RecommendationDoc = {
  _id: ObjectId;
  hostId: string;
  authorId: string;
  ratings: { overall: number; trust: number; accuracy: number; experience: number };
  text?: string;
  hidden: boolean;
  createdAt: Date;
};

type UserDoc = {
  _id: string; // firebase uid
  hostStats?: {
    hostScore: number;
    avgRating: number;
    recsCount: number;
    updatedAt: Date;
  };
};

function clampInt(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export async function recomputeHostStats(hostId: string) {
  const recsCol = await getCollection<RecommendationDoc>("recommendations");
  const usersCol = await getCollection<UserDoc>("users");

  const recs = await recsCol
    .find({ hostId, hidden: false })
    .project({ ratings: 1 })
    .toArray();

  const recsCount = recs.length;
  const avgRating =
    recsCount === 0
      ? 0
      : recs.reduce((s, r) => s + (r.ratings?.overall ?? 0), 0) / recsCount;

  // MVP hostScore: mostly avg rating + small boost for more reviews (bounded)
  // hostScore stays within [0, 5]
  const boost = clampInt(recsCount, 0, 20) * 0.03; // up to +0.60
  const hostScore = Math.max(0, Math.min(5, avgRating + boost));

  await usersCol.updateOne(
    { _id: hostId },
    {
      $set: {
        "hostStats.hostScore": hostScore,
        "hostStats.avgRating": avgRating,
        "hostStats.recsCount": recsCount,
        "hostStats.updatedAt": new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return { hostScore, avgRating, recsCount };
}
