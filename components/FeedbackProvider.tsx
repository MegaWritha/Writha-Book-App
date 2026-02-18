import React, { createContext, useContext, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

// This is the "Passport" that lets other files use the feedback system
export const FeedbackContext = createContext({
  showFeedback: (message: string, type: 'success' | 'error' | 'info') => {},
});

export const FeedbackProvider = ({ children }: { children: React.ReactNode }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error' | 'info'>('info');
  const [visible, setVisible] = useState(false);
  const [opacity] = useState(new Animated.Value(0)); // Fixed: simplified initialization

  const showFeedback = (msg: string, t: 'success' | 'error' | 'info') => {
    setMessage(msg);
    setType(t);
    setVisible(true);
    
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  return (
    <FeedbackContext.Provider value={{ showFeedback }}>
      {children}
      {visible && (
        <Animated.View style={[
          styles.toast, 
          { opacity, backgroundColor: type === 'error' ? '#FF6B6B' : type === 'success' ? '#10B981' : '#4C1D95' }
        ]}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => useContext(FeedbackContext);

const styles = StyleSheet.create({
  toast: { position: 'absolute', bottom: 100, left: 20, right: 20, padding: 16, borderRadius: 12, alignItems: 'center', zIndex: 10000, elevation: 5 },
  text: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});