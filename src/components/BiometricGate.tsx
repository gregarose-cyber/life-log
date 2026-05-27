import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const BIOMETRIC_LOCK_KEY = 'biometric_lock';

interface Props {
  children: React.ReactNode;
}

export default function BiometricGate({ children }: Props) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    checkAndLock();
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  const checkAndLock = async () => {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY);
    if (enabled === 'true') setLocked(true);
    setReady(true);
  };

  const handleAppStateChange = async (next: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && next === 'active') {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY);
      if (enabled === 'true') setLocked(true);
    }
    appState.current = next;
  };

  const handleUnlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Life Log',
      fallbackLabel: 'Use Passcode',
    });
    if (result.success) setLocked(false);
  };

  if (!ready) return null;
  if (!locked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Life Log is Locked</Text>
        <Text style={styles.subtitle}>Authenticate to continue</Text>
        <TouchableOpacity style={styles.button} onPress={handleUnlock}>
          <Text style={styles.buttonText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
