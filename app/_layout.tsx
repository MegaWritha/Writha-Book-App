import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router"; 
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FeedbackProvider } from "@/components/FeedbackProvider";
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

  // Load Brand Typography
  const [fontsLoaded] = useFonts({
    Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  // 1. Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Security & Navigation Logic
  useEffect(() => {
    if (authLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    const checkUserStatus = async () => {
      if (!user) {
        // If not logged in and not on auth screens, force login
        if (!inAuthGroup) router.replace('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
          // If authenticated but no Firestore profile, force signup
          console.error("User authenticated but document missing.");
          if (!inAuthGroup) router.replace('/signup'); 
          return;
        }

        // If logged in and on auth screens, send to main hub
        if (inAuthGroup) {
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.error("Sync Error:", err);
      }
    };

    checkUserStatus();
  }, [user, authLoading, segments, fontsLoaded]);

  // 3. Hide Splash Screen when Ready
  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded || authLoading) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
                <Stack 
                  screenOptions={{ 
                    headerShown: false,
                    headerStyle: { backgroundColor: '#000' },
                    headerTintColor: '#D4AF37', // Writha Gold
                    headerTitleStyle: {
                      fontFamily: 'Inter_700Bold',
                      fontSize: 14, 
                      ...({
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      } as any),
                    },
                    headerShadowVisible: false,
                    contentStyle: { backgroundColor: '#000' }
                  }}
                >
                  {/* Auth Screens */}
                  <Stack.Screen name="login" />
                  <Stack.Screen name="signup" />

                  {/* Main Tab App */}
                  <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
                  
                  {/* Dynamic Feed Content - Headers enabled for these */}
                  <Stack.Screen 
                    name="weave/[id]" 
                    options={{ 
                      headerShown: true, 
                      title: 'THE WEAVE',
                      headerBackTitle: 'Back' 
                    }} 
                  />
                  <Stack.Screen 
                    name="group/[id]" 
                    options={{ 
                      headerShown: true, 
                      title: 'GROUP WEAVES',
                      headerBackTitle: 'Back' 
                    }} 
                  />
                  <Stack.Screen 
                    name="create" 
                    options={{ 
                      headerShown: true, 
                      title: 'DISCUSSION',
                      headerBackTitle: 'Back' 
                    }} 
                  />
                </Stack>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </FeedbackProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}