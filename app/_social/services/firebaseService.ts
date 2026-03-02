import {
  collection,
  query as firestoreQuery,
  where,
  onSnapshot,
  doc,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  Query,
  CollectionReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatMessage, UserProfile, GroupWeave, Notification } from "../types";

/**
 * ==================== CHAT SERVICE ====================
 */
export const chatService = {
  listenToChats(
    userId: string,
    onUpdate: (chats: ChatMessage[]) => void,
    onError?: (error: Error) => void
  ) {
    const qChats = firestoreQuery(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc"),
      limit(50)
    );

    return onSnapshot(
      qChats,
      (snap) => {
        const chats = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as ChatMessage));
        onUpdate(chats);
      },
      (error: any) => {
        console.error("Chats listener error:", error);
        onError?.(error as Error);
      }
    );
  },

  async fetchChatUserData(
    userId: string,
    cache: Map<string, UserProfile>
  ): Promise<UserProfile | null> {
    if (cache.has(userId)) {
      return cache.get(userId) || null;
    }

    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        cache.set(userId, data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching chat user:", error);
    }
    return null;
  },

  async batchFetchChatUsers(
    userIds: string[],
    cache: Map<string, UserProfile>
  ): Promise<Record<string, UserProfile>> {
    const toFetch = userIds.filter((id) => !cache.has(id));

    if (toFetch.length === 0) {
      const result: Record<string, UserProfile> = {};
      userIds.forEach((id) => {
        const cached = cache.get(id);
        if (cached) result[id] = cached;
      });
      return result;
    }

    const result: Record<string, UserProfile> = {};

    try {
      const promises = toFetch.map((id) => getDoc(doc(db, "users", id)));
      const snaps = await Promise.all(promises);

      snaps.forEach((snap, idx) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          cache.set(toFetch[idx], data);
          result[toFetch[idx]] = data;
        }
      });
    } catch (error) {
      console.error("Error batch fetching users:", error);
    }

    return result;
  },
};

/**
 * ==================== FRIENDS SERVICE ====================
 */
export const friendsService = {
  listenToFollowing(
    userId: string,
    onUpdate: (ids: string[]) => void,
    onError?: (error: Error) => void
  ) {
    return onSnapshot(
      collection(db, "users", userId, "following"),
      (snap) => onUpdate(snap.docs.map((d) => d.id)),
      (error: any) => {
        console.error("Following listener error:", error);
        onError?.(error as Error);
      }
    );
  },

  listenToFollowers(
    userId: string,
    onUpdate: (ids: string[]) => void,
    onError?: (error: Error) => void
  ) {
    return onSnapshot(
      collection(db, "users", userId, "followers"),
      (snap) => onUpdate(snap.docs.map((d) => d.id)),
      (error: any) => {
        console.error("Followers listener error:", error);
        onError?.(error as Error);
      }
    );
  },

  async fetchMutualFriends(
    followingIds: string[],
    followerIds: string[],
    cache: Map<string, UserProfile>
  ): Promise<UserProfile[]> {
    const mutualIds = followingIds.filter((id) => followerIds.includes(id));

    if (mutualIds.length === 0) return [];

    const toFetch = mutualIds.filter((id) => !cache.has(id));

    if (toFetch.length > 0) {
      try {
        const snaps = await Promise.all(
          toFetch.map((id) => getDoc(doc(db, "users", id)))
        );
        snaps.forEach((snap, idx) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            cache.set(toFetch[idx], data);
          }
        });
      } catch (error) {
        console.error("Error fetching mutual friends:", error);
      }
    }

    return mutualIds
      .map((id) => cache.get(id))
      .filter((user): user is UserProfile => !!user);
  },

  async searchUsers(
    searchQuery: string,
    userId: string,
    limit_: number = 20
  ): Promise<UserProfile[]> {
    if (searchQuery.trim().length < 2) return [];

    const q = searchQuery.toLowerCase();

    try {
      const q2 = firestoreQuery(
        collection(db, "users"),
        where("displayNameLower", ">=", q),
        where("displayNameLower", "<", q + "\uf8ff"),
        limit(limit_)
      );

      const snap = await getDocs(q2);

      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.id !== userId);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  },

  async fetchSuggestions(
    userId: string,
    limit_: number = 30
  ): Promise<UserProfile[]> {
    try {
      const q = firestoreQuery(collection(db, "users"), limit(limit_));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.id !== userId);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      return [];
    }
  },

  async followUser(userId: string, targetId: string): Promise<void> {
    try {
      const timestamp = serverTimestamp();
      await Promise.all([
        setDoc(doc(db, "users", userId, "following", targetId), {
          followedAt: timestamp,
        }),
        setDoc(doc(db, "users", targetId, "followers", userId), {
          followedAt: timestamp,
        }),
        addDoc(collection(db, "users", targetId, "notifications"), {
          type: "follow",
          message: "Someone started following you",
          fromUserId: userId,
          read: false,
          createdAt: timestamp,
        }),
      ]);
    } catch (error) {
      console.error("Follow error:", error);
      throw error;
    }
  },

  async unfollowUser(userId: string, targetId: string): Promise<void> {
    try {
      await Promise.all([
        deleteDoc(doc(db, "users", userId, "following", targetId)),
        deleteDoc(doc(db, "users", targetId, "followers", userId)),
      ]);
    } catch (error) {
      console.error("Unfollow error:", error);
      throw error;
    }
  },
};

