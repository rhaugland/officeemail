import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts, sends } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function parseDemoQuestion(body: string): { name: string; email: string; message: string } | null {
  // Body format: "NEW QUESTION FROM THE DEMO\nName <email>\nMessage"
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => l.toUpperCase().includes("NEW QUESTION FROM THE DEMO"));
  if (headerIdx === -1) return null;

  // Look for "Name <email>" pattern in remaining lines
  const remaining = lines.slice(headerIdx + 1);
  const emailMatch = remaining.join("\n").match(/([^<\n]+?)\s*<([^>]+@[^>]+)>/);
  if (!emailMatch) return null;

  const name = emailMatch[1].trim();
  const email = emailMatch[2].trim().toLowerCase();
  // Message is everything after the name/email line
  const emailLineIdx = remaining.findIndex((l) => l.includes(emailMatch[0]));
  const message = remaining.slice(emailLineIdx + 1).join("\n").trim();

  return { name, email, message };
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

    // Check if this is a demo support form submission
    const demoQuestion = parseDemoQuestion(body);
    const isDemoForm = fromEmail.includes("team@officecast.co") || !!demoQuestion;

    if (isDemoForm && demoQuestion) {
      // Find or create contact by the actual sender's email
      let [contact] = await getDb()
        .select()
        .from(contacts)
        .where(eq(contacts.email, demoQuestion.email))
        .limit(1);

      if (!contact) {
        const nameParts = demoQuestion.name.split(" ");
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || "Unknown";

        const [newContact] = await getDb()
          .insert(contacts)
          .values({
            firstName,
            lastName,
            email: demoQuestion.email,
            title: "Demo Inquiry",
            companyName: "Via Working Demo",
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
        subject: "Demo Question",
        body: demoQuestion.message || body,
      });

      if (contact.status !== "replied" && contact.status !== "opted_out") {
        await getDb()
          .update(contacts)
          .set({ status: "replied", repliedAt: new Date(), updatedAt: new Date() })
          .where(eq(contacts.id, contact.id));
      }

      return NextResponse.json({ ok: true, stored: true, demo: true });
    }

    // Regular inbound email — find contact by from or reply-to
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

    if (!contact) {
      const senderEmail = replyTo || fromEmail;
      const namePart = senderEmail.split("@")[0].replace(/[._-]/g, " ");
      const parts = namePart.split(" ");
      const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Unknown";
      const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Unknown";

      const [newContact] = await getDb()
        .insert(contacts)
        .values({
          firstName,
          lastName,
          email: senderEmail,
          title: "",
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

    if (contact.status !== "replied" && contact.status !== "opted_out") {
      await getDb()
        .update(contacts)
        .set({ status: "replied", repliedAt: new Date(), updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));
    }

    return NextResponse.json({ ok: true, stored: true });
  }

  if (payload.type === "email.opened") {
    const resendId = payload.data?.email_id;
    if (resendId) {
      // Find the contact via the sends table
      const [send] = await getDb()
        .select({ contactId: sends.contactId })
        .from(sends)
        .where(eq(sends.resendId, resendId))
        .limit(1);

      if (send) {
        await getDb()
          .update(contacts)
          .set({
            openCount: sql`${contacts.openCount} + 1`,
            lastOpenedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, send.contactId));

        return NextResponse.json({ ok: true, tracked: true });
      }
    }
    return NextResponse.json({ ok: true, skipped: "no matching send" });
  }

  return NextResponse.json({ ok: true, ignored: payload.type });
}
