import { useCallback, useRef, useState } from 'react';

interface UseVoiceRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      options.onError?.('Speech recognition tidak didukung di browser ini');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = options.lang || 'id-ID';
    recognition.continuous = options.continuous || false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      if (finalTranscript) {
        setTranscript(finalTranscript);
        options.onResult?.(finalTranscript.toLowerCase().trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        options.onError?.(event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, options]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
  };
}
