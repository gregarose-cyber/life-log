import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const ls = typeof localStorage !== 'undefined' ? localStorage : null;

const storage = Platform.OS === 'web'
  ? {
      getItem: (key: string) => Promise.resolve(ls?.getItem(key) ?? null),
      setItem: (key: string, value: string) => { ls?.setItem(key, value); return Promise.resolve(); },
      removeItem: (key: string) => { ls?.removeItem(key); return Promise.resolve(); },
    }
  : {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };

export const supabase = createClient(
  'https://akjlbxmgqjugjbotdyin.supabase.co',
  'sb_publishable_TDdRX1Fd_IPz9a4o6B4SVg_IcjjeaZQ',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);