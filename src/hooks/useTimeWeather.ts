import { useState, useCallback } from 'react';

export interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  icon: string;
}

export function useTimeWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const getCurrentTime = useCallback((): string => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    const hourStr = hours.toString().padStart(2, '0');
    const minStr = minutes.toString().padStart(2, '0');
    
    let period = '';
    if (hours >= 5 && hours < 11) period = 'pagi';
    else if (hours >= 11 && hours < 15) period = 'siang';
    else if (hours >= 15 && hours < 18) period = 'sore';
    else period = 'malam';

    return `Sekarang jam ${hourStr}:${minStr} ${period}`;
  }, []);

  const getCurrentDate = useCallback((): string => {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const dayName = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();

    return `Hari ini ${dayName}, tanggal ${date} ${month} ${year}`;
  }, []);

  const getWeather = useCallback(async (lat: number, lon: number): Promise<WeatherData | null> => {
    setIsLoadingWeather(true);
    
    try {
      // Using Open-Meteo API (free, no API key needed)
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia/Jakarta`
      );
      
      const data = await response.json();
      const current = data.current;

      // Weather code descriptions in Indonesian
      const weatherDescriptions: Record<number, string> = {
        0: 'cerah',
        1: 'sebagian besar cerah',
        2: 'berawan sebagian',
        3: 'berawan',
        45: 'berkabut',
        48: 'berkabut tebal',
        51: 'gerimis ringan',
        53: 'gerimis',
        55: 'gerimis lebat',
        61: 'hujan ringan',
        63: 'hujan',
        65: 'hujan lebat',
        71: 'salju ringan',
        73: 'salju',
        75: 'salju lebat',
        80: 'hujan ringan',
        81: 'hujan',
        82: 'hujan sangat lebat',
        95: 'badai petir',
        96: 'badai petir dengan hujan es',
        99: 'badai petir dengan hujan es lebat',
      };

      const weatherData: WeatherData = {
        temperature: Math.round(current.temperature_2m),
        description: weatherDescriptions[current.weather_code] || 'tidak diketahui',
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        feelsLike: Math.round(current.apparent_temperature),
        icon: getWeatherIcon(current.weather_code),
      };

      setWeather(weatherData);
      setIsLoadingWeather(false);
      return weatherData;
    } catch {
      setIsLoadingWeather(false);
      return null;
    }
  }, []);

  const getWeatherIcon = (code: number): string => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌧️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return '❄️';
    if (code <= 82) return '🌧️';
    return '⛈️';
  };

  const formatWeatherReport = useCallback((data: WeatherData): string => {
    return `Cuaca saat ini ${data.description}, suhu ${data.temperature} derajat celsius, ` +
      `terasa seperti ${data.feelsLike} derajat. ` +
      `Kelembaban ${data.humidity} persen, kecepatan angin ${data.windSpeed} kilometer per jam.`;
  }, []);

  const getBatteryStatus = useCallback(async (): Promise<string> => {
    try {
      // @ts-ignore - Battery API
      const battery = await navigator.getBattery?.();
      if (battery) {
        const level = Math.round(battery.level * 100);
        const charging = battery.charging ? 'sedang mengisi daya' : 'tidak mengisi daya';
        return `Baterai ${level} persen, ${charging}`;
      }
      return 'Informasi baterai tidak tersedia';
    } catch {
      return 'Informasi baterai tidak tersedia';
    }
  }, []);

  return {
    weather,
    isLoadingWeather,
    getCurrentTime,
    getCurrentDate,
    getWeather,
    formatWeatherReport,
    getBatteryStatus,
  };
}
