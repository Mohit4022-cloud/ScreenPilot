import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingAssistant } from './components/FloatingAssistant';
import PermissionDialog from './components/PermissionDialog';
import SettingsPanel from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { UpdateNotification } from './components/UpdateNotification';
import InsightDisplay from './components/InsightDisplay';
import type { ViewType, AppState } from '../shared/types';

function App() {
  const [view, setView] = useState<ViewType>('assistant');
  const [state, setState] = useState<AppState>({
    isCapturing: false,
    hasPermissions: false,
    currentInsight: null,
    metrics: null,
    error: null,
  });

  useEffect(() => {
    // Check permissions on startup
    checkPermissions();

    // Set up event listeners
    window.screenpilot.onStatus((status) => {
      setState(prev => ({ 
        ...prev, 
        isCapturing: status.isActive && !status.isPaused,
        metrics: status.metrics 
      }));
    });

    window.screenpilot.onInsight((insight) => {
      setState(prev => ({ ...prev, currentInsight: insight }));
    });

    window.screenpilot.onError((error) => {
      setState(prev => ({ ...prev, error: error.message || 'Unknown error' }));
    });

    window.screenpilot.onNavigate((route) => {
      if (route === '/settings') setView('settings');
    });

    // Load metrics periodically
    const metricsInterval = setInterval(loadMetrics, 5000);

    return () => {
      clearInterval(metricsInterval);
      window.screenpilot.removeAllListeners('screenpilot:status');
      window.screenpilot.removeAllListeners('screenpilot:insight');
      window.screenpilot.removeAllListeners('screenpilot:error');
      window.screenpilot.removeAllListeners('navigate');
    };
  }, []);

  const checkPermissions = async () => {
    // For now, assume permissions are granted
    // TODO: Implement proper permission checking
    setState(prev => ({ ...prev, hasPermissions: true }));
  };

  const loadMetrics = async () => {
    try {
      const status = await window.screenpilot.getStatus();
      setState(prev => ({ ...prev, metrics: status.metrics }));
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const handlePermissionGranted = () => {
    setState(prev => ({ ...prev, hasPermissions: true }));
    setView('assistant');
  };

  return (
    <div className="relative w-full h-screen bg-transparent">
      {/* Update Notification */}
      <UpdateNotification />
      
      {/* Status Bar */}
      <StatusBar 
        onPauseToggle={async (paused) => {
          await window.screenpilot.pause(paused);
        }}
      />

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {view === 'assistant' && (
          <motion.div
            key="assistant"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full"
          >
            <FloatingAssistant />
            {state.currentInsight && (
              <InsightDisplay insight={state.currentInsight} />
            )}
          </motion.div>
        )}

        {view === 'permissions' && (
          <motion.div
            key="permissions"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <PermissionDialog onComplete={handlePermissionGranted} />
          </motion.div>
        )}

        {view === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SettingsPanel onClose={() => setView('assistant')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;