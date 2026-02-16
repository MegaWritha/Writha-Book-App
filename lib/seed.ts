import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, limit } from "firebase/firestore";

const FEATURED_BOOKS = [
  { 
    title: "The Art of War", authorName: "Sun Tzu", genre: "Strategy", 
    gutenbergId: "132", cover: "https://m.media-amazon.com/images/I/712K4DfcBYL.jpg",
    description: "An ancient Chinese military treatise dating from the Late Spring and Autumn Period.",
    rating: 5.0, reads: 1205
  },
  { 
    title: "Meditations", authorName: "Marcus Aurelius", genre: "Philosophy", 
    gutenbergId: "264", cover: "https://m.media-amazon.com/images/I/81S2H3v6YfL.jpg",
    description: "A series of personal writings by Marcus Aurelius, Roman Emperor, recording his private notes to himself.",
    rating: 4.9, reads: 890
  },
  { 
    title: "The Great Gatsby", authorName: "F. Scott Fitzgerald", genre: "Romance", 
    gutenbergId: "64317", cover: "https://m.media-amazon.com/images/I/71FTB9f6SLL.jpg",
    description: "A 1925 novel by American writer F. Scott Fitzgerald set in the Jazz Age.",
    rating: 4.8, reads: 2300
  }
];

export const seedDatabase = async () => {
  try {
    const booksRef = collection(db, "books");
    const existing = await getDocs(query(booksRef, limit(1)));
    if (!existing.empty) return; 

    for (const book of FEATURED_BOOKS) {
      await addDoc(booksRef, { ...book, createdAt: serverTimestamp() });
    }
    console.log("✅ Library Seeded");
  } catch (e) { console.error(e); }
};