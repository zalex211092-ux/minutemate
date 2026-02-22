import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckSquare, MessageSquare, Copy, Download, Mail, Edit3, Save, Check, Loader2, Home } from 'lucide-react';
import { generateMinutes, extractActionsFromMinutes } from '../services/minutesGenerator';
import { exportToPDF, exportToDOCX, copyToClipboard, generateEmailLink } from '../services/exportService';
import type { Meeting } from '../types';

interface MinutesScreenProps {
  meeting: Meeting;
  onSaveMinutes: (minutesText: string, actions: Meeting['actions']) => void;
  onFinalize: () => void;
}

type TabType = 'minutes' | 'actions' | 'transcript';

export function MinutesScreen({ meeting, onSaveMinutes, onFinalize }: MinutesScreenProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('minutes');
  const [minutes, setMinutes] = useState(meeting.minutesText);
  const [actions, setActions] = useState<Meeting['actions']>(meeting.actions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!meeting.minutesText && meeting.transcriptText && !isGenerating) {
      handleGenerateMinutes();
    }
  }, []);

  const handleGenerateMinutes = async () => {
    setIsGenerating(true);
    try {
      const generatedMinutes = await generateMinutes(meeting);
      setMinutes(generatedMinutes);
      const extractedActions = extractActionsFromMinutes(generatedMinutes);
      setActions(extractedActions);
      onSaveMinutes(generatedMinutes, extractedActions);
    } catch (error) {
      console.error('Failed to generate minutes:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveMinutes = () => {
    const extractedActions = extractActionsFromMinutes(minutes);
    setActions(extractedActions);
    onSaveMinutes(minutes, extractedActions);
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopy = async () => {
    await copyToClipboard({ ...meeting, minutesText: minutes });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    exportToPDF({ ...meeting, minutesText: minutes });
  };

  const handleExportDOCX = () => {
    exportToDOCX({ ...meeting, minutesText: minutes });
  };

  const handleEmail = () => {
    const link = generateEmailLink({ ...meeting, minutesText: minutes });
    window.open(link, '_blank');
  };

  const handleFinish = () => {
    onFinalize();
    navigate('/');
  };

  const renderMinutes = () => {
    if (!minutes) return <p className="text-slate-500">No minutes generated yet.</p>;

    const lines = minutes.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-xl font-semibold text-slate-900 mt-6 mb-3">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-lg font-semibold text-slate-900 mt-5 mb-2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 text-slate-700 mb-1 leading-relaxed">{line.replace('- ', '')}</li>;
      }
      const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (!line.trim()) {
        return <div key={index} className="h-2" />;
      }
      return <p key={index} className="text-slate-700 mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: boldLine }} />;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Meeting Minutes</h1>
        <p className="text-slate-500 mt-1">Review, edit and export your minutes</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        {[
          { id: 'minutes' as TabType, label: 'Minutes', icon: FileText },
          { id: 'actions' as TabType, label: 'Actions', icon: CheckSquare },
          { id: 'transcript' as TabType, label: 'Transcript', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700 capitalize">{activeTab}</span>
            {saved && (
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">Saved</span>
            )}
          </div>
          {activeTab === 'minutes' && (
            <div className="flex items-center gap-2">
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
                  onClick={handleSaveMinutes}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-4 min-h-[280px] max-h-[480px] overflow-y-auto">
          {activeTab === 'minutes' && (
            <>
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-56">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-3" />
                  <p className="text-slate-500">Generating minutes...</p>
                </div>
              ) : isEditing ? (
                <textarea
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-full min-h-[400px] p-4 text-sm text-slate-700 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 resize-y font-mono leading-relaxed"
                />
              ) : (
                <div className="prose prose-slate max-w-none">
                  {renderMinutes()}
                </div>
              )}
            </>
          )}

          {activeTab === 'actions' && (
            <div>
              {actions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No actions extracted from minutes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="p-4 bg-slate-50 rounded-xl"
                    >
                      <p className="font-medium text-slate-900 mb-2">{action.action}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs uppercase tracking-wide text-slate-400">Owner</span>
                          <span className="font-medium text-slate-700">{action.owner}</span>
                        </span>
                        {action.deadline && action.deadline !== 'Not stated' && (
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs uppercase tracking-wide text-slate-400">Deadline</span>
                            <span className="font-medium text-slate-700">{action.deadline}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {meeting.transcriptText || <span className="text-slate-400 italic">No transcript available</span>}
            </div>
          )}
        </div>
      </div>

      {/* Export Buttons */}
      {activeTab === 'minutes' && minutes && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Export</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm ring-1 ring-slate-100 text-slate-700 hover:bg-slate-50 hover:ring-slate-200 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span className="text-sm font-medium">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm ring-1 ring-slate-100 text-slate-700 hover:bg-slate-50 hover:ring-slate-200 transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">PDF</span>
            </button>
            <button
              onClick={handleExportDOCX}
              className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm ring-1 ring-slate-100 text-slate-700 hover:bg-slate-50 hover:ring-slate-200 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Word</span>
            </button>
            <button
              onClick={handleEmail}
              className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm ring-1 ring-slate-100 text-slate-700 hover:bg-slate-50 hover:ring-slate-200 transition-all"
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">Email</span>
            </button>
          </div>
        </div>
      )}

      {/* Finish Button */}
      <button
        onClick={handleFinish}
        className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
      >
        <Home className="w-5 h-5" />
        Save & Return Home
      </button>
    </div>
  );
}
