import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts, attachments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  // Get all contacts that have at least one message
  const allMessages = await getDb()
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt));

  // Collect all message IDs and fetch attachment metadata in one query
  const messageIds = allMessages.map((m) => m.id);
  const allAttachments =
    messageIds.length > 0
      ? await getDb()
          .select({
            id: attachments.id,
            messageId: attachments.messageId,
            filename: attachments.filename,
            contentType: attachments.contentType,
            size: attachments.size,
          })
          .from(attachments)
      : [];

  // Build a map of messageId -> attachment metadata
  const attachmentMap = new Map<
    string,
    { id: string; filename: string; contentType: string; size: number }[]
  >();
  for (const att of allAttachments) {
    if (!attachmentMap.has(att.messageId)) {
      attachmentMap.set(att.messageId, []);
    }
    attachmentMap.get(att.messageId)!.push({
      id: att.id,
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
    });
  }

  // Group by contact
  const threadMap = new Map<
    string,
    { contact: { id: string; firstName: string; lastName: string; email: string; companyName: string }; messages: (typeof allMessages[number] & { attachments: { id: string; filename: string; contentType: string; size: number }[] })[] }
  >();

  for (const msg of allMessages) {
    if (!threadMap.has(msg.contactId)) {
      const [contact] = await getDb()
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          companyName: contacts.companyName,
          lastReadAt: contacts.lastReadAt,
        })
        .from(contacts)
        .where(eq(contacts.id, msg.contactId))
        .limit(1);

      if (!contact) continue;

      threadMap.set(msg.contactId, { contact, messages: [] });
    }
    threadMap.get(msg.contactId)!.messages.push({
      ...msg,
      attachments: attachmentMap.get(msg.id) || [],
    });
  }

  // Sort threads by most recent message
  const threads = Array.from(threadMap.values()).sort(
    (a, b) =>
      new Date(b.messages[0].createdAt).getTime() -
      new Date(a.messages[0].createdAt).getTime()
  );

  return NextResponse.json(threads);
}
