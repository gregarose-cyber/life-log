import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Tag } from '@/lib/types';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

export default function NewEntryScreen() {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [links, setLinks] = useState<string[]>(['']);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useFocusEffect(
  useCallback(() => {
    setContent('');
    setSelectedTags([]);
    setLinks(['']);
    setPhotos([]);
    setShowTagInput(false);
    fetchTags();
  }, [])
);

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('*').eq('user_id', user?.id);
    setTags(data || []);
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
      setTags([...tags, data]);
      setSelectedTags([...selectedTags, data.id]);
      setNewTagName('');
      setShowTagInput(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
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
    if (!result.canceled) setPhotos([...photos, ...result.assets.map(a => a.uri)]);
  };

  const handleSave = async () => {
    if (!content.trim() && photos.length === 0) {
      Alert.alert('Empty entry', 'Please write something or add a photo.');
      return;
    }
    setSaving(true);
    try {
      const { data: entry, error } = await supabase
        .from('entries')
        .insert({ user_id: user?.id, content: content.trim() || null })
        .select()
        .single();

      if (error || !entry) {
        Alert.alert('Error', error?.message ?? 'Could not save entry.');
        return;
      }

      if (selectedTags.length > 0) {
        await supabase.from('entry_tags').insert(
          selectedTags.map(tagId => ({ entry_id: entry.id, tag_id: tagId }))
        );
      }

      const validLinks = links.filter(l => l.trim());
      if (validLinks.length > 0) {
        await supabase.from('entry_links').insert(
          validLinks.map(url => ({ entry_id: entry.id, url: url.trim() }))
        );
      }

      for (const photoUri of photos) {
        const fileName = `${user?.id}/${entry.id}/${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await supabase.storage.from('entry-files').upload(fileName, bytes, { contentType: 'image/jpeg' });
        await supabase.from('entry_photos').insert({ entry_id: entry.id, storage_path: fileName });
      }

      router.replace('/(app)');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Entry</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={styles.save}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.contentInput}
          placeholder="What's on your mind..."
          placeholderTextColor="#444"
          value={content}
          onChangeText={setContent}
          multiline
          autoFocus
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TAGS</Text>
          <View style={styles.tagsRow}>
            {tags.map(tag => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.tag, selectedTags.includes(tag.id) && { backgroundColor: tag.color + '33', borderColor: tag.color }]}
                onPress={() => toggleTag(tag.id)}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag.id) && { color: tag.color }]}>{tag.name}</Text>
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
                placeholderTextColor="#555"
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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LINKS</Text>
          {links.map((link, index) => (
            <TextInput
              key={index}
              style={styles.linkInput}
              placeholder="https://..."
              placeholderTextColor="#444"
              value={link}
              onChangeText={(text) => {
                const updated = [...links];
                updated[index] = text;
                setLinks(updated);
              }}
              autoCapitalize="none"
              keyboardType="url"
            />
          ))}
          <TouchableOpacity onPress={() => setLinks([...links, ''])}>
            <Text style={styles.addLink}>+ Add another link</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbsRow}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.thumbContainer}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                  >
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
            <Text style={styles.photoButtonText}>+ Add Photos</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 80, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  title: { color: '#fff', fontSize: 17, fontWeight: '600' },
  cancel: { color: '#555', fontSize: 16 },
  save: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  contentInput: { color: '#fff', fontSize: 18, lineHeight: 28, padding: 20, minHeight: 200 },
  section: { padding: 20, borderTopWidth: 1, borderTopColor: '#1A1A1A' },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A' },
  tagText: { color: '#555', fontSize: 14 },
  addTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },
  addTagText: { color: '#555', fontSize: 14 },
  tagInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tagInput: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 8, padding: 10, color: '#fff' },
  tagSave: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  tagSaveText: { color: '#fff', fontWeight: '600' },
  linkInput: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, color: '#fff', marginBottom: 8 },
  addLink: { color: '#6366f1', fontSize: 14, marginTop: 4 },
  thumbsRow: { marginBottom: 12 },
  thumbContainer: { position: 'relative', marginRight: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  removePhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  photoButton: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: 14, alignItems: 'center' },
  photoButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
});