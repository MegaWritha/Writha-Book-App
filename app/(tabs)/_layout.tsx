import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { 
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          height: 65,
          paddingBottom: 5,
          paddingHorizontal: 10,
        } 
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="home-sharp" size={22} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="book-sharp" size={22} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="friends"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="people-sharp" size={24} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="grid-sharp" size={22} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="wallet-sharp" size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="person-sharp" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}