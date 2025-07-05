import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Listen for update events
    window.screenpilot.on('update-available', (info: UpdateInfo) => {
      setUpdateInfo(info);
      setShowNotification(true);
      setIsDownloading(true); // Auto-download starts
    });

    window.screenpilot.on('update-progress', (progress: DownloadProgress) => {
      setDownloadProgress(progress);
    });

    window.screenpilot.on('update-downloaded', (info: UpdateInfo) => {
      setIsDownloading(false);
      setIsUpdateReady(true);
      setUpdateInfo(info);
      setShowNotification(true);
    });

    return () => {
      window.screenpilot.removeAllListeners('update-available');
      window.screenpilot.removeAllListeners('update-progress');
      window.screenpilot.removeAllListeners('update-downloaded');
    };
  }, []);

  const handleInstallUpdate = async () => {
    try {
      if (window.screenpilot.installUpdate) {
        await window.screenpilot.installUpdate();
      }
    } catch (error) {
      console.error('Failed to install update:', error);
    }
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <AnimatePresence>
      {showNotification && updateInfo && (
        <motion.div
          className="update-notification fixed top-4 right-4 max-w-md z-50"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: "spring", damping: 20 }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5" />
                  <div>
                    <h3 className="font-semibold">
                      {isUpdateReady ? 'Update Ready to Install' : 'Update Available'}
                    </h3>
                    <p className="text-sm text-blue-100">Version {updateInfo.version}</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Download Progress */}
              {isDownloading && downloadProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>Downloading update...</span>
                    <span>{downloadProgress.percent.toFixed(1)}%</span>
                  </div>
                  <div className="relative">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress.percent}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-500">
                    <span>{formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}</span>
                    <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
                  </div>
                </div>
              )}

              {/* Release Notes */}
              {updateInfo.releaseNotes && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    What's New:
                  </h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                    {updateInfo.releaseNotes.split('\n').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {isUpdateReady ? (
                  <>
                    <button
                      onClick={handleInstallUpdate}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Restart & Install
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      Later
                    </button>
                  </>
                ) : isDownloading ? (
                  <button
                    disabled
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 animate-bounce" />
                    Downloading...
                  </button>
                ) : (
                  <button
                    onClick={handleDismiss}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    OK
                  </button>
                )}
              </div>

              {/* Auto-install notice */}
              {!isUpdateReady && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-500 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>The update will be installed automatically when you quit the app.</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};