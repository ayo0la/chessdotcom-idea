import type { Request, Response, NextFunction } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db.js";

declare module "express-serve-static-core" {
  interface Request {
    authId?: string;
    userId?: string;
  }
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const supa = supabase();
  if (!token || !supa) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.authId = data.user.id;
  next();
}

export async function requireLinkedUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = await db.user.findUnique({ where: { authId: req.authId! } });
  if (!user) {
    res.status(403).json({ error: "No linked Chess.com account" });
    return;
  }
  req.userId = user.id;
  next();
}
