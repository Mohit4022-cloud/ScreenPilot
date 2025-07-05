export interface GuidanceAction {
  id: string;
  label: string;
  type: 'keyboard' | 'click' | 'command';
  payload: any;
}

export interface Guidance {
  id: string;
  title?: string;
  description?: string;
  type: 'info' | 'warning' | 'error' | 'automation';
  priority: 'low' | 'medium' | 'high';
  actions?: GuidanceAction[];
  shortcut?: string;
  timestamp: number;
  context?: {
    application?: string;
    window?: string;
    region?: string;
  };
}

export interface InsightData {
  type: 'guidance' | 'instant-action' | 'critical-error' | 'automation';
  data: any;
  timestamp: number;
}