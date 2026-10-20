import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

export function authenticatedUserId(req: Request, res: Response): string | null {
  const userId = getAuth(req).userId;
  if (userId) return userId;

  res.status(401).json({ error: "Inicie sessão para continuar." });
  return null;
}
