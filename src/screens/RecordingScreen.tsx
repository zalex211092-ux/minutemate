import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, Pause, Play, AlertCircle, Flag, CheckCircle, Star, ArrowRight } from 'lucide-react';
import { useSpeechRecognition, type RecordingMarker } from '../hooks/useSpeechRecognition';
import type { Meeting } from '../types';

interface RecordingScreenProps {
  meeting: Meeting;
  onUpdateMeeting: (meeting: Meeting | null) => void;
}

export function RecordingScreen({ meeting, onUpdateMeeting }: RecordingScreenProps) {
  const navigate = useNavigate();
  const [consentChecked, setConsentChecked] = useState(meeting.consentConfirmed);
  const [showConsentError, setShowConsentError] = useState(false);
  
  const {
    state,
    fullTranscript,
    formattedTime,
    markers,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    addMarker,
    resetRecording,
  } = useSpeechRecognition();

  useEffect(() => {
    if (state === 'stopped' && fullTranscript) {
      const updated = {
        ...meeting,
        transcriptText: fullTranscript,
        consentConfirmed: consentChecked,
        updatedAt: new Date().toISOString(),
      };
      onUpdateMeeting(updated);
    }
  }, [state, fullTranscript, meeting, consentChecked, onUpdateMeeting]);

  const handleStartRecording = () => {
    if (!consentChecked) {
      setShowConsentError(true);
      return;
    }
    setShowConsentError(false);
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

   const handleContinue = () => {
  const updated = {
    ...meeting,
    transcriptText: fullTranscript,
    markers: markers,
    consentConfirmed: consentChecked,
    updatedAt: new Date().toISOString(),
  };
  
  // Save to localStorage first
  localStorage.setItem('currentMeeting', JSON.stringify(updated));
  onUpdateMeeting(updated);
  
  // Use React Router navigation
  navigate('/transcript');
};
 
  const handleAddMarker = (type: RecordingMarker['type']) => {
    addMarker(type);
  };

  if (!isSupported) {
    return (
      <div className="space-y-6">
        <div className="p-5 bg-rose-50 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-rose-900">Speech Recognition Not Supported</h3>
              <p className="text-sm text-rose-700 mt-1">
                Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari for the best experience.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/new')}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Record Meeting</h1>
        <p className="text-slate-500 mt-1 truncate">{meeting.title}</p>
      </div>

      {/* Consent Panel */}
      {state === 'idle' && (
        <div className={`p-5 rounded-2xl ${
          showConsentError ? 'bg-rose-50' : 'bg-amber-50'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              showConsentError ? 'bg-rose-100' : 'bg-amber-100'
            }`}>
              <AlertCircle className={`w-5 h-5 ${showConsentError ? 'text-rose-600' : 'text-amber-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${showConsentError ? 'text-rose-900' : 'text-amber-900'}`}>
                Consent Required
              </h3>
              <p className={`text-sm mt-1 ${showConsentError ? 'text-rose-700' : 'text-amber-700'}`}>
                Confirm everyone present has been informed and consented to audio recording.
              </p>
              
              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => {
                    setConsentChecked(e.target.checked);
                    setShowConsentError(false);
                  }}
                  className="w-5 h-5 mt-0.5 rounded-lg border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className={`text-sm ${showConsentError ? 'text-rose-800' : 'text-slate-700'}`}>
                  I confirm all attendees have consented to being recorded
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-rose-50 rounded-xl">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Recording Card */}
      <div className="p-6 bg-white rounded-3xl shadow-sm ring-1 ring-slate-100">
        {/* Timer Display */}
        <div className="text-center mb-8">
          <div className={`text-6xl font-mono font-semibold tracking-tight ${
            state === 'recording' ? 'text-rose-500' : 'text-slate-900'
          }`}>
            {formattedTime}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            {state === 'recording' && (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <span className="text-sm text-rose-600 font-medium">Recording</span>
              </>
            )}
            {state === 'paused' && (
              <span className="text-sm text-amber-600 font-medium">Paused</span>
            )}
            {state === 'stopped' && (
              <span className="text-sm text-emerald-600 font-medium">Recording Complete</span>
            )}
            {state === 'idle' && (
              <span className="text-sm text-slate-400">Ready to record</span>
            )}
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {state === 'idle' && (
            <button
              onClick={handleStartRecording}
              className="relative w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 hover:bg-rose-600 active:scale-95 transition-all"
            >
              <Mic className="w-8 h-8 text-white" />
            </button>
          )}

          {state === 'recording' && (
            <>
              <button
                onClick={pauseRecording}
                className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center shadow-lg shadow-amber-400/30 hover:bg-amber-500 active:scale-95 transition-all"
              >
                <Pause className="w-6 h-6 text-white" fill="white" />
              </button>
              <button
                onClick={handleStopRecording}
                className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Square className="w-7 h-7 text-white" fill="white" />
              </button>
            </>
          )}

          {state === 'paused' && (
            <>
              <button
                onClick={resumeRecording}
                className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
              >
                <Play className="w-6 h-6 text-white" fill="white" />
              </button>
              <button
                onClick={handleStopRecording}
                className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Square className="w-7 h-7 text-white" fill="white" />
              </button>
            </>
          )}

          {state === 'stopped' && (
            <button
              onClick={handleContinue}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Marker Buttons */}
        {(state === 'recording' || state === 'paused') && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: 'decision' as const, icon: Flag, label: 'Decision', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
              { type: 'action' as const, icon: CheckCircle, label: 'Action', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { type: 'keypoint' as const, icon: Star, label: 'Key Point', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            ].map((marker) => (
              <button
                key={marker.type}
                onClick={() => handleAddMarker(marker.type)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors ${marker.color}`}
              >
                <marker.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{marker.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Markers List */}
      {markers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Markers</h3>
          <div className="space-y-2">
          {markers.map((marker: any) => (
              <div
                key={marker.id}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  marker.type === 'decision' ? 'bg-purple-50' :
                  marker.type === 'action' ? 'bg-blue-50' :
                  'bg-amber-50'
                }`}
              >
                {marker.type === 'decision' && <Flag className="w-4 h-4 text-purple-600" />}
                {marker.type === 'action' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                {marker.type === 'keypoint' && <Star className="w-4 h-4 text-amber-600" />}
                <span className="text-sm font-mono text-slate-500">
                  {Math.floor(marker.timestamp / 60).toString().padStart(2, '0')}:
                  {(marker.timestamp % 60).toString().padStart(2, '0')}
                </span>
                <span className={`text-sm font-medium capitalize ${
                  marker.type === 'decision' ? 'text-purple-700' :
                  marker.type === 'action' ? 'text-blue-700' :
                  'text-amber-700'
                }`}>
                  {marker.type.replace('-', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Transcript Preview */}
      {(state === 'recording' || state === 'paused' || state === 'stopped') && fullTranscript && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Live Transcript</h3>
          <div className="p-4 bg-slate-50 rounded-2xl max-h-48 overflow-y-auto">
            <p className="text-sm text-slate-600 leading-relaxed">{fullTranscript}</p>
          </div>
        </div>
      )}

      {/* Reset Option */}
      {state === 'stopped' && (
        <button
          onClick={resetRecording}
          className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          Start New Recording
        </button>
      )}
    </div>
  );
}
