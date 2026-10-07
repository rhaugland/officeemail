import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  // Show confirmation page — don't opt out on GET (email security scanners click links)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://officeemail.vercel.app";
  return new NextResponse(
    `<html>
      <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center;">
          <h2>Unsubscribe</h2>
          <p>Click the button below to stop receiving emails from us.</p>
          <form method="POST" action="${appUrl}/api/opt-out">
            <input type="hidden" name="id" value="${id}" />
            <button type="submit" style="padding: 12px 24px; font-size: 16px; background: #000; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Unsubscribe</button>
          </form>
        </div>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const id = formData.get("id") as string;

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
          <h1>You have been unsubscribed</h1>
          <p>You will no longer receive emails from us.</p>
        </div>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
