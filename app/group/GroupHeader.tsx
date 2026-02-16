import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// FIX: Added groupData to the interface so the [id].tsx errors disappear
interface HeaderProps {
  groupId: string;
  groupData: any;
  onMenuPress?: () => void;
  }

export default function GroupHeader({ groupId, groupData, onMenuPress }: HeaderProps) {
  const router = useRouter();

  // Safeguard: use groupData or fallback to defaults while loading
  const name = groupData?.name || "Loading Thread...";
  const type = groupData?.type || "WEAVE";
  const memberCount = groupData?.members?.length || 1;
  const bio = groupData?.bio || "A collaborative space within the Writha Home.";

  return (
    <View style={styles.header}>
      {/* BACKGROUND DECORATION */}
      <View style={styles.glowSpot} />

      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={28} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsBtn}>
        <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        {/* AVATAR: Now dynamically takes the first letter of the group name */}
        <View style={styles.goldBorder}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.title}>{name}</Text>
        
        <View style={styles.tag}>
          <Text style={styles.tagText}>#{type.toUpperCase()}</Text>
        </View>

        <Text style={styles.bio}>{bio}</Text>
        
        <View style={styles.stats}>
          <View style={styles.statPill}>
            <MaterialCommunityIcons name="molecule" size={14} color="#D4AF37" />
            <Text style={styles.statText}>
              <Text style={styles.bold}>{memberCount}</Text> {memberCount === 1 ? 'Scholar' : 'Scholars'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    paddingTop: 60, 
    paddingBottom: 40, 
    paddingHorizontal: 25, 
    backgroundColor: "#000", // Changed to Black for the Gold/Purple contrast
    borderBottomLeftRadius: 40, 
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: '#222'
  },
  glowSpot: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#8E2DE2',
    opacity: 0.2,
  },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  settingsBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  infoContainer: { alignItems: 'center', marginTop: 10 },
  goldBorder: {
    padding: 2,
    backgroundColor: '#D4AF37', // Writha Gold border
    borderRadius: 32,
    marginBottom: 15,
  },
  avatar: { 
    width: 85, 
    height: 85, 
    borderRadius: 30, 
    backgroundColor: "#0A0A0A", 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000'
  },
  avatarText: { color: "#D4AF37", fontSize: 36, fontWeight: "900" },
  title: { fontSize: 28, fontWeight: "900", color: "#FFF", textAlign: 'center', letterSpacing: -0.5 },
  tag: { backgroundColor: "#8E2DE2", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10, marginTop: 10 },
  tagText: { color: "#FFF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  bio: { marginTop: 18, color: "#888", textAlign: 'center', fontSize: 14, lineHeight: 22, paddingHorizontal: 10 },
  stats: { marginTop: 22 },
  statPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    gap: 8
  },
  statText: { color: "#AAA", fontSize: 12, fontWeight: '600' },
  bold: { fontWeight: '900', color: '#D4AF37' }
});