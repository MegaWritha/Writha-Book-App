import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function AuthorHub() {
  const router = useRouter();
  return (
    <ScrollView style={{flex: 1, backgroundColor: '#fff'}}>
      <View style={styles.hero}>
        <Feather name="feather" size={50} color="#4A00E0" />
        <Text style={styles.hTitle}>Author's Sanctum</Text>
        <Text style={styles.hSub}>Your legacy starts here.</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.s}><Text style={styles.n}>0</Text><Text style={styles.l}>Works</Text></View>
        <View style={styles.s}><Text style={styles.n}>0</Text><Text style={styles.l}>Readers</Text></View>
        <View style={styles.s}><Text style={styles.n}>$0</Text><Text style={styles.l}>Earnings</Text></View>
      </View>
      <TouchableOpacity style={styles.btn} onPress={() => router.back()}><Text style={styles.btnT}>Go Back</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 50, alignItems: 'center', backgroundColor: '#F8F4FF' },
  hTitle: { fontSize: 24, fontWeight: 'bold', color: '#4A00E0', marginTop: 15 },
  hSub: { color: '#8E2DE2', opacity: 0.6 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', padding: 25, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  s: { alignItems: 'center' },
  n: { fontSize: 20, fontWeight: 'bold' },
  l: { fontSize: 12, color: '#999' },
  btn: { margin: 25, padding: 18, backgroundColor: '#4A00E0', borderRadius: 15, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: 'bold' }
});