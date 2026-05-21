import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const { data } = await supabase
      .from('entries')
      .select(`*, tags:entry_tags(tag:tags(*)), photos:entry_photos(*), links:entry_links(*)`)
      .eq('user_id', user?.id)
      .ilike('content', `%${text}%`)
      .order('created_at', { ascending: false });

    setResults(data || []);
    setSearched(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search your entries..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/entry/${item.id}`)}
          >
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            {item.content ? (
              <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
            ) : (
              <Text style={styles.noContent}>Voice entry</Text>
            )}
            <View style={styles.tags}>
              {item.tags?.slice(0, 3).map((t: any) => (
                <View key={t.tag?.id} style={[styles.tag, { backgroundColor: t.tag?.color + '33' }]}>
                  <Text style={[styles.tagText, { color: t.tag?.color }]}>{t.tag?.name}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          searched ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No entries found</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  searchBar: { paddingHorizontal: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  list: { padding: 16 },
  card: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  date: { color: '#6366f1', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { color: '#fff', fontSize: 16, lineHeight: 24, marginBottom: 10 },
  noContent: { color: '#555', fontSize: 16, fontStyle: 'italic', marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#555', fontSize: 14 },
});