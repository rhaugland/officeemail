import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sequences, phases, sends, contacts } from "@/lib/db/schema";
import { eq, sql, and, notInArray, inArray } from "drizzle-orm";

export async function GET() {
  const allSequences = await getDb().select().from(sequences).orderBy(sequences.createdAt);

  const result = [];
  for (const seq of allSequences) {
    const seqPhases = await getDb()
      .select()
      .from(phases)
      .where(eq(phases.sequenceId, seq.id))
      .orderBy(phases.phaseNumber);

    const phasesWithStats = [];
    for (const phase of seqPhases) {
      const [stats] = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(sends)
        .where(eq(sends.phaseId, phase.id));

      // Count eligible contacts (approved/enrolled, not already sent this phase)
      const alreadySent = await getDb()
        .select({ contactId: sends.contactId })
        .from(sends)
        .where(eq(sends.phaseId, phase.id));

      const alreadySentIds = alreadySent.map((s) => s.contactId);

      const [eligibleStats] = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(
          and(
            inArray(contacts.status, ["approved", "enrolled"]),
            alreadySentIds.length > 0
              ? notInArray(contacts.id, alreadySentIds)
              : undefined
          )
        );

      phasesWithStats.push({
        ...phase,
        sentCount: Number(stats?.count || 0),
        eligibleCount: Math.min(Number(eligibleStats?.count || 0), seq.dailyLimit),
      });
    }

    result.push({ ...seq, phases: phasesWithStats });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { name, dailyLimit = 50 } = await request.json();

  const [seq] = await getDb()
    .insert(sequences)
    .values({ name, dailyLimit })
    .returning();

  return NextResponse.json(seq);
}
