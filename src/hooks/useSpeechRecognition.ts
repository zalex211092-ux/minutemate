// src/hooks/useSpeechRecognition.ts

import { useState, useRef, useCallback, useEffect } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecordingMarker {
  id: string;
  timestamp: number;
  label: string;
  type: 'decision' | 'action' | 'keypoint';
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  resetTranscript: () => void;
  state: RecordingState;
  fullTranscript: string;
  formattedTime: string;
  markers: RecordingMarker[];
  pauseRecording: () => void;
  resumeRecording: () => void;
  addMarker: (type: RecordingMarker['type']) => void;
  resetRecording: () => void;
}

// Check if speech recognition is supported
const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
};

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [state, setState] = useState<RecordingState>('idle');
  const [markers, setMarkers] = useState<RecordingMarker[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Format time as MM:SS
  const formattedTime = useCallback(() => {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [elapsedTime]);

  // Check for browser support on mount
  useEffect(() => {
    const checkSupport = () => {
      const supported = isSpeechRecognitionSupported();
      setIsSupported(supported);
      if (!supported) {
        setError('Speech recognition not supported in this browser. Please use Chrome.');
      }
    };
    
    // Delay check slightly to ensure window is ready
    const timer = setTimeout(checkSupport, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  const resetRecording = useCallback(() => {
    resetTranscript();
    setMarkers([]);
    setElapsedTime(0);
    setState('idle');
    setError(null);
  }, [resetTranscript]);

  const stopRecording = useCallback(() => {
    isManuallyStoppedRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
    }
    
    setIsRecording(false);
    setInterimTranscript('');
    setState('stopped');
  }, []);

  const pauseRecording = useCallback(() => {
    isManuallyStoppedRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
    }
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    setIsRecording(false);
    setState('paused');
  }, []);

  const resumeRecording = useCallback(() => {
    isManuallyStoppedRef.current = false;
    setState('recording');
    
    // Restart timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    // Restart speech recognition
    startRecordingInternal();
  }, []);

  const addMarker = useCallback((type: RecordingMarker['type']) => {
    const typeLabels: Record<RecordingMarker['type'], string> = {
      'decision': 'Decision',
      'action': 'Action Item',
      'keypoint': 'Key Point'
    };
    
    const newMarker: RecordingMarker = {
      id: Date.now().toString(),
      timestamp: elapsedTime,
      label: typeLabels[type],
      type
    };
    setMarkers(prev => [...prev, newMarker]);
  }, [elapsedTime]);

  const startRecordingInternal = useCallback(() => {
    const SpeechRecognitionAPI = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported');
      setIsSupported(false);
      return;
    }

    setError(null);

    // Create new recognition instance
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    // Critical settings for mobile compatibility
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      // Loop through results - CRITICAL: use resultIndex to avoid duplicates
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      // Update interim transcript (always overwrite, never append)
      setInterimTranscript(interim);

      // Update final transcript - prevent duplicates
      if (final) {
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      // Don't show error for no-speech (common on mobile)
      if (event.error === 'no-speech') {
        return;
      }

      // Handle "not-allowed" error (permissions)
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow microphone access.');
        setIsRecording(false);
        isManuallyStoppedRef.current = true;
        return;
      }

      // Handle "aborted" - usually means manual stop, ignore
      if (event.error === 'aborted') {
        return;
      }

      setError(`Error: ${event.error}`);
      
      // Try to restart on certain errors
      if (!isManuallyStoppedRef.current && 
          (event.error === 'network' || event.error === 'service-not-allowed')) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!isManuallyStoppedRef.current) {
            startRecordingInternal();
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');

      // Auto-restart if not manually stopped and not paused/stopped
      if (!isManuallyStoppedRef.current && state !== 'paused' && state !== 'stopped') {
        // Small delay to prevent rapid restart loops
        restartTimeoutRef.current = setTimeout(() => {
          if (!isManuallyStoppedRef.current) {
            startRecordingInternal();
          }
        }, 300);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setError('Failed to start speech recognition');
      setIsRecording(false);
    }
  }, [state]);

  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setError('Speech recognition not supported in this browser');
      setIsSupported(false);
      return;
    }

    isManuallyStoppedRef.current = false;
    setMarkers([]);
    setElapsedTime(0);
    setState('recording');
    
    // Start timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    startRecordingInternal();
  }, [startRecordingInternal]);

  return {
    transcript,
    interimTranscript,
    isRecording,
    isSupported,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
    state,
    fullTranscript: transcript,
    formattedTime: formattedTime(),
    markers,
    pauseRecording,
    resumeRecording,
    addMarker,
    resetRecording
  };
};

export default useSpeechRecognition;