import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Save, FileText, Sparkles, ArrowRight } from 'lucide-react';
import type { Meeting } from '../types';

interface TranscriptScreenProps {
  meeting: Meeting;
  onUpdateTranscript: (transcript: string) => void;
}

export function TranscriptScreen({ meeting, onUpdateTranscript }: TranscriptScreenProps) {
  
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [transcript, setTranscript] = useState(meeting.transcriptText);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdateTranscript(transcript);
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGenerateMinutes = () => {
    if (isEditing) {
      onUpdateTranscript(transcript);
    }
    navigate('/minutes');
  };

  const hasTranscript = transcript && transcript.trim().length > 0;
  const wordCount = hasTranscript ? transcript.split(/\s+/).filter(w => w.length > 0).length : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Review Transcript</h1>
        <p className="text-slate-500 mt-1">Edit for accuracy before generating minutes</p>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900">Transcript Review</h3>
            <p className="text-sm text-blue-700 mt-0.5">
              Review and correct any errors. This will be used to generate minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Transcript Editor */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Transcript</span>
            {saved && (
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">Saved</span>
            )}
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {isEditing ? (
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full min-h-[280px] p-4 text-sm text-slate-700 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 resize-y leading-relaxed"
              placeholder="Transcript will appear here..."
            />
          ) : (
            <div className="min-h-[280px] p-4 text-sm text-slate-700 bg-slate-50 rounded-xl leading-relaxed whitespace-pre-wrap">
              {hasTranscript ? (
                transcript
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <FileText className="w-10 h-10 mb-3 opacity-50" />
                  <p>No transcript available</p>
                  <p className="text-xs mt-1">Recording may have been empty</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        {hasTranscript && (
          <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-4">
            <span>{wordCount.toLocaleString()} words</span>
            <span>{transcript.length.toLocaleString()} characters</span>
            <span>~{Math.ceil(wordCount / 130)} min read</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleGenerateMinutes}
          disabled={!hasTranscript}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-slate-900/10"
        >
          <Sparkles className="w-5 h-5" />
          Generate Minutes
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => {
            if (isEditing) {
              onUpdateTranscript(transcript);
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className="w-full py-3 text-slate-600 font-medium hover:text-slate-900 transition-colors"
        >
          Save Draft
        </button>
      </div>

      {/* Tips */}
      <div className="p-4 bg-slate-50 rounded-2xl">
        <h4 className="font-medium text-slate-900 mb-2 text-sm">Editing Tips</h4>
        <div className="space-y-1.5">
          {[
            'Correct names and technical terms',
            'Add punctuation for clarity',
            'Remove filler words if needed',
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-1 h-1 bg-slate-400 rounded-full" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}