import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  USER: "writha_user",
  BOOKS: "writha_books",
  READING_PROGRESS: "writha_reading_progress",
  BOOKMARKS: "writha_bookmarks",
  GROUPS: "writha_groups",
  MESSAGES: "writha_messages",
  WALLET: "writha_wallet",
  SETTINGS: "writha_settings",
};

export interface User {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar: string;
  interests: string[];
  isWriter: boolean;
  isTeacher: boolean;
  joinedDate: string;
  followers: number;
  following: number;
  booksRead: number;
  booksWritten: number;
  badges: string[];
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: string;
  isPaid: boolean;
  price: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  authorId: string;
  cover: string;
  genre: string;
  description: string;
  chapters: Chapter[];
  isPaid: boolean;
  price: number;
  rating: number;
  reads: number;
  likes: number;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  scrollPosition: number;
  lastRead: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterId: string;
  position: number;
  note: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  cover: string;
  memberCount: number;
  category: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface WalletData {
  balance: number;
  earnings: number;
  tips: number;
  withdrawals: number;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: "earning" | "tip" | "withdrawal";
  amount: number;
  description: string;
  createdAt: string;
  status: "pending" | "completed" | "failed";
}

export interface Settings {
  nightMode: boolean;
  fontSize: number;
  fontFamily: string;
}

const DEFAULT_USER: User = {
  id: "user_1",
  name: "Amara Okonkwo",
  email: "amara@example.com",
  bio: "Passionate storyteller exploring the depths of African mythology and contemporary fiction. Writing is my soul's language.",
  avatar: "",
  interests: ["African Mythology", "Romance", "Historical Fiction", "Poetry"],
  isWriter: true,
  isTeacher: false,
  joinedDate: "2024-01-15",
  followers: 1248,
  following: 89,
  booksRead: 156,
  booksWritten: 3,
  badges: ["Top Writer", "Storyteller", "Active Reader"],
};

const SAMPLE_CHAPTERS: Chapter[] = [
  {
    id: "ch_1",
    title: "The Beginning",
    content: `The sun dipped below the horizon, painting the sky in shades of amber and crimson that reminded Adaeze of her grandmother's kanga cloth. She stood at the edge of the village, where the red earth met the tall grasses that whispered secrets of ancient times.

"The spirits are restless tonight," her grandmother had warned that morning, her weathered hands trembling over the divination cowries. "Something stirs in the old forest."

Adaeze had dismissed it as the ramblings of an old woman who spent too much time communing with the ancestors. But now, as the first stars emerged and the baobab trees cast long shadows across the land, she felt it too—a humming in her bones, a calling she couldn't ignore.

The path before her glowed faintly, lit by phosphorescent fungi that sprouted only during the sacred moon. Her people called it the Spirit Trail, and it appeared once in a generation to the one chosen to bridge the world of the living and the realm of the ancestors.

She took her first step forward, and the ground seemed to welcome her weight, soft and yielding like a mother's embrace. The tall grasses parted before her, creating a corridor that led deeper into the heart of the ancient forest.

Behind her, the village lights flickered like earthbound stars. Ahead, only darkness and possibility.`,
    wordCount: 234,
    createdAt: "2024-02-01",
    isPaid: false,
    price: 0,
  },
  {
    id: "ch_2",
    title: "The Forest Speaks",
    content: `The deeper Adaeze ventured, the more the forest transformed around her. What had been familiar trees became towering sentinels with bark that shimmered like obsidian. Their branches wove together overhead, creating a canopy that blocked out the stars yet somehow allowed a soft, ethereal light to filter through.

She heard them before she saw them—voices carried on the wind, speaking in the old tongue that her grandmother had taught her in secret, the language the colonizers had tried to erase from their memories.

"Daughter of the earth, why do you walk our path?"

Adaeze's heart thundered, but she kept her voice steady. "I was called. I felt your summons in my blood."

A figure materialized from the shadows—not quite human, not quite spirit. It wore the face of a beautiful woman, but its body was made of swirling smoke and starlight. Around its neck hung a necklace of cowrie shells that clinked softly with each movement.

"Many are called, but few have the courage to answer," the spirit said, its voice like wind through hollow reeds. "Tell me, daughter, what do you seek in the realm between worlds?"`,
    wordCount: 198,
    createdAt: "2024-02-08",
    isPaid: true,
    price: 50,
  },
  {
    id: "ch_3",
    title: "The Test of Ancestors",
    content: `Adaeze considered the question carefully. What did she seek? Power? Knowledge? The ability to protect her village from the threats that lurked at its borders?

"I seek wisdom," she finally answered. "The wisdom to understand my purpose and the strength to fulfill it."

The spirit's form shifted, becoming more solid, more defined. A smile curved its ancient lips.

"Wisdom is a worthy pursuit, but it comes at a cost. Are you prepared to pay it?"

Before Adaeze could respond, the ground beneath her feet dissolved into a pool of liquid silver. She sank slowly, the cool metallic substance rising to her waist, her chest, her chin.

"Do not struggle," the spirit advised. "Let the memories of your ancestors fill you. Their joys, their sorrows, their triumphs and failures—all will become part of you."

The silver closed over her head, and suddenly she was drowning in centuries of experiences. She felt the first king's coronation, the grief of mothers who lost children to disease, the exhilaration of hunters who brought down their first prey. She lived through famines and festivals, wars and weddings, until she could no longer tell where she ended and her ancestors began.`,
    wordCount: 207,
    createdAt: "2024-02-15",
    isPaid: true,
    price: 50,
  },
];

const SAMPLE_BOOKS: Book[] = [
  {
    id: "book_1",
    title: "Whispers of the Ancestors",
    author: "Amara Okonkwo",
    authorId: "user_1",
    cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400",
    genre: "African Mythology",
    description: "A young woman discovers she is the chosen bridge between the living and the spirit realm, embarking on a journey through ancient traditions and mystical encounters.",
    chapters: SAMPLE_CHAPTERS,
    isPaid: false,
    price: 0,
    rating: 4.8,
    reads: 15420,
    likes: 3256,
    status: "published",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-15",
    tags: ["mythology", "fantasy", "african", "spiritual"],
  },
  {
    id: "book_2",
    title: "Lagos Love Letters",
    author: "Chidi Nwosu",
    authorId: "user_2",
    cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400",
    genre: "Romance",
    description: "Two strangers meet in the bustling streets of Lagos and find themselves caught in a whirlwind of passion, cultural expectations, and the search for true love.",
    chapters: [
      {
        id: "ch_ll_1",
        title: "The Third Mainland Bridge",
        content: `The traffic on Third Mainland Bridge was at a standstill, as it always was during rush hour. Nkechi sat in the backseat of the yellow taxi, watching the sun paint the Lagos Lagoon in shades of gold and pink.

Her phone buzzed. Another message from her mother about the eligible bachelor she had lined up for their weekend visit. Another reminder that at twenty-eight, Nkechi was "running out of time."

She sighed and turned her attention back to the window. That's when she saw him—in the car next to hers, a man with kind eyes and a smile that seemed to light up the evening air. He was looking at her too.

Before she knew what she was doing, she had lowered her window. He did the same.

"Beautiful evening, isn't it?" he called out over the din of honking horns and radio music.

"It would be more beautiful if we weren't stuck here," she replied, surprising herself with her boldness.

His laugh was warm and genuine. "I'm Emeka. And I have a feeling this traffic jam is about to become the best thing that's ever happened to me."`,
        wordCount: 189,
        createdAt: "2024-03-01",
        isPaid: false,
        price: 0,
      },
    ],
    isPaid: true,
    price: 500,
    rating: 4.9,
    reads: 28340,
    likes: 7890,
    status: "published",
    createdAt: "2024-03-01",
    updatedAt: "2024-03-15",
    tags: ["romance", "lagos", "contemporary", "love"],
  },
  {
    id: "book_3",
    title: "Mathematics Made Simple",
    author: "Prof. Bola Adeyemi",
    authorId: "user_3",
    cover: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400",
    genre: "Education",
    description: "A comprehensive guide to secondary school mathematics, breaking down complex concepts into easy-to-understand lessons.",
    chapters: [
      {
        id: "ch_m_1",
        title: "Understanding Algebra",
        content: `Welcome to the wonderful world of algebra! In this chapter, we will explore the fundamental concepts that form the foundation of algebraic thinking.

What is Algebra?
Algebra is a branch of mathematics that uses letters and symbols to represent numbers and quantities in formulas and equations. Think of it as a universal language for solving problems.

Variables and Constants
A variable is a symbol (usually a letter) that represents an unknown value. For example, in the equation x + 5 = 10, 'x' is our variable.

A constant is a fixed value that doesn't change. In our equation above, 5 and 10 are constants.

Solving Simple Equations
Let's solve our first equation: x + 5 = 10

To find x, we need to isolate it on one side of the equation:
x + 5 - 5 = 10 - 5
x = 5

Congratulations! You've just solved your first algebraic equation.`,
        wordCount: 156,
        createdAt: "2024-01-10",
        isPaid: false,
        price: 0,
      },
    ],
    isPaid: false,
    price: 0,
    rating: 4.7,
    reads: 45200,
    likes: 12400,
    status: "published",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-28",
    tags: ["education", "mathematics", "textbook", "secondary"],
  },
  {
    id: "book_4",
    title: "Echoes of Tomorrow",
    author: "Amara Okonkwo",
    authorId: "user_1",
    cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400",
    genre: "Science Fiction",
    description: "In a future where memories can be downloaded and shared, one woman discovers a memory that could change everything.",
    chapters: [],
    isPaid: false,
    price: 0,
    rating: 0,
    reads: 0,
    likes: 0,
    status: "draft",
    createdAt: "2024-03-10",
    updatedAt: "2024-03-10",
    tags: ["scifi", "future", "technology"],
  },
];

const SAMPLE_GROUPS: Group[] = [
  {
    id: "group_1",
    name: "African Mythology Lovers",
    description: "Explore the rich tapestry of African myths, legends, and folklore. Share recommendations and discuss your favorite stories.",
    cover: "https://images.unsplash.com/photo-1590845947676-fa0caaa2c5cf?w=400",
    memberCount: 2845,
    category: "African Mythology",
    isPrivate: false,
    createdAt: "2023-06-15",
  },
  {
    id: "group_2",
    name: "Romance Book Club",
    description: "For lovers of love stories! Weekly book picks, discussions, and recommendations for the hopeless romantics.",
    cover: "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400",
    memberCount: 5621,
    category: "Romance",
    isPrivate: false,
    createdAt: "2023-04-20",
  },
  {
    id: "group_3",
    name: "SS3 Study Group",
    description: "A private group for SS3 students preparing for WAEC and JAMB. Share notes, ask questions, and support each other.",
    cover: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400",
    memberCount: 342,
    category: "Students",
    isPrivate: true,
    createdAt: "2024-01-05",
  },
  {
    id: "group_4",
    name: "Writers' Corner",
    description: "Connect with fellow writers, share your work, get feedback, and discuss the craft of storytelling.",
    cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400",
    memberCount: 1890,
    category: "Writers",
    isPrivate: false,
    createdAt: "2023-08-10",
  },
];

const SAMPLE_MESSAGES: Message[] = [
  {
    id: "msg_1",
    groupId: "group_1",
    userId: "user_2",
    userName: "Chidi Nwosu",
    content: "Has anyone read the new book on Yoruba deities? It's absolutely fascinating!",
    createdAt: "2024-03-15T10:30:00Z",
  },
  {
    id: "msg_2",
    groupId: "group_1",
    userId: "user_3",
    userName: "Fatima Ibrahim",
    content: "Yes! The chapter on Sango was my favorite. The way the author connected his story to modern interpretations was brilliant.",
    createdAt: "2024-03-15T10:35:00Z",
  },
  {
    id: "msg_3",
    groupId: "group_1",
    userId: "user_1",
    userName: "Amara Okonkwo",
    content: "I'm actually working on a story inspired by Igbo mythology. Would love your feedback when I publish the first chapter!",
    createdAt: "2024-03-15T10:42:00Z",
  },
];

const DEFAULT_WALLET: WalletData = {
  balance: 15750,
  earnings: 45200,
  tips: 8350,
  withdrawals: 37800,
  transactions: [
    {
      id: "txn_1",
      type: "earning",
      amount: 2500,
      description: "Chapter purchase: Lagos Love Letters Ch. 5",
      createdAt: "2024-03-14",
      status: "completed",
    },
    {
      id: "txn_2",
      type: "tip",
      amount: 500,
      description: "Tip from @ChidiN for 'Whispers of the Ancestors'",
      createdAt: "2024-03-13",
      status: "completed",
    },
    {
      id: "txn_3",
      type: "withdrawal",
      amount: 10000,
      description: "Withdrawal to GTBank ***4521",
      createdAt: "2024-03-10",
      status: "completed",
    },
    {
      id: "txn_4",
      type: "earning",
      amount: 1500,
      description: "Ad revenue share - February",
      createdAt: "2024-03-01",
      status: "completed",
    },
  ],
};

const DEFAULT_SETTINGS: Settings = {
  nightMode: false,
  fontSize: 18,
  fontFamily: "serif",
};

export async function getUser(): Promise<User> {
  try {
    const data = await AsyncStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function getBooks(): Promise<Book[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.BOOKS);
    return data ? JSON.parse(data) : SAMPLE_BOOKS;
  } catch {
    return SAMPLE_BOOKS;
  }
}

export async function saveBooks(books: Book[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.BOOKS, JSON.stringify(books));
}

export async function getBook(id: string): Promise<Book | null> {
  const books = await getBooks();
  return books.find((b) => b.id === id) || null;
}

export async function getReadingProgress(): Promise<ReadingProgress[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.READING_PROGRESS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveReadingProgress(progress: ReadingProgress[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.READING_PROGRESS, JSON.stringify(progress));
}

export async function getBookmarks(): Promise<Bookmark[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.BOOKMARKS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
}

export async function getGroups(): Promise<Group[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.GROUPS);
    return data ? JSON.parse(data) : SAMPLE_GROUPS;
  } catch {
    return SAMPLE_GROUPS;
  }
}

