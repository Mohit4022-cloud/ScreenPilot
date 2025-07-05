import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, Settings, Pause } from 'lucide-react';
import { Guidance } from '../types/guidance';

export const FloatingAssistant: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Listen for guidance from main process
    window.screenpilot.on('show-guidance', (data: Guidance) => {
      setGuidance(data);
      setIsVisible(true);
      
      // Auto-hide after delay
      setTimeout(() => setIsVisible(false), 5000);
    });

    // Listen for pause state
    window.screenpilot.on('pause-state', (paused: boolean) => {
      setIsPaused(paused);
    });

    return () => {
      window.screenpilot.removeAllListeners('show-guidance');
      window.screenpilot.removeAllListeners('pause-state');
    };
  }, []);

  const handleAction = async (action: any) => {
    try {
      await window.screenpilot.executeAction(action);
      setIsVisible(false);
    } catch (error) {
      console.error('Failed to execute action:', error);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && guidance && (
        <motion.div
          className="floating-assistant fixed bottom-6 right-6 max-w-sm z-50"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: "spring", damping: 20 }}
        >
          <div className="glass-morphism rounded-2xl shadow-2xl p-4 backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-gray-900 dark:text-gray-100">ScreenPilot</span>
              </div>
              <div className="flex items-center gap-2">
                {isPaused && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                    <Pause className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">Paused</span>
                  </div>
                )}
                <button
                  onClick={() => setIsVisible(false)}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full p-1 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {guidance.title && (
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {guidance.title}
                </h3>
              )}
              
              {guidance.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {guidance.description}
                </p>
              )}

              {guidance.actions && guidance.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {guidance.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(action)}
                      className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {guidance.shortcut && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">
                    {guidance.shortcut}
                  </kbd>
                  <span>Try this shortcut instead</span>
                </div>
              )}

              {guidance.context && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {guidance.context.application && (
                      <span>App: {guidance.context.application}</span>
                    )}
                    {guidance.context.window && (
                      <span className="ml-2">Window: {guidance.context.window}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};