import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts, sends, messages } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";

export async function GET() {
  const [contactStats] = await getDb()
    .select({
      total: sql<number>`count(*)`,
      approved: sql<number>`count(*) filter (where ${contacts.status} = 'approved')`,
      enrolled: sql<number>`count(*) filter (where ${contacts.status} = 'enrolled')`,
      replied: sql<number>`count(*) filter (where ${contacts.status} = 'replied')`,
      optedOut: sql<number>`count(*) filter (where ${contacts.status} = 'opted_out')`,
      newCount: sql<number>`count(*) filter (where ${contacts.status} = 'new')`,
    })
    .from(contacts);

  const [sendStats] = await getDb()
    .select({
      totalSent: sql<number>`count(*)`,
      sentToday: sql<number>`count(*) filter (where ${sends.sentAt}::date = current_date)`,
    })
    .from(sends);

  const [replyStats] = await getDb()
    .select({
      totalInbound: sql<number>`count(*) filter (where ${messages.direction} = 'inbound')`,
    })
    .from(messages);

  const replyRate = Number(sendStats.totalSent) > 0
    ? Math.round((Number(contactStats.replied) / Number(sendStats.totalSent)) * 100)
    : 0;

  return NextResponse.json({
    contacts: {
      total: Number(contactStats.total),
      new: Number(contactStats.newCount),
      approved: Number(contactStats.approved),
      enrolled: Number(contactStats.enrolled),
      replied: Number(contactStats.replied),
      optedOut: Number(contactStats.optedOut),
    },
    emails: {
      totalSent: Number(sendStats.totalSent),
      sentToday: Number(sendStats.sentToday),
      replies: Number(replyStats.totalInbound),
      replyRate,
    },
  });
}
