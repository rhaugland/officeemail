import { getDb } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [attachment] = await getDb()
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);

  if (!attachment) {
    return new Response("Attachment not found", { status: 404 });
  }

  const buffer = Buffer.from(attachment.content, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": `attachment; filename="${attachment.filename}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
