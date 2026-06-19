import { BIOMETRIC_LOCK_KEY } from '@/components/BiometricGate';
import { useAuth } from '@/context/AuthContext';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setSupportedTypes(types);
      const stored = await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY);
      setBiometricEnabled(stored === 'true');
    })();
  }, []);

  const biometricLabel = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID Lock'
    : supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ? 'Touch ID Lock'
    : 'Biometric Lock';

  const handleToggle = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometric lock',
        fallbackLabel: 'Use Passcode',
      });
      if (!result.success) {
        Alert.alert('Not Available', 'Biometric authentication is not set up on this device. Enable Face ID or Touch ID in iPhone Settings first.');
        return;
      }
    }
    await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, value ? 'true' : 'false');
    setBiometricEnabled(value);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>{biometricLabel}</Text>
            <Text style={styles.rowSubtitle}>Lock app when it goes to background</Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleToggle}
            trackColor={{ true: '#6366f1' }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tags</Text>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/(app)/manage-tags')}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>Manage Tags</Text>
            <Text style={styles.rowSubtitle}>Archive or delete tags</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: '#1C1C1E', marginBottom: 24 },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 16, color: '#1C1C1E', fontWeight: '500' },
  rowSubtitle: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  signOutRow: { paddingHorizontal: 16, paddingVertical: 14 },
  signOutText: { fontSize: 16, color: '#FF3B30', fontWeight: '500' },
  chevron: { fontSize: 20, color: '#C7C7CC', fontWeight: '300' },
});
