import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Settings, 
  Activity,
  AlertCircle,
  CheckCircle,
  Loader,
  Pause,
  Play,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  Brain,
  Zap
} from 'lucide-react';
import type { FloatingAssistantProps, Insight, Status } from '../../shared/types';

type AssistantStatus = 'idle' | 'processing' | 'success' | 'error' | 'listening';

interface EnhancedFloatingAssistantProps extends FloatingAssistantProps {
  onPauseToggle?: () => void;
  onMinimize?: () => void;
  isMuted?: boolean;
  onMuteToggle?: () => void;
  status?: Status | null;
}

const EnhancedFloatingAssistant: React.FC<EnhancedFloatingAssistantProps> = ({ 
  isCapturing, 
  onSettingsClick,
  onPauseToggle,
  onMinimize,
  isMuted = false,
  onMuteToggle,
  status
}) => {
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('idle');
  const [lastAction, setLastAction] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [recentInsights, setRecentInsights] = useState<Insight[]>([]);
  const [pulseIntensity, setPulseIntensity] = useState(1);
  
  // Animated orb effect
  const x = useSpring(0, { stiffness: 100, damping: 10 });
  const y = useSpring(0, { stiffness: 100, damping: 10 });
  
  // Particle system ref
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.getElementById('assistant-orb')?.getBoundingClientRect();
      if (rect && !isMinimized) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (e.clientX - centerX) * 0.05;
        const deltaY = (e.clientY - centerY) * 0.05;
        x.set(deltaX);
        y.set(deltaY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [x, y, isMinimized]);

  // Listen for insights
  useEffect(() => {
    const handleInsight = (insight: Insight) => {
      setRecentInsights(prev => [insight, ...prev.slice(0, 4)]);
      
      if (insight.type === 'instant-action') {
        setAssistantStatus('processing');
        setLastAction(insight.data.content);
        setPulseIntensity(2);
        setTimeout(() => {
          setAssistantStatus('success');
          setPulseIntensity(1.5);
        }, 1000);
        setTimeout(() => {
          setAssistantStatus('idle');
          setPulseIntensity(1);
        }, 3000);
      } else if (insight.type === 'critical-error') {
        setAssistantStatus('error');
        setPulseIntensity(3);
        setTimeout(() => {
          setAssistantStatus('idle');
          setPulseIntensity(1);
        }, 5000);
      } else if (insight.type === 'guidance') {
        setAssistantStatus('listening');
        setPulseIntensity(1.5);
        setTimeout(() => {
          setAssistantStatus('idle');
          setPulseIntensity(1);
        }, 2000);
      }
    };

    window.screenpilot.onInsight(handleInsight);

    return () => {
      window.screenpilot.removeAllListeners('screenpilot:insight');
    };
  }, []);

  const getStatusIcon = () => {
    switch (assistantStatus) {
      case 'processing':
        return <Loader className="w-6 h-6 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-6 h-6" />;
      case 'error':
        return <AlertCircle className="w-6 h-6" />;
      case 'listening':
        return <Brain className="w-6 h-6" />;
      default:
        return isCapturing ? <Activity className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />;
    }
  };

  const getStatusColor = () => {
    switch (assistantStatus) {
      case 'processing':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'listening':
        return 'bg-purple-500';
      default:
        return isCapturing ? 'bg-accent' : 'bg-gray-600';
    }
  };

  const getGlowColor = () => {
    switch (assistantStatus) {
      case 'error':
        return 'rgba(255, 51, 102, 0.5)';
      case 'success':
        return 'rgba(0, 255, 136, 0.5)';
      case 'listening':
        return 'rgba(168, 85, 247, 0.5)';
      default:
        return 'rgba(0, 255, 136, 0.5)';
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (onMinimize) onMinimize();
  };

  return (
    <div className={`flex flex-col items-center justify-center h-full p-8 transition-all ${isMinimized ? 'p-4' : ''}`}>
      {/* Title Bar */}
      <div className="absolute top-0 left-0 right-0 h-8 drag-region flex items-center justify-between px-4">
        <span className="text-xs text-text-secondary">ScreenPilot</span>
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={toggleMinimize}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          {onMuteToggle && (
            <button
              onClick={onMuteToggle}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          {isCapturing && onPauseToggle && (
            <button
              onClick={onPauseToggle}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={status?.isPaused ? "Resume" : "Pause"}
            >
              {status?.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onSettingsClick}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Orb */}
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          <motion.div
            key="expanded"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative"
          >
            <motion.div
              id="assistant-orb"
              className={`relative w-32 h-32 rounded-full ${getStatusColor()} shadow-2xl flex items-center justify-center`}
              style={{ x, y }}
              animate={{
                scale: isCapturing ? [1, 1.05 * pulseIntensity, 1] : 1,
              }}
              transition={{
                scale: {
                  repeat: isCapturing ? Infinity : 0,
                  duration: 2 / pulseIntensity,
                  ease: "easeInOut"
                }
              }}
            >
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  opacity: isCapturing ? [0.3, 0.6, 0.3] : 0,
                }}
                transition={{
                  repeat: isCapturing ? Infinity : 0,
                  duration: 2 / pulseIntensity,
                  ease: "easeInOut"
                }}
                style={{
                  background: `radial-gradient(circle, ${getGlowColor()} 0%, transparent 70%)`,
                  filter: 'blur(20px)',
                  transform: 'scale(1.5)',
                }}
              />

              {/* Icon */}
              <div className="relative z-10 text-white">
                {getStatusIcon()}
              </div>

              {/* Pulse rings */}
              {isCapturing && assistantStatus === 'idle' && (
                <>
                  {[0, 0.5, 1].map((delay) => (
                    <motion.div
                      key={delay}
                      className="absolute inset-0 rounded-full border-2 border-white/20"
                      animate={{
                        scale: [1, 1.5 * pulseIntensity, 2 * pulseIntensity],
                        opacity: [0.5, 0.2, 0],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 2,
                        ease: "easeOut",
                        delay
                      }}
                    />
                  ))}
                </>
              )}

              {/* Activity particles */}
              {isCapturing && (
                <div ref={particlesRef} className="absolute inset-0">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full"
                      initial={{ 
                        x: 0, 
                        y: 0,
                        opacity: 0
                      }}
                      animate={{
                        x: [0, (Math.random() - 0.5) * 100],
                        y: [0, (Math.random() - 0.5) * 100],
                        opacity: [0, 1, 0]
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeOut"
                      }}
                      style={{
                        left: '50%',
                        top: '50%',
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>

            {/* Status Text */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-lg font-semibold mb-2">
                {status?.isPaused ? 'Paused' : (isCapturing ? 'Watching Your Screen' : 'Ready to Assist')}
              </h2>
              <p className="text-sm text-text-secondary max-w-xs">
                {lastAction || (isCapturing 
                  ? 'AI is analyzing your screen in real-time' 
                  : 'Start capture to begin AI assistance')}
              </p>
            </motion.div>

            {/* Quick Stats */}
            {isCapturing && status && (
              <motion.div
                className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 text-xs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Activity className="w-3 h-3 text-green-500" />
                    <span className="font-semibold">{status.metrics.fps} FPS</span>
                  </div>
                  <span className="text-text-secondary">Capture Rate</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Brain className="w-3 h-3 text-blue-500" />
                    <span className="font-semibold">{status.metrics.insightsGenerated}</span>
                  </div>
                  <span className="text-text-secondary">Insights</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span className="font-semibold">{status.metrics.latency}ms</span>
                  </div>
                  <span className="text-text-secondary">Latency</span>
                </div>
              </motion.div>
            )}

            {/* Recent Insights Preview */}
            {recentInsights.length > 0 && !isCapturing && (
              <motion.div
                className="absolute bottom-4 left-4 right-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-xs text-text-secondary mb-2">Recent Insights</p>
                <div className="space-y-1">
                  {recentInsights.slice(0, 3).map((insight, i) => (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="text-xs bg-white/5 rounded p-2 truncate"
                    >
                      {insight.title}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="minimized"
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            className={`relative w-16 h-16 rounded-full ${getStatusColor()} shadow-lg flex items-center justify-center`}
          >
            <div className="text-white">
              {getStatusIcon()}
            </div>
            {isCapturing && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/20"
                animate={{
                  scale: [1, 1.5, 2],
                  opacity: [0.5, 0.2, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeOut"
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedFloatingAssistant;