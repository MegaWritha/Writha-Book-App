import * as admin from "firebase-admin";
let extractTextFromDocx: (buffer: Buffer) => Promise<string>;
try {
  extractTextFromDocx = require("./extractText").extractTextFromDocx;
} catch {
    extractTextFromDocx = async (buffer: Buffer) => buffer.toString("utf8");
}

admin.initializeApp();

const db      = admin.firestore();
const storage = admin.storage();

// Lazy import functions to avoid type errors
const getFunctions = () => require("firebase-functions");

// ── MANUSCRIPT PROCESSOR ─────────────────────────────────────────────────
export const processManuscript = getFunctions().storage
  .object()
  .onFinalize(async (object: any) => {

    const filePath    = object.name || "";
    const contentType = object.contentType || "";

    if (!filePath.startsWith("manuscripts/")) return null;

    const pathParts = filePath.split("/");
    if (pathParts.length < 3) return null;

    const uid      = pathParts[1];
    const fileName = pathParts[2];
    const ext      = fileName.split(".").pop()?.toLowerCase() ?? "";

    console.log(`Processing: ${filePath} for user: ${uid}`);

    try {
      const bucket   = storage.bucket(object.bucket);
      const file     = bucket.file(filePath);
      const [buffer] = await file.download();

      let rawText = "";

      if (ext === "txt") {
        rawText = buffer.toString("utf8");

      } else if (ext === "docx") {
        rawText = await extractTextFromDocx(buffer);

      } else if (ext === "pdf") {
        const pdfParse = require("pdf-parse");
        const pdfData  = await pdfParse(buffer);
        rawText        = pdfData.text;

      } else {
        console.log(`Unsupported file type: ${ext}`);
        return null;
      }

      const cleanedText  = cleanText(rawText);
      const words        = cleanedText.trim().split(/\s+/).filter(Boolean);
      const wordCount    = words.length;
      const chapterCount = countChapters(cleanedText);
      const pageCount    = Math.ceil(wordCount / 250);
      const readingTime  = formatReadingTime(wordCount);

      const draftsSnap = await db
        .collection("books")
        .where("authorId", "==", uid)
        .where("status",   "==", "processing")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (draftsSnap.empty) {
        await db.collection("manuscripts_processed").add({
          uid,
          fileName,
          content:     cleanedText,
          wordCount,
          chapterCount,
          pageCount,
          readingTime,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      await draftsSnap.docs[0].ref.update({
        content:     cleanedText,
        wordCount,
        chapterCount,
        pageCount,
        readingTime,
        status:      "ready",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify user
      const userSnap = await db.collection("users").doc(uid).get();
      if (userSnap.exists) {
        const userData = userSnap.data();
        if (userData?.fcmToken) {
          await admin.messaging().send({
            token: userData.fcmToken,
            notification: {
              title: "Manuscript Ready! 📚",
              body:  `Your manuscript has been processed — ${wordCount.toLocaleString()} words, ${chapterCount} chapters.`,
            },
            data: { type: "manuscript_ready", bookId: draftsSnap.docs[0].id },
          });
        }
      }

      return null;

    } catch (error) {
      console.error("Error processing manuscript:", error);
      try {
        const draftsSnap = await db
          .collection("books")
          .where("authorId", "==", uid)
          .where("status",   "==", "processing")
          .limit(1)
          .get();
        if (!draftsSnap.empty) {
          await draftsSnap.docs[0].ref.update({
            status:       "processing_error",
            errorMessage: (error as Error).message,
          });
        }
      } catch (e) {
        console.error("Could not update error status:", e);
      }
      return null;
    }
  });

// ── BOOK APPROVED ─────────────────────────────────────────────────────────
export const onBookApproved = getFunctions().firestore
  .document("books/{bookId}")
  .onUpdate(async (change: any, context: any) => {
    const before = change.before.data();
    const after  = change.after.data();

    if (before.status === after.status) return null;
    if (after.status !== "published")   return null;

    const authorId = after.authorId;
    if (!authorId) return null;

    try {
      const userSnap = await db.collection("users").doc(authorId).get();
      if (!userSnap.exists) return null;
      const userData = userSnap.data();

      if (userData?.fcmToken) {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: {
            title: "Your Book is Live! 🎉",
            body:  `"${after.title}" has been approved and is now on Writha.`,
          },
          data: { type: "book_approved", bookId: context.params.bookId },
        });
      }

      await db
        .collection("users")
        .doc(authorId)
        .collection("notifications")
        .add({
          type:      "book_approved",
          title:     "Your Book is Live! 🎉",
          message:   `"${after.title}" has been approved and is now available on Writha.`,
          bookId:    context.params.bookId,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    } catch (error) {
      console.error("Approval notification error:", error);
    }

    return null;
  });

// ── BOOK REJECTED ─────────────────────────────────────────────────────────
export const onBookRejected = getFunctions().firestore
  .document("books/{bookId}")
  .onUpdate(async (change: any, context: any) => {
    const before = change.before.data();
    const after  = change.after.data();

    if (before.status === after.status) return null;
    if (after.status !== "rejected")    return null;

    const authorId = after.authorId;
    if (!authorId) return null;

    try {
      const userSnap = await db.collection("users").doc(authorId).get();
      if (!userSnap.exists) return null;
      const userData = userSnap.data();

      if (userData?.fcmToken) {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: {
            title: "Submission Update",
            body:  `"${after.title}" was not approved. You can revise and resubmit.`,
          },
          data: { type: "book_rejected", bookId: context.params.bookId },
        });
      }

      await db
        .collection("users")
        .doc(authorId)
        .collection("notifications")
        .add({
          type:      "book_rejected",
          title:     "Submission Update",
          message:   `"${after.title}" was not approved this time. Revise and resubmit from your library.`,
          bookId:    context.params.bookId,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    } catch (error) {
      console.error("Rejection notification error:", error);
    }

    return null;
  });

// ── HELPERS ───────────────────────────────────────────────────────────────
const cleanText = (raw: string): string =>
  raw
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, " — ").replace(/\u2013/g, " – ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\d+\s*$/gm, "")
    .replace(/^(Page \d+|Chapter \d+ of \d+)\s*$/gim, "")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim();

const countChapters = (text: string): number => {
  let count = 0;
  text.split("\n").forEach((line) => {
    const t = line.trim();
    if (
      /^chapter\s+\d+/i.test(t) ||
      /^chapter\s+[ivxlcdm]+/i.test(t) ||
      (t.length < 50 && t.length > 2 && t === t.toUpperCase() && /[A-Z]/.test(t))
    ) count++;
  });
  return Math.max(count, 1);
};

const formatReadingTime = (words: number): string => {
  const minutes = Math.ceil(words / 250);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${hours}h ${mins}m`;
};