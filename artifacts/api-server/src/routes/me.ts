import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { GetMeResponse, UpdateMeBody, UpdateMeResponse } from "@workspace/api-zod";
import { authenticatedUserId } from "../lib/auth";
import { ensureProfile, getPublicProfile } from "../lib/marketplace";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  await ensureProfile(userId);
  res.json(GetMeResponse.parse(await getPublicProfile(userId)));
});

router.put("/me", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Indique um nome com pelo menos 2 caracteres." });
    return;
  }

  await db
    .insert(profilesTable)
    .values({ userId, displayName: parsed.data.displayName.trim() })
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: { displayName: parsed.data.displayName.trim(), updatedAt: new Date() },
    });

  res.json(UpdateMeResponse.parse(await getPublicProfile(userId)));
});

export default router;
