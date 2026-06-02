import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Tag } from '@/lib/types';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { captureAutoMetadata } from '@/utils/autoMetadata';
import { generateTitle } from '@/utils/generateTitle';
import LocationPicker, { PlaceResult } from '@/components/LocationPicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

export default function NewEntryScreen() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [links, setLinks] = useState<string[]>(['']);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<PlaceResult | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { user } = useAuth();
  const router = useRouter();

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setInterimText('');
  });
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
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission needed', 'Please allow microphone and speech recognition access in Settings.');
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  };

  useFocusEffect(
    useCallback(() => {
      setTitle('');
      setContent('');
      setSelectedTags([]);
      setLinks(['']);
      setPhotos([]);
      setShowTagInput(false);
      setInterimText('');
      setSelectedLocation(null);
      fetchTags();
      return () => {
        if (listening) ExpoSpeechRecognitionModule.stop();
      };
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

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) setPhotos([...photos, result.assets[0].uri]);
  };

  const handleSave = async () => {
    if (!content.trim() && photos.length === 0) {
      Alert.alert('Empty entry', 'Please write something or add a photo.');
      return;
    }
    setSaving(true);
    try {
      const meta = await captureAutoMetadata();
      const tagNames = tags.filter(t => selectedTags.includes(t.id)).map(t => t.name);

      const resolvedTitle = title.trim() || await generateTitle({
        content: content.trim() || null,
        location_name: selectedLocation?.name ?? null,
        tags: tagNames,
        time_of_day: meta.time_of_day,
      });

      const { data: entry, error } = await supabase
        .from('entries')
        .insert({
          user_id: user?.id,
          title: resolvedTitle || null,
          content: content.trim() || null,
          latitude: selectedLocation?.latitude ?? meta.latitude,
          longitude: selectedLocation?.longitude ?? meta.longitude,
          location_name: selectedLocation?.name ?? null,
          time_of_day: meta.time_of_day,
        })
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
          style={styles.titleInput}
          placeholder="Title (optional)"
          placeholderTextColor="#AEAEB2"
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          autoFocus
        />
        <TextInput
          style={styles.contentInput}
          placeholder="What's on your mind..."
          placeholderTextColor="#AEAEB2"
          value={content}
          onChangeText={setContent}
          multiline
        />

        {/* Mic button + interim transcript */}
        <View style={styles.micRow}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.micButton, listening && styles.micButtonActive]}
              onPress={handleMicPress}
            >
              <Text style={styles.micIcon}>{listening ? '⏹' : '🎙'}</Text>
            </TouchableOpacity>
          </Animated.View>
          {listening && (
            <Text style={styles.listeningLabel}>Listening...</Text>
          )}
        </View>

        {interimText ? (
          <Text style={styles.interimText}>{interimText}</Text>
        ) : null}

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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LINKS</Text>
          {links.map((link, index) => (
            <TextInput
              key={index}
              style={styles.linkInput}
              placeholder="https://..."
              placeholderTextColor="#AEAEB2"
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
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => setShowLocationPicker(true)}>
            <Text style={styles.locationBtnText}>
              {selectedLocation ? `📍  ${selectedLocation.name}` : '📍  Add location'}
            </Text>
            {selectedLocation && (
              <TouchableOpacity onPress={() => setSelectedLocation(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.locationClear}>✕</Text>
              </TouchableOpacity>
            )}
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
          <View style={styles.photoButtons}>
            <TouchableOpacity style={[styles.photoButton, { flex: 1 }]} onPress={handlePickPhoto}>
              <Text style={styles.photoButtonText}>+ Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoButton, { flex: 1 }]} onPress={handleTakePhoto}>
              <Text style={styles.photoButtonText}>+ Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(place) => setSelectedLocation(place)}
        initial={selectedLocation}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 80, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', backgroundColor: '#FFFFFF' },
  title: { color: '#1C1C1E', fontSize: 17, fontWeight: '600' },
  cancel: { color: '#8E8E93', fontSize: 16 },
  save: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  titleInput: { color: '#1C1C1E', fontSize: 22, fontWeight: '600', padding: 20, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  contentInput: { color: '#1C1C1E', fontSize: 18, lineHeight: 28, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, minHeight: 160, backgroundColor: '#FFFFFF' },
  micRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12, backgroundColor: '#FFFFFF' },
  micButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  micButtonActive: { backgroundColor: '#FEE2E2', borderColor: '#ef4444' },
  micIcon: { fontSize: 22 },
  listeningLabel: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  interimText: { color: '#8E8E93', fontSize: 16, lineHeight: 24, paddingHorizontal: 20, paddingBottom: 12, fontStyle: 'italic', backgroundColor: '#FFFFFF' },
  section: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E5EA', backgroundColor: '#FFFFFF' },
  sectionLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA' },
  tagText: { color: '#8E8E93', fontSize: 14 },
  addTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#D1D1D6', borderStyle: 'dashed' },
  addTagText: { color: '#8E8E93', fontSize: 14 },
  tagInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tagInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, color: '#1C1C1E' },
  tagSave: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  tagSaveText: { color: '#fff', fontWeight: '600' },
  linkInput: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 12, color: '#1C1C1E', marginBottom: 8 },
  addLink: { color: '#6366f1', fontSize: 14, marginTop: 4 },
  thumbsRow: { marginBottom: 12 },
  thumbContainer: { position: 'relative', marginRight: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  removePhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  locationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F2F2F7', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E5E5EA' },
  locationBtnText: { color: '#6366f1', fontSize: 15, flex: 1 },
  locationClear: { color: '#8E8E93', fontSize: 16, paddingLeft: 8 },
  photoButtons: { flexDirection: 'row', gap: 8 },
  photoButton: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 14, alignItems: 'center' },
  photoButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
});
