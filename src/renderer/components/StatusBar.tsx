import React, { useState, useEffect } from 'react';
import { Activity, PauseCircle, PlayCircle, AlertCircle, DollarSign } from 'lucide-react';

interface StatusBarProps {
  onPauseToggle: (paused: boolean) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ onPauseToggle }) => {
  const [status, setStatus] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Get initial status
    window.screenpilot.getStatus().then(setStatus);

    // Listen for status updates
    window.screenpilot.on('status-change', (newStatus: any) => {
      setStatus(newStatus);
      setIsPaused(newStatus.isPaused || false);
    });

    return () => {
      window.screenpilot.removeAllListeners('status-change');
    };
  }, []);

  const handlePauseToggle = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    onPauseToggle(newPaused);
  };

  if (!status) return null;

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="status-bar fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          {/* Active/Paused Status */}
          <div className="flex items-center gap-2">
            {status.isActive ? (
              <Activity className="w-4 h-4 text-green-500 animate-pulse" />
            ) : (
              <Activity className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {status.isActive ? (isPaused ? 'Paused' : 'Active') : 'Inactive'}
            </span>
          </div>

          {/* Insights Count */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Insights: <span className="font-medium">{status.metrics?.totalInsights || 0}</span>
            </span>
          </div>

          {/* Daily Cost */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Today: <span className="font-medium">{formatCost(status.metrics?.dailyCost || 0)}</span>
            </span>
          </div>

          {/* Cache Hit Rate */}
          {status.metrics?.cacheHitRate !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Cache: <span className="font-medium">{formatPercentage(status.metrics.cacheHitRate)}</span>
              </span>
            </div>
          )}

          {/* Response Time */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Avg Response: <span className="font-medium">{status.metrics?.averageResponseTime || 0}ms</span>
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {status.lastError && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 dark:text-red-400">Error</span>
            </div>
          )}

          {status.isActive && (
            <button
              onClick={handlePauseToggle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <PlayCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <PauseCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};