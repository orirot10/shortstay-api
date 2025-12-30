import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getCollection } from "../db/mongo";

type ListingStatus = "ACTIVE" | "INACTIVE";

type ListingDoc = {
  _id: ObjectId;
  ownerId: string;
  title: string;
  area: string;
  pricePerNight: number;
  description: string;
  availabilityText?: string;
  status: ListingStatus;
  images: { storagePath: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export const listingsRouter = Router();

const CreateListingSchema = z.object({
  title: z.string().min(3).max(80),
  area: z.string().min(2).max(80),
  pricePerNight: z.number().int().min(0).max(1_000_000),
  description: z.string().min(10).max(5000),
  availabilityText: z.string().max(500).optional(),
  images: z.array(z.object({ storagePath: z.string().min(3).max(300) })).optional(),
});

listingsRouter.get("/listings", async (req, res) => {
  const area = (req.query.area as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.toUpperCase() as ListingStatus | undefined;
  const priceMax = req.query.priceMax ? Number(req.query.priceMax) : undefined;

  const q: any = {};
  if (area) q.area = area;
  if (status) q.status = status;
  else q.status = "ACTIVE";
  if (Number.isFinite(priceMax)) q.pricePerNight = { $lte: priceMax };

  const col = await getCollection<ListingDoc>("listings");
  const docs = await col
    .find(q)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return res.json({
    items: docs.map((d) => ({
      id: d._id.toString(),
      ownerId: d.ownerId,
      title: d.title,
      area: d.area,
      pricePerNight: d.pricePerNight,
      description: d.description,
      availabilityText: d.availabilityText,
      status: d.status,
      images: d.images ?? [],
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
});

listingsRouter.get("/listings/:id", async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });

  const col = await getCollection<ListingDoc>("listings");
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return res.status(404).json({ error: "Not found" });

  return res.json({
    item: {
      id: doc._id.toString(),
      ownerId: doc.ownerId,
      title: doc.title,
      area: doc.area,
      pricePerNight: doc.pricePerNight,
      description: doc.description,
      availabilityText: doc.availabilityText,
      status: doc.status,
      images: doc.images ?? [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  });
});

listingsRouter.post("/listings", requireAuth, async (req, res) => {
  const u = req.user!;
  const body = CreateListingSchema.parse(req.body);

  const now = new Date();
  const doc: Omit<ListingDoc, "_id"> = {
    ownerId: u.uid,
    title: body.title,
    area: body.area,
    pricePerNight: body.pricePerNight,
    description: body.description,
    availabilityText: body.availabilityText,
    status: "ACTIVE",
    images: body.images ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const col = await getCollection<ListingDoc>("listings");
  const result = await col.insertOne(doc as any);

  return res.status(201).json({ id: result.insertedId.toString() });
});
