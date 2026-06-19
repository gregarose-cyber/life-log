import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Tag {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}

export default function ManageTagsScreen() {
  const [tags, setTags] = useState<Tag[]>([]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => { fetchTags(); }, []);

  const fetchTags = async () => {
    const { data } = await supabase
      .from('tags')
      .select('id, name, color, archived')
      .eq('user_id', user?.id)
      .order('archived')
      .order('name');
    setTags(data || []);
  };

  const toggleArchive = async (tag: Tag) => {
    const { error } = await supabase
      .from('tags')
      .update({ archived: !tag.archived })
      .eq('id', tag.id);
    if (!error) {
      setTags(prev => prev.map(t => t.id === tag.id ? { ...t, archived: !t.archived } : t));
    }
  };

  const handleDelete = (tag: Tag) => {
    Alert.alert(
      'Delete Tag',
      `Delete "${tag.name}"? It will be removed from all entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await supabase.from('tags').delete().eq('id', tag.id);
            setTags(prev => prev.filter(t => t.id !== tag.id));
          }
        },
      ]
    );
  };

  const active = tags.filter(t => !t.archived);
  const archived = tags.filter(t => t.archived);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Manage Tags</Text>
      </View>

      <Text style={styles.sectionTitle}>ACTIVE</Text>
      <View style={styles.section}>
        {active.length === 0 && (
          <Text style={styles.empty}>No active tags</Text>
        )}
        {active.map((tag, i) => (
          <View key={tag.id} style={[styles.row, i < active.length - 1 && styles.rowBorder]}>
            <View style={[styles.dot, { backgroundColor: tag.color }]} />
            <Text style={styles.tagName}>{tag.name}</Text>
            <TouchableOpacity style={styles.archiveBtn} onPress={() => toggleArchive(tag)}>
              <Text style={styles.archiveBtnText}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(tag)}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {archived.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ARCHIVED</Text>
          <Text style={styles.sectionSubtitle}>Hidden from pickers but still shown on existing entries</Text>
          <View style={styles.section}>
            {archived.map((tag, i) => (
              <View key={tag.id} style={[styles.row, i < archived.length - 1 && styles.rowBorder]}>
                <View style={[styles.dot, { backgroundColor: tag.color + '66' }]} />
                <Text style={[styles.tagName, styles.tagNameArchived]}>{tag.name}</Text>
                <TouchableOpacity style={styles.unarchiveBtn} onPress={() => toggleArchive(tag)}>
                  <Text style={styles.unarchiveBtnText}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(tag)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  back: { color: '#6366f1', fontSize: 16 },
  heading: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#AEAEB2', marginBottom: 8 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 24, overflow: 'hidden' },
  empty: { color: '#AEAEB2', fontSize: 14, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  tagName: { flex: 1, fontSize: 15, color: '#1C1C1E' },
  tagNameArchived: { color: '#AEAEB2' },
  archiveBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F2F2F7', borderRadius: 8 },
  archiveBtnText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  unarchiveBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#EEF2FF', borderRadius: 8 },
  unarchiveBtnText: { fontSize: 13, color: '#6366f1', fontWeight: '500' },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  deleteBtnText: { fontSize: 13, color: '#FF3B30', fontWeight: '500' },
});
