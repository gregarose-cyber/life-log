import { useAuth } from '@/context/AuthContext';
import { Tag } from '@/lib/types';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [entry, setEntry] = useState<any>(null);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; id: string; storagePath: string }[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // edit-mode state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editLinks, setEditLinks] = useState<string[]>(['']);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const router = useRouter();

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => { setListening(false); setInterimText(''); });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setContent(prev => prev + (prev.trimEnd() ? ' ' : '') + transcript);
      setInterimText('');
    } else {
      setInterimText(transcript);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    Alert.alert('Speech error', event.message ?? event.error);
    setListening(false);
    setInterimText('');
  });

  useEffect(() => {
    if (listening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [listening]);

  const handleMicPress = async () => {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission needed', 'Please allow microphone and speech recognition access in Settings.');
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  };

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

  const startEditing = async () => {
    const { data: tagsData } = await supabase.from('tags').select('*').eq('user_id', user?.id);
    setAllTags(tagsData || []);
    setSelectedTagIds(entry.tags?.map((t: any) => t.tag?.id).filter(Boolean) ?? []);
    const existingLinks = entry.links?.map((l: any) => l.url) ?? [];
    setEditLinks(existingLinks.length > 0 ? existingLinks : ['']);
    setShowTagInput(false);
    setNewTagName('');
    setEditing(true);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: newTagName.trim(), color, user_id: user?.id })
      .select()
      .single();
    if (!error && data) {
      setAllTags([...allTags, data]);
      setSelectedTagIds([...selectedTagIds, data.id]);
      setNewTagName('');
      setShowTagInput(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        const fileName = `${user?.id}/${id}/${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await supabase.storage.from('entry-files').upload(fileName, bytes, { contentType: 'image/jpeg' });
        const { data: photoRecord } = await supabase
          .from('entry_photos')
          .insert({ entry_id: id, storage_path: fileName })
          .select()
          .single();
        if (photoRecord) {
          const { data: signed } = await supabase.storage.from('entry-files').createSignedUrl(fileName, 3600);
          if (signed?.signedUrl) {
            setPhotos(prev => [...prev, { url: signed.signedUrl, id: photoRecord.id, storagePath: fileName }]);
          }
        }
      }
    }
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    await supabase.storage.from('entry-files').remove([storagePath]);
    await supabase.from('entry_photos').delete().eq('id', photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase
        .from('entries')
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', id);

      await supabase.from('entry_tags').delete().eq('entry_id', id);
      if (selectedTagIds.length > 0) {
        await supabase.from('entry_tags').insert(
          selectedTagIds.map(tagId => ({ entry_id: id, tag_id: tagId }))
        );
      }

      await supabase.from('entry_links').delete().eq('entry_id', id);
      const validLinks = editLinks.filter(l => l.trim());
      if (validLinks.length > 0) {
        await supabase.from('entry_links').insert(
          validLinks.map(url => ({ entry_id: id, url: url.trim() }))
        );
      }

      setEditing(false);
      fetchEntry();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
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
            <TouchableOpacity onPress={startEditing}>
              <Text style={styles.edit}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.delete}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.date}>{formatDate(entry.created_at)}</Text>
        {(entry.weather || entry.time_of_day) && (
          <View style={styles.metaRow}>
            {entry.time_of_day ? <Text style={styles.metaText}>{entry.time_of_day}</Text> : null}
            {entry.weather ? <Text style={styles.metaText}>{entry.weather}</Text> : null}
          </View>
        )}

        {editing ? (
          <>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
            />
            <View style={styles.micRow}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[styles.micButton, listening && styles.micButtonActive]}
                  onPress={handleMicPress}
                >
                  <Text style={styles.micIcon}>{listening ? '⏹' : '🎙'}</Text>
                </TouchableOpacity>
              </Animated.View>
              {listening && <Text style={styles.listeningLabel}>Listening...</Text>}
            </View>
            {interimText ? <Text style={styles.interimText}>{interimText}</Text> : null}
          </>
        ) : (
          <Text style={styles.content}>{entry.content || 'No text content'}</Text>
        )}

        {/* TAGS */}
        {editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagsRow}>
              {allTags.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tag, selectedTagIds.includes(tag.id) && { backgroundColor: tag.color + '33', borderColor: tag.color }]}
                  onPress={() => setSelectedTagIds(prev =>
                    prev.includes(tag.id) ? prev.filter(i => i !== tag.id) : [...prev, tag.id]
                  )}
                >
                  <Text style={[styles.tagText, selectedTagIds.includes(tag.id) && { color: tag.color }]}>{tag.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addTag} onPress={() => setShowTagInput(true)}>
                <Text style={styles.addTagText}>+ New Tag</Text>
              </TouchableOpacity>
            </View>
            {showTagInput && (
              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Tag name..."
                  placeholderTextColor="#AEAEB2"
                  value={newTagName}
                  onChangeText={setNewTagName}
                  autoFocus
                />
                <TouchableOpacity style={styles.tagSave} onPress={handleAddTag}>
                  <Text style={styles.tagSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : entry.tags?.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagsRow}>
              {entry.tags.map((t: any) => (
                <View key={t.tag?.id} style={[styles.tag, { backgroundColor: t.tag?.color + '33', borderColor: t.tag?.color }]}>
                  <Text style={[styles.tagText, { color: t.tag?.color }]}>{t.tag?.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* LINKS */}
        {editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LINKS</Text>
            {editLinks.map((link, index) => (
              <View key={index} style={styles.linkEditRow}>
                <TextInput
                  style={styles.linkInput}
                  placeholder="https://..."
                  placeholderTextColor="#AEAEB2"
                  value={link}
                  onChangeText={(text) => {
                    const updated = [...editLinks];
                    updated[index] = text;
                    setEditLinks(updated);
                  }}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity onPress={() => setEditLinks(editLinks.filter((_, i) => i !== index))}>
                  <Text style={styles.removeLinkText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setEditLinks([...editLinks, ''])}>
              <Text style={styles.addLink}>+ Add link</Text>
            </TouchableOpacity>
          </View>
        ) : entry.links?.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LINKS</Text>
            {entry.links.map((link: any) => (
              <TouchableOpacity key={link.id} style={styles.linkCard} onPress={() => {
                const url = /^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`;
                Linking.openURL(url);
              }}>
                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* PHOTOS */}
        <View style={styles.section}>
          {(photos.length > 0 || editing) && <Text style={styles.sectionLabel}>PHOTOS</Text>}
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: editing ? 12 : 0 }}>
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
          )}
          {editing && (
            <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
              <Text style={styles.photoButtonText}>+ Add Photos</Text>
            </TouchableOpacity>
          )}
        </View>

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
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loading: { flex: 1, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8E8E93' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', backgroundColor: '#FFFFFF' },
  back: { color: '#6366f1', fontSize: 16 },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  edit: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  save: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  deleteBtn: {},
  delete: { color: '#ef4444', fontSize: 16 },
  scroll: { flex: 1, padding: 20, backgroundColor: '#FFFFFF' },
  date: { color: '#6366f1', fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metaText: { color: '#AEAEB2', fontSize: 13 },
  content: { color: '#1C1C1E', fontSize: 18, lineHeight: 30 },
  contentInput: { color: '#1C1C1E', fontSize: 18, lineHeight: 30, minHeight: 200 },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  micButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  micButtonActive: { backgroundColor: '#FEE2E2', borderColor: '#ef4444' },
  micIcon: { fontSize: 22 },
  listeningLabel: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  interimText: { color: '#8E8E93', fontSize: 16, lineHeight: 24, marginBottom: 8, fontStyle: 'italic' },
  section: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#E5E5EA', paddingTop: 20 },
  sectionLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  // tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA' },
  tagText: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },
  addTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#D1D1D6', borderStyle: 'dashed' },
  addTagText: { color: '#8E8E93', fontSize: 14 },
  tagInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tagInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, color: '#1C1C1E' },
  tagSave: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  tagSaveText: { color: '#fff', fontWeight: '600' },
  // links
  linkCard: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 12, marginBottom: 8 },
  linkUrl: { color: '#6366f1', fontSize: 14 },
  linkEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  linkInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 8, padding: 12, color: '#1C1C1E' },
  removeLinkText: { color: '#8E8E93', fontSize: 18, paddingHorizontal: 4 },
  addLink: { color: '#6366f1', fontSize: 14, marginTop: 4 },
  // photos
  photoWrapper: { position: 'relative', marginRight: 10 },
  photo: { width: 200, height: 200, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoButton: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 14, alignItems: 'center' },
  photoButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
});
