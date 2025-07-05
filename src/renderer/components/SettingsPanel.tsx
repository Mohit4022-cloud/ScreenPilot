import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Key, DollarSign, Gauge, Brain, Monitor } from 'lucide-react';
import type { SettingsPanelProps, Settings } from '../../shared/types';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [settings, setSettings] = useState<Settings>({
    capture: {
      fps: 5,
      quality: 0.8,
      captureMode: 'fullscreen',
      multiMonitor: false,
    },
    ai: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 500,
      streamResponses: true,
    },
    privacy: {
      sensitiveDataDetection: true,
      exclusionPatterns: [],
      passwordMasking: true,
      creditCardMasking: true,
    },
    shortcuts: {},
    notifications: true,
    theme: 'dark',
  });

  useEffect(() => {
    // Load current settings
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await window.screenpilot.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      await window.screenpilot.saveSettings(settings);
      if (apiKey) {
        // TODO: Save API key securely
        console.log('API key would be saved securely');
      }
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-bg-primary rounded-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 drag-region">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={onClose}
          className="no-drag p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
        {/* API Key */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Key className="w-4 h-4" />
            OpenAI API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-accent focus:outline-none"
          />
        </div>

        {/* Performance */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
            <Gauge className="w-4 h-4" />
            Performance
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-secondary">
                Capture Rate: {settings.capture.fps} FPS
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.capture.fps}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  capture: { ...settings.capture, fps: parseInt(e.target.value) }
                })}
                className="w-full mt-1"
              />
            </div>
          </div>
        </div>

        {/* AI Model Settings */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
            <Brain className="w-4 h-4" />
            AI Model
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-secondary">Model</label>
              <select
                value={settings.ai.model}
                onChange={(e) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, model: e.target.value as 'gpt-4o' | 'gpt-4o-mini' }
                })}
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-accent focus:outline-none"
              >
                <option value="gpt-4o">GPT-4o (Better quality)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (Lower cost)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary">
                Temperature: {settings.ai.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.ai.temperature}
                onChange={(e) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, temperature: parseFloat(e.target.value) }
                })}
                className="w-full mt-1"
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
            <Brain className="w-4 h-4" />
            AI Features
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.ai.streamResponses}
                onChange={(e) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, streamResponses: e.target.checked }
                })}
                className="rounded"
              />
              <span>Streaming Responses</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.capture.multiMonitor}
                onChange={(e) => setSettings({
                  ...settings,
                  capture: { ...settings.capture, multiMonitor: e.target.checked }
                })}
                className="rounded"
              />
              <span>Multi-Monitor Support</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.privacy.sensitiveDataDetection}
                onChange={(e) => setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, sensitiveDataDetection: e.target.checked }
                })}
                className="rounded"
              />
              <span>Sensitive Data Detection</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.privacy.passwordMasking}
                onChange={(e) => setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, passwordMasking: e.target.checked }
                })}
                className="rounded"
              />
              <span>Password Masking</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                className="rounded"
              />
              <span>Notifications</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
        <button
          onClick={handleSave}
          className="w-full px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent/90 transition-colors font-semibold flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </motion.div>
  );
};

export default SettingsPanel;