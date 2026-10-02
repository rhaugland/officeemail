import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { contactId } = await request.json();

  await getDb()
    .update(contacts)
    .set({ lastReadAt: new Date() })
    .where(eq(contacts.id, contactId));

  return NextResponse.json({ ok: true });
}
