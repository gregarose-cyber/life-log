const base = require('./app.json');

module.exports = ({ config }) => ({
  ...base.expo,
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    'expo-secure-store',
    [
      'react-native-maps',
      {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow Life Log to use Face ID to unlock the app.',
      },
    ],
    'expo-speech-recognition',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Life Log uses your location to tag entries with where you are.',
      },
    ],
  ],
});
