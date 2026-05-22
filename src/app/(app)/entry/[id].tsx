import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<any>(null);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; id: string; storagePath: string }[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => { fetchEntry(); }, [id]);

const fetchPhotoUrls = async (photoRecords: any[]) => {
  const result = await Promise.all(
    photoRecords.map(async (photo) => {
      const { data } = await supabase.storage
        .from('entry-files')
        .createSignedUrl(photo.storage_path, 3600);
      return data?.signedUrl ? { url: data.signedUrl, id: photo.id, storagePath: photo.storage_path } : null;
    })
  );
  setPhotos(result.filter(Boolean) as { url: string; id: string; storagePath: string }[]);
};

const handleDeletePhoto = async (photoId: string, storagePath: string) => {
  await supabase.storage.from('entry-files').remove([storagePath]);
  await supabase.from('entry_photos').delete().eq('id', photoId);
  setPhotos(prev => prev.filter(p => p.id !== photoId));
};

  const fetchEntry = async () => {
    const { data } = await supabase
      .from('entries')
      .select(`*, tags:entry_tags(tag:tags(*)), photos:entry_photos(*), links:entry_links(*)`)
      .eq('id', id)
      .single();
    if (data) {
      setEntry(data);
      setContent(data.content || '');
      if (data.photos?.length > 0) fetchPhotoUrls(data.photos);
      else setPhotos([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('entries')
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);
    setEditing(false);
    fetchEntry();
  };

  const handleDelete = () => {
    Alert.alert('Delete Entry', 'This cannot be undone. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('entries').delete().eq('id', id);
          router.replace('/(app)');
        }
      }
    ]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (!entry) return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {editing ? (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={styles.save}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.edit}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.delete}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        <Text style={styles.date}>{formatDate(entry.created_at)}</Text>

        {editing ? (
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
          />
        ) : (
          <Text style={styles.content}>{entry.content || 'No text content'}</Text>
        )}

        {entry.tags?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagsRow}>
              {entry.tags.map((t: any) => (
                <View key={t.tag?.id} style={[styles.tag, { backgroundColor: t.tag?.color + '33' }]}>
                  <Text style={[styles.tagText, { color: t.tag?.color }]}>{t.tag?.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {entry.links?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LINKS</Text>
            {entry.links.map((link: any) => (
              <View key={link.id} style={styles.linkCard}>
                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
              </View>
            ))}
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PHOTOS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((photo) => (
                <TouchableOpacity key={photo.id} onPress={() => setSelectedPhotoUrl(photo.url)} style={styles.photoWrapper}>
                  <Image source={{ uri: photo.url }} style={styles.photo} contentFit="cover" />
                  {editing && (
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => handleDeletePhoto(photo.id, photo.storagePath)}
                    >
                      <Text style={styles.removePhotoText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Modal visible={!!selectedPhotoUrl} transparent animationType="fade" onRequestClose={() => setSelectedPhotoUrl(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedPhotoUrl(null)}>
            <Image source={{ uri: selectedPhotoUrl ?? '' }} style={styles.modalImage} contentFit="contain" />
          </TouchableOpacity>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  loading: { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#555' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  back: { color: '#6366f1', fontSize: 16 },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  edit: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  save: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  deleteBtn: {},
  delete: { color: '#ef4444', fontSize: 16 },
  scroll: { flex: 1, padding: 20 },
  date: { color: '#6366f1', fontSize: 13, fontWeight: '600', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { color: '#fff', fontSize: 18, lineHeight: 30 },
  contentInput: { color: '#fff', fontSize: 18, lineHeight: 30, minHeight: 200 },
  section: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingTop: 20 },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 14, fontWeight: '500' },
  linkCard: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, marginBottom: 8 },
  linkUrl: { color: '#6366f1', fontSize: 14 },
  photoWrapper: { position: 'relative', marginRight: 10 },
  photo: { width: 200, height: 200, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
});