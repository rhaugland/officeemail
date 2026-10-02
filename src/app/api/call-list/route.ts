import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { sql, gt } from "drizzle-orm";

export async function GET() {
  const openers = await getDb()
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      title: contacts.title,
      companyName: contacts.companyName,
      status: contacts.status,
      openCount: contacts.openCount,
      lastOpenedAt: contacts.lastOpenedAt,
    })
    .from(contacts)
    .where(gt(contacts.openCount, 0))
    .orderBy(sql`${contacts.openCount} desc`);

  return NextResponse.json(openers);
}
