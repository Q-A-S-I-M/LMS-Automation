import sanitizeHtml from "sanitize-html";

export function sanitizeUserText(input, { maxLen = 4000 } = {}) {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const clipped = raw.slice(0, maxLen);
  // Strip HTML completely (chat input should be plain text).
  const cleaned = sanitizeHtml(clipped, { allowedTags: [], allowedAttributes: {} });
  return cleaned.trim();
}

