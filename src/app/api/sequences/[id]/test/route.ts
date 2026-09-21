import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { phases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { phaseId, email } = await request.json();

  if (!email || !phaseId) {
    return NextResponse.json({ error: "email and phaseId required" }, { status: 400 });
  }

  const [phase] = await getDb()
    .select()
    .from(phases)
    .where(eq(phases.id, phaseId));

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  const subject = phase.subject
    .replace(/{{first_name}}/g, "Test")
    .replace(/{{last_name}}/g, "User")
    .replace(/{{company}}/g, "Acme Corp")
    .replace(/{{title}}/g, "CHRO");

  const body = phase.body
    .replace(/{{first_name}}/g, "Test")
    .replace(/{{last_name}}/g, "User")
    .replace(/{{company}}/g, "Acme Corp")
    .replace(/{{title}}/g, "CHRO");

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
      to: email,
      subject: `[TEST] ${subject}`,
      html: body,
    });

    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }
}
