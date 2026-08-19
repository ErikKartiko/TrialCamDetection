import { useState, useCallback, useRef } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  city?: string;
  district?: string;
  street?: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface RouteData {
  totalDistance: number;
  totalDuration: number;
  steps: RouteStep[];
  destinationName: string;
}

export function useLocation() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const getCurrentPosition = useCallback((): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung di browser ini'));
        return;
      }

      setIsLocating(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=id`
            );
            const data = await response.json();
            
            const locationData: LocationData = {
              latitude,
              longitude,
              accuracy,
              address: data.display_name,
              city: data.address?.city || data.address?.town || data.address?.village,
              district: data.address?.suburb || data.address?.district,
              street: data.address?.road,
            };
            
            setCurrentLocation(locationData);
            setIsLocating(false);
            resolve(locationData);
          } catch {
            const locationData: LocationData = { latitude, longitude, accuracy };
            setCurrentLocation(locationData);
            setIsLocating(false);
            resolve(locationData);
          }
        },
        (err) => {
          setIsLocating(false);
          setError(err.message);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  const searchPlace = useCallback(async (query: string): Promise<{
    lat: number;
    lon: number;
    name: string;
  } | null> => {
    try {
      // Add Indonesia bias to search
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=id&accept-language=id`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          name: data[0].display_name,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const getRoute = useCallback(async (
    destination: string
  ): Promise<RouteData | null> => {
    try {
      setIsNavigating(true);
      setError(null);

      // Get current location first
      const current = await getCurrentPosition();
      
      // Search for destination
      const dest = await searchPlace(destination);
      if (!dest) {
        setError('Lokasi tujuan tidak ditemukan');
        setIsNavigating(false);
        return null;
      }

      // Get route from OSRM
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${current.longitude},${current.latitude};${dest.lon},${dest.lat}?steps=true&overview=false&language=id`
      );
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes[0]) {
        setError('Tidak dapat menemukan rute');
        setIsNavigating(false);
        return null;
      }

      const routeData = data.routes[0];
      const legs = routeData.legs[0];

      // Convert OSRM maneuver types to Indonesian instructions
      const translateManeuver = (step: any): string => {
        const type = step.maneuver.type;
        const modifier = step.maneuver.modifier;
        const name = step.name || 'jalan';
        const distance = Math.round(step.distance);

        switch (type) {
          case 'depart':
            return `Mulai berjalan ke arah ${modifier || 'depan'}, menuju ${name}`;
          case 'turn':
            if (modifier === 'left') return `Belok kiri ke ${name}, ${distance} meter`;
            if (modifier === 'right') return `Belok kanan ke ${name}, ${distance} meter`;
            if (modifier === 'slight left') return `Belok sedikit ke kiri ke ${name}, ${distance} meter`;
            if (modifier === 'slight right') return `Belok sedikit ke kanan ke ${name}, ${distance} meter`;
            if (modifier === 'sharp left') return `Belok tajam ke kiri ke ${name}, ${distance} meter`;
            if (modifier === 'sharp right') return `Belok tajam ke kanan ke ${name}, ${distance} meter`;
            return `Belok ke ${name}, ${distance} meter`;
          case 'continue':
            return `Lurus terus di ${name}, ${distance} meter`;
          case 'arrive':
            return `Anda telah sampai di tujuan`;
          case 'roundabout':
            return `Masuk bundaran, ambil jalan keluar ke ${name}`;
          case 'fork':
            if (modifier === 'left') return `Ambil jalur kiri ke ${name}`;
            if (modifier === 'right') return `Ambil jalur kanan ke ${name}`;
            return `Di pertigaan, menuju ${name}`;
          default:
            return `Lanjutkan ke ${name}, ${distance} meter`;
        }
      };

      const steps: RouteStep[] = legs.steps.map((step: any) => ({
        instruction: translateManeuver(step),
        distance: step.distance,
        duration: step.duration,
      }));

      const result: RouteData = {
        totalDistance: routeData.distance,
        totalDuration: routeData.duration,
        steps,
        destinationName: dest.name,
      };

      setRoute(result);
      setIsNavigating(false);
      return result;
    } catch (err) {
      setError('Gagal mendapatkan rute');
      setIsNavigating(false);
      return null;
    }
  }, [getCurrentPosition, searchPlace]);

  const startWatchingPosition = useCallback((onUpdate: (location: LocationData) => void) => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const locationData: LocationData = { latitude, longitude, accuracy };
        setCurrentLocation(locationData);
        onUpdate(locationData);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );
  }, []);

  const stopWatchingPosition = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} meter`;
    }
    return `${(meters / 1000).toFixed(1)} kilometer`;
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} menit`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} jam ${remainingMinutes} menit`;
  }, []);

  return {
    currentLocation,
    isLocating,
    route,
    isNavigating,
    error,
    getCurrentPosition,
    searchPlace,
    getRoute,
    startWatchingPosition,
    stopWatchingPosition,
    formatDistance,
    formatDuration,
  };
}
