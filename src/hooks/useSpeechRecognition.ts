// src/hooks/useSpeechRecognition.ts

import { useState, useRef, useCallback, useEffect } from 'react';

// Type definitions remain the same...
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
  
  // NEW: Track the last final transcript to detect duplicates
  const lastFinalTranscriptRef = useRef('');

  const formattedTime = useCallback(() => {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [elapsedTime]);

  useEffect(() => {
    const checkSupport = () => {
      const supported = isSpeechRecognitionSupported();
      setIsSupported(supported);
      if (!supported) {
        setError('Speech recognition not supported in this browser. Please use Chrome.');
      }
    };
    
    const timer = setTimeout(checkSupport, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
    lastFinalTranscriptRef.current = '';
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
    
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
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

  // NEW: Smart deduplication function
  const extractNewContent = useCallback((incomingText: string, existingText: string): string => {
    if (!existingText) return incomingText;
    if (!incomingText) return '';
    
    const incoming = incomingText.trim().toLowerCase();
    const existing = existingText.trim().toLowerCase();
    
    // Case 1: Exact match or incoming is contained in existing
    if (existing.includes(incoming)) return '';
    
    // Case 2: Existing is contained in incoming (Android cumulative behavior)
    if (incoming.includes(existing)) {
      // Return only the new part
      const newPart = incomingText.trim().slice(existing.length).trim();
      return newPart;
    }
    
    // Case 3: Partial overlap at the end (rare but possible)
    // Find the longest suffix of existing that matches prefix of incoming
    const existingWords = existing.split(' ');
    for (let i = existingWords.length; i > 0; i--) {
      const suffix = existingWords.slice(-i).join(' ');
      if (incoming.startsWith(suffix)) {
        const incomingWords = incomingText.trim().split(' ');
        const existingWordsCount = suffix.split(' ').length;
        if (incomingWords.length > existingWordsCount) {
          return incomingWords.slice(existingWordsCount).join(' ');
        }
        return '';
      }
    }
    
    // Case 4: No overlap, treat as new sentence
    return incomingText.trim();
  }, []);

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

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

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
      let finalTextFromThisEvent = '';
        // DEBUG: Log what Android is sending
  console.log('--- New result event ---');
  console.log('Results length:', event.results.length);
  console.log('Current final transcript:', finalTranscriptRef.current);

      // Collect all final results from this event
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;

        if (result.isFinal) {
          finalTextFromThisEvent += transcriptText;
        } else {
          interim = transcriptText;
        }
      }
        // DEBUG: Log what we extracted
  console.log('Final text from this event:', finalTextFromThisEvent);
  console.log('New content extracted:', newContent);

      setInterimTranscript(interim);

      // Process final text with smart deduplication
      if (finalTextFromThisEvent.trim()) {
        const currentFinal = finalTranscriptRef.current;
        const newContent = extractNewContent(finalTextFromThisEvent, currentFinal);
        
        if (newContent) {
          // Add space if needed
          const separator = currentFinal && !currentFinal.endsWith(' ') ? ' ' : '';
          finalTranscriptRef.current = currentFinal + separator + newContent;
          setTranscript(finalTranscriptRef.current.trim());
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'no-speech') return;

      if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow microphone access.');
        setIsRecording(false);
        isManuallyStoppedRef.current = true;
        return;
      }

      if (event.error === 'aborted') return;

      setError(`Error: ${event.error}`);
      
      if (!isManuallyStoppedRef.current && 
          (event.error === 'network' || event.error === 'service-not-allowed')) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!isManuallyStoppedRef.current) startRecordingInternal();
        }, 1000);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');

      if (!isManuallyStoppedRef.current && state !== 'paused' && state !== 'stopped') {
        restartTimeoutRef.current = setTimeout(() => {
          if (!isManuallyStoppedRef.current) startRecordingInternal();
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
  }, [state, extractNewContent]);

  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setError('Speech recognition not supported in this browser');
      setIsSupported(false);
      return;
    }

    // Reset everything
    finalTranscriptRef.current = '';
    lastFinalTranscriptRef.current = '';
    isManuallyStoppedRef.current = false;
    setMarkers([]);
    setElapsedTime(0);
    setState('recording');
    
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