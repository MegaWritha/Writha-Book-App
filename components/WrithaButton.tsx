import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  title: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  style?: ViewStyle;
}

export const WrithaButton = ({ title, onPress, loading, style }: Props) => {
  const handlePress = () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity 
      style={[styles.btn, style, loading && { opacity: 0.7 }]} 
      onPress={handlePress} 
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }
});