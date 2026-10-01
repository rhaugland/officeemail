import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  const { contactId, subject, body } = await request.json();

  if (!contactId || !body) {
    return NextResponse.json({ error: "contactId and body are required" }, { status: 400 });
  }

  const [contact] = await getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
    to: contact.email,
    subject: subject || "Re: OfficeForecast",
    text: body,
  });

  await getDb().insert(messages).values({
    contactId,
    direction: "outbound",
    subject: subject || "Re: OfficeForecast",
    body,
    resendId: result.data?.id || null,
  });

  return NextResponse.json({ sent: true });
}
