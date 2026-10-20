import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { db, applicationsTable, jobsTable, profilesTable } from "@workspace/db";
import {
  CreateJobBody,
  CreateJobResponse,
  DeleteJobParams,
  GetJobParams,
  GetJobResponse,
  ListJobsQueryParams,
  ListJobsResponse,
  ListMyJobsResponse,
  UpdateJobBody,
  UpdateJobParams,
  UpdateJobResponse,
  GetStatsResponse,
} from "@workspace/api-zod";
import { authenticatedUserId } from "../lib/auth";
import { ensureProfile } from "../lib/marketplace";

const router: IRouter = Router();

function jobProjection() {
  return {
    id: jobsTable.id,
    title: jobsTable.title,
    description: jobsTable.description,
    category: jobsTable.category,
    location: jobsTable.location,
    budget: jobsTable.budget,
    scheduledDate: jobsTable.scheduledDate,
    status: jobsTable.status,
    ownerId: jobsTable.ownerId,
    ownerName: profilesTable.displayName,
    createdAt: jobsTable.createdAt,
    applicationCount: sql<number>`count(${applicationsTable.id})::int`,
  };
}

async function findJob(id: number) {
  const [job] = await db
    .select(jobProjection())
    .from(jobsTable)
    .leftJoin(profilesTable, eq(jobsTable.ownerId, profilesTable.userId))
    .leftJoin(applicationsTable, eq(jobsTable.id, applicationsTable.jobId))
    .where(eq(jobsTable.id, id))
    .groupBy(jobsTable.id, profilesTable.displayName)
    .limit(1);
  return job;
}

router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Os filtros da pesquisa não são válidos." });
    return;
  }

  const filters = [eq(jobsTable.status, "open")];
  const { q, category, location, maxBudget } = parsed.data;
  const search = q?.trim();
  if (search) {
    filters.push(or(ilike(jobsTable.title, `%${search}%`), ilike(jobsTable.description, `%${search}%`))!);
  }
  if (category) filters.push(eq(jobsTable.category, category));
  if (location?.trim()) filters.push(ilike(jobsTable.location, `%${location.trim()}%`));
  if (maxBudget != null) filters.push(lte(jobsTable.budget, maxBudget));

  const rows = await db
    .select(jobProjection())
    .from(jobsTable)
    .leftJoin(profilesTable, eq(jobsTable.ownerId, profilesTable.userId))
    .leftJoin(applicationsTable, eq(jobsTable.id, applicationsTable.jobId))
    .where(and(...filters))
    .groupBy(jobsTable.id, profilesTable.displayName)
    .orderBy(desc(jobsTable.createdAt))
    .limit(50);
  res.json(ListJobsResponse.parse(rows));
});

router.get("/jobs/:jobId", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "O pedido indicado não é válido." });
    return;
  }
  const job = await findJob(params.data.jobId);
  if (!job) {
    res.status(404).json({ error: "Este pedido já não está disponível." });
    return;
  }
  res.json(GetJobResponse.parse(job));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Verifique o título, a descrição, a categoria, a localidade e o orçamento." });
    return;
  }

  await ensureProfile(userId);
  const [created] = await db
    .insert(jobsTable)
    .values({
      ...parsed.data,
      ownerId: userId,
      scheduledDate: parsed.data.scheduledDate?.toISOString().slice(0, 10) ?? null,
    })
    .returning({ id: jobsTable.id });
  const job = await findJob(created.id);
  res.status(201).json(CreateJobResponse.parse(job));
});

router.patch("/jobs/:jobId", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = UpdateJobParams.safeParse(req.params);
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: "Indique pelo menos um campo válido para atualizar." });
    return;
  }

  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.jobId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  if (existing.ownerId !== userId) {
    res.status(403).json({ error: "Só pode editar os seus próprios pedidos." });
    return;
  }

  const { scheduledDate, ...fields } = parsed.data;
  const update = {
    ...fields,
    ...(scheduledDate !== undefined
      ? { scheduledDate: scheduledDate?.toISOString().slice(0, 10) ?? null }
      : {}),
    updatedAt: new Date(),
  };
  await db
    .update(jobsTable)
    .set(update)
    .where(and(eq(jobsTable.id, params.data.jobId), eq(jobsTable.ownerId, userId)));

  res.json(UpdateJobResponse.parse(await findJob(params.data.jobId)));
});

router.delete("/jobs/:jobId", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "O pedido indicado não é válido." });
    return;
  }

  const [existing] = await db.select({ ownerId: jobsTable.ownerId }).from(jobsTable)
    .where(eq(jobsTable.id, params.data.jobId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  if (existing.ownerId !== userId) {
    res.status(403).json({ error: "Só pode eliminar os seus próprios pedidos." });
    return;
  }

  await db.delete(jobsTable).where(and(eq(jobsTable.id, params.data.jobId), eq(jobsTable.ownerId, userId)));
  res.sendStatus(204);
});

router.get("/my/jobs", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const rows = await db
    .select(jobProjection())
    .from(jobsTable)
    .leftJoin(profilesTable, eq(jobsTable.ownerId, profilesTable.userId))
    .leftJoin(applicationsTable, eq(jobsTable.id, applicationsTable.jobId))
    .where(eq(jobsTable.ownerId, userId))
    .groupBy(jobsTable.id, profilesTable.displayName)
    .orderBy(desc(jobsTable.createdAt));
  res.json(ListMyJobsResponse.parse(rows));
});

router.get("/stats", async (_req, res): Promise<void> => {
  const [openJobs] = await db
    .select({ value: count() })
    .from(jobsTable)
    .where(eq(jobsTable.status, "open"));
  const [workers] = await db
    .select({ value: sql<number>`count(distinct ${applicationsTable.applicantId})::int` })
    .from(applicationsTable);
  res.json(GetStatsResponse.parse({ openJobs: openJobs.value, workers: workers.value }));
});

export default router;
