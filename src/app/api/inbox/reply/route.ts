import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts, attachments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  const {
    contactId,
    subject,
    body,
    attachments: attachmentList,
  } = await request.json();

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

  // Build Resend attachments
  const resendAttachments =
    attachmentList?.map(
      (a: { filename: string; content: string }) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })
    ) || [];

  const textBody = body.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
    to: contact.email,
    subject: subject || "Re: OfficeForecast",
    html: body,
    text: textBody,
    ...(resendAttachments.length > 0
      ? { attachments: resendAttachments }
      : {}),
  });

  const [message] = await getDb()
    .insert(messages)
    .values({
      contactId,
      direction: "outbound",
      subject: subject || "Re: OfficeForecast",
      body,
      resendId: result.data?.id || null,
    })
    .returning();

  // Store attachments
  if (attachmentList?.length) {
    await getDb()
      .insert(attachments)
      .values(
        attachmentList.map(
          (a: {
            filename: string;
            contentType: string;
            content: string;
            size: number;
          }) => ({
            messageId: message.id,
            filename: a.filename,
            contentType: a.contentType,
            content: a.content,
            size: a.size,
          })
        )
      );
  }

  return NextResponse.json({ sent: true });
}