export async function saveGroups(groups: Group[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.GROUPS, JSON.stringify(groups));
}

export async function getMessages(groupId: string): Promise<Message[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.MESSAGES);
    const allMessages: Message[] = data ? JSON.parse(data) : SAMPLE_MESSAGES;
    return allMessages.filter((m) => m.groupId === groupId);
  } catch {
    return SAMPLE_MESSAGES.filter((m) => m.groupId === groupId);
  }
}

export async function saveMessage(message: Message): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(KEYS.MESSAGES);
    const messages: Message[] = data ? JSON.parse(data) : SAMPLE_MESSAGES;
    messages.push(message);
    await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
  } catch {
    const messages = [...SAMPLE_MESSAGES, message];
    await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
  }
}

export async function getWallet(): Promise<WalletData> {
  try {
    const data = await AsyncStorage.getItem(KEYS.WALLET);
    return data ? JSON.parse(data) : DEFAULT_WALLET;
  } catch {
    return DEFAULT_WALLET;
  }
}

export async function saveWallet(wallet: WalletData): Promise<void> {
  await AsyncStorage.setItem(KEYS.WALLET, JSON.stringify(wallet));
}

export async function getSettings(): Promise<Settings> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatCurrency(amount: number): string {
  return "₦" + amount.toLocaleString();
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
