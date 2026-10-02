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
    const replyTo = data.reply_to?.toLowerCase();
    const emailId = data.email_id;
    const subject = data.subject || "(no subject)";

    if (!fromEmail) {
      return NextResponse.json({ ok: true, skipped: "no from" });
    }

    // Try to find contact by from email, then by reply-to
    let [contact] = await getDb()
      .select()
      .from(contacts)
      .where(eq(contacts.email, fromEmail))
      .limit(1);

    if (!contact && replyTo) {
      [contact] = await getDb()
        .select()
        .from(contacts)
        .where(eq(contacts.email, replyTo))
        .limit(1);
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

    if (!contact) {
      // Unknown sender (e.g. demo support form) — create a contact from reply-to or from
      const senderEmail = replyTo || fromEmail;
      // Try to parse name from the body or use email prefix
      const namePart = senderEmail.split("@")[0].replace(/[._-]/g, " ");
      const parts = namePart.split(" ");
      const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Unknown";
      const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "";

      const [newContact] = await getDb()
        .insert(contacts)
        .values({
          firstName,
          lastName: lastName || "Unknown",
          email: senderEmail,
          title: "Demo Inquiry",
          companyName: "Unknown",
          companySize: null,
          companyLocation: null,
          industry: null,
          status: "replied",
          repliedAt: new Date(),
        })
        .returning();

      contact = newContact;
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
