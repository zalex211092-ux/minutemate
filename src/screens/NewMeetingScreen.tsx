import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, FileText, Users, Plus, X, ChevronRight, Briefcase, User, UserCircle, Gavel, Search, ArrowLeft } from 'lucide-react';
import type { Meeting, MeetingType, Attendee, Settings } from '../types';
import { MEETING_TYPE_LABELS, ROLE_TEMPLATES } from '../types';

interface NewMeetingScreenProps {
  settings: Settings;
  onSave: (meeting: Partial<Meeting>) => string;
}

const MEETING_TYPES: { type: MeetingType; icon: typeof Briefcase; color: string; bg: string; description: string }[] = [
  { type: '1:1', icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50', description: 'Manager and employee check-in' },
  { type: 'team', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', description: 'Team discussion or standup' },
  { type: 'disciplinary', icon: Gavel, color: 'text-rose-600', bg: 'bg-rose-50', description: 'Formal disciplinary hearing' },
  { type: 'investigation', icon: Search, color: 'text-amber-600', bg: 'bg-amber-50', description: 'HR investigation meeting' },
];

export function NewMeetingScreen({ settings, onSave }: NewMeetingScreenProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [location, setLocation] = useState(settings.defaultLocation || '');
  const [caseRef, setCaseRef] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [newAttendeeRole, setNewAttendeeRole] = useState('');

  const handleTypeSelect = (type: MeetingType) => {
    setSelectedType(type);
    if (!title) {
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      setTitle(`${MEETING_TYPE_LABELS[type]} - ${dateStr}`);
    }
  };

  const handleAddAttendee = () => {
    if (newAttendeeName.trim() && newAttendeeRole.trim()) {
      setAttendees([...attendees, {
        id: crypto.randomUUID(),
        name: newAttendeeName.trim(),
        role: newAttendeeRole.trim(),
      }]);
      setNewAttendeeName('');
      setNewAttendeeRole('');
    }
  };

  const handleRemoveAttendee = (id: string) => {
    setAttendees(attendees.filter((a) => a.id !== id));
  };

  const handleQuickAddRole = (role: string) => {
    if (!attendees.some((a) => a.role === role)) {
      setAttendees([...attendees, {
        id: crypto.randomUUID(),
        name: '',
        role,
      }]);
    }
  };

  const handleContinue = () => {
    if (selectedType && title.trim()) {
      setStep(2);
    }
  };

  const handleStartRecording = () => {
    if (selectedType && title.trim()) {
      const meetingData: Partial<Meeting> = {
        type: selectedType,
        title: title.trim(),
        date,
        startTime,
        location: location.trim() || undefined,
        caseRef: caseRef.trim() || undefined,
        attendees,
      };
      onSave(meetingData);
      navigate('/record');
    }
  };

  const availableRoles = selectedType ? ROLE_TEMPLATES[selectedType] : [];

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Meeting</h1>
          <p className="text-slate-500 mt-1">Select meeting type and add details</p>
        </div>

        {/* Meeting Type Cards */}
        <div className="grid grid-cols-2 gap-3">
          {MEETING_TYPES.map(({ type, icon: Icon, color, bg, description }) => (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className={`group p-4 rounded-2xl text-left transition-all ${
                selectedType === type
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`w-11 h-11 ${selectedType === type ? 'bg-white/10' : bg} rounded-xl flex items-center justify-center mb-3 transition-colors`}>
                <Icon className={`w-5 h-5 ${selectedType === type ? 'text-white' : color}`} />
              </div>
              <h3 className={`font-semibold text-sm ${selectedType === type ? 'text-white' : 'text-slate-900'}`}>
                {MEETING_TYPE_LABELS[type]}
              </h3>
              <p className={`text-xs mt-1 ${selectedType === type ? 'text-slate-300' : 'text-slate-500'}`}>
                {description}
              </p>
            </button>
          ))}
        </div>

        {/* Meeting Details Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Meeting Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Team Standup"
              className="w-full px-4 py-3.5 bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Location <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Conference Room A"
                className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
              />
            </div>
          </div>

          {(selectedType === 'disciplinary' || selectedType === 'investigation') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Case Reference <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={caseRef}
                  onChange={(e) => setCaseRef(e.target.value)}
                  placeholder="e.g., HR-2024-001"
                  className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Attendees Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Attendees</label>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{attendees.length}</span>
          </div>

          {settings.useRoleTemplates && selectedType && availableRoles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleQuickAddRole(role)}
                  disabled={attendees.some((a) => a.role === role)}
                  className="px-3 py-1.5 text-xs font-medium bg-white rounded-lg shadow-sm ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 hover:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  + {role}
                </button>
              ))}
            </div>
          )}

          {attendees.length > 0 && (
            <div className="space-y-2">
              {attendees.map((attendee) => (
                <div key={attendee.id} className="flex items-center gap-2 p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={attendee.name}
                      onChange={(e) => {
                        const updated = attendees.map((a) =>
                          a.id === attendee.id ? { ...a, name: e.target.value } : a
                        );
                        setAttendees(updated);
                      }}
                      placeholder="Name"
                      className="px-3 py-2 text-sm bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-slate-900"
                    />
                    <input
                      type="text"
                      value={attendee.role}
                      onChange={(e) => {
                        const updated = attendees.map((a) =>
                          a.id === attendee.id ? { ...a, role: e.target.value } : a
                        );
                        setAttendees(updated);
                      }}
                      placeholder="Role"
                      className="px-3 py-2 text-sm bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveAttendee(attendee.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={newAttendeeName}
                  onChange={(e) => setNewAttendeeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAttendee()}
                  placeholder="Name"
                  className="w-full pl-10 pr-3 py-3 text-sm bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={newAttendeeRole}
                  onChange={(e) => setNewAttendeeRole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAttendee()}
                  placeholder="Role"
                  className="w-full pl-10 pr-3 py-3 text-sm bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>
            <button
              onClick={handleAddAttendee}
              disabled={!newAttendeeName.trim() || !newAttendeeRole.trim()}
              className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedType || !title.trim()}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-slate-900/10"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Step 2: Review
  return (
    <div className="space-y-6">
      <button
        onClick={() => setStep(1)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Review & Confirm</h1>
        <p className="text-slate-500 mt-1">Check the details before starting</p>
      </div>

      {/* Summary Card */}
      <div className="p-5 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-slate-50">
          <span className="text-sm text-slate-500">Type</span>
          <span className="text-sm font-medium text-slate-900">{selectedType && MEETING_TYPE_LABELS[selectedType]}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-slate-50">
          <span className="text-sm text-slate-500">Title</span>
          <span className="text-sm font-medium text-slate-900 text-right max-w-[60%] truncate">{title}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-slate-50">
          <span className="text-sm text-slate-500">Date & Time</span>
          <span className="text-sm font-medium text-slate-900">{date} at {startTime}</span>
        </div>
        {location && (
          <div className="flex items-center justify-between py-2 border-b border-slate-50">
            <span className="text-sm text-slate-500">Location</span>
            <span className="text-sm font-medium text-slate-900">{location}</span>
          </div>
        )}
        {caseRef && (
          <div className="flex items-center justify-between py-2 border-b border-slate-50">
            <span className="text-sm text-slate-500">Case Ref</span>
            <span className="text-sm font-medium text-slate-900">{caseRef}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-slate-500">Attendees</span>
          <span className="text-sm font-medium text-slate-900">{attendees.length}</span>
        </div>
      </div>

      {/* Attendees List */}
      {attendees.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Attendees</h3>
          <div className="space-y-2">
            {attendees.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">
                <span className="font-medium text-slate-900">{a.name || '(Unnamed)'}</span>
                <span className="text-sm text-slate-500">{a.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        <button
          onClick={handleStartRecording}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
        >
          Start Recording
        </button>
      </div>
    </div>
  );
}
