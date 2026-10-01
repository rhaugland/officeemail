import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  const payload = await request.json();

  if (payload.type === "email.received") {
    const data = payload.data;
    const fromEmail = data.from?.toLowerCase();
    const emailId = data.email_id;
    const subject = data.subject || "(no subject)";

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

    // Fetch full email body from Resend API
    let body = "";
    if (emailId) {
      try {
        const full = await getResend().emails.receiving.get(emailId);
        if (full.data) {
          body = full.data.text || full.data.html || "";
        }
      } catch {
        // If fetch fails, store what we have
      }
    }

    await getDb().insert(messages).values({
      contactId: contact.id,
      direction: "inbound",
      subject,
      body: body || "(email body unavailable)",
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
