import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const payload = await request.json();

  // Resend sends different event types — we care about inbound emails
  // This handles the "email.received" webhook for inbound replies
  if (payload.type === "email.received") {
    const data = payload.data;
    const fromEmail = data.from?.toLowerCase();
    const subject = data.subject || "(no subject)";
    const body = data.text || data.html || "";

    if (!fromEmail) {
      return NextResponse.json({ ok: true, skipped: "no from" });
    }

    // Find the contact by email
    const [contact] = await getDb()
      .select()
      .from(contacts)
      .where(eq(contacts.email, fromEmail))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ ok: true, skipped: "unknown sender" });
    }

    // Store the inbound message
    await getDb().insert(messages).values({
      contactId: contact.id,
      direction: "inbound",
      subject,
      body,
    });

    // Mark contact as replied
    if (contact.status !== "replied" && contact.status !== "opted_out") {
      await getDb()
        .update(contacts)
        .set({ status: "replied", repliedAt: new Date(), updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));
    }

    return NextResponse.json({ ok: true, stored: true });
  }

  return NextResponse.json({ ok: true, ignored: payload.type });
}
