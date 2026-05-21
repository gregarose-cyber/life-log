import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Entry } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function JournalScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut, user } = useAuth();
  const router = useRouter();

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select(`*, tags:entry_tags(tag:tags(*)), photos:entry_photos(*), links:entry_links(*)`)
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) Alert.alert('Error', error.message);
    else setEntries(data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchEntries(); }, []));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderEntry = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/entry/${item.id}`)}>
      <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      {item.content ? (
        <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
      ) : (
        <Text style={styles.noContent}>Voice entry</Text>
      )}
      <View style={styles.meta}>
        {item.tags?.length > 0 && (
          <View style={styles.tags}>
            {item.tags.slice(0, 3).map((t: any) => (
              <View key={t.tag?.id} style={[styles.tag, { backgroundColor: t.tag?.color + '33' }]}>
                <Text style={[styles.tagText, { color: t.tag?.color }]}>{t.tag?.name}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.indicators}>
          {item.photos?.length > 0 && <Text style={styles.indicator}>ðŸ“· {item.photos.length}</Text>}
          {item.links?.length > 0 && <Text style={styles.indicator}>ðŸ”— {item.links.length}</Text>}
          {item.audio_url && <Text style={styles.indicator}>ðŸŽ¤</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Life Log</Text>
        <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: signOut }
        ])}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchEntries} tintColor="#6366f1" />}
        contentContainerStyle={entries.length === 0 ? styles.empty : styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No entries yet</Text>
              <Text style={styles.emptySubtext}>Tap New Entry to start journaling</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  signOut: { color: '#555', fontSize: 14 },
  list: { padding: 16 },
  empty: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 120 },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#555', fontSize: 14 },
  card: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  date: { color: '#6366f1', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { color: '#fff', fontSize: 16, lineHeight: 24, marginBottom: 12 },
  noContent: { color: '#555', fontSize: 16, fontStyle: 'italic', marginBottom: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '500' },
  indicators: { flexDirection: 'row', gap: 8 },
  indicator: { fontSize: 12, color: '#888' },
});