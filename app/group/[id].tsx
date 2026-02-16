import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { 
  View, 
  StyleSheet, 
  StatusBar, 
  Text, 
  ActivityIndicator, 
  Dimensions 
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase"; 
import GroupHeader from "./GroupHeader";
import GroupTabs from "./GroupTabs";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000",
  accent: "#D4AF37",
  purple: "#8E2DE2",
  text: "#FFFFFF",
};

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // NEW: State to control which tab is visible (The Loom, Weavers, or Vault)
  // This allows the "Three Dots" in the header to switch the view
  const [activeTab, setActiveTab] = useState<"loom" | "members" | "settings">("loom");

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, "groups", id);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setGroupData({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }, (err) => {
      console.error("Loom sync error:", err);
      setLoading(false);
    });

    return unsub;
  }, [id]);

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={styles.loadingText}>SYNCHRONIZING THREAD...</Text>
      </View>
    );
  }

  if (!id || !groupData) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>VOID: WEAVE NOT FOUND</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.backgroundAura} />

      {/* FIX: Added onMenuPress. When the user clicks the three dots, 
          it tells this screen to set the active tab to "settings" (The Vault).
      */}
      <GroupHeader 
        groupId={id} 
        groupData={groupData} 
        onMenuPress={() => setActiveTab("settings")} 
      />
      
      <View style={styles.content}>
         {/* FIX: Passing activeTab and setActiveTab so the tab bar 
             stays in sync with the header button.
         */}
         <GroupTabs 
            groupId={id} 
            groupData={groupData} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
         />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: THEME.bg 
  },
  backgroundAura: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: width,
    height: 300,
    backgroundColor: THEME.purple,
    opacity: 0.05,
    borderRadius: width / 2,
    transform: [{ scaleX: 2 }],
  },
  content: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  stateContainer: { 
    flex: 1, 
    backgroundColor: THEME.bg, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: THEME.accent, 
    fontWeight: '900', 
    fontSize: 10, 
    letterSpacing: 3, 
    marginTop: 20 
  },
  errorText: { 
    color: THEME.purple, 
    fontWeight: '900', 
    letterSpacing: 2 
  }
});