/** @typedef {"en"|"zh"} Language */
/** @typedef {"allowed"|"blocked"|"emergency"|"redirected"|"sanitized"} SafetyStatus */
/**
 * POST /api/chat body: { conversationId?: UUID|null, message: string, language?: Language }
 * Response: { reply: string, conversationId: UUID, sources: Array<{name,url}>, safety:{status:SafetyStatus} }
 * Authorization: Bearer <Supabase access token> (except local-only demo).
 */
export const CONTRACT_VERSION = "1";
