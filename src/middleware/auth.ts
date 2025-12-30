import { Request, Response, NextFunction } from "express";
import { verifyFirebaseIdToken } from "../auth/firebase";

export type AuthedUser = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const hdr = req.header("Authorization") ?? "";
    console.debug("[auth] Authorization header present:", !!hdr);
    const match = hdr.match(/^Bearer (.+)$/);
    if (!match) {
      console.warn("[auth] Missing or malformed Authorization header", { header: hdr });
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    // show masked token prefix for debugging (do NOT log full tokens in production)
    const tokenPreview = match[1].slice(0, 10) + "...";
    console.debug("[auth] verifying token (preview):", tokenPreview);

    const decoded = await verifyFirebaseIdToken(match[1]);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: (decoded as any).picture,
    };
    return next();
  } catch (err: any) {
    console.error("[auth] requireAuth error:", { message: err?.message, code: err?.code });
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}
