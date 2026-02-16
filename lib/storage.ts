import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  nightMode: boolean;
  fontSize: number;
  fontFamily: string;
}

const SETTINGS_KEY = 'writha_settings';
const USER_KEY = 'writha_user';

export const getSettings = async (): Promise<Settings> => {
  try {
    const s = await AsyncStorage.getItem(SETTINGS_KEY);
    return s ? JSON.parse(s) : { nightMode: false, fontSize: 18, fontFamily: 'serif' };
  } catch {
    return { nightMode: false, fontSize: 18, fontFamily: 'serif' };
  }
};

export const saveSettings = async (settings: Settings) => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// THIS IS THE MISSING PIECE CAUSING YOUR ERROR
export const getCurrentUser = async () => {
  try {
    const user = await AsyncStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const saveUser = async (user: any) => {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

