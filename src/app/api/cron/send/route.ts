export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts, phases, sends, sequences, messages } from "@/lib/db/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { Resend } from "resend";
import { htmlToText } from "@/lib/html-to-text";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allSequences = await getDb().select().from(sequences);
  let totalSent = 0;
  let totalSkipped = 0;
  let totalAutoApproved = 0;

  for (const seq of allSequences) {
    const seqPhases = await getDb()
      .select()
      .from(phases)
      .where(and(eq(phases.sequenceId, seq.id), eq(phases.isActive, true)))
      .orderBy(phases.phaseNumber);

    if (seqPhases.length === 0) continue;

    // Step 1: Auto-approve up to dailyLimit "new" contacts
    const newContacts = await getDb()
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.status, "new"))
      .limit(seq.dailyLimit);

    if (newContacts.length > 0) {
      const newIds = newContacts.map((c) => c.id);
      await getDb()
        .update(contacts)
        .set({ status: "approved", updatedAt: new Date() })
        .where(inArray(contacts.id, newIds));
      totalAutoApproved += newIds.length;
    }

    // Step 2: Send Phase 1 to up to dailyLimit new contacts
    // Step 3: Send Phase 2+ to ALL eligible contacts (no cap)

    for (const phase of seqPhases) {
      const alreadySent = await getDb()
        .select({ contactId: sends.contactId })
        .from(sends)
        .where(eq(sends.phaseId, phase.id));
      const alreadySentIds = alreadySent.map((s) => s.contactId);

      let eligible;

      if (phase.phaseNumber === 1) {
        // Phase 1: capped at dailyLimit
        eligible = await getDb()
          .select()
          .from(contacts)
          .where(
            and(
              inArray(contacts.status, ["approved", "enrolled"]),
              alreadySentIds.length > 0 ? notInArray(contacts.id, alreadySentIds) : undefined
            )
          )
          .limit(seq.dailyLimit);
      } else {
        // Phase 2+: send to ALL contacts who got previous phase >= delayDays ago
        const prevPhase = seqPhases.find((p) => p.phaseNumber === phase.phaseNumber - 1);
        if (!prevPhase) continue;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - phase.delayDays);

        const prevSent = await getDb()
          .select({ contactId: sends.contactId, sentAt: sends.sentAt })
          .from(sends)
          .where(eq(sends.phaseId, prevPhase.id));

        const eligibleFromPrev = prevSent
          .filter((s) => new Date(s.sentAt) <= cutoffDate)
          .map((s) => s.contactId);

        if (eligibleFromPrev.length === 0) continue;

        eligible = await getDb()
          .select()
          .from(contacts)
          .where(
            and(
              inArray(contacts.id, eligibleFromPrev),
              inArray(contacts.status, ["approved", "enrolled"]),
              alreadySentIds.length > 0 ? notInArray(contacts.id, alreadySentIds) : undefined
            )
          );
      }

      for (const contact of eligible) {
        const personalizedBody = htmlToText(
          phase.body
            .replace(/{{first_name}}/g, contact.firstName)
            .replace(/{{last_name}}/g, contact.lastName)
            .replace(/{{company}}/g, contact.companyName)
            .replace(/{{title}}/g, contact.title)
        );

        const personalizedSubject = phase.subject
          .replace(/{{first_name}}/g, contact.firstName)
          .replace(/{{last_name}}/g, contact.lastName)
          .replace(/{{company}}/g, contact.companyName)
          .replace(/{{title}}/g, contact.title);

        try {
          const result = await getResend().emails.send({
            from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
            to: contact.email,
            subject: personalizedSubject,
            text: personalizedBody,
          });

          await getDb().insert(sends).values({
            contactId: contact.id,
            phaseId: phase.id,
            resendId: result.data?.id || null,
          });

          await getDb().insert(messages).values({
            contactId: contact.id,
            direction: "outbound",
            subject: personalizedSubject,
            body: personalizedBody,
            resendId: result.data?.id || null,
          });

          if (contact.status === "approved") {
            await getDb()
              .update(contacts)
              .set({ status: "enrolled", enrolledAt: new Date(), updatedAt: new Date() })
              .where(eq(contacts.id, contact.id));
          }

          totalSent++;
        } catch {
          totalSkipped++;
        }
      }
    }
  }

  return NextResponse.json({
    autoApproved: totalAutoApproved,
    sent: totalSent,
    skipped: totalSkipped,
  });
}
