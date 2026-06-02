import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';

export interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Prediction {
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (place: PlaceResult) => void;
  initial?: PlaceResult | null;
}

export default function LocationPicker({ visible, onClose, onSelect, initial }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (visible) {
      setSelected(initial ?? null);
      setQuery(initial?.name ?? '');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (selected) {
      mapRef.current?.animateToRegion({
        latitude: selected.latitude,
        longitude: selected.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }, [selected]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => fetchAutocomplete(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchAutocomplete = async (input: string) => {
    if (!PLACES_KEY) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${PLACES_KEY}&types=establishment%7Cgeocode`
      );
      const data = await res.json();
      setResults(data.predictions ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    setResults([]);
    setQuery(prediction.structured_formatting.main_text);
    if (!PLACES_KEY) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=name,formatted_address,geometry&key=${PLACES_KEY}`
      );
      const data = await res.json();
      const r = data.result;
      if (r?.geometry) {
        setSelected({
          name: r.name,
          address: r.formatted_address,
          latitude: r.geometry.location.lat,
          longitude: r.geometry.location.lng,
        });
      }
    } catch {}
  };

  const handleCurrentLocation = async () => {
    setLoadingCurrent(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      if (PLACES_KEY) {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${PLACES_KEY}`
        );
        const data = await res.json();
        const place = data.results?.[0];
        if (place) {
          const name = place.address_components?.[0]?.long_name ?? place.formatted_address;
          setSelected({ name, address: place.formatted_address, latitude, longitude });
          setQuery(name);
          setResults([]);
          return;
        }
      }

      // Fallback: Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'User-Agent': 'LifeLogApp/1.0' } }
      );
      const json = await res.json();
      const name = json.name ?? json.address?.road ?? 'Current Location';
      const city = json.address?.city ?? json.address?.town ?? json.address?.suburb ?? '';
      const displayName = city ? `${name}, ${city}` : name;
      setSelected({ name: displayName, address: json.display_name ?? '', latitude, longitude });
      setQuery(displayName);
      setResults([]);
    } catch {} finally {
      setLoadingCurrent(false);
    }
  };

  const handleConfirm = () => {
    if (selected) { onSelect(selected); onClose(); }
  };

  const showMap = selected != null && results.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Location</Text>
          <TouchableOpacity onPress={handleConfirm} disabled={!selected}>
            <Text style={[styles.confirm, !selected && styles.confirmDisabled]}>Confirm</Text>
          </TouchableOpacity>
        </View>

        {/* Current location */}
        <TouchableOpacity style={styles.currentBtn} onPress={handleCurrentLocation} disabled={loadingCurrent}>
          {loadingCurrent
            ? <ActivityIndicator color="#F59E0B" />
            : <Text style={styles.currentBtnText}>📍  Use my current location</Text>
          }
        </TouchableOpacity>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search places..."
            placeholderTextColor="#A89880"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {searching && <ActivityIndicator color="#F59E0B" style={{ marginLeft: 8 }} />}
        </View>

        {/* Results list */}
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={item => item.place_id}
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => handleSelectPrediction(item)}>
                <Text style={styles.resultMain}>{item.structured_formatting.main_text}</Text>
                <Text style={styles.resultSecondary}>{item.structured_formatting.secondary_text}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Selected place + map */}
        {showMap && (
          <>
            <View style={styles.selectedCard}>
              <Text style={styles.selectedName}>{selected!.name}</Text>
              <Text style={styles.selectedAddress} numberOfLines={2}>{selected!.address}</Text>
            </View>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: selected!.latitude,
                longitude: selected!.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={{ latitude: selected!.latitude, longitude: selected!.longitude }}
                pinColor="#F59E0B"
              />
            </MapView>
          </>
        )}

        {!showMap && results.length === 0 && !query && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Search for a place or use your current location</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1512' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4A4438',
  },
  title: { color: '#F5F0E8', fontSize: 17, fontWeight: '600' },
  cancel: { color: '#A89880', fontSize: 16 },
  confirm: { color: '#F59E0B', fontSize: 16, fontWeight: '700' },
  confirmDisabled: { color: '#4A4438' },
  currentBtn: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#252018',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4A4438',
    alignItems: 'center',
  },
  currentBtnText: { color: '#F59E0B', fontSize: 15, fontWeight: '500' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#322D26',
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#4A4438',
  },
  searchInput: { flex: 1, color: '#F5F0E8', fontSize: 16, paddingVertical: 12 },
  results: { flex: 1, marginTop: 8 },
  resultRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2420',
  },
  resultMain: { color: '#F5F0E8', fontSize: 15, fontWeight: '500' },
  resultSecondary: { color: '#A89880', fontSize: 13, marginTop: 3 },
  selectedCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#252018',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F59E0B55',
  },
  selectedName: { color: '#F5F0E8', fontSize: 17, fontWeight: '600' },
  selectedAddress: { color: '#A89880', fontSize: 13, marginTop: 4 },
  map: {
    flex: 1,
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#A89880', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
