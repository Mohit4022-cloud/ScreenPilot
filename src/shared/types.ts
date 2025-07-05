// Shared types for ScreenPilot application

// Insight types
export type InsightType = 'instant-action' | 'workflow' | 'error-detection' | 'guidance' | 'critical-error';
export type InsightPriority = 'low' | 'medium' | 'high';
export type InsightCategory = 'ERROR_HELP' | 'SHORTCUT' | 'AUTOMATION' | 'GENERAL';

export interface Suggestion {
  text: string;
  confidence: number;
  actionable?: boolean;
  shortcut?: string;
}

export interface InsightData {
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface Insight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  summary: string;
  suggestions?: Suggestion[];
  data: InsightData;
  timestamp: number;
}

// Status types
export interface Metrics {
  fps: number;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  screenshotsProcessed: number;
  insightsGenerated: number;
  totalInsights: number;
  averageResponseTime?: number;
  totalCost?: number;
}

export interface Status {
  isActive: boolean;
  isPaused: boolean;
  metrics: Metrics;
  lastScreenshotTime?: number;
  error?: string;
}

// Settings types
export interface CaptureSettings {
  fps: number;
  quality: number;
  captureMode: 'fullscreen' | 'activeWindow' | 'region';
  multiMonitor: boolean;
}

export interface AISettings {
  model: 'gpt-4o' | 'gpt-4o-mini';
  temperature: number;
  maxTokens: number;
  streamResponses: boolean;
}

export interface PrivacySettings {
  sensitiveDataDetection: boolean;
  exclusionPatterns: string[];
  passwordMasking: boolean;
  creditCardMasking: boolean;
}

export interface Settings {
  capture: CaptureSettings;
  ai: AISettings;
  privacy: PrivacySettings;
  shortcuts: Record<string, string>;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Error types
export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
}

// IPC Event types
export type IPCEvent = 
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'pause'; paused: boolean }
  | { type: 'getStatus' }
  | { type: 'getSettings' }
  | { type: 'saveSettings'; settings: Settings }
  | { type: 'insight'; insight: Insight }
  | { type: 'error'; error: ErrorInfo }
  | { type: 'status'; status: Status }
  | { type: 'navigate'; route: string };

// Window interface augmentation
declare global {
  interface Window {
    screenpilot: {
      // Core functionality
      start: () => Promise<void>;
      stop: () => Promise<void>;
      pause: (paused: boolean) => Promise<void>;
      getStatus: () => Promise<Status>;
      
      // Settings
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
      
      // Actions
      executeAction: (action: any) => Promise<void>;
      
      // Event listeners
      onInsight: (callback: (insight: Insight) => void) => void;
      onError: (callback: (error: ErrorInfo) => void) => void;
      onStatus: (callback: (status: Status) => void) => void;
      onNavigate: (callback: (route: string) => void) => void;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      
      // Generic event handling
      on: (channel: string, callback: (data: any) => void) => void;
      removeListener: (channel: string, callback: (data: any) => void) => void;
      
      // Remove listeners
      removeAllListeners: (channel: string) => void;
      
      // Auto-update functions
      checkForUpdates?: () => Promise<void>;
      getUpdateStatus?: () => Promise<any>;
      downloadUpdate?: () => Promise<void>;
      installUpdate?: () => Promise<void>;
    };
  }
}

// Component prop types
export interface FloatingAssistantProps {
  isCapturing: boolean;
  onSettingsClick: () => void;
}

export interface StatusBarComponentProps {
  onPauseToggle: (paused: boolean) => void;
}

export interface PermissionDialogProps {
  onComplete: () => void;
}

export interface SettingsPanelProps {
  onClose: () => void;
}

export interface StatusBarProps {
  isCapturing: boolean;
  metrics: Metrics | null;
  error: string | null;
}

export interface InsightDisplayProps {
  insight: Insight;
}

// App state types
export interface AppState {
  isCapturing: boolean;
  hasPermissions: boolean;
  currentInsight: Insight | null;
  metrics: Metrics | null;
  error: string | null;
}

export type ViewType = 'assistant' | 'permissions' | 'settings';