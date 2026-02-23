import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CheckSquare, MessageSquare, Copy, Download,
  Mail, Edit3, Save, Check, Loader2, Home, Shield, Users,
  Clock, MapPin, Hash, Calendar, ChevronRight, AlertTriangle
} from 'lucide-react';
import { generateMinutes, extractActionsFromMinutes } from '../services/minutesGenerator';
import { exportToPDF, exportToDOCX, copyToClipboard, generateEmailLink } from '../services/exportService';
import type { Meeting, MeetingType } from '../types';

interface MinutesScreenProps {
  meeting: Meeting;
  onSaveMinutes: (minutesText: string, actions: Meeting['actions']) => void;
  onFinalize: () => void;
}

type TabType = 'minutes' | 'actions' | 'transcript';

// ─── Meeting type config ──────────────────────────────────────────────────────
const TYPE_CONFIG: Record<MeetingType, {
  label: string;
  gradient: string;
  badge: string;
  badgeText: string;
  icon: React.FC<{ className?: string }>;
}> = {
  'team': {
    label: 'Team Meeting',
    gradient: 'from-blue-600 to-blue-800',
    badge: 'bg-blue-100 text-blue-700',
    badgeText: 'Internal',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  '1:1': {
    label: '1:1 Meeting',
    gradient: 'from-violet-600 to-violet-800',
    badge: 'bg-violet-100 text-violet-700',
    badgeText: 'Confidential',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  'disciplinary': {
    label: 'Disciplinary Hearing',
    gradient: 'from-red-600 to-red-800',
    badge: 'bg-red-100 text-red-700',
    badgeText: 'HR Confidential',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  'investigation': {
    label: 'Investigation Meeting',
    gradient: 'from-amber-600 to-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    badgeText: 'HR Confidential',
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
};

// ─── Markdown parser → structured sections ────────────────────────────────────
interface ParsedSection {
  heading: string;
  content: string;
}

function parseMinutesIntoSections(raw: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', '').trim(), content: '' };
    } else if (line.startsWith('# ')) {
      // skip top-level heading — shown in header card
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ─── Render markdown table ─────────────────────────────────────────────────────
function MarkdownTable({ raw }: { raw: string }) {
  const rows = raw.trim().split('\n').filter(l => l.startsWith('|'));
  if (rows.length < 3) return null;

  const parseRow = (row: string) =>
    row.split('|').map(c => c.trim()).filter(Boolean);

  const headers = parseRow(rows[0]);
  const body = rows.slice(2); // skip separator row

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
                {h.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => {
            const cells = parseRow(row);
            const isEmpty = cells[0]?.includes('No actions') || cells[0]?.includes('No attendees');
            return (
              <tr key={ri} className={`border-b border-slate-100 last:border-0 ${isEmpty ? 'italic text-slate-400' : ''}`}>
                {cells.map((c, ci) => (
                  <td key={ci} className="px-4 py-3 text-slate-700 align-top">
                    <span dangerouslySetInnerHTML={{ __html: c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/–/g, '–') }} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Render a section's content ───────────────────────────────────────────────
function SectionContent({ content }: { content: string }) {
  const lines = content.trim().split('\n');
  const result: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let i = 0;

  const flushTable = () => {
    if (tableBuffer.length) {
      result.push(<MarkdownTable key={`table-${i}`} raw={tableBuffer.join('\n')} />);
      tableBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('|')) {
      tableBuffer.push(line);
    } else {
      flushTable();

      if (line.startsWith('**') && line.endsWith('**') && !line.includes('|')) {
        const heading = line.replace(/\*\*/g, '');
        result.push(
          <p key={i} className="font-semibold text-slate-800 mt-4 mb-1 first:mt-0">{heading}</p>
        );
      } else if (line.startsWith('- ')) {
        const text = line.replace('- ', '');
        const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        result.push(
          <div key={i} className="flex gap-2 mb-1.5">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
            <p className="text-slate-700 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      } else if (line.trim()) {
        const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        result.push(
          <p key={i} className="text-slate-700 leading-relaxed text-sm mb-2" dangerouslySetInnerHTML={{ __html: html }} />
        );
      } else {
        result.push(<div key={i} className="h-2" />);
      }
    }
    i++;
  }
  flushTable();

  return <div>{result}</div>;
}

// ─── Section icon map ─────────────────────────────────────────────────────────
function SectionIcon({ heading }: { heading: string }) {
  const h = heading.toLowerCase();
  if (h.includes('meeting info')) return <Calendar className="w-4 h-4" />;
  if (h.includes('attendee')) return <Users className="w-4 h-4" />;
  if (h.includes('discussion') || h.includes('summary')) return <MessageSquare className="w-4 h-4" />;
  if (h.includes('decision')) return <CheckSquare className="w-4 h-4" />;
  if (h.includes('action')) return <ChevronRight className="w-4 h-4" />;
  if (h.includes('follow')) return <Clock className="w-4 h-4" />;
  if (h.includes('hr') || h.includes('document')) return <Shield className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

// ─── Executive summary extractor ──────────────────────────────────────────────
function extractExecutiveSummary(raw: string): string | null {
  const match = raw.match(/^(Meeting addressed[\s\S]*?)(?=\n##)/m);
  return match ? match[1].trim() : null;
}

function extractTitle(raw: string): string {
  const match = raw.match(/^# (.*)/m);
  return match ? match[1].trim() : 'Meeting Minutes';
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
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

  const handleFinish = () => {
    onFinalize();
    navigate('/');
  };

  const typeConfig = TYPE_CONFIG[meeting.type] || TYPE_CONFIG['team'];
  const TypeIcon = typeConfig.icon;
  const sections = minutes ? parseMinutesIntoSections(minutes) : [];
  const execSummary = minutes ? extractExecutiveSummary(minutes) : null;
  const docTitle = minutes ? extractTitle(minutes) : typeConfig.label;

  // ─── Tab bar ────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'minutes' as TabType, label: 'Minutes', icon: FileText },
    { id: 'actions' as TabType, label: `Actions${actions.length ? ` (${actions.length})` : ''}`, icon: CheckSquare },
    { id: 'transcript' as TabType, label: 'Transcript', icon: MessageSquare },
  ];

  return (
    <div className="space-y-4 pb-6">

      {/* ── Document header card ─────────────────────────────────────────── */}
      <div className={`rounded-2xl bg-gradient-to-br ${typeConfig.gradient} p-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white`}>
                <Shield className="w-3 h-3" />
                {typeConfig.badgeText}
              </span>
            </div>
            <h1 className="text-lg font-bold leading-snug text-white">{meeting.title}</h1>
            <p className="text-white/70 text-sm mt-0.5">{typeConfig.label}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <TypeIcon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/80">
          {meeting.date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(meeting.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {meeting.startTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {meeting.startTime}
            </span>
          )}
          {meeting.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {meeting.location}
            </span>
          )}
          {meeting.attendees?.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Minutes tab ──────────────────────────────────────────────────── */}
      {activeTab === 'minutes' && (
        <>
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl ring-1 ring-slate-100">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center mb-4`}>
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <p className="text-slate-600 font-medium">Generating minutes…</p>
              <p className="text-slate-400 text-sm mt-1">Analysing transcript</p>
            </div>
          ) : isEditing ? (
            <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">Editing raw markdown</span>
                <button
                  onClick={handleSaveMinutes}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
              <textarea
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full min-h-[500px] p-4 text-sm text-slate-700 bg-white border-0 focus:outline-none resize-y font-mono leading-relaxed"
              />
            </div>
          ) : minutes ? (
            <div className="space-y-3">
              {/* Executive summary */}
              {execSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Summary</p>
                  <p className="text-slate-700 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: execSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                </div>
              )}

              {/* Section cards */}
              {sections.map((section, idx) => (
                <div key={idx} className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50 bg-slate-50/60">
                    <span className="text-slate-400">
                      <SectionIcon heading={section.heading} />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800">{section.heading}</h3>
                  </div>
                  <div className="px-4 py-3">
                    <SectionContent content={section.content} />
                  </div>
                </div>
              ))}

              {/* Edit button */}
              <button
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border border-dashed border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit raw markdown
              </button>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-100">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No minutes generated yet.</p>
            </div>
          )}

          {/* Export strip */}
          {minutes && !isEditing && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2.5 px-1">Export</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: copied ? 'Copied!' : 'Copy', icon: copied ? Check : Copy, action: handleCopy, highlight: copied },
                  { label: 'PDF', icon: Download, action: () => exportToPDF({ ...meeting, minutesText: minutes }) },
                  { label: 'Word', icon: FileText, action: () => exportToDOCX({ ...meeting, minutesText: minutes }) },
                  { label: 'Email', icon: Mail, action: () => { const l = generateEmailLink({ ...meeting, minutesText: minutes }); window.open(l, '_blank'); } },
                ].map(({ label, icon: Icon, action, highlight }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all border ${
                      highlight
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Actions tab ──────────────────────────────────────────────────── */}
      {activeTab === 'actions' && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
          {actions.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No actions recorded</p>
              <p className="text-sm mt-1">Actions from the transcript will appear here</p>
            </div>
          ) : (
            <div>
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">{actions.length} action item{actions.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {actions.map((action, idx) => (
                  <div key={action.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 w-6 h-6 rounded-lg bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center flex-shrink-0 text-white text-xs font-bold`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm leading-snug">{action.action}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Users className="w-3 h-3" />
                            <span className="font-medium text-slate-700">{action.owner}</span>
                          </span>
                          {action.deadline && action.deadline !== 'Not stated' && action.deadline !== 'TBC' && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium text-slate-700">{action.deadline}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Transcript tab ───────────────────────────────────────────────── */}
      {activeTab === 'transcript' && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Raw transcript</p>
          </div>
          <div className="px-4 py-4 max-h-[480px] overflow-y-auto">
            {meeting.transcriptText ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{meeting.transcriptText}</p>
            ) : (
              <p className="text-slate-400 italic text-sm">No transcript available</p>
            )}
          </div>
        </div>
      )}

      {/* ── Save & return ────────────────────────────────────────────────── */}
      <button
        onClick={handleFinish}
        className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg bg-gradient-to-r ${typeConfig.gradient} text-white hover:opacity-90`}
      >
        <Home className="w-5 h-5" />
        Save & Return Home
      </button>
    </div>
  );
}
