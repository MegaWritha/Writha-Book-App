import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router"; // Added useRouter and useSegments
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/contexts/ThemeContext";

import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

import {
  useFonts,
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();

// NAVIGATION FOR UNAUTHENTICATED USERS
function AuthNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}

// NAVIGATION FOR LOGGED IN USERS
function AppNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="book/[id]" />
      <Stack.Screen name="read/[id]" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="write" />
    </Stack>
  );
}

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await currentUser.reload();
          setUser(currentUser);
        } catch (e) {
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // AUTH PROTECTION REDIRECTS
  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!user && inTabsGroup) {
      // Not logged in -> Kick to login
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Logged in -> Send to app
      router.replace('/(tabs)');
    }
  }, [user, authLoading, segments]);

  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded || authLoading) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              {/* This switch ensures the user ONLY sees what they are supposed to */}
              {user ? <AppNavigator /> : <AuthNavigator />}
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}