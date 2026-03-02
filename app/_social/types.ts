import { Timestamp } from "firebase/firestore";

export type GroupType = "reading" | "research" | "discussion" | "study";
export type TabType = "Chats" | "Friends" | "Groups";
export type NotificationType = 
  | "like" | "comment" | "follow" | "purchase" | "review" 
  | "mention" | "weave" | "book_approved" | "book_rejected";

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  photoURL?: string;
  email?: string;
  bio?: string;
  isOnline: boolean;
  weaveCount: number;
  createdAt?: Timestamp;
  displayNameLower?: string;
  usernameLower?: string;
}

export interface ChatMessage {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp;
  unreadCount: Record<string, number>;
  createdAt: Timestamp;
}

export interface GroupWeave {
  id: string;
  name: string;
  type: GroupType;
  privacy: "public" | "private";
  createdBy: string;
  members: string[];
  createdAt: Timestamp;
  lastActivity: Timestamp;
  weaveLevel: number;
  bookTitle?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  body?: string;
  fromUserId?: string;
  read: boolean;
  createdAt: Timestamp;
  relatedId?: string;
}