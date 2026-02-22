import { useEffect, useRef, useState } from "react";

type Status = "idle" | "recording" | "stopped";

export const useSpeechRecognition = () => {
  const recognitionRef = useRef<any>(null);

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const shouldRestartRef = useRef(false);
  const isManuallyStoppedRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";

    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) finalText += text + " ";
        else interimText += text;
      }

      setTranscript(finalText.trim());
      setInterimTranscript(interimText);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current && !isManuallyStoppedRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.warn("Restart blocked:", err);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech error:", event?.error || event);
      if (event?.error === "not-allowed") shouldRestartRef.current = false;
    };

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    isManuallyStoppedRef.current = false;
    shouldRestartRef.current = true;

    try {
      recognitionRef.current.start();
      setStatus("recording");
    } catch (err) {
      console.warn("Start error:", err);
    }
  };

  const stopRecording = () => {
    if (!recognitionRef.current) return;

    shouldRestartRef.current = false;
    isManuallyStoppedRef.current = true;

    try {
      recognitionRef.current.stop();
    } catch {}

    setStatus("stopped");
  };

  const resetTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
  };

  return {
    transcript,
    interimTranscript,
    status,
    startRecording,
    stopRecording,
    resetTranscript,
  };
};