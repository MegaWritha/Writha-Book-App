import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router"; 
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FeedbackProvider } from "@/components/FeedbackProvider"; // 👈 New Import
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase"; 
import { doc, getDoc } from "firebase/firestore";

import {
  useFonts, Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (authLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    const checkUserStatus = async () => {
      if (!user) {
        if (!inAuthGroup) router.replace('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
          console.error("User authenticated but document missing.");
          if (!inAuthGroup) router.replace('/signup'); 
          return;
        }

        if (inAuthGroup) {
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.error("Sync Error:", err);
      }
    };

    checkUserStatus();
  }, [user, authLoading, segments, fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded || authLoading) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider> {/* 👈 Wrapped around GestureHandler to cover all UI */}
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="login" />
                  <Stack.Screen name="signup" />
                  <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
                </Stack>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </FeedbackProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}