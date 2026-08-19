import { useCallback, useRef, useState } from 'react';

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  priority?: 'high' | 'normal' | 'low';
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRef = useRef<{ text: string; options: SpeechOptions }[]>([]);
  const isSpeakingRef = useRef(false);

  const getVoice = useCallback((lang: string) => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer Indonesian voice
    let voice = voices.find(v => v.lang.startsWith('id'));
    if (!voice) voice = voices.find(v => v.lang.startsWith(lang));
    if (!voice) voice = voices.find(v => v.lang.startsWith('en'));
    return voice || voices[0];
  }, []);

  const speak = useCallback((text: string, options: SpeechOptions = {}) => {
    if (!('speechSynthesis' in window)) return;

    const {
      lang = 'id-ID',
      rate = 1.1,
      pitch = 1.0,
      volume = 1.0,
      priority = 'normal'
    } = options;

    if (priority === 'high') {
      window.speechSynthesis.cancel();
      queueRef.current = [];
    }

    if (isSpeakingRef.current && priority !== 'high') {
      queueRef.current.push({ text, options });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const voice = getVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      // Process queue
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        speak(next.text, next.options);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [getVoice]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    queueRef.current = [];
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

  return { speak, stop, isSpeaking };
}
