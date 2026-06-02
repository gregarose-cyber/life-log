import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureAutoMetadata } from '@/utils/autoMetadata';
import { generateTitle } from '@/utils/generateTitle';
import { EntryTemplate, TEMPLATES, serializeTemplate } from './EntryTemplates';
import LocationPicker, { PlaceResult } from './LocationPicker';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'capture' | 'pick-template' | 'fill-template';

export default function QuickCaptureModal({ visible, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('capture');
  const [entryTitle, setEntryTitle] = useState('');
  const [freeText, setFreeText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EntryTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<PlaceResult | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const { user } = useAuth();

  const reset = () => {
    setStep('capture');
    setEntryTitle('');
    setFreeText('');
    setSelectedTemplate(null);
    setFieldValues({});
    setSelectedLocation(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePickTemplate = (template: EntryTemplate) => {
    setSelectedTemplate(template);
    setFieldValues({});
    setStep('fill-template');
  };

  const handleSave = async () => {
    const content = selectedTemplate
      ? serializeTemplate(selectedTemplate, fieldValues)
      : freeText.trim();

    if (!content) {
      Alert.alert('Empty', 'Please add some content before saving.');
      return;
    }

    setSaving(true);
    try {
      const meta = await captureAutoMetadata();

      const templateFields = selectedTemplate
        ? selectedTemplate.fields.map(f => `${f.label}: ${fieldValues[f.key] ?? ''}`).join(', ')
        : undefined;

      const resolvedTitle = entryTitle.trim() || await generateTitle({
        content: selectedTemplate ? undefined : freeText.trim() || undefined,
        location_name: selectedLocation?.name ?? null,
        time_of_day: meta.time_of_day,
        template_name: selectedTemplate?.name,
        template_fields: templateFields,
      });

      const { data: entry, error } = await supabase
        .from('entries')
        .insert({
          user_id: user?.id,
          title: resolvedTitle || null,
          content,
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

      if (selectedTemplate) {
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', user?.id)
          .eq('name', selectedTemplate.name)
          .single();

        let tagId = existingTag?.id;

        if (!tagId) {
          const colors: Record<string, string> = {
            food: '#f59e0b',
            golf: '#10b981',
            movie: '#6366f1',
            place: '#ec4899',
          };
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ user_id: user?.id, name: selectedTemplate.name, color: colors[selectedTemplate.id] ?? '#6366f1' })
            .select('id')
            .single();
          tagId = newTag?.id;
        }

        if (tagId) {
          await supabase.from('entry_tags').insert({ entry_id: entry.id, tag_id: tagId });
        }
      }

      reset();
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const LocationButton = () => (
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
  );

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              {step !== 'capture' ? (
                <TouchableOpacity onPress={() => setStep(step === 'fill-template' ? 'pick-template' : 'capture')}>
                  <Text style={styles.headerBack}>← Back</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.headerCancel}>Cancel</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.headerTitle}>
                {step === 'capture' ? 'Quick Capture' : step === 'pick-template' ? 'Choose Template' : selectedTemplate?.name ?? ''}
              </Text>
              {step !== 'pick-template' ? (
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                  <Text style={styles.headerSave}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 50 }} />
              )}
            </View>

            {/* STEP: free-form capture */}
            {step === 'capture' && (
              <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={styles.titleInput}
                  placeholder="Title (optional)"
                  placeholderTextColor="#AEAEB2"
                  value={entryTitle}
                  onChangeText={setEntryTitle}
                  returnKeyType="next"
                  autoFocus
                />
                <TextInput
                  style={styles.freeInput}
                  placeholder="What's on your mind..."
                  placeholderTextColor="#AEAEB2"
                  value={freeText}
                  onChangeText={setFreeText}
                  multiline
                />
                <LocationButton />
                <TouchableOpacity style={styles.templateToggle} onPress={() => setStep('pick-template')}>
                  <Text style={styles.templateToggleText}>📋  Use a template</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* STEP: pick template */}
            {step === 'pick-template' && (
              <ScrollView style={styles.body} contentContainerStyle={styles.templateGrid}>
                {TEMPLATES.map(t => (
                  <TouchableOpacity key={t.id} style={styles.templateCard} onPress={() => handlePickTemplate(t)}>
                    <Text style={styles.templateIcon}>{t.icon}</Text>
                    <Text style={styles.templateName}>{t.name}</Text>
                    <Text style={styles.templateFieldCount}>{t.fields.length} fields</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* STEP: fill template */}
            {step === 'fill-template' && selectedTemplate && (
              <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
                {selectedTemplate.fields.map((field, index) => (
                  <View key={field.key} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      style={[styles.fieldInput, field.multiline && styles.fieldInputMultiline]}
                      placeholder={field.placeholder}
                      placeholderTextColor="#AEAEB2"
                      value={fieldValues[field.key] ?? ''}
                      onChangeText={text => setFieldValues(prev => ({ ...prev, [field.key]: text }))}
                      multiline={field.multiline}
                      autoFocus={index === 0}
                      returnKeyType={field.multiline ? 'default' : 'next'}
                    />
                  </View>
                ))}
                <View style={styles.fieldRow}>
                  <LocationButton />
                </View>
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(place) => setSelectedLocation(place)}
        initial={selectedLocation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', minHeight: '60%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { color: '#1C1C1E', fontSize: 16, fontWeight: '600' },
  headerCancel: { color: '#8E8E93', fontSize: 16, width: 60 },
  headerBack: { color: '#6366f1', fontSize: 16, width: 60 },
  headerSave: { color: '#6366f1', fontSize: 16, fontWeight: '600', width: 60, textAlign: 'right' },
  body: { flex: 1 },
  // free text
  titleInput: { color: '#1C1C1E', fontSize: 20, fontWeight: '600', padding: 20, paddingBottom: 6 },
  freeInput: { color: '#1C1C1E', fontSize: 17, lineHeight: 26, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20, minHeight: 120 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  locationBtnText: { color: '#6366f1', fontSize: 15, flex: 1 },
  locationClear: { color: '#8E8E93', fontSize: 16, paddingLeft: 8 },
  templateToggle: { marginHorizontal: 20, marginBottom: 20, padding: 14, backgroundColor: '#F2F2F7', borderRadius: 10, borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center' },
  templateToggleText: { color: '#8E8E93', fontSize: 15 },
  // template picker
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  templateCard: { width: '47%', backgroundColor: '#F2F2F7', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center', gap: 6 },
  templateIcon: { fontSize: 32 },
  templateName: { color: '#1C1C1E', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  templateFieldCount: { color: '#8E8E93', fontSize: 12 },
  // template form
  fieldRow: { paddingHorizontal: 20, paddingTop: 18 },
  fieldLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  fieldInput: { backgroundColor: '#F2F2F7', borderRadius: 10, padding: 12, color: '#1C1C1E', fontSize: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
