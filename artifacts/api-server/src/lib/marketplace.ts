import { avg, count, eq } from "drizzle-orm";
import { db, profilesTable, ratingsTable } from "@workspace/db";

export async function ensureProfile(userId: string): Promise<void> {
  await db.insert(profilesTable).values({ userId }).onConflictDoNothing();
}

export async function getPublicProfile(userId: string) {
  const [profile] = await db
    .select({
      displayName: profilesTable.displayName,
    })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const [rating] = await db
    .select({
      ratingAverage: avg(ratingsTable.score),
      ratingCount: count(ratingsTable.id),
    })
    .from(ratingsTable)
    .where(eq(ratingsTable.subjectId, userId));

  return {
    displayName: profile?.displayName ?? null,
    ratingAverage: rating?.ratingCount ? Number(rating.ratingAverage) : null,
    ratingCount: Number(rating?.ratingCount ?? 0),
  };
}
