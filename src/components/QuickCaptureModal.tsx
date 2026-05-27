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
import { EntryTemplate, TEMPLATES, serializeTemplate } from './EntryTemplates';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'capture' | 'pick-template' | 'fill-template';

export default function QuickCaptureModal({ visible, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('capture');
  const [freeText, setFreeText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EntryTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const reset = () => {
    setStep('capture');
    setFreeText('');
    setSelectedTemplate(null);
    setFieldValues({});
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
      const { data: entry, error } = await supabase
        .from('entries')
        .insert({ user_id: user?.id, content })
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

  return (
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
                style={styles.freeInput}
                placeholder="What's on your mind..."
                placeholderTextColor="#555"
                value={freeText}
                onChangeText={setFreeText}
                multiline
                autoFocus
              />
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
                    placeholderTextColor="#555"
                    value={fieldValues[field.key] ?? ''}
                    onChangeText={text => setFieldValues(prev => ({ ...prev, [field.key]: text }))}
                    multiline={field.multiline}
                    autoFocus={index === 0}
                    returnKeyType={field.multiline ? 'default' : 'next'}
                  />
                </View>
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', minHeight: '60%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCancel: { color: '#555', fontSize: 16, width: 60 },
  headerBack: { color: '#6366f1', fontSize: 16, width: 60 },
  headerSave: { color: '#6366f1', fontSize: 16, fontWeight: '600', width: 60, textAlign: 'right' },
  body: { flex: 1 },
  // free text
  freeInput: { color: '#fff', fontSize: 17, lineHeight: 26, padding: 20, minHeight: 140 },
  templateToggle: { marginHorizontal: 20, marginBottom: 20, padding: 14, backgroundColor: '#1E1E1E', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center' },
  templateToggleText: { color: '#888', fontSize: 15 },
  // template picker
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  templateCard: { width: '47%', backgroundColor: '#1E1E1E', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', gap: 6 },
  templateIcon: { fontSize: 32 },
  templateName: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  templateFieldCount: { color: '#555', fontSize: 12 },
  // template form
  fieldRow: { paddingHorizontal: 20, paddingTop: 18 },
  fieldLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  fieldInput: { backgroundColor: '#1E1E1E', borderRadius: 10, padding: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
