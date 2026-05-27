import BiometricGate from '@/components/BiometricGate';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function AppLayout() {
  return (
    <BiometricGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E5EA',
            paddingBottom: 8,
            height: 60,
          },
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#8E8E93',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Journal',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="new-entry"
          options={{
            title: 'New Entry',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="entry/[id]" options={{ href: null }} />
      </Tabs>
    </BiometricGate>
  );
}
