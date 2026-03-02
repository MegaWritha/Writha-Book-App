import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  chatService,
  friendsService,
  groupsService,
  notificationsService,
} from "../services/firebaseService";
import {
  ChatMessage,
  UserProfile,
  GroupWeave,
  Notification,
} from "../types";

/**
 * Main hook for all social screen data
 */
export const useSocialData = (userId: string | undefined) => {
  // ==================== CHATS ====================
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [chatUserData, setChatUserData] = useState<Record<string, UserProfile>>({});
  const chatUserCacheRef = useRef(new Map<string, UserProfile>());

  // ==================== FRIENDS ====================
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const userDataCacheRef = useRef(new Map<string, UserProfile>());

  // ==================== GROUPS ====================
  const [groups, setGroups] = useState<GroupWeave[]>([]);
  const [publicGroups, setPublicGroups] = useState<GroupWeave[]>([]);

  // ==================== NOTIFICATIONS ====================
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // ==================== LOADING & ERRORS ====================
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ==================== SETUP ALL LISTENERS ====================
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubscribers: (() => void)[] = [];
    let allLoaded = 0;
    const totalToLoad = 6; // 6 listeners

    const checkAllLoaded = () => {
      allLoaded++;
      if (allLoaded === totalToLoad && isMountedRef.current) {
        setLoading(false);
      }
    };

    try {
      // 1. Chats
      unsubscribers.push(
        chatService.listenToChats(
          userId,
          (chats) => {
            if (!isMountedRef.current) return;
            setChats(chats);
            checkAllLoaded();

            // Fetch missing user data in background
            const userIds = chats
              .map((c) => c.participants?.find((p) => p !== userId))
              .filter((id): id is string => !!id);

            if (userIds.length > 0) {
              chatService
                .batchFetchChatUsers(userIds, chatUserCacheRef.current)
                .then((data) => {
                  if (isMountedRef.current) {
                    setChatUserData((prev) => ({ ...prev, ...data }));
                  }
                });
            }
          },
          (error) => {
            if (isMountedRef.current) {
              setErrors((prev) => ({ ...prev, chats: error.message }));
              checkAllLoaded();
            }
          }
        )
      );

      // 2. Following
      unsubscribers.push(
        friendsService.listenToFollowing(
          userId,
          (ids) => {
            if (isMountedRef.current) {
              setFollowingIds(ids);
              checkAllLoaded();
            }
          },
          (error) => {
            if (isMountedRef.current) {
              setErrors((prev) => ({ ...prev, following: error.message }));
              checkAllLoaded();
            }
          }
        )
      );

      // 3. Followers
      unsubscribers.push(
        friendsService.listenToFollowers(
          userId,
          (ids) => {
            if (isMountedRef.current) {
              setFollowerIds(ids);
              checkAllLoaded();
            }
          },
          (error) => {
            if (isMountedRef.current) {
              setErrors((prev) => ({ ...prev, followers: error.message }));
              checkAllLoaded();
            }
          }
        )
      );

      // 4. Groups
      unsubscribers.push(
        groupsService.listenToUserGroups(
          userId,
          (groups) => {
            if (isMountedRef.current) {
              setGroups(groups);
              checkAllLoaded();
            }
          },
          (error) => {
            if (isMountedRef.current) {
              setErrors((prev) => ({ ...prev, groups: error.message }));
              checkAllLoaded();
            }
          }
        )
      );

      // 5. Public Groups
      unsubscribers.push(
        groupsService.listenToPublicGroups(
          userId,
          (groups) => {
            if (isMountedRef.current) {
              setPublicGroups(groups);
              checkAllLoaded();
            }
          },
          (error) => {
            if (isMountedRef.current) {
              setErrors((prev) => ({ ...prev, publicGroups: error.message }));
              checkAllLoaded();
            }
          }
        )
      );

      // 6. Notifications
      unsubscribers.push(
        notificationsService.listenToNotifications(
          userId,
          (notifs) => {
            if (isMountedRef.current) {
              setNotifications(notifs);
              checkAllLoaded();
            }
          },
          (error) => {
            if (isMountedRef.current) {
              setErrors((prev) => ({ ...prev, notifications: error.message }));
              checkAllLoaded();
            }
          }
        )
      );

      // Load suggestions in background
      friendsService.fetchSuggestions(userId, 30).then((suggestions) => {
        if (isMountedRef.current) {
          setSuggestions(suggestions);
        }
      });
    } catch (error) {
      console.error("Setup error:", error);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [userId]);

  // ==================== COMPUTE MUTUAL FRIENDS ====================
  useEffect(() => {
    if (!userId) return;

    const mutualIds = followingIds.filter((id) => followerIds.includes(id));

    if (mutualIds.length === 0) {
      setFriends([]);
      return;
    }

    friendsService
      .fetchMutualFriends(followingIds, followerIds, userDataCacheRef.current)
      .then((friends) => {
        if (isMountedRef.current) {
          setFriends(friends);
        }
      });
  }, [followingIds, followerIds, userId]);

  // ==================== SEARCH ====================
  const searchUsers = useCallback(
    async (query: string) => {
      if (!userId) return;

      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const results = await friendsService.searchUsers(query, userId);
        if (isMountedRef.current) {
          setSearchResults(results);
        }
      } catch (error) {
        console.error("Search error:", error);
        if (isMountedRef.current) {
          setSearchResults([]);
        }
      }
    },
    [userId]
  );

  // ==================== FOLLOW/UNFOLLOW ====================
  const followUser = useCallback(
    async (targetId: string) => {
      if (!userId) return;
      try {
        await friendsService.followUser(userId, targetId);
      } catch (error) {
        console.error("Follow error:", error);
        throw error;
      }
    },
    [userId]
  );

  const unfollowUser = useCallback(
    async (targetId: string) => {
      if (!userId) return;
      try {
        await friendsService.unfollowUser(userId, targetId);
      } catch (error) {
        console.error("Unfollow error:", error);
        throw error;
      }
    },
    [userId]
  );

  // ==================== GROUPS ====================
  const createGroup = useCallback(
    async (
      name: string,
      type: "reading" | "research" | "discussion" | "study",
      isPrivate: boolean
    ): Promise<string> => {
      if (!userId) throw new Error("No user");
      return groupsService.createGroup(userId, name, type, isPrivate);
    },
    [userId]
  );

  const joinGroup = useCallback(
    async (groupId: string) => {
      if (!userId) return;
      try {
        await groupsService.joinGroup(groupId, userId);
      } catch (error) {
        console.error("Join group error:", error);
        throw error;
      }
    },
    [userId]
  );

  // ==================== NOTIFICATIONS ====================
  const markNotificationsAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await notificationsService.markAllAsRead(userId);
    } catch (error) {
      console.error("Mark read error:", error);
      throw error;
    }
  }, [userId]);

  return {
    // Chats
    chats,
    chatUserData,

    // Friends
    friends,
    followingIds,
    followerIds,
    suggestions,
    searchResults,

    // Groups
    groups,
    publicGroups,

    // Notifications
    notifications,
    unreadCount,

    // Loading & Errors
    loading,
    errors,

    // Actions
    searchUsers,
    followUser,
    unfollowUser,
    createGroup,
    joinGroup,
    markNotificationsAsRead,
  };
};