import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  Dimensions,
  Animated
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
// FIX: Corrected imports for Real-Time data and Auth
import { auth, db } from "../../lib/firebase"; 
import { collection, query, getCountFromServer } from "firebase/firestore";
import GlobalFeed from "./GlobalFeed";
import Weaves from "./Weaves";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000",
  surface: "#0A0A0A",
  ui: "#111111",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  text: "#FFFFFF",
  textMuted: "#666666"
};

export default function HubScreen() {
  const [activeTab, setActiveTab] = useState<"feed" | "weaves">("weaves");
  
  // REAL DATA STATE: Capturing the live pulse of the database
  const [totalWeaves, setTotalWeaves] = useState<number | string>("...");

  // FETCH REAL COUNT LOGIC
  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const countQuery = query(collection(db, "groups"));
        const snapshot = await getCountFromServer(countQuery);
        setTotalWeaves(snapshot.data().count);
      } catch (error) {
        console.error("Database Count Error:", error);
        setTotalWeaves(0); 
      }
    };
    fetchLiveStats();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ADVANCED BRANDED HEADER */}
      <View style={styles.topSection}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandText}>WRITHA ARCHIVE</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>The Hub</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>SYNCED</Text>
              </View>
            </View>
          </View>
          
          {/* USER QUICK ACTIONS */}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={20} color={THEME.accent} />
              <View style={styles.badge} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SUB-HEADER STATUS BAR - NOW REMOVED FAKE DATA */}
        <View style={styles.statusLine}>
          <View style={styles.statusItem}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color={THEME.purple} />
            <Text style={styles.statusText}>
              {auth.currentUser?.displayName || "Active Scholar"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusItem}>
            <Ionicons name="flash-outline" size={14} color={THEME.accent} />
            <Text style={styles.statusText}>{totalWeaves} Global Weaves</Text>
          </View>
        </View>
      </View>

      {/* THE GOLD-FRAMED TOGGLE BAR */}
      <View style={styles.tabOuterFrame}>
        <View style={styles.tabHeader}>
          <TouchableOpacity 
            onPress={() => setActiveTab("feed")}
            style={[
              styles.tab, 
              activeTab === "feed" && styles.activeTabGold
            ]}
          >
            <View style={styles.tabContent}>
              <Ionicons 
                name="newspaper-outline" 
                size={18} 
                color={activeTab === "feed" ? THEME.bg : THEME.textMuted} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === "feed" && styles.activeTabText
              ]}>Feed</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab("weaves")}
            style={[
              styles.tab, 
              activeTab === "weaves" && styles.activeTabGold
            ]}
          >
            <View style={styles.tabContent}>
              <MaterialCommunityIcons 
                name="molecule" 
                size={20} 
                color={activeTab === "weaves" ? THEME.bg : THEME.textMuted} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === "weaves" && styles.activeTabText
              ]}>My Weaves</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT AREA */}
      <View style={styles.contentContainer}>
        {activeTab === "feed" ? <GlobalFeed /> : <Weaves />}
      </View>
      
      {/* DECORATIVE BOTTOM GLOW */}
      <View style={styles.bottomGlow} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: THEME.bg 
  },
  topSection: {
    paddingHorizontal: 25,
    paddingTop: 10,
    marginBottom: 10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandText: { 
    color: THEME.purple, 
    fontSize: 11, 
    fontWeight: "900", 
    letterSpacing: 5,
    marginBottom: 5
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  title: { 
    fontSize: 38, 
    fontWeight: "900", 
    color: THEME.text, 
    letterSpacing: -1 
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
    marginTop: 5
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF00',
    marginRight: 6
  },
  liveText: {
    color: '#AAA',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1
  },
  headerActions: {
    flexDirection: 'row',
    paddingTop: 5
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: THEME.ui,
    borderWidth: 1,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.purple,
    borderWidth: 2,
    borderColor: THEME.ui
  },
  
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111'
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  statusText: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700'
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: '#222',
    marginHorizontal: 15
  },

  // THE TAB TOGGLE
  tabOuterFrame: {
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  tabHeader: { 
    flexDirection: "row", 
    backgroundColor: THEME.ui, 
    borderRadius: 20, 
    padding: 5,
    borderWidth: 1,
    borderColor: "#222"
  },
  tab: { 
    flex: 1, 
    paddingVertical: 14, 
    alignItems: "center", 
    borderRadius: 16 
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  activeTabGold: { 
    backgroundColor: THEME.accent,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabText: { 
    color: THEME.textMuted, 
    fontWeight: "900", 
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  activeTabText: { 
    color: THEME.bg 
  },

  contentContainer: { 
    flex: 1 
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -50,
    left: width * 0.25,
    width: width * 0.5,
    height: 100,
    backgroundColor: THEME.purple,
    opacity: 0.1,
    borderRadius: 100,
    filter: 'blur(50px)'
  }
});