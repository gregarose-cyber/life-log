import * as Location from 'expo-location';

export interface AutoMetadata {
  latitude: number | null;
  longitude: number | null;
  time_of_day: string;
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export async function captureAutoMetadata(): Promise<AutoMetadata> {
  const time_of_day = getTimeOfDay();

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { latitude: null, longitude: null, time_of_day };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude, longitude } = location.coords;

    return { latitude, longitude, time_of_day };
  } catch {
    return { latitude: null, longitude: null, time_of_day };
  }
}
