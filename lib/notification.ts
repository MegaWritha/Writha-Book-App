import * as Notifications from 'expo-notifications';
import { db, auth } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
  let token;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') return;

  token = (await Notifications.getExpoPushTokenAsync({
    projectId: "your-expo-project-id" // Found in app.json
  })).data;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const userId = auth.currentUser?.uid;
  if (userId) {
    await updateDoc(doc(db, "users", userId), { pushToken: token });
  }

  return token;
}