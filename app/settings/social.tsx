import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8"
};

export default function SocialSettings() {
  const router = useRouter();

  const SettingItem = ({ icon, label, sub, type = "link" }: any) => (
    <TouchableOpacity style={styles.item}>
      <View style={styles.iconBox}>
        <Feather name={icon} size={20} color={THEME.accent} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemLabel}>{label}</Text>
        {sub && <Text style={styles.itemSub}>{sub}</Text>}
      </View>
      {type === "link" ? (
        <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
      ) : (
        <Switch trackColor={{ false: "#333", true: THEME.accent }} thumbColor={"#fff"} value={true} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color={THEME.text} /></TouchableOpacity>
        <Text style={styles.title}>SOCIAL SETTINGS</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>PRIVACY</Text>
        <SettingItem icon="eye-off" label="Ghost Mode" sub="Hide your online status from others" type="switch" />
        <SettingItem icon="user-x" label="Blocked Members" sub="Manage people you've restricted" />
        <SettingItem icon="mail" label="Message Requests" sub="Control who can start new chats" />

        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <SettingItem icon="bell" label="Chat Alerts" type="switch" />
        <SettingItem icon="at-sign" label="Mentions" type="switch" />

        <Text style={styles.sectionTitle}>DATA & MEDIA</Text>
        <SettingItem icon="download" label="Auto-Download Files" sub="Save media automatically" type="switch" />
        <SettingItem icon="trash-2" label="Clear All History" sub="Permanently delete all conversations" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: THEME.text, fontWeight: '900', letterSpacing: 2 },
  scroll: { paddingHorizontal: 25, paddingBottom: 50 },
  sectionTitle: { color: THEME.accent, fontSize: 12, fontWeight: 'bold', marginTop: 30, marginBottom: 15, letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.ui, padding: 15, borderRadius: 20, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  itemInfo: { flex: 1 },
  itemLabel: { color: THEME.text, fontWeight: '600', fontSize: 15 },
  itemSub: { color: THEME.textMuted, fontSize: 12, marginTop: 2 }
});