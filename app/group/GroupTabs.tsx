import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import GroupChat from "./GroupChat"; 
import GroupMembers from "../../components/GroupMembers";
import GroupSettings from "./GroupSettings";

interface TabProps {
  groupId: string;
  groupData: any;
  // Added these to allow the Header (Three Dots) to control the tabs
  activeTab?: "loom" | "members" | "settings";
  setActiveTab?: (tab: "loom" | "members" | "settings") => void;
}

export default function GroupTabs({ groupId, groupData, activeTab: externalTab, setActiveTab: setExternalTab }: TabProps) {
  // Use external state if provided, otherwise fallback to internal state
  const [internalTab, setInternalTab] = useState<"loom" | "members" | "settings">("loom");
  
  const activeTab = externalTab || internalTab;
  const setActiveTab = setExternalTab || setInternalTab;

  return (
    <View style={styles.container}>
      {/* ADVANCED TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          onPress={() => setActiveTab("loom")} 
          style={[styles.tab, activeTab === "loom" && styles.activeTab]}
        >
          <MaterialCommunityIcons 
            name="molecule" 
            size={22} 
            color={activeTab === "loom" ? "#FFF" : "#444"} 
          />
          {activeTab === "loom" && <Text style={styles.tabLabel}>LOOM</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setActiveTab("members")} 
          style={[styles.tab, activeTab === "members" && styles.activeTab]}
        >
          <Ionicons 
            name="people-outline" 
            size={22} 
            color={activeTab === "members" ? "#FFF" : "#444"} 
          />
          {activeTab === "members" && <Text style={styles.tabLabel}>WEAVERS</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab("settings")} 
          style={[styles.tab, activeTab === "settings" && styles.activeTab]}
        >
          <Ionicons 
            name="shield-outline" 
            size={20} 
            color={activeTab === "settings" ? "#FFF" : "#444"} 
          />
          {activeTab === "settings" && <Text style={styles.tabLabel}>VAULT</Text>}
        </TouchableOpacity>
      </View>

      {/* CONTENT AREA */}
      <View style={styles.content}>
        {activeTab === "loom" && <GroupChat groupId={groupId} />}
        {activeTab === "members" && <GroupMembers groupId={groupId} />}
        {activeTab === "settings" && <GroupSettings groupId={groupId} groupData={groupData} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  tabBar: { 
    flexDirection: "row", 
    justifyContent: "center", 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderColor: "#111",
    gap: 15
  },
  tab: { 
    flexDirection: 'row',
    paddingVertical: 10, 
    paddingHorizontal: 15,
    borderRadius: 15, 
    alignItems: 'center',
    gap: 8
  },
  activeTab: { 
    backgroundColor: "#111", 
    borderWidth: 1,
    borderColor: "#8E2DE2" 
  },
  tabLabel: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1
  },
  content: { flex: 1 }
});