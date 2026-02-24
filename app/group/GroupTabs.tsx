import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import GroupChat from "./GroupChat";
import GroupMembers from "../../components/GroupMembers";
import GroupSettings from "./GroupSettings";
import ContributionPanel from "./ContributionPanel";
import OutputPanel from "./OutputPanel";

interface TabProps {
  groupId: string;
  groupData: any;
  activeTab?: "loom" | "members" | "contribute" | "output" | "settings";
  setActiveTab?: (tab: "loom" | "members" | "contribute" | "output" | "settings") => void;
}

export default function GroupTabs({ groupId, groupData, activeTab: ext, setActiveTab: setExt }: TabProps) {
  const [internal, setInternal] = useState<"loom" | "members" | "contribute" | "output" | "settings">("loom");
  const activeTab = ext || internal;
  const setActiveTab = setExt || setInternal;

  return (
    <View style={styles.container}>
      {activeTab === "loom"       && <GroupChat groupId={groupId} groupData={groupData} />}
      {activeTab === "contribute" && <ContributionPanel groupId={groupId} groupData={groupData} />}
      {activeTab === "output"     && <OutputPanel groupId={groupId} groupData={groupData} />}
      {activeTab === "members"    && <GroupMembers groupId={groupId} />}
      {activeTab === "settings"   && <GroupSettings groupId={groupId} groupData={groupData} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", minHeight: 600 },
});