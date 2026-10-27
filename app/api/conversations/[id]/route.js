import { authenticate, deleteConversation } from "../../../../lib/db/supabase.js";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
} });

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (typeof id !== "string" || !UUID.test(id)) return json({ error: "Invalid conversation ID" }, 400);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
    const token = request.headers.get("authorization")?.match(/^Bearer[ \t]+([^\s]+)$/i)?.[1];
    if (!token || token.length > 8192) return json({ error: "Authentication required" }, 401);
    const user = await authenticate(token);
    if (!user) return json({ error: "Invalid session" }, 401);
    if (!await deleteConversation(user, id)) return json({ error: "Conversation not found" }, 404);
    // The same 404 covers missing and unowned IDs. Do not reveal message counts
    // or reset usage quotas when deleting history.
    return json({ deleted: true });
  } catch {
    return json({ error: "Conversation could not be deleted. Please retry." }, 503);
  }
}