/**
 * ==================== GROUPS SERVICE ====================
 */
export const groupsService = {
  listenToUserGroups(
    userId: string,
    onUpdate: (groups: GroupWeave[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = firestoreQuery(
      collection(db, "groups"),
      where("members", "array-contains", userId),
      limit(100)
    );

    return onSnapshot(
      q,
      (snap) => {
        const groups = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as GroupWeave));
        onUpdate(groups);
      },
      (error: any) => {
        console.error("Groups listener error:", error);
        onError?.(error as Error);
      }
    );
  },

  listenToPublicGroups(
    userId: string,
    onUpdate: (groups: GroupWeave[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = firestoreQuery(
      collection(db, "groups"),
      where("privacy", "==", "public"),
      limit(20)
    );

    return onSnapshot(
      q,
      (snap) => {
        const groups = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as GroupWeave))
          .filter((g) => !g.members?.includes(userId));
        onUpdate(groups);
      },
      (error: any) => {
        console.error("Public groups listener error:", error);
        onError?.(error as Error);
      }
    );
  },

  async createGroup(
    userId: string,
    name: string,
    type: "reading" | "research" | "discussion" | "study",
    isPrivate: boolean
  ): Promise<string> {
    try {
      const ref = await addDoc(collection(db, "groups"), {
        name: name.trim(),
        type,
        privacy: isPrivate ? "private" : "public",
        createdBy: userId,
        members: [userId],
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        weaveLevel: 1,
      });
      return ref.id;
    } catch (error) {
      console.error("Create group error:", error);
      throw error;
    }
  },

  async joinGroup(groupId: string, userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, "groups", groupId), {
        members: arrayUnion(userId),
        lastActivity: serverTimestamp(),
      });
    } catch (error) {
      console.error("Join group error:", error);
      throw error;
    }
  },

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, "groups", groupId), {
        members: arrayRemove(userId),
        lastActivity: serverTimestamp(),
      });
    } catch (error) {
      console.error("Leave group error:", error);
      throw error;
    }
  },
};

/**
 * ==================== NOTIFICATIONS SERVICE ====================
 */
export const notificationsService = {
  listenToNotifications(
    userId: string,
    onUpdate: (notifications: Notification[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = firestoreQuery(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    return onSnapshot(
      q,
      (snap) => {
        const notifs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as Notification));
        onUpdate(notifs);
      },
      (error: any) => {
        console.error("Notifications listener error:", error);
        onError?.(error as Error);
      }
    );
  },

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = firestoreQuery(
        collection(db, "users", userId, "notifications"),
        where("read", "==", false)
      );
      const snap = await getDocs(q);

      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));

      await updateDoc(doc(db, "users", userId), { hasUnread: false });
    } catch (error) {
      console.error("Mark notifications read error:", error);
      throw error;
    }
  },

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await updateDoc(
        doc(db, "users", userId, "notifications", notificationId),
        { read: true }
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
      throw error;
    }
  },
};