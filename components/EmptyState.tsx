import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from "@expo/vector-icons";

// 1. Ensure 'title' is defined here in the Interface
interface EmptyStateProps {
  title: string;
  message: string;
  icon?: string;
}

export const EmptyState = ({ title, message, icon = "text-search" }: EmptyStateProps) => {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={48} color="#4C1D95" />
      {/* 2. Ensure it's rendered here */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  message: {
    color: '#A78BFA',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
});