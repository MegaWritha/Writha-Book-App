import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function UserProfile() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      
      <Text style={styles.text}>Scholar Profile</Text>
      <Text style={styles.idText}>ID: {id}</Text>
      <Text style={styles.subText}>We are building the "Intellectual Net Worth" view here soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F', justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', top: 50, left: 20 },
  text: { color: '#C9A24D', fontSize: 24, fontWeight: 'bold' },
  idText: { color: '#555', marginTop: 10 },
  subText: { color: '#888', marginTop: 20, textAlign: 'center', paddingHorizontal: 40 }
});