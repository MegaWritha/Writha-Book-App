import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WeaveCardProps {
  item: any;
  onMenuPress: () => void;
}

export const WeaveCard = ({ item, onMenuPress }: WeaveCardProps) => {
  return (
    <View style={styles.weaveCard}>
      <View style={styles.weaveHeader}>
        <Text style={styles.weaveType}>{item.type?.toUpperCase() || 'POST'}</Text>
        
        {/* ACTIONABLE THREE DOTS */}
        <TouchableOpacity 
          onPress={onMenuPress} 
          style={styles.moreBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.weaveTitle}>{item.title || "Untitled Weave"}</Text>
      <Text style={styles.weaveBody}>
        {item.content || item.findings || "No content provided."}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  weaveCard: { backgroundColor: '#1E1135', padding: 22, borderRadius: 20, marginBottom: 18, borderLeftWidth: 5, borderLeftColor: '#FFD700' },
  weaveHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  moreBtn: { padding: 10 }, // Increased hit area
  weaveType: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  weaveTitle: { color: '#FFF', fontSize: 19, fontWeight: 'bold', marginBottom: 8 },
  weaveBody: { color: '#A78BFA', fontSize: 15, lineHeight: 22 },
});