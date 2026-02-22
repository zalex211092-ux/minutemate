import { useState, useRef, useCallback, useEffect } from 'react';

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

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface RecordingMarker {
  id: string;
  timestamp: number;
  type: 'decision' | 'action' | 'keypoint';
  note?: string;
}

export function useSpeechRecognition() {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [markers, setMarkers] = useState<RecordingMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-GB';

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access to use recording.');
        setState('idle');
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors, just continue
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current.onend = () => {
      if (state === 'recording') {
        // Restart if we're still supposed to be recording
        try {
          recognitionRef.current?.start();
        } catch (e) {
          // Already started, ignore
        }
      }
    };

    return () => {
      recognitionRef.current?.abort();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setMarkers([]);
    setRecordingTime(0);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;

    try {
      recognitionRef.current.start();
      setState('recording');

      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e) {
      setError('Failed to start recording. Please try again.');
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setState('paused');
    pausedTimeRef.current = Date.now() - startTimeRef.current;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.start();
      setState('recording');
      startTimeRef.current = Date.now() - pausedTimeRef.current;

      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e) {
      setError('Failed to resume recording. Please try again.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setState('stopped');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const addMarker = useCallback((type: RecordingMarker['type'], note?: string) => {
    const marker: RecordingMarker = {
      id: crypto.randomUUID(),
      timestamp: recordingTime,
      type,
      note,
    };
    setMarkers((prev) => [...prev, marker]);
  }, [recordingTime]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const resetRecording = useCallback(() => {
    setState('idle');
    setTranscript('');
    setInterimTranscript('');
    setRecordingTime(0);
    setMarkers([]);
    setError(null);
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    fullTranscript: transcript + (interimTranscript ? ' ' + interimTranscript : ''),
    recordingTime,
    formattedTime: formatTime(recordingTime),
    markers,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    addMarker,
    resetRecording,
  };
}
