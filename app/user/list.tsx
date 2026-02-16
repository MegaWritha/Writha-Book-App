import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function UserList() {
  const { type, uid } = useLocalSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // This looks into your users/{uid}/followers or following sub-collections
        const snap = await getDocs(collection(db, "users", uid as string, type as string));
        const userPromises = snap.docs.map(async (d) => {
          const userSnap = await getDoc(doc(db, "users", d.id));
          return { id: d.id, ...userSnap.data() };
        });
        const results = await Promise.all(userPromises);
        setUsers(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [type, uid]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{(type as string)?.toUpperCase()}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color="#FFD700" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.userCard} 
              onPress={() => router.push(`/user/${item.id}`)}
            >
              <Image source={{ uri: item.profilePic || `https://ui-avatars.com/api/?name=${item.firstName}` }} style={styles.avatar} />
              <View>
                <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No {type} found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#1E1135' },
  headerTitle: { color: '#FFD700', fontWeight: '900', letterSpacing: 2 },
  userCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#1E1135', padding: 15, borderRadius: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, borderWidth: 1, borderColor: '#FFD700' },
  name: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  username: { color: '#A78BFA', fontSize: 13 },
  empty: { color: '#4C1D95', textAlign: 'center', marginTop: 50, fontStyle: 'italic' }
});