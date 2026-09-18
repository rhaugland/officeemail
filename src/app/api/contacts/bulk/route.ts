import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export async function PATCH(request: Request) {
  const { ids, status } = await request.json();

  if (!ids?.length || !status) {
    return NextResponse.json({ error: "ids and status required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "enrolled") updates.enrolledAt = new Date();
  if (status === "replied") updates.repliedAt = new Date();
  if (status === "opted_out") updates.optedOutAt = new Date();

  const updated = await getDb()
    .update(contacts)
    .set(updates)
    .where(inArray(contacts.id, ids))
    .returning();

  return NextResponse.json({ updated: updated.length });
}
