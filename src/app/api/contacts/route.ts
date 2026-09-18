import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, sql, and, ne } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");

  const where = status
    ? eq(contacts.status, status as "new" | "approved" | "rejected" | "enrolled" | "replied" | "opted_out")
    : undefined;

  const rows = await getDb()
    .select()
    .from(contacts)
    .where(where)
    .orderBy(contacts.createdAt);

  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "enrolled") updates.enrolledAt = new Date();
  if (status === "replied") updates.repliedAt = new Date();
  if (status === "opted_out") updates.optedOutAt = new Date();

  const [updated] = await getDb()
    .update(contacts)
    .set(updates)
    .where(eq(contacts.id, id))
    .returning();

  return NextResponse.json(updated);
}
