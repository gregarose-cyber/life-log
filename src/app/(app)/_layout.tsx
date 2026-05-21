import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F0F0F',
          borderTopColor: '#2A2A2A',
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#555',
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
    </Tabs>
  );
}