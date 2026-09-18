import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { phases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const { phaseId } = await params;
  const { subject, body } = await request.json();

  const [updated] = await getDb()
    .update(phases)
    .set({ subject, body })
    .where(eq(phases.id, phaseId))
    .returning();

  return NextResponse.json(updated);
}
