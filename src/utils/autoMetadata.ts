import * as Location from 'expo-location';

export interface AutoMetadata {
  latitude: number | null;
  longitude: number | null;
  weather: string | null;
  time_of_day: string;
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

async function fetchWeather(lat: number, lon: number): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const temp = Math.round(data.main?.temp ?? 0);
    const condition = data.weather?.[0]?.main ?? '';
    return condition ? `${temp}°F, ${condition}` : `${temp}°F`;
  } catch {
    return null;
  }
}

export async function captureAutoMetadata(): Promise<AutoMetadata> {
  const time_of_day = getTimeOfDay();

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { latitude: null, longitude: null, weather: null, time_of_day };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude, longitude } = location.coords;
    const weather = await fetchWeather(latitude, longitude);

    return { latitude, longitude, weather, time_of_day };
  } catch {
    return { latitude: null, longitude: null, weather: null, time_of_day };
  }
}
