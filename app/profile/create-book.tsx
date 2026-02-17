import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AuthorHub() {
  const router = useRouter();

  const stats = [
    { label: 'Total Readers', value: '1.2k', icon: 'account-group' },
    { label: 'Royalties', value: '$142.50', icon: 'currency-usd' },
    { label: 'Published', value: '3', icon: 'book-open-variant' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Author Hub</Text>
          <Text style={styles.subtitle}>Manage your legacy and lore.</Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item, index) => (
            <View key={index} style={styles.statCard}>
              <MaterialCommunityIcons name={item.icon as any} size={24} color="#FFD700" />
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Manuscripts</Text>
            <TouchableOpacity onPress={() => router.push('/profile/create-book')}>
              <Text style={styles.linkText}>+ New Book</Text>
            </TouchableOpacity>
          </View>

          {/* Placeholder for actual book list mapping */}
          <TouchableOpacity style={styles.bookItem}>
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle}>The Shadow of Aethelgard</Text>
              <Text style={styles.bookStatus}>DRAFT • 12 Chapters</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.mainAction}
          onPress={() => router.push('/profile/create-book')}
        >
          <LinearGradient colors={['#FFD700', '#B8860B']} style={styles.gradientBtn}>
            <Text style={styles.btnText}>WRITE NEW MASTERPIECE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F071A' },
  scroll: { padding: 20 },
  header: { marginBottom: 30, marginTop: 10 },
  title: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  subtitle: { color: '#A78BFA', fontSize: 14, marginTop: 5 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 20, width: '31%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)' },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginVertical: 5 },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#A78BFA', fontWeight: 'bold' },
  bookItem: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 15, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: '#FFD700' },
  bookInfo: { flex: 1 },
  bookTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  bookStatus: { color: '#555', fontSize: 12, marginTop: 4 },
  mainAction: { marginTop: 20 },
  gradientBtn: { padding: 20, borderRadius: 15, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: '900', letterSpacing: 1 }
});