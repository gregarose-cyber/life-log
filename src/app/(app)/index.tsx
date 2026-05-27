import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Entry } from '@/lib/types';
import QuickCaptureModal from '@/components/QuickCaptureModal';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function JournalScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const loadedIds = useRef<Set<string>>(new Set());
  const { signOut, user } = useAuth();
  const router = useRouter();

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select(`*, tags:entry_tags(tag:tags(*)), photos:entry_photos(*), links:entry_links(*)`)
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) { Alert.alert('Error', error.message); setLoading(false); return; }

    const fetched = data || [];
    setEntries(fetched);
    setLoading(false); // render entries immediately, fetch thumbnails after

    const firstPhotos = fetched
      .filter((e: any) => e.photos?.length > 0 && !loadedIds.current.has(e.id))
      .map((e: any) => ({ entryId: e.id, path: e.photos[0].storage_path }));

    if (firstPhotos.length > 0) {
      const { data: signed } = await supabase.storage
        .from('entry-files')
        .createSignedUrls(firstPhotos.map(p => p.path), 3600);
      const map: Record<string, string> = {};
      signed?.forEach((item, i) => {
        if (item.signedUrl) {
          map[firstPhotos[i].entryId] = item.signedUrl;
          loadedIds.current.add(firstPhotos[i].entryId);
        }
      });
      setThumbnails(prev => ({ ...prev, ...map }));
    }
  };

  useFocusEffect(useCallback(() => { fetchEntries(); }, []));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderEntry = ({ item }: { item: any }) => {
    const thumbUrl = thumbnails[item.id];
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/entry/${item.id}`)}>
        <View style={styles.cardInner}>
          <View style={styles.cardText}>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            {item.content ? (
              <Text style={styles.content} numberOfLines={thumbUrl ? 2 : 3}>{item.content}</Text>
            ) : (
              <Text style={styles.noContent}>Photo entry</Text>
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
                {item.photos?.length > 0 && <Text style={styles.indicator}>📷 {item.photos.length}</Text>}
                {item.links?.length > 0 && <Text style={styles.indicator}>🔗 {item.links.length}</Text>}
              </View>
            </View>
          </View>
          {thumbUrl && (
            <Image source={{ uri: thumbUrl }} style={styles.thumbnail} contentFit="cover" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Life Log</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.quickCaptureBtn} onPress={() => setQuickCaptureOpen(true)}>
            <Text style={styles.quickCaptureBtnText}>⚡ Capture</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut }
          ])}>
            <Text style={styles.signOut}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <QuickCaptureModal
        visible={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onSaved={() => { setQuickCaptureOpen(false); fetchEntries(); }}
      />

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
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  quickCaptureBtn: { backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  quickCaptureBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  signOut: { color: '#8E8E93', fontSize: 14 },
  list: { padding: 16 },
  empty: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 120 },
  emptyText: { color: '#1C1C1E', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#8E8E93', fontSize: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  cardInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardText: { flex: 1 },
  thumbnail: { width: 72, height: 72, borderRadius: 10, flexShrink: 0 },
  date: { color: '#6366f1', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { color: '#1C1C1E', fontSize: 16, lineHeight: 24, marginBottom: 12 },
  noContent: { color: '#8E8E93', fontSize: 16, fontStyle: 'italic', marginBottom: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '500' },
  indicators: { flexDirection: 'row', gap: 8 },
  indicator: { fontSize: 12, color: '#8E8E93' },
});
