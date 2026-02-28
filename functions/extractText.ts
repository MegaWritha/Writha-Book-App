import mammoth from "mammoth";

// ── EXTRACT TEXT FROM DOCX BUFFER ────────────────────────────────────────
export const extractTextFromDocx = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages && result.messages.length > 0) {
      console.log("Mammoth messages:", result.messages);
    }

    return result.value;
  } catch (error) {
    console.error("Mammoth extraction error:", error);
    throw new Error(
      "Could not extract text from this Word document. " +
      "Please ensure it is a valid .docx file (not .doc)."
    );
  }
};

// ── EXTRACT METADATA FROM DOCX ───────────────────────────────────────────
export const extractMetaFromDocx = async (
  buffer: Buffer
): Promise<{
  title?:  string;
  author?: string;
  description?: string;
}> => {
  try {
    // Extract HTML to get heading structure for title detection
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html       = htmlResult.value;

    // Try to extract title from first H1
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title   = h1Match
      ? h1Match[1].replace(/<[^>]+>/g, "").trim()
      : undefined;

    return { title };
  } catch {
    return {};
  }
};