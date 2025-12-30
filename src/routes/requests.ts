import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getCollection } from "../db/mongo";

type RequestStatus = "ACTIVE" | "CLOSED";

type RentalRequestDoc = {
  _id: ObjectId;
  authorId: string;
  area: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  budgetMax?: number | null;
  text: string;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
};

export const requestsRouter = Router();

const CreateRequestSchema = z.object({
  area: z.string().min(2).max(80),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  budgetMax: z.number().int().min(0).max(1_000_000).optional(),
  text: z.string().min(5).max(2000),
});

requestsRouter.get("/requests", async (req, res) => {
  const area = (req.query.area as string | undefined)?.trim();
  const q: any = { status: "ACTIVE" };
  if (area) q.area = area;

  const col = await getCollection<RentalRequestDoc>("rentalRequests");
  const docs = await col.find(q).sort({ createdAt: -1 }).limit(100).toArray();

  return res.json({
    items: docs.map((d) => ({
      id: d._id.toString(),
      authorId: d.authorId,
      area: d.area,
      dateFrom: d.dateFrom ?? null,
      dateTo: d.dateTo ?? null,
      budgetMax: d.budgetMax ?? null,
      text: d.text,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
});

requestsRouter.get("/requests/mine", requireAuth, async (req, res) => {
  const u = req.user!;
  const col = await getCollection<RentalRequestDoc>("rentalRequests");
  const docs = await col.find({ authorId: u.uid }).sort({ createdAt: -1 }).limit(100).toArray();

  return res.json({
    items: docs.map((d) => ({
      id: d._id.toString(),
      area: d.area,
      dateFrom: d.dateFrom ?? null,
      dateTo: d.dateTo ?? null,
      budgetMax: d.budgetMax ?? null,
      text: d.text,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
});

requestsRouter.post("/requests", requireAuth, async (req, res) => {
  const u = req.user!;
  const body = CreateRequestSchema.parse(req.body);

  const now = new Date();
  const doc: Omit<RentalRequestDoc, "_id"> = {
    authorId: u.uid,
    area: body.area,
    dateFrom: body.dateFrom ? new Date(body.dateFrom) : null,
    dateTo: body.dateTo ? new Date(body.dateTo) : null,
    budgetMax: body.budgetMax ?? null,
    text: body.text,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  const col = await getCollection<RentalRequestDoc>("rentalRequests");
  const ins = await col.insertOne(doc as any);

  return res.status(201).json({ id: ins.insertedId.toString() });
});
