import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeech } from './hooks/useSpeech';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { useObjectDetection, DetectedObject, translateObject } from './hooks/useObjectDetection';
import { useCamera } from './hooks/useCamera';
import { useHaptic } from './hooks/useHaptic';
import { useLocation, RouteData } from './hooks/useLocation';
import { useCurrency } from './hooks/useCurrency';
import { useTimeWeather } from './hooks/useTimeWeather';
import { LoadingScreen } from './components/LoadingScreen';
import { DetectionOverlay } from './components/DetectionOverlay';
import { VoiceWave } from './components/VoiceWave';
import { ModeSelector, AppMode } from './components/ModeSelector';
import { NavigationPanel } from './components/NavigationPanel';
import { CurrencyResultDisplay } from './components/CurrencyResult';

type AppPhase = 'loading' | 'welcome' | 'active';

function App() {
  // ─── STATE ───
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [mode, setMode] = useState<AppMode>('idle');
  const [loadingText, setLoadingText] = useState('Mempersiapkan VisioBantu...');
  const [lastAnnounced, setLastAnnounced] = useState<string>('');
  const [detectionCount, setDetectionCount] = useState(0);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [navigationStepIndex, setNavigationStepIndex] = useState(0);
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  // ─── REFS ───
  const containerRef = useRef<HTMLDivElement>(null);
  const lastObjectsRef = useRef<string>('');
  const announceCooldownRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const currencyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── HOOKS ───
  const { speak, stop: stopSpeech, isSpeaking } = useSpeech();
  const { videoRef, isActive: isCameraActive, startCamera, stopCamera, switchCamera } = useCamera();
  const { 
    isModelReady, detections, error: modelError,
    loadModel, startContinuousDetection, stopDetection 
  } = useObjectDetection();
  const haptic = useHaptic();
  const { 
    currentLocation, isLocating, isNavigating,
    getCurrentPosition, getRoute, formatDistance, formatDuration 
  } = useLocation();
  const { isAnalyzing, lastResult, detectCurrency, formatDenomination } = useCurrency();
  const { 
    isLoadingWeather, 
    getCurrentTime, getCurrentDate, getWeather, formatWeatherReport, getBatteryStatus 
  } = useTimeWeather();

  // Voice recognition
  const { isListening, startListening, isSupported: isVoiceSupported } = useVoiceRecognition({
    lang: 'id-ID',
    onResult: handleVoiceCommand,
  });

  // ─── INITIALIZATION ───
  useEffect(() => {
    const init = async () => {
      setLoadingText('Memuat model pengenalan objek...');
      await loadModel();
      setLoadingText('Model siap! Mempersiapkan antarmuka...');
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }

      setTimeout(() => setPhase('welcome'), 1000);
    };
    init();

    return () => {
      stopDetection();
      stopCamera();
      stopSpeech();
      if (currencyIntervalRef.current) clearInterval(currencyIntervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── WELCOME GREETING ───
  useEffect(() => {
    if (phase === 'welcome') {
      const timer = setTimeout(() => {
        speak(
          'Selamat datang di VisioBantu, asisten penglihatan pribadi Anda. ' +
          'Ketuk layar untuk membuka menu fitur. ' +
          'Atau geser ke atas untuk perintah suara. ' +
          'Fitur yang tersedia: deteksi benda, cek uang, lokasi, navigasi, dan informasi.',
          { priority: 'high', rate: 0.95 }
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, speak]);

  // ─── CONTAINER SIZE ───
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ─── MODE CHANGE HANDLER ───
  useEffect(() => {
    // Cleanup previous mode
    stopDetection();
    if (currencyIntervalRef.current) {
      clearInterval(currencyIntervalRef.current);
      currencyIntervalRef.current = null;
    }

    // Start new mode
    switch (mode) {
      case 'objectScan':
        startObjectScan();
        break;
      case 'currencyScan':
        startCurrencyScan();
        break;
      case 'location':
        announceLocation();
        break;
      case 'navigation':
        if (pendingDestination) {
          startNavigation(pendingDestination);
        } else {
          speak('Sebutkan tujuan Anda setelah bunyi.', { priority: 'high' });
          setTimeout(() => startListening(), 2000);
        }
        break;
      case 'info':
        announceInfo();
        break;
      case 'emergency':
        activateEmergency();
        break;
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── OBJECT DETECTION ───
  const announceDetections = useCallback((objects: DetectedObject[]) => {
    const now = Date.now();
    if (now - announceCooldownRef.current < 3000) return;
    if (objects.length === 0) return;

    const objectSignature = objects.map(o => o.class).sort().join(',');
    if (objectSignature === lastObjectsRef.current) return;
    
    lastObjectsRef.current = objectSignature;
    announceCooldownRef.current = now;

    const counts: Record<string, number> = {};
    objects.forEach(o => {
      const name = translateObject(o.class);
      counts[name] = (counts[name] || 0) + 1;
    });

    const parts: string[] = [];
    Object.entries(counts).forEach(([name, count]) => {
      if (count > 1) parts.push(`${count} ${name}`);
      else parts.push(name);
    });

    const announcement = `Terdeteksi: ${parts.join(', ')}`;
    setLastAnnounced(announcement);
    setDetectionCount(objects.length);
    speak(announcement, { rate: 1.15 });
    haptic.notification();
  }, [speak, haptic]);

  const startObjectScan = useCallback(async () => {
    if (!isModelReady) {
      speak('Model belum siap. Mohon tunggu.', { priority: 'high' });
      return;
    }

    if (!isCameraActive) {
      speak('Mengaktifkan kamera...', { priority: 'high' });
      const success = await startCamera();
      if (!success) {
        speak('Tidak dapat mengakses kamera.', { priority: 'high' });
        setMode('idle');
        return;
      }
    }

    speak('Mode deteksi benda aktif. Arahkan kamera ke sekitar Anda.', { priority: 'high' });
    haptic.success();

    setTimeout(() => {
      if (videoRef.current) {
        startContinuousDetection(videoRef.current, announceDetections, 800, 0.45);
      }
    }, 1000);
  }, [isModelReady, isCameraActive, startCamera, startContinuousDetection, announceDetections, speak, haptic, videoRef]);

  const generateSceneDescription = useCallback((objects: DetectedObject[]) => {
    if (objects.length === 0) {
      speak('Tidak ada benda yang terdeteksi. Coba arahkan kamera ke arah lain.', { priority: 'high' });
      return;
    }

    const counts: Record<string, { count: number; positions: string[] }> = {};
    
    objects.forEach(o => {
      const name = translateObject(o.class);
      if (!counts[name]) counts[name] = { count: 0, positions: [] };
      counts[name].count++;

      const [x, , w] = o.bbox;
      const centerX = x + w / 2;
      const videoWidth = videoRef.current?.videoWidth || 640;
      
      if (centerX < videoWidth * 0.33) counts[name].positions.push('kiri');
      else if (centerX > videoWidth * 0.66) counts[name].positions.push('kanan');
      else counts[name].positions.push('tengah');
    });

    let description = 'Deskripsi pemandangan: ';
    const parts: string[] = [];
    
    Object.entries(counts).forEach(([name, info]) => {
      const positions = [...new Set(info.positions)].join(' dan ');
      if (info.count > 1) parts.push(`${info.count} ${name} di bagian ${positions}`);
      else parts.push(`${name} di bagian ${positions}`);
    });

    description += parts.join('. ') + '.';

    const largeObjects = objects.filter(o => {
      const [, , w, h] = o.bbox;
      const videoWidth = videoRef.current?.videoWidth || 640;
      const videoHeight = videoRef.current?.videoHeight || 480;
      return (w * h) / (videoWidth * videoHeight) > 0.3;
    });

    if (largeObjects.length > 0) {
      const closeName = translateObject(largeObjects[0].class);
      description += ` Perhatian: ${closeName} terlihat sangat dekat.`;
      haptic.warning();
    }

    setLastAnnounced(description);
    speak(description, { priority: 'high', rate: 0.95 });
  }, [speak, haptic, videoRef]);

  // ─── CURRENCY DETECTION ───
  const startCurrencyScan = useCallback(async () => {
    if (!isCameraActive) {
      speak('Mengaktifkan kamera...', { priority: 'high' });
      const success = await startCamera();
      if (!success) {
        speak('Tidak dapat mengakses kamera.', { priority: 'high' });
        setMode('idle');
        return;
      }
    }

    speak('Mode cek uang aktif. Letakkan uang kertas di depan kamera dengan pencahayaan yang baik.', { priority: 'high' });
    haptic.success();

    // Start periodic currency detection
    setTimeout(() => {
      const detectLoop = async () => {
        if (videoRef.current && mode === 'currencyScan') {
          const result = await detectCurrency(videoRef.current);
          if (result) {
            const genuineText = result.isLikelyGenuine 
              ? 'Uang terlihat asli.' 
              : 'Perlu verifikasi lebih lanjut.';
            const announcement = `${formatDenomination(result.denomination)}. ${genuineText}`;
            setLastAnnounced(announcement);
            speak(announcement, { priority: 'high' });
            haptic.notification();
          }
        }
      };

      currencyIntervalRef.current = setInterval(detectLoop, 3000);
      detectLoop();
    }, 1500);
  }, [isCameraActive, startCamera, detectCurrency, formatDenomination, speak, haptic, videoRef, mode]);

  // ─── LOCATION ───
  const announceLocation = useCallback(async () => {
    speak('Mencari lokasi Anda saat ini...', { priority: 'high' });
    haptic.tap();

    try {
      const location = await getCurrentPosition();
      let announcement = '';

      if (location.street) {
        announcement = `Anda berada di ${location.street}`;
        if (location.district) announcement += `, ${location.district}`;
        if (location.city) announcement += `, ${location.city}`;
      } else if (location.address) {
        announcement = `Lokasi Anda: ${location.address}`;
      } else {
        announcement = `Koordinat Anda: ${location.latitude.toFixed(4)} lintang, ${location.longitude.toFixed(4)} bujur. Akurasi ${Math.round(location.accuracy)} meter.`;
      }

      setLastAnnounced(announcement);
      speak(announcement, { priority: 'high', rate: 0.95 });
      haptic.success();
    } catch {
      speak('Tidak dapat mendapatkan lokasi. Pastikan GPS aktif dan izin lokasi diberikan.', { priority: 'high' });
    }

    setMode('idle');
  }, [getCurrentPosition, speak, haptic]);

  // ─── NAVIGATION ───
  const startNavigation = useCallback(async (destination: string) => {
    speak(`Mencari rute ke ${destination}...`, { priority: 'high' });
    haptic.tap();

    try {
      const routeData = await getRoute(destination);
      if (routeData) {
        setCurrentRoute(routeData);
        setNavigationStepIndex(0);

        const summary = `Rute ditemukan ke ${routeData.destinationName.split(',')[0]}. ` +
          `Jarak total ${formatDistance(routeData.totalDistance)}, ` +
          `perkiraan waktu ${formatDuration(routeData.totalDuration)}. ` +
          `Langkah pertama: ${routeData.steps[0].instruction}`;

        setLastAnnounced(summary);
        speak(summary, { priority: 'high', rate: 0.9 });
        haptic.success();
      } else {
        speak('Tidak dapat menemukan rute ke tujuan tersebut.', { priority: 'high' });
        setMode('idle');
      }
    } catch {
      speak('Gagal mendapatkan rute navigasi.', { priority: 'high' });
      setMode('idle');
    }
    setPendingDestination(null);
  }, [getRoute, formatDistance, formatDuration, speak, haptic]);

  const nextNavigationStep = useCallback(() => {
    if (!currentRoute) return;
    
    if (navigationStepIndex < currentRoute.steps.length - 1) {
      const newIndex = navigationStepIndex + 1;
      setNavigationStepIndex(newIndex);
      const step = currentRoute.steps[newIndex];
      speak(step.instruction, { priority: 'high' });
      haptic.tap();
    } else {
      speak('Anda telah sampai di tujuan!', { priority: 'high' });
      haptic.success();
      setCurrentRoute(null);
      setMode('idle');
    }
  }, [currentRoute, navigationStepIndex, speak, haptic]);

  const repeatNavigationStep = useCallback(() => {
    if (!currentRoute) return;
    const step = currentRoute.steps[navigationStepIndex];
    speak(step.instruction, { priority: 'high' });
    haptic.tap();
  }, [currentRoute, navigationStepIndex, speak, haptic]);

  // ─── INFO ───
  const announceInfo = useCallback(async () => {
    speak('Mengumpulkan informasi...', { priority: 'high' });
    haptic.tap();

    const time = getCurrentTime();
    const date = getCurrentDate();
    const battery = await getBatteryStatus();

    let announcement = `${time}. ${date}. ${battery}.`;

    // Get weather if we have location
    if (currentLocation) {
      const weatherData = await getWeather(currentLocation.latitude, currentLocation.longitude);
      if (weatherData) {
        announcement += ` ${formatWeatherReport(weatherData)}`;
      }
    }

    setLastAnnounced(announcement);
    speak(announcement, { priority: 'high', rate: 0.95 });
    haptic.success();
    setMode('idle');
  }, [getCurrentTime, getCurrentDate, getBatteryStatus, currentLocation, getWeather, formatWeatherReport, speak, haptic]);

  // ─── EMERGENCY ───
  const activateEmergency = useCallback(async () => {
    haptic.warning();
    speak('MODE DARURAT AKTIF. Mencari lokasi Anda untuk dibagikan.', { priority: 'high', rate: 1.1 });

    try {
      const location = await getCurrentPosition();
      
      let locationText = '';
      if (location.street) {
        locationText = `${location.street}, ${location.district || ''}, ${location.city || ''}`;
      } else if (location.address) {
        locationText = location.address;
      } else {
        locationText = `Koordinat: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      }

      const announcement = 
        `Lokasi darurat Anda: ${locationText}. ` +
        `Nomor darurat: Polisi 110, Ambulans 118, Pemadam 113, SAR 115. ` +
        `Ketuk dua kali untuk menelepon 112. ` +
        `Koordinat GPS: ${location.latitude.toFixed(6)} lintang, ${location.longitude.toFixed(6)} bujur.`;

      setLastAnnounced(announcement);
      speak(announcement, { priority: 'high', rate: 0.9 });

      // Store location for potential sharing
      if (navigator.clipboard) {
        const shareText = `DARURAT! Lokasi saya: ${locationText}\nGoogle Maps: https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        navigator.clipboard.writeText(shareText).catch(() => {});
      }

    } catch {
      speak('Tidak dapat mendapatkan lokasi. Nomor darurat: 112 untuk semua keadaan darurat.', { priority: 'high' });
    }
  }, [getCurrentPosition, speak, haptic]);

  const callEmergency = useCallback(() => {
    haptic.warning();
    speak('Menghubungi 112', { priority: 'high' });
    // Open phone dialer
    window.location.href = 'tel:112';
  }, [speak, haptic]);

  // ─── VOICE COMMAND HANDLER ───
  function handleVoiceCommand(command: string) {
    haptic.tap();
    const cmd = command.toLowerCase();

    // Mode selection by number
    if (cmd.includes('1') || cmd.includes('satu')) {
      speak('Mode deteksi benda', { priority: 'high' });
      setMode('objectScan');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('2') || cmd.includes('dua')) {
      speak('Mode cek uang', { priority: 'high' });
      setMode('currencyScan');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('3') || cmd.includes('tiga')) {
      speak('Mode lokasi', { priority: 'high' });
      setMode('location');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('4') || cmd.includes('empat')) {
      speak('Mode navigasi. Sebutkan tujuan Anda.', { priority: 'high' });
      setTimeout(() => startListening(), 2000);
      return;
    }
    if (cmd.includes('5') || cmd.includes('lima')) {
      speak('Mode informasi', { priority: 'high' });
      setMode('info');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('6') || cmd.includes('enam') || cmd.includes('darurat') || cmd.includes('tolong') || cmd.includes('emergency') || cmd.includes('sos')) {
      speak('Mode darurat', { priority: 'high' });
      setMode('emergency');
      setShowModeSelector(false);
      return;
    }

    // Feature commands
    if (cmd.includes('deteksi') || cmd.includes('scan') || cmd.includes('benda') || cmd.includes('lihat')) {
      speak('Memulai deteksi benda', { priority: 'high' });
      setMode('objectScan');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('uang') || cmd.includes('rupiah') || cmd.includes('cek uang')) {
      speak('Memulai pengecekan uang', { priority: 'high' });
      setMode('currencyScan');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('lokasi') || cmd.includes('posisi') || cmd.includes('dimana')) {
      speak('Mencari lokasi', { priority: 'high' });
      setMode('location');
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('navigasi') || cmd.includes('arah') || cmd.includes('rute') || cmd.includes('pergi ke') || cmd.includes('jalan ke')) {
      // Extract destination
      let destination = '';
      if (cmd.includes('ke ')) {
        destination = cmd.split('ke ').pop() || '';
      } else if (cmd.includes('menuju ')) {
        destination = cmd.split('menuju ').pop() || '';
      }
      
      if (destination) {
        setPendingDestination(destination);
        setMode('navigation');
      } else {
        speak('Sebutkan tujuan Anda. Contoh: navigasi ke Monas', { priority: 'high' });
        setTimeout(() => startListening(), 2500);
      }
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('waktu') || cmd.includes('jam') || cmd.includes('tanggal') || cmd.includes('cuaca') || cmd.includes('info')) {
      speak('Mengambil informasi', { priority: 'high' });
      setMode('info');
      setShowModeSelector(false);
      return;
    }

    // Navigation controls
    if (mode === 'navigation' && currentRoute) {
      if (cmd.includes('selanjutnya') || cmd.includes('lanjut') || cmd.includes('next')) {
        nextNavigationStep();
        return;
      }
      if (cmd.includes('ulangi') || cmd.includes('ulang')) {
        repeatNavigationStep();
        return;
      }
    }

    // General commands
    if (cmd.includes('stop') || cmd.includes('berhenti') || cmd.includes('selesai')) {
      speak('Mode dihentikan', { priority: 'high' });
      setMode('idle');
      setCurrentRoute(null);
      setShowModeSelector(false);
      return;
    }
    if (cmd.includes('menu') || cmd.includes('fitur')) {
      setShowModeSelector(true);
      speak('Menu fitur terbuka. Ketuk atau ucapkan nomor fitur.', { priority: 'high' });
      return;
    }
    if (cmd.includes('jelaskan') || cmd.includes('deskripsi') || cmd.includes('apa yang ada')) {
      if (mode === 'objectScan') {
        generateSceneDescription(detections);
      } else {
        speak('Aktifkan mode deteksi benda terlebih dahulu', { priority: 'high' });
      }
      return;
    }
    if (cmd.includes('ganti kamera') || cmd.includes('balik kamera')) {
      speak('Mengganti kamera', { priority: 'high' });
      switchCamera();
      return;
    }
    if (cmd.includes('bantuan') || cmd.includes('help') || cmd.includes('tolong')) {
      speakHelp();
      return;
    }

    // If in navigation mode waiting for destination
    if (pendingDestination === null && (mode === 'navigation' || cmd.length > 2)) {
      // Assume it's a destination
      setPendingDestination(command);
      setMode('navigation');
      return;
    }

    speak(`Perintah tidak dikenali. Ucapkan bantuan untuk panduan.`, { priority: 'high' });
  }

  const speakHelp = useCallback(() => {
    speak(
      'Panduan VisioBantu. ' +
      'Ucapkan angka 1 sampai 6 untuk memilih fitur. ' +
      'Satu: deteksi benda. Dua: cek uang. Tiga: lokasi. Empat: navigasi. Lima: informasi. Enam: darurat. ' +
      'Gestur: Ketuk sekali untuk menu. Ketuk dua kali untuk aksi cepat. Geser atas untuk suara. Geser bawah untuk bantuan. ' +
      'Ucapkan stop untuk berhenti. Bantuan untuk mendengar ini lagi.',
      { priority: 'high', rate: 0.9 }
    );
  }, [speak]);

  // ─── TOUCH GESTURES ───
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 30 && dt < 500) {
      // Tap
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < 350) {
        // Double tap
        haptic.doubleTap();
        if (mode === 'objectScan') {
          generateSceneDescription(detections);
        } else if (mode === 'navigation' && currentRoute) {
          nextNavigationStep();
        } else if (mode === 'emergency') {
          callEmergency();
        } else {
          // Start voice command
          if (isVoiceSupported) {
            stopSpeech();
            speak('Mendengarkan...', { priority: 'high', rate: 1.2 });
            setTimeout(() => startListening(), 1000);
          }
        }
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
        setTimeout(() => {
          if (lastTapRef.current === now) {
            // Single tap
            haptic.tap();
            if (phase === 'welcome') {
              setPhase('active');
              setShowModeSelector(true);
              speak('Menu fitur. Pilih dengan ketuk atau suara.', { priority: 'high' });
            } else if (showModeSelector) {
              setShowModeSelector(false);
            } else {
              setShowModeSelector(true);
              speak('Menu fitur', { priority: 'high' });
            }
          }
        }, 360);
      }
    } else if (dist > 50 && dt < 600) {
      // Swipe
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absY > absX) {
        if (dy < -50) {
          // Swipe up - voice command
          haptic.tap();
          setShowModeSelector(false);
          if (isVoiceSupported) {
            stopSpeech();
            speak('Mendengarkan perintah suara', { priority: 'high', rate: 1.2 });
            setTimeout(() => startListening(), 1500);
          } else {
            speak('Perintah suara tidak didukung', { priority: 'high' });
          }
        } else if (dy > 50) {
          // Swipe down - help/menu
          haptic.tap();
          if (showModeSelector) {
            speakHelp();
          } else {
            setShowModeSelector(true);
            speak('Menu fitur', { priority: 'high' });
          }
        }
      } else {
        if (dx > 50) {
          // Swipe right - next step (navigation) or switch camera
          haptic.tap();
          if (mode === 'navigation' && currentRoute) {
            nextNavigationStep();
          } else {
            speak('Mengganti kamera', { priority: 'high' });
            switchCamera();
          }
        } else if (dx < -50) {
          // Swipe left - repeat or back
          haptic.tap();
          if (mode === 'navigation' && currentRoute) {
            repeatNavigationStep();
          } else if (lastAnnounced) {
            speak(lastAnnounced, { priority: 'high' });
          }
        }
      }
    }

    touchStartRef.current = null;
  }, [
    phase, mode, detections, lastAnnounced, currentRoute, showModeSelector, isVoiceSupported,
    haptic, speak, stopSpeech, generateSceneDescription, nextNavigationStep, repeatNavigationStep,
    startListening, switchCamera, speakHelp
  ]);

  // ─── KEYBOARD SUPPORT ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const modes: AppMode[] = ['objectScan', 'currencyScan', 'location', 'navigation', 'info'];
        const modeIndex = parseInt(e.key) - 1;
        setMode(modes[modeIndex]);
        setShowModeSelector(false);
      } else {
        switch (e.key) {
          case ' ':
          case 'Enter':
            e.preventDefault();
            if (phase === 'welcome') {
              setPhase('active');
              setShowModeSelector(true);
            } else {
              setShowModeSelector(!showModeSelector);
            }
            break;
          case 'v':
          case 'V':
            if (isVoiceSupported) {
              stopSpeech();
              speak('Mendengarkan', { priority: 'high', rate: 1.2 });
              setTimeout(() => startListening(), 1000);
            }
            break;
          case 'h':
          case 'H':
            speakHelp();
            break;
          case 'Escape':
            setMode('idle');
            setShowModeSelector(false);
            setCurrentRoute(null);
            stopSpeech();
            break;
          case 'ArrowRight':
            if (mode === 'navigation' && currentRoute) {
              nextNavigationStep();
            }
            break;
          case 'ArrowLeft':
            if (mode === 'navigation' && currentRoute) {
              repeatNavigationStep();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    phase, mode, currentRoute, showModeSelector, isVoiceSupported,
    nextNavigationStep, repeatNavigationStep, speakHelp, speak, stopSpeech, startListening
  ]);

  // ─── SELECT MODE HANDLER ───
  const handleSelectMode = useCallback((selectedMode: AppMode) => {
    const modeNames: Record<AppMode, string> = {
      idle: 'Mode standby',
      objectScan: 'Mode deteksi benda',
      currencyScan: 'Mode cek uang',
      location: 'Mode lokasi',
      navigation: 'Mode navigasi',
      voiceCommand: 'Perintah suara',
      info: 'Mode informasi',
      emergency: 'Mode darurat',
    };
    speak(modeNames[selectedMode], { priority: 'high' });
    setMode(selectedMode);
    setShowModeSelector(false);
    haptic.tap();
  }, [speak, haptic]);

  // ─── RENDER: LOADING ───
  if (phase === 'loading') {
    return (
      <LoadingScreen
        progress={loadingText}
        subText={modelError || undefined}
      />
    );
  }

  // ─── RENDER: WELCOME ───
  if (phase === 'welcome') {
    return (
      <div
        className="fixed inset-0 bg-dark flex flex-col items-center justify-center p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="main"
        aria-label="Halaman selamat datang VisioBantu"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-glow-blue/5 rounded-full blur-3xl animate-breathe" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-glow-purple/5 rounded-full blur-3xl animate-breathe" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-glow-blue/20 to-glow-purple/20 flex items-center justify-center border border-white/10">
              <span className="text-6xl">👁️</span>
            </div>
            <div className="absolute -inset-2 rounded-full border-2 border-glow-blue/20 animate-breathe" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-3">VisioBantu</h1>
          <p className="text-glow-blue text-lg mb-8 font-medium">Asisten Penglihatan AI</p>

          <div className="grid grid-cols-3 gap-3 mb-8 w-full">
            {[
              { icon: '👁️', label: 'Benda' },
              { icon: '💵', label: 'Uang' },
              { icon: '📍', label: 'Lokasi' },
              { icon: '🧭', label: 'Navigasi' },
              { icon: '📊', label: 'Info' },
              { icon: '🆘', label: 'Darurat' },
            ].map((item, i) => (
              <div key={i} className="glass rounded-xl p-3 flex flex-col items-center animate-fade-in-up" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                <span className="text-2xl mb-1">{item.icon}</span>
                <span className="text-white/60 text-xs">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="animate-breathe">
            <p className="text-white/60 text-sm">Ketuk untuk membuka menu fitur</p>
          </div>

          {isSpeaking && (
            <div className="mt-6 flex items-center gap-3">
              <VoiceWave active={true} />
              <span className="text-glow-blue text-sm">Berbicara...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RENDER: ACTIVE ───
  const getModeDisplay = () => {
    switch (mode) {
      case 'objectScan': return { icon: '👁️', label: 'Deteksi Benda', color: '#00ff88' };
      case 'currencyScan': return { icon: '💵', label: 'Cek Uang', color: '#fbbf24' };
      case 'location': return { icon: '📍', label: 'Lokasi', color: '#00d4ff' };
      case 'navigation': return { icon: '🧭', label: 'Navigasi', color: '#a855f7' };
      case 'info': return { icon: '📊', label: 'Informasi', color: '#00d4ff' };
      case 'emergency': return { icon: '🆘', label: 'DARURAT', color: '#ef4444' };
      default: return { icon: '⏸️', label: 'Standby', color: '#666' };
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <div
      className="fixed inset-0 bg-dark flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="application"
      aria-label="VisioBantu aktif"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {lastAnnounced}
      </div>

      {/* Camera View */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          aria-hidden="true"
        />

        {/* Scanning overlay for object detection */}
        {mode === 'objectScan' && (
          <>
            <div className="scan-line" />
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-glow-green/60 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-glow-green/60 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-glow-green/60 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-glow-green/60 rounded-br-lg" />
          </>
        )}

        {/* Currency scanning overlay */}
        {mode === 'currencyScan' && (
          <>
            <div className="absolute inset-x-8 top-1/4 bottom-1/4 border-2 border-dashed border-warning/50 rounded-2xl" />
            <div className="absolute inset-x-8 top-1/4 -translate-y-8 text-center">
              <span className="text-warning text-sm glass px-3 py-1 rounded-full">Letakkan uang di dalam kotak</span>
            </div>
          </>
        )}

        {/* Detection boxes */}
        {mode === 'objectScan' && (
          <DetectionOverlay
            detections={detections}
            videoWidth={videoRef.current?.videoWidth || 640}
            videoHeight={videoRef.current?.videoHeight || 480}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        )}

        {/* Navigation panel */}
        {mode === 'navigation' && (
          <NavigationPanel
            route={currentRoute}
            currentStepIndex={navigationStepIndex}
            isActive={true}
            formatDistance={formatDistance}
            formatDuration={formatDuration}
          />
        )}

        {/* Currency result */}
        {mode === 'currencyScan' && (
          <CurrencyResultDisplay result={lastResult} isAnalyzing={isAnalyzing} />
        )}

        {/* Emergency mode overlay */}
        {mode === 'emergency' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="glass rounded-3xl p-8 m-4 text-center border-2 border-danger/50">
              <div className="text-6xl mb-4 animate-pulse">🆘</div>
              <h2 className="text-2xl font-bold text-danger mb-4">MODE DARURAT</h2>
              <div className="space-y-3 text-left mb-6">
                <div className="flex items-center gap-3 text-white">
                  <span className="text-xl">🚔</span>
                  <span>Polisi: 110</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <span className="text-xl">🚑</span>
                  <span>Ambulans: 118</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <span className="text-xl">🚒</span>
                  <span>Pemadam: 113</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <span className="text-xl">📞</span>
                  <span>Darurat Umum: 112</span>
                </div>
              </div>
              <button
                onClick={callEmergency}
                className="w-full bg-danger hover:bg-danger/80 text-white font-bold py-4 px-6 rounded-2xl text-lg transition-colors"
              >
                📞 Panggil 112
              </button>
              <p className="text-white/50 text-xs mt-4">
                Ketuk dua kali layar untuk menelepon 112
              </p>
            </div>
          </div>
        )}

        {/* Status bar - top */}
        <div className="absolute top-0 left-0 right-0 p-3 z-20">
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="status-dot" style={{ backgroundColor: modeDisplay.color, color: modeDisplay.color }} />
              <span className="text-xl">{modeDisplay.icon}</span>
              <span className="text-white text-sm font-medium">{modeDisplay.label}</span>
            </div>

            {mode === 'objectScan' && detectionCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-glow-green text-sm font-bold">{detectionCount}</span>
                <span className="text-white/60 text-xs">objek</span>
              </div>
            )}

            {(isSpeaking || isListening) && <VoiceWave active={true} color={isListening ? '#a855f7' : '#00d4ff'} />}
          </div>
        </div>

        {/* Voice listening indicator */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-dark/80">
            <div className="glass rounded-3xl p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-glow-purple/20 flex items-center justify-center">
                  <span className="text-4xl">🎤</span>
                </div>
                <div className="pulse-ring w-20 h-20 absolute inset-0" style={{ borderColor: '#a855f7' }} />
              </div>
              <VoiceWave active={true} color="#a855f7" />
              <p className="text-white text-lg font-medium">Mendengarkan...</p>
              <p className="text-white/50 text-sm text-center">
                {mode === 'navigation' && !currentRoute 
                  ? 'Sebutkan tujuan Anda' 
                  : 'Ucapkan perintah atau nomor fitur'}
              </p>
            </div>
          </div>
        )}

        {/* Loading indicators */}
        {(isLocating || isNavigating || isLoadingWeather) && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="glass rounded-2xl px-6 py-4 flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-glow-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-white">
                {isLocating ? 'Mencari lokasi...' : isNavigating ? 'Mencari rute...' : 'Memuat cuaca...'}
              </span>
            </div>
          </div>
        )}

        {/* Idle state */}
        {mode === 'idle' && !isCameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <span className="text-6xl block mb-4">👆</span>
              <p className="text-white/60 text-lg">Ketuk untuk membuka menu</p>
              <p className="text-white/40 text-sm mt-2">atau geser ke atas untuk suara</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="bg-surface border-t border-white/5">
        {lastAnnounced && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5" style={{ color: modeDisplay.color }}>●</span>
              <p className="text-white text-sm leading-relaxed flex-1">{lastAnnounced}</p>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="px-4 py-3 flex items-center justify-around">
          <button
            className="flex flex-col items-center gap-1 p-2 rounded-xl active:bg-white/10 transition-colors min-w-[56px]"
            onClick={() => {
              haptic.tap();
              setShowModeSelector(true);
              speak('Menu fitur', { priority: 'high' });
            }}
            aria-label="Menu fitur"
          >
            <span className="text-2xl">📋</span>
            <span className="text-white/50 text-[10px]">Menu</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 p-2 rounded-xl active:bg-white/10 transition-colors min-w-[56px]"
            onClick={() => {
              haptic.tap();
              if (isVoiceSupported) {
                stopSpeech();
                speak('Mendengarkan', { priority: 'high', rate: 1.2 });
                setTimeout(() => startListening(), 1000);
              }
            }}
            aria-label="Perintah suara"
          >
            <span className="text-2xl">🎤</span>
            <span className="text-white/50 text-[10px]">Suara</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 p-2 rounded-xl active:bg-white/10 transition-colors min-w-[56px]"
            onClick={() => {
              haptic.tap();
              if (lastAnnounced) speak(lastAnnounced, { priority: 'high' });
            }}
            aria-label="Ulangi"
          >
            <span className="text-2xl">🔄</span>
            <span className="text-white/50 text-[10px]">Ulangi</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 p-2 rounded-xl active:bg-white/10 transition-colors min-w-[56px]"
            onClick={() => {
              haptic.tap();
              setMode('idle');
              setCurrentRoute(null);
              stopSpeech();
              speak('Mode dihentikan', { priority: 'high' });
            }}
            aria-label="Berhenti"
          >
            <span className="text-2xl">⏹️</span>
            <span className="text-white/50 text-[10px]">Stop</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Modal */}
      <ModeSelector
        currentMode={mode}
        onSelectMode={handleSelectMode}
        isVisible={showModeSelector}
        onClose={() => {
          setShowModeSelector(false);
          haptic.tap();
        }}
      />
    </div>
  );
}

export default App;
