import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, applicationsTable, jobsTable, messagesTable, profilesTable } from "@workspace/db";
import {
  ListApplicationMessagesParams,
  ListApplicationMessagesResponse,
  SendApplicationMessageBody,
  SendApplicationMessageParams,
  SendApplicationMessageResponse,
} from "@workspace/api-zod";
import { authenticatedUserId } from "../lib/auth";

const router: IRouter = Router();

async function findConversation(applicationId: number) {
  const [application] = await db
    .select({
      id: applicationsTable.id,
      applicantId: applicationsTable.applicantId,
      ownerId: jobsTable.ownerId,
    })
    .from(applicationsTable)
    .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .where(eq(applicationsTable.id, applicationId))
    .limit(1);
  return application;
}

router.get("/applications/:applicationId/messages", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = ListApplicationMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "A conversa indicada não é válida." });
    return;
  }

  const conversation = await findConversation(params.data.applicationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }
  if (conversation.applicantId !== userId && conversation.ownerId !== userId) {
    res.status(403).json({ error: "Esta conversa é privada." });
    return;
  }

  const messages = await db
    .select({
      id: messagesTable.id,
      applicationId: messagesTable.applicationId,
      senderId: messagesTable.senderId,
      senderName: profilesTable.displayName,
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .leftJoin(profilesTable, eq(messagesTable.senderId, profilesTable.userId))
    .where(eq(messagesTable.applicationId, params.data.applicationId))
    .orderBy(asc(messagesTable.createdAt));
  res.json(ListApplicationMessagesResponse.parse(messages));
});

router.post("/applications/:applicationId/messages", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const params = SendApplicationMessageParams.safeParse(req.params);
  const parsed = SendApplicationMessageBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "A mensagem não pode estar vazia e tem um limite de 2 000 caracteres." });
    return;
  }

  const conversation = await findConversation(params.data.applicationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }
  if (conversation.applicantId !== userId && conversation.ownerId !== userId) {
    res.status(403).json({ error: "Só os participantes podem enviar mensagens nesta conversa." });
    return;
  }

  const [message] = await db.insert(messagesTable).values({
    applicationId: params.data.applicationId,
    senderId: userId,
    content: parsed.data.content.trim(),
  }).returning();
  const [profile] = await db.select({ displayName: profilesTable.displayName })
    .from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  res.status(201).json(SendApplicationMessageResponse.parse({
    ...message,
    senderName: profile?.displayName ?? null,
  }));
});

export default router;
