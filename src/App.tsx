import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useMeetings, useSettings, useCurrentMeeting } from './hooks/useStorage';
import { HomeScreen } from './screens/HomeScreen';
import { NewMeetingScreen } from './screens/NewMeetingScreen';
import { RecordingScreen } from './screens/RecordingScreen';
import { TranscriptScreen } from './screens/TranscriptScreen';
import { MinutesScreen } from './screens/MinutesScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Layout } from './components/Layout';
import type { Meeting } from './types';

function App() {
  const { meetings, addMeeting, updateMeeting, deleteMeeting, getMeetingById, searchMeetings } = useMeetings();
  const { settings, updateSettings } = useSettings();
  const { currentMeeting, saveCurrentMeeting, clearCurrentMeeting } = useCurrentMeeting();

// DEBUG - Add this right after the line above
console.log('App render - currentMeeting:', currentMeeting?.id || 'null');
  const handleStartNewMeeting = () => {
    clearCurrentMeeting();
  };

  const handleSaveMeetingSetup = (meetingData: Partial<Meeting>) => {
    const newMeeting: Meeting = {
      id: crypto.randomUUID(),
      title: meetingData.title || 'Untitled Meeting',
      type: meetingData.type || 'team',
      date: meetingData.date || new Date().toISOString().split('T')[0],
      startTime: meetingData.startTime || new Date().toTimeString().slice(0, 5),
      location: meetingData.location,
      caseRef: meetingData.caseRef,
      consentConfirmed: false,
      attendees: meetingData.attendees || [],
      transcriptText: '',
      minutesText: '',
      actions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };
    saveCurrentMeeting(newMeeting);
    return newMeeting.id;
  };

  const handleUpdateTranscript = (transcript: string) => {
    if (currentMeeting) {
      const updated = { ...currentMeeting, transcriptText: transcript };
      saveCurrentMeeting(updated);
    }
  };

  const handleSaveMinutes = (minutesText: string, actions: Meeting['actions']) => {
    if (currentMeeting) {
      const updated = {
        ...currentMeeting,
        minutesText,
        actions,
        updatedAt: new Date().toISOString(),
      };
      saveCurrentMeeting(updated);
      
      // Also save to meetings list
      const existing = getMeetingById(currentMeeting.id);
      if (existing) {
        updateMeeting(currentMeeting.id, updated);
      } else {
        addMeeting(updated);
      }
    }
  };

  const handleFinalizeMeeting = () => {
    if (currentMeeting) {
      const finalized = {
        ...currentMeeting,
        status: 'completed' as const,
        updatedAt: new Date().toISOString(),
      };
      
      const existing = getMeetingById(currentMeeting.id);
      if (existing) {
        updateMeeting(currentMeeting.id, finalized);
      } else {
        addMeeting(finalized);
      }
      clearCurrentMeeting();
    }
  };

  return (
    <Router>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <HomeScreen
                meetings={meetings.slice(0, 5)}
                currentMeeting={currentMeeting}
                onStartNew={handleStartNewMeeting}
              />
            }
          />
          <Route
            path="/new"
            element={
              <NewMeetingScreen
                settings={settings}
                onSave={handleSaveMeetingSetup}
              />
            }
          />
          <Route
            path="/record"
            element={
              currentMeeting ? (
                <RecordingScreen
                  meeting={currentMeeting}
                  onUpdateMeeting={saveCurrentMeeting}
                />
              ) : (
                <Navigate to="/new" />
              )
            }
          />
          <Route
            path="/transcript"
            element={
              currentMeeting ? (
                <TranscriptScreen
                  meeting={currentMeeting}
                  onUpdateTranscript={handleUpdateTranscript}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />
          <Route
            path="/minutes"
            element={
              currentMeeting ? (
                <MinutesScreen
                  meeting={currentMeeting}
                  onSaveMinutes={handleSaveMinutes}
                  onFinalize={handleFinalizeMeeting}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />
          <Route
            path="/history"
            element={
              <HistoryScreen
                meetings={meetings}
                onDelete={deleteMeeting}
                onSearch={searchMeetings}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsScreen
                settings={settings}
                onUpdate={updateSettings}
                onDeleteAll={() => {
                  meetings.forEach((m) => deleteMeeting(m.id));
                }}
              />
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
