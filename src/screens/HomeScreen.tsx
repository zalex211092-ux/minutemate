import { Link } from 'react-router-dom';
import { Plus, FileText, Clock, Calendar, Users, Mic, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Meeting } from '../types';

interface HomeScreenProps {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  onStartNew: () => void;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  '1:1': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'team': { bg: 'bg-blue-50', text: 'text-blue-700' },
  'disciplinary': { bg: 'bg-rose-50', text: 'text-rose-700' },
  'investigation': { bg: 'bg-amber-50', text: 'text-amber-700' },
};

export function HomeScreen({ meetings, currentMeeting, onStartNew }: HomeScreenProps) {
  const hasDraft = currentMeeting && currentMeeting.status === 'draft';
  const lastCompleted = meetings.find((m) => m.status === 'completed');

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="pt-2">
        <h1 className="text-2xl font-semibold text-slate-900">Good day</h1>
        <p className="text-slate-500 mt-1">Ready to capture your next meeting?</p>
      </div>

      {/* Primary CTA */}
      <Link
        to="/new"
        onClick={onStartNew}
        className="group flex items-center justify-between p-5 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/15 hover:bg-slate-800 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-lg">Start New Meeting</p>
            <p className="text-slate-400 text-sm">Record and generate minutes</p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </Link>

      {/* Quick Actions */}
      {(hasDraft || lastCompleted) && (
        <div className="grid grid-cols-2 gap-3">
          {hasDraft && (
            <Link
              to="/record"
              className="p-4 bg-amber-50 rounded-2xl hover:bg-amber-100/70 transition-colors"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="font-medium text-slate-900 text-sm">Continue Draft</p>
              <p className="text-amber-700/70 text-xs mt-0.5 truncate">{currentMeeting.title}</p>
            </Link>
          )}
          
          {lastCompleted && (
            <Link
              to="/history"
              className="p-4 bg-blue-50 rounded-2xl hover:bg-blue-100/70 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-medium text-slate-900 text-sm">Export Last</p>
              <p className="text-blue-700/70 text-xs mt-0.5 truncate">{lastCompleted.title}</p>
            </Link>
          )}
        </div>
      )}

      {/* Recent Meetings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Recent Meetings</h2>
          <Link to="/history" className="text-sm text-slate-500 hover:text-slate-700 font-medium">
            View all
          </Link>
        </div>

        {meetings.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mic className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium">No meetings yet</p>
            <p className="text-slate-500 text-sm mt-1">Start your first meeting to see it here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map((meeting) => {
              const colors = typeColors[meeting.type] || typeColors.team;
              return (
                <Link
                  key={meeting.id}
                  to="/history"
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl hover:bg-slate-50 transition-colors group"
                >
                  <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-xs font-semibold ${colors.text}`}>
                      {meeting.type === '1:1' ? '1:1' : meeting.type.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{meeting.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(meeting.date), 'dd MMM')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {meeting.attendees.length}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips Card */}
      <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl">
        <h3 className="font-semibold text-slate-900 mb-3">Quick Tips</h3>
        <div className="space-y-2.5">
          {[
            'Always obtain consent before recording',
            'Use markers to highlight key moments',
            'Review and edit transcripts for accuracy',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-white rounded-lg flex items-center justify-center text-xs font-medium text-slate-500 shadow-sm flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-slate-600">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
