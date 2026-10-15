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
    to,
    subject,
    body,
    attachments: attachmentList,
  } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    );
  }

  // Find or create contact by email
  let [contact] = await getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.email, to.toLowerCase()))
    .limit(1);

  if (!contact) {
    const namePart = to.split("@")[0].replace(/[._-]/g, " ");
    const parts = namePart.split(" ");
    const firstName = parts[0]
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      : "Unknown";
    const lastName = parts[1]
      ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
      : "Unknown";

    const [newContact] = await getDb()
      .insert(contacts)
      .values({
        firstName,
        lastName,
        email: to.toLowerCase(),
        title: "",
        companyName: "Unknown",
        companySize: null,
        companyLocation: null,
        industry: null,
        status: "enrolled",
      })
      .returning();

    contact = newContact;
  }

  // Build Resend attachments
  const resendAttachments =
    attachmentList?.map(
      (a: { filename: string; content: string }) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })
    ) || [];

  // Send via Resend
  const textBody = body
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
    to: to.toLowerCase(),
    subject,
    html: body,
    text: textBody,
    ...(resendAttachments.length > 0
      ? { attachments: resendAttachments }
      : {}),
  });

  // Store message
  const [message] = await getDb()
    .insert(messages)
    .values({
      contactId: contact.id,
      direction: "outbound",
      subject,
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

  return NextResponse.json({
    sent: true,
    contactId: contact.id,
    messageId: message.id,
  });
}
