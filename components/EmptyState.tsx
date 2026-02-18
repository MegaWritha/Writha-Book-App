import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const EmptyState = ({ message }: { message: string }) => (
  <View style={styles.container}>
    <Ionicons name="book-outline" size={64} color="#4C1D95" />
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  text: { color: '#A78BFA', textAlign: 'center', marginTop: 10, fontSize: 16 }
});