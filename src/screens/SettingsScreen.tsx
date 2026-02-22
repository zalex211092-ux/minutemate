import { useState } from 'react';
import { MapPin, Users, FileText, Trash2, AlertCircle, Check, Shield, Info } from 'lucide-react';
import type { Settings } from '../types';

interface SettingsScreenProps {
  settings: Settings;
  onUpdate: (updates: Partial<Settings>) => void;
  onDeleteAll: () => void;
}

export function SettingsScreen({ settings, onUpdate, onDeleteAll }: SettingsScreenProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const handleUpdate = (key: keyof Settings, value: any) => {
    onUpdate({ [key]: value });
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
  };

  const handleDeleteAll = () => {
    if (deleteConfirmText === 'DELETE') {
      onDeleteAll();
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your preferences</p>
      </div>

      {/* Default Location */}
      <div className="p-5 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Default Location</h3>
            <p className="text-sm text-slate-500">Pre-fill for new meetings</p>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={settings.defaultLocation}
            onChange={(e) => handleUpdate('defaultLocation', e.target.value)}
            placeholder="e.g., Conference Room A"
            className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 transition-all"
          />
          {saved === 'defaultLocation' && (
            <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />
          )}
        </div>
      </div>

      {/* Role Templates */}
      <div className="p-5 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Role Templates</h3>
            <p className="text-sm text-slate-500">Show quick-add role buttons</p>
          </div>
        </div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-700">Enable role templates</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={settings.useRoleTemplates}
              onChange={(e) => handleUpdate('useRoleTemplates', e.target.checked)}
              className="sr-only"
            />
            <div className={`w-12 h-7 rounded-full transition-colors ${
              settings.useRoleTemplates ? 'bg-slate-900' : 'bg-slate-300'
            }`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                settings.useRoleTemplates ? 'translate-x-6' : 'translate-x-0.5'
              } mt-0.5`} />
            </div>
          </div>
        </label>
      </div>

      {/* Export Format */}
      <div className="p-5 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Default Export Format</h3>
            <p className="text-sm text-slate-500">Preferred format for minutes</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['pdf', 'docx'] as const).map((format) => (
            <button
              key={format}
              onClick={() => handleUpdate('defaultExportFormat', format)}
              className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                settings.defaultExportFormat === format
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Data Retention */}
      <div className="p-5 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Data Retention</h3>
            <p className="text-sm text-slate-500">Auto-delete meetings after</p>
          </div>
        </div>
        <select
          value={settings.autoDeleteDays || ''}
          onChange={(e) => handleUpdate('autoDeleteDays', e.target.value ? parseInt(e.target.value) : undefined)}
          className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-slate-900 transition-all"
        >
          <option value="">Never auto-delete</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="180">180 days</option>
          <option value="365">1 year</option>
        </select>
      </div>

      {/* Delete All Data */}
      <div className="p-5 bg-rose-50 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-semibold text-rose-900">Delete All Data</h3>
            <p className="text-sm text-rose-600">Permanently delete everything</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3.5 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition-colors"
        >
          Delete All Data
        </button>
      </div>

      {/* About */}
      <div className="p-5 bg-slate-50 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <Info className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">About MinuteMate</h3>
            <p className="text-sm text-slate-500">Version 1.0.0</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Professional meeting minutes for HR teams. All data is stored locally on your device for maximum privacy and security.
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Delete All Data?</h3>
            <p className="text-slate-500 text-center mb-6">
              This will permanently delete all meetings, transcripts, and settings. This action cannot be undone.
            </p>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type "DELETE" to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-rose-500 transition-all text-center font-medium"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 py-3.5 text-slate-700 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteConfirmText !== 'DELETE'}
                className="flex-1 py-3.5 bg-rose-500 text-white font-medium hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
