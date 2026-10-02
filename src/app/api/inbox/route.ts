import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { messages, contacts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  // Get all contacts that have at least one message
  const allMessages = await getDb()
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt));

  // Group by contact
  const threadMap = new Map<
    string,
    { contact: { id: string; firstName: string; lastName: string; email: string; companyName: string }; messages: typeof allMessages }
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
    threadMap.get(msg.contactId)!.messages.push(msg);
  }

  // Sort threads by most recent message
  const threads = Array.from(threadMap.values()).sort(
    (a, b) =>
      new Date(b.messages[0].createdAt).getTime() -
      new Date(a.messages[0].createdAt).getTime()
  );

  return NextResponse.json(threads);
}
