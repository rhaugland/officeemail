import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts, phases, sends, sequences } from "@/lib/db/schema";
import { eq, and, notInArray, inArray, sql } from "drizzle-orm";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sequenceId } = await params;
  const { phaseId } = await request.json();

  const [sequence] = await getDb()
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId));

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  const [phase] = await getDb()
    .select()
    .from(phases)
    .where(eq(phases.id, phaseId));

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  // Get contacts already sent this phase
  const alreadySent = await getDb()
    .select({ contactId: sends.contactId })
    .from(sends)
    .where(eq(sends.phaseId, phaseId));

  const alreadySentIds = alreadySent.map((s) => s.contactId);

  // Get eligible contacts: approved/enrolled, not opted_out, not replied
  const eligible = await getDb()
    .select()
    .from(contacts)
    .where(
      and(
        inArray(contacts.status, ["approved", "enrolled"]),
        alreadySentIds.length > 0
          ? notInArray(contacts.id, alreadySentIds)
          : undefined
      )
    )
    .limit(sequence.dailyLimit);

  let sent = 0;
  const errors: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const contact of eligible) {
    const personalizedBody = phase.body
      .replace(/{{first_name}}/g, contact.firstName)
      .replace(/{{last_name}}/g, contact.lastName)
      .replace(/{{company}}/g, contact.companyName)
      .replace(/{{title}}/g, contact.title);

    const optOutUrl = `${appUrl}/api/opt-out?id=${contact.id}`;

    try {
      const result = await getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
        to: contact.email,
        subject: phase.subject
          .replace(/{{first_name}}/g, contact.firstName)
          .replace(/{{company}}/g, contact.companyName),
        html: `${personalizedBody}<br/><br/><p style="font-size:11px;color:#999;"><a href="${optOutUrl}">Unsubscribe</a></p>`,
      });

      await getDb().insert(sends).values({
        contactId: contact.id,
        phaseId: phase.id,
        resendId: result.data?.id || null,
      });

      if (contact.status === "approved") {
        await getDb()
          .update(contacts)
          .set({ status: "enrolled", enrolledAt: new Date(), updatedAt: new Date() })
          .where(eq(contacts.id, contact.id));
      }

      sent++;
    } catch (err) {
      errors.push(`${contact.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({
    sent,
    remaining: eligible.length - sent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
