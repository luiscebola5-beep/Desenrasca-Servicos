import { Router, type IRouter } from "express";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, applicationsTable, jobsTable, messagesTable, profilesTable } from "@workspace/db";
import {
  ApplyToJobBody,
  ApplyToJobParams,
  ApplyToJobResponse,
  ListJobApplicationsParams,
  ListJobApplicationsResponse,
  ListMyApplicationsResponse,
  UpdateApplicationStatusBody,
  UpdateApplicationStatusParams,
  UpdateApplicationStatusResponse,
} from "@workspace/api-zod";
import { authenticatedUserId } from "../lib/auth";
import { ensureProfile } from "../lib/marketplace";

const router: IRouter = Router();

router.get("/jobs/:jobId/applications", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = ListJobApplicationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "O pedido indicado não é válido." });
    return;
  }

  const [job] = await db.select({ id: jobsTable.id, ownerId: jobsTable.ownerId })
    .from(jobsTable).where(eq(jobsTable.id, params.data.jobId)).limit(1);
  if (!job) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  if (job.ownerId !== userId) {
    res.status(403).json({ error: "Só o autor do pedido pode consultar as candidaturas." });
    return;
  }

  const applications = await db
    .select({
      id: applicationsTable.id,
      jobId: applicationsTable.jobId,
      jobTitle: jobsTable.title,
      applicantId: applicationsTable.applicantId,
      applicantName: profilesTable.displayName,
      message: applicationsTable.message,
      status: applicationsTable.status,
      createdAt: applicationsTable.createdAt,
    })
    .from(applicationsTable)
    .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .leftJoin(profilesTable, eq(applicationsTable.applicantId, profilesTable.userId))
    .where(eq(applicationsTable.jobId, params.data.jobId))
    .orderBy(desc(applicationsTable.createdAt));
  res.json(ListJobApplicationsResponse.parse(applications));
});

router.post("/jobs/:jobId/applications", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = ApplyToJobParams.safeParse(req.params);
  const parsed = ApplyToJobBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Escreva uma mensagem de candidatura com pelo menos 10 caracteres." });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.jobId)).limit(1);
  if (!job || job.status !== "open") {
    res.status(404).json({ error: "Este pedido já não está disponível." });
    return;
  }
  if (job.ownerId === userId) {
    res.status(400).json({ error: "Não pode candidatar-se ao seu próprio pedido." });
    return;
  }

  await ensureProfile(userId);
  const result = await db.transaction(async (tx) => {
    const [application] = await tx
      .insert(applicationsTable)
      .values({ jobId: job.id, applicantId: userId, message: parsed.data.message.trim() })
      .onConflictDoNothing()
      .returning();
    if (!application) return null;

    await tx.insert(messagesTable).values({
      applicationId: application.id,
      senderId: userId,
      content: parsed.data.message.trim(),
    });
    return application;
  });

  if (!result) {
    res.status(409).json({ error: "Já se candidatou a este pedido." });
    return;
  }

  const [profile] = await db.select({ displayName: profilesTable.displayName })
    .from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  res.status(201).json(ApplyToJobResponse.parse({
    id: result.id,
    jobId: result.jobId,
    jobTitle: job.title,
    applicantId: result.applicantId,
    applicantName: profile?.displayName ?? null,
    message: result.message,
    status: result.status,
    createdAt: result.createdAt,
  }));
});

router.get("/applications", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const applications = await db
    .select({
      id: applicationsTable.id,
      jobId: applicationsTable.jobId,
      jobTitle: jobsTable.title,
      applicantId: applicationsTable.applicantId,
      applicantName: profilesTable.displayName,
      message: applicationsTable.message,
      status: applicationsTable.status,
      createdAt: applicationsTable.createdAt,
    })
    .from(applicationsTable)
    .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .leftJoin(profilesTable, eq(applicationsTable.applicantId, profilesTable.userId))
    .where(eq(applicationsTable.applicantId, userId))
    .orderBy(desc(applicationsTable.createdAt));
  res.json(ListMyApplicationsResponse.parse(applications));
});

router.patch("/applications/:applicationId/status", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = UpdateApplicationStatusParams.safeParse(req.params);
  const parsed = UpdateApplicationStatusBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "O estado indicado não é válido." });
    return;
  }

  const [existing] = await db
    .select({
      id: applicationsTable.id,
      jobId: applicationsTable.jobId,
      jobTitle: jobsTable.title,
      ownerId: jobsTable.ownerId,
      applicantId: applicationsTable.applicantId,
      applicantName: profilesTable.displayName,
      message: applicationsTable.message,
      status: applicationsTable.status,
      createdAt: applicationsTable.createdAt,
    })
    .from(applicationsTable)
    .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .leftJoin(profilesTable, eq(applicationsTable.applicantId, profilesTable.userId))
    .where(eq(applicationsTable.id, params.data.applicationId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Candidatura não encontrada." });
    return;
  }
  if (existing.ownerId !== userId) {
    res.status(403).json({ error: "Só o autor do pedido pode alterar esta candidatura." });
    return;
  }

  if (parsed.data.status === "accepted") {
    const [accepted] = await db.select({ id: applicationsTable.id })
      .from(applicationsTable)
      .where(and(
        eq(applicationsTable.jobId, existing.jobId),
        eq(applicationsTable.status, "accepted"),
        ne(applicationsTable.id, existing.id),
      ))
      .limit(1);
    if (accepted) {
      res.status(409).json({ error: "Já aceitou outra candidatura para este pedido." });
      return;
    }
  }

  const [updated] = await db.update(applicationsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(applicationsTable.id, existing.id))
    .returning();
  if (parsed.data.status === "accepted") {
    await db.update(jobsTable).set({ status: "closed", updatedAt: new Date() })
      .where(eq(jobsTable.id, existing.jobId));
  }

  res.json(UpdateApplicationStatusResponse.parse({
    id: updated.id,
    jobId: existing.jobId,
    jobTitle: existing.jobTitle,
    applicantId: existing.applicantId,
    applicantName: existing.applicantName,
    message: existing.message,
    status: updated.status,
    createdAt: updated.createdAt,
  }));
});

export default router;
