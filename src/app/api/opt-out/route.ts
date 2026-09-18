import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  await getDb()
    .update(contacts)
    .set({ status: "opted_out", optedOutAt: new Date(), updatedAt: new Date() })
    .where(eq(contacts.id, id));

  return new NextResponse(
    `<html>
      <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center;">
          <h1>You've been unsubscribed</h1>
          <p>You will no longer receive emails from us.</p>
        </div>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
