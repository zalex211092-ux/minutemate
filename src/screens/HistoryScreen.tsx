import { useState } from 'react';
import { Search, Calendar, Users, Filter, X, Trash2, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import type { Meeting, MeetingType } from '../types';
import { MEETING_TYPE_LABELS } from '../types';
import { exportToPDF } from '../services/exportService';

interface HistoryScreenProps {
  meetings: Meeting[];
  onDelete: (id: string) => void;
  onSearch: (query: string, filters?: { type?: string; dateFrom?: string; dateTo?: string; attendee?: string }) => Meeting[];
}

const typeColors: Record<string, { bg: string; text: string; dot: string }> = {
  '1:1': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'team': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'disciplinary': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  'investigation': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
};

export function HistoryScreen({ meetings: _meetings, onDelete, onSearch }: HistoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: '' as MeetingType | '',
    dateFrom: '',
    dateTo: '',
    attendee: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredMeetings = onSearch(searchQuery, {
    type: filters.type || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    attendee: filters.attendee || undefined,
  });

  const handleClearFilters = () => {
    setFilters({
      type: '',
      dateFrom: '',
      dateTo: '',
      attendee: '',
    });
    setSearchQuery('');
  };

  const handleExport = (meeting: Meeting) => {
    exportToPDF(meeting);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setDeleteConfirm(null);
  };

  const hasActiveFilters = searchQuery || filters.type || filters.dateFrom || filters.dateTo || filters.attendee;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Meeting History</h1>
        <p className="text-slate-500 mt-1">Search and manage your meetings</p>
      </div>

      {/* Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings, attendees..."
            className="w-full pl-12 pr-11 py-3.5 bg-white rounded-xl border-0 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="ml-1 text-xs opacity-70">on</span>}
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Meeting Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value as MeetingType })}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 transition-all"
              >
                <option value="">All types</option>
                <option value="1:1">1:1 Meeting</option>
                <option value="team">Team Meeting</option>
                <option value="disciplinary">Disciplinary Hearing</option>
                <option value="investigation">Investigation Meeting</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Attendee Name</label>
              <input
                type="text"
                value={filters.attendee}
                onChange={(e) => setFilters({ ...filters, attendee: e.target.value })}
                placeholder="Search by attendee..."
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Meetings List */}
      {filteredMeetings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-900 font-medium">No meetings found</p>
          <p className="text-slate-500 text-sm mt-1">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Start a new meeting to see it here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => {
            const colors = typeColors[meeting.type] || typeColors.team;
            return (
              <div
                key={meeting.id}
                className="p-4 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 hover:ring-slate-200 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Type & Status */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {MEETING_TYPE_LABELS[meeting.type]}
                      </span>
                      {meeting.caseRef && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{meeting.caseRef}</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                        meeting.status === 'completed' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {meeting.status === 'completed' ? 'Completed' : 'Draft'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-slate-900 mb-1.5">{meeting.title}</h3>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(meeting.date), 'dd MMM yyyy')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {meeting.attendees.length}
                      </span>
                      {meeting.location && (
                        <span className="text-slate-400">{meeting.location}</span>
                      )}
                    </div>

                    {/* Attendees */}
                    {meeting.attendees.length > 0 && (
                      <div className="mt-2.5 text-sm text-slate-600">
                        {meeting.attendees.slice(0, 3).map((a, i) => (
                          <span key={a.id}>
                            {a.name || a.role}{i < Math.min(meeting.attendees.length, 3) - 1 ? ', ' : ''}
                          </span>
                        ))}
                        {meeting.attendees.length > 3 && (
                          <span className="text-slate-400"> +{meeting.attendees.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 ml-3">
                    <button
                      onClick={() => handleExport(meeting)}
                      className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Export PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(meeting.id)}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Delete Meeting?</h3>
            <p className="text-slate-500 text-center mb-6">
              This action cannot be undone. The meeting minutes and transcript will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3.5 text-slate-700 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3.5 bg-rose-500 text-white font-medium hover:bg-rose-600 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
