import * as Notifications from 'expo-notifications';
import { db, auth } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
  // Fix: Stop the VAPID/Web error by returning early on Web
  if (Platform.OS === 'web') {
    console.log("Push notifications are only available on mobile devices.");
    return null;
  }

  let token;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') return;

  try {
    token = (await Notifications.getExpoPushTokenAsync({
      // This ID must match your app.json extra.eas.projectId
      projectId: "your-actual-project-id-from-expo-dashboard" 
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
  } catch (error) {
    console.error("Error fetching push token:", error);
  }

  return token;
}