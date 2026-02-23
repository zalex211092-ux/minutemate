import { useState, useEffect, useCallback } from 'react';
import type { Meeting, Settings } from '../types';

const MEETINGS_KEY = 'minutemate_meetings';
const SETTINGS_KEY = 'minutemate_settings';
const CURRENT_MEETING_KEY = 'minutemate_current_meeting';

const defaultSettings: Settings = {
  defaultLocation: '',
  useRoleTemplates: true,
  defaultExportFormat: 'pdf',
};

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(MEETINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMeetings(parsed);
      } catch (e) {
        console.error('Failed to parse meetings:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
    }
  }, [meetings, isLoaded]);

  const addMeeting = useCallback((meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev]);
  }, []);

  const updateMeeting = useCallback((id: string, updates: Partial<Meeting>) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      )
    );
  }, []);

  const deleteMeeting = useCallback((id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const getMeetingById = useCallback(
    (id: string) => meetings.find((m) => m.id === id),
    [meetings]
  );

  const searchMeetings = useCallback(
    (query: string, filters?: { type?: string; dateFrom?: string; dateTo?: string; attendee?: string }) => {
      return meetings.filter((meeting) => {
        if (query) {
          const q = query.toLowerCase();
          const matchesQuery =
            meeting.title.toLowerCase().includes(q) ||
            meeting.caseRef?.toLowerCase().includes(q) ||
            meeting.attendees.some((a) => a.name.toLowerCase().includes(q));
          if (!matchesQuery) return false;
        }

        if (filters?.type && meeting.type !== filters.type) return false;
        if (filters?.dateFrom && meeting.date < filters.dateFrom) return false;
        if (filters?.dateTo && meeting.date > filters.dateTo) return false;
        if (filters?.attendee) {
          const hasAttendee = meeting.attendees.some(
            (a) => a.name.toLowerCase().includes(filters.attendee!.toLowerCase())
          );
          if (!hasAttendee) return false;
        }

        return true;
      });
    },
    [meetings]
  );

  return {
    meetings,
    isLoaded,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    getMeetingById,
    searchMeetings,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return { settings, isLoaded, updateSettings, resetSettings };
}

export function useCurrentMeeting() {
  // Initialize from localStorage immediately to prevent null state after navigation
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CURRENT_MEETING_KEY);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  // Keep localStorage in sync with state changes
  useEffect(() => {
    if (currentMeeting) {
      localStorage.setItem(CURRENT_MEETING_KEY, JSON.stringify(currentMeeting));
    } else {
      localStorage.removeItem(CURRENT_MEETING_KEY);
    }
  }, [currentMeeting]);

  const clearCurrentMeeting = () => {
    setCurrentMeeting(null);
    localStorage.removeItem(CURRENT_MEETING_KEY);
  };

  return {
    currentMeeting,
    setCurrentMeeting,
    clearCurrentMeeting
  };
}