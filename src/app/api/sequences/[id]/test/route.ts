import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { phases, contacts, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { htmlToText } from "@/lib/html-to-text";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { phaseId, email } = await request.json();

  if (!email || !phaseId) {
    return NextResponse.json({ error: "email and phaseId required" }, { status: 400 });
  }

  const [phase] = await getDb()
    .select()
    .from(phases)
    .where(eq(phases.id, phaseId));

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  // Check if the test email belongs to an existing contact
  const [contact] = await getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.email, email))
    .limit(1);

  const firstName = contact?.firstName || "Test";
  const lastName = contact?.lastName || "User";
  const company = contact?.companyName || "Acme Corp";
  const title = contact?.title || "CHRO";

  const subject = phase.subject
    .replace(/{{first_name}}/g, firstName)
    .replace(/{{last_name}}/g, lastName)
    .replace(/{{company}}/g, company)
    .replace(/{{title}}/g, title);

  const body = htmlToText(
    phase.body
      .replace(/{{first_name}}/g, firstName)
      .replace(/{{last_name}}/g, lastName)
      .replace(/{{company}}/g, company)
      .replace(/{{title}}/g, title)
  );

  try {
    const result = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
      to: email,
      subject: `[TEST] ${subject}`,
      text: body,
    });

    // Log to messages if the recipient is an existing contact
    if (contact) {
      await getDb().insert(messages).values({
        contactId: contact.id,
        direction: "outbound",
        subject: `[TEST] ${subject}`,
        body,
        resendId: result.data?.id || null,
      });
    }

    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }
}
