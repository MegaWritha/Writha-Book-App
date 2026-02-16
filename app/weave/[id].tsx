import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

export default function WeaveDetail() {
  const { id } = useLocalSearchParams();
  const [comment, setComment] = useState("");

  // Default empty state to avoid errors
  const weaveName = "Weave #" + (id || "Unknown");

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{weaveName}</Text>

      <Text style={styles.sectionTitle}>Thesis</Text>
      <Text style={styles.body}>
        This weave explores the intellectual foundations of the selected book.
      </Text>

      <Text style={styles.sectionTitle}>Citations</Text>
      <Text style={styles.body}>• Author interviews{"\n"}• Historical texts</Text>

      <Text style={styles.sectionTitle}>Discussion</Text>

      <View style={styles.commentBox}>
        <TextInput
          placeholder="Add your perspective..."
          placeholderTextColor="#777"
          value={comment}
          onChangeText={setComment}
          style={styles.input}
        />

        <TouchableOpacity style={styles.postBtn}>
          <Text style={{ fontWeight: "600" }}>Post</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    padding: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#C9A24D",
    marginBottom: 20,
  },

  sectionTitle: {
    color: "#fff",
    fontWeight: "600",
    marginTop: 20,
  },

  body: {
    color: "#ccc",
    marginTop: 8,
  },

  commentBox: {
    marginTop: 20,
  },

  input: {
    backgroundColor: "#1A1A22",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
  },

  postBtn: {
    backgroundColor: "#C9A24D",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
  },
});