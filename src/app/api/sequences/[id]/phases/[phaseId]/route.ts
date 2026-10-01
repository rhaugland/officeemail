import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { phases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const { phaseId } = await params;
  const { subject, body, delayDays } = await request.json();

  const updates: Record<string, unknown> = {};
  if (subject !== undefined) updates.subject = subject;
  if (body !== undefined) updates.body = body;
  if (delayDays !== undefined) updates.delayDays = delayDays;

  const [updated] = await getDb()
    .update(phases)
    .set(updates)
    .where(eq(phases.id, phaseId))
    .returning();

  return NextResponse.json(updated);
}
