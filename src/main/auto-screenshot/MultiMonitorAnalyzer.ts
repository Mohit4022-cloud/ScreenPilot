import { EventEmitter } from 'events';
import { screen, Display, desktopCapturer } from 'electron';
import sharp from 'sharp';
import OpenAI from 'openai';

export interface MonitorInfo {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
  isPrimary: boolean;
  screenshot?: Buffer;
}

export interface WorkspaceAnalysis {
  monitors: MonitorInfo[];
  layout: 'single' | 'dual-horizontal' | 'dual-vertical' | 'triple' | 'quad';
  primaryTask: string;
  distractionSources: string[];
  efficiencyScore: number; // 0-100
  suggestions: string[];
}

export interface WindowArrangement {
  application: string;
  monitor: string;
  position: { x: number; y: number; width: number; height: number };
  isActive: boolean;
}

export class MultiMonitorAnalyzer extends EventEmitter {
  private openai: OpenAI;
  private lastAnalysis: WorkspaceAnalysis | null = null;
  private monitorCache: Map<string, MonitorInfo> = new Map();

  constructor(openai: OpenAI) {
    super();
    this.openai = openai;
    
    // Monitor display changes
    screen.on('display-added', () => this.onDisplaysChanged());
    screen.on('display-removed', () => this.onDisplaysChanged());
    screen.on('display-metrics-changed', () => this.onDisplaysChanged());
  }

  // Analyze entire workspace
  async analyzeWorkspace(): Promise<WorkspaceAnalysis> {
    const monitors = await this.captureAllMonitors();
    
    if (monitors.length === 0) {
      throw new Error('No monitors detected');
    }
    
    // Determine layout
    const layout = this.detectLayout(monitors);
    
    // Single monitor - simple analysis
    if (monitors.length === 1) {
      return this.analyzeSingleMonitor(monitors[0]);
    }
    
    // Multi-monitor - comprehensive analysis
    const analysis = await this.analyzeMultiMonitorSetup(monitors, layout);
    
    this.lastAnalysis = analysis;
    this.emit('analysisComplete', analysis);
    
    return analysis;
  }

  // Capture screenshots from all monitors
  private async captureAllMonitors(): Promise<MonitorInfo[]> {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const monitors: MonitorInfo[] = [];
    
    for (const display of displays) {
      try {
        const screenshot = await this.captureDisplay(display);
        
        const monitorInfo: MonitorInfo = {
          id: display.id.toString(),
          name: `Display ${displays.indexOf(display) + 1}`,
          bounds: display.bounds,
          scaleFactor: display.scaleFactor,
          isPrimary: display.id === primaryDisplay.id,
          screenshot
        };
        
        monitors.push(monitorInfo);
        this.monitorCache.set(monitorInfo.id, monitorInfo);
      } catch (error) {
        console.error(`Failed to capture display ${display.id}:`, error);
      }
    }
    
    return monitors;
  }

  // Capture single display
  private async captureDisplay(display: Display): Promise<Buffer> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: display.bounds.width,
        height: display.bounds.height
      }
    });
    
    // Find source for this display
    const source = sources.find(s => 
      s.display_id === display.id.toString() || 
      sources.length === 1
    );
    
    if (!source) {
      throw new Error(`No source found for display ${display.id}`);
    }
    
    // Optimize for GPT-4o
    const optimized = await sharp(source.thumbnail.toPNG())
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    return optimized;
  }

  // Detect monitor layout
  private detectLayout(monitors: MonitorInfo[]): WorkspaceAnalysis['layout'] {
    if (monitors.length === 1) return 'single';
    if (monitors.length === 2) {
      // Check if side-by-side or stacked
      const [m1, m2] = monitors;
      const horizontalOverlap = Math.abs(m1.bounds.y - m2.bounds.y) < 100;
      return horizontalOverlap ? 'dual-horizontal' : 'dual-vertical';
    }
    if (monitors.length === 3) return 'triple';
    return 'quad';
  }

  // Analyze single monitor workspace
  private async analyzeSingleMonitor(monitor: MonitorInfo): Promise<WorkspaceAnalysis> {
    if (!monitor.screenshot) {
      throw new Error('No screenshot available');
    }
    
    const prompt = `Analyze this single-monitor workspace:

Identify:
1. Primary application/task
2. Window organization efficiency
3. Potential distractions
4. Improvement suggestions

FORMAT:
PRIMARY_TASK: [main activity]
EFFICIENCY: [0-100]
DISTRACTIONS: [list]
SUGGESTIONS:
- [suggestion 1]
- [suggestion 2]`;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${monitor.screenshot.toString('base64')}`,
              detail: 'low'
            }
          }
        ]
      }],
      max_tokens: 300,
      temperature: 0.3
    });
    
    return this.parseWorkspaceAnalysis(response.choices[0]?.message?.content || '', [monitor], 'single');
  }

  // Analyze multi-monitor setup
  private async analyzeMultiMonitorSetup(
    monitors: MonitorInfo[],
    layout: WorkspaceAnalysis['layout']
  ): Promise<WorkspaceAnalysis> {
    // Create composite image for analysis
    const compositePrompt = `Analyze this ${monitors.length}-monitor workspace setup:

Monitor Layout: ${layout}
${monitors.map((m, i) => `Monitor ${i + 1}: ${m.isPrimary ? 'PRIMARY' : 'Secondary'}`).join('\n')}

Analyze:
1. How well the monitors are being utilized
2. Task distribution across monitors
3. Workflow efficiency
4. Potential improvements

FORMAT:
PRIMARY_TASK: [main activity across all monitors]
EFFICIENCY: [0-100]
MONITOR_USAGE:
- Monitor 1: [what's displayed]
- Monitor 2: [what's displayed]
${monitors.length > 2 ? '- Monitor 3: [what\'s displayed]' : ''}
DISTRACTIONS: [list sources]
SUGGESTIONS:
- [improvement 1]
- [improvement 2]
- [improvement 3]`;
    
    // Analyze each monitor
    const messages: any[] = [{
      role: 'user',
      content: [
        { type: 'text', text: compositePrompt }
      ]
    }];
    
    // Add all monitor screenshots
    for (const monitor of monitors) {
      if (monitor.screenshot) {
        messages[0].content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${monitor.screenshot.toString('base64')}`,
            detail: 'low'
          }
        });
      }
    }
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 500,
      temperature: 0.3
    });
    
    return this.parseWorkspaceAnalysis(response.choices[0]?.message?.content || '', monitors, layout);
  }

  // Parse GPT-4o response
  private parseWorkspaceAnalysis(
    response: string,
    monitors: MonitorInfo[],
    layout: WorkspaceAnalysis['layout']
  ): WorkspaceAnalysis {
    const lines = response.split('\n');
    const analysis: WorkspaceAnalysis = {
      monitors,
      layout,
      primaryTask: 'Unknown',
      distractionSources: [],
      efficiencyScore: 50,
      suggestions: []
    };
    
    let inSuggestions = false;
    let inDistractions = false;
    
    for (const line of lines) {
      if (line.startsWith('PRIMARY_TASK:')) {
        analysis.primaryTask = line.substring(13).trim();
      } else if (line.startsWith('EFFICIENCY:')) {
        const match = line.match(/(\d+)/);
        if (match) {
          analysis.efficiencyScore = parseInt(match[1]);
        }
      } else if (line.startsWith('DISTRACTIONS:')) {
        inDistractions = true;
        inSuggestions = false;
        const inline = line.substring(13).trim();
        if (inline && inline !== '[list]') {
          analysis.distractionSources = inline.split(',').map(d => d.trim());
        }
      } else if (line.startsWith('SUGGESTIONS:')) {
        inSuggestions = true;
        inDistractions = false;
      } else if (line.startsWith('- ') && inSuggestions) {
        analysis.suggestions.push(line.substring(2).trim());
      } else if (line.startsWith('- ') && inDistractions) {
        analysis.distractionSources.push(line.substring(2).trim());
      }
    }
    
    return analysis;
  }

  // Get optimal window arrangement suggestions
  async suggestWindowArrangement(
    currentArrangement: WindowArrangement[]
  ): Promise<WindowArrangement[]> {
    const monitors = await this.captureAllMonitors();
    
    // Analyze current arrangement efficiency
    const efficiencyIssues = this.analyzeArrangementIssues(currentArrangement, monitors);
    
    if (efficiencyIssues.length === 0) {
      return currentArrangement; // Already optimal
    }
    
    // Generate optimized arrangement
    return this.optimizeArrangement(currentArrangement, monitors, efficiencyIssues);
  }

  private analyzeArrangementIssues(
    arrangement: WindowArrangement[],
    monitors: MonitorInfo[]
  ): string[] {
    const issues: string[] = [];
    
    // Check for communication apps on primary monitor
    const primaryMonitor = monitors.find(m => m.isPrimary);
    if (primaryMonitor) {
      const distractingApps = ['Slack', 'Discord', 'Messages', 'WhatsApp'];
      const distractingOnPrimary = arrangement.filter(w => 
        w.monitor === primaryMonitor.id &&
        distractingApps.some(app => w.application.includes(app))
      );
      
      if (distractingOnPrimary.length > 0) {
        issues.push('Distracting apps on primary monitor');
      }
    }
    
    // Check for poor space utilization
    for (const monitor of monitors) {
      const windowsOnMonitor = arrangement.filter(w => w.monitor === monitor.id);
      const totalArea = monitor.bounds.width * monitor.bounds.height;
      const usedArea = windowsOnMonitor.reduce((sum, w) => 
        sum + (w.position.width * w.position.height), 0
      );
      
      if (usedArea / totalArea < 0.7) {
        issues.push(`Underutilized space on monitor ${monitor.name}`);
      }
    }
    
    return issues;
  }

  private optimizeArrangement(
    current: WindowArrangement[],
    monitors: MonitorInfo[],
    issues: string[]
  ): WindowArrangement[] {
    const optimized = [...current];
    const primaryMonitor = monitors.find(m => m.isPrimary)!;
    const secondaryMonitors = monitors.filter(m => !m.isPrimary);
    
    // Move distracting apps to secondary monitors
    const distractingApps = ['Slack', 'Discord', 'Messages', 'WhatsApp', 'Mail'];
    
    for (const window of optimized) {
      if (distractingApps.some(app => window.application.includes(app))) {
        if (window.monitor === primaryMonitor.id && secondaryMonitors.length > 0) {
          window.monitor = secondaryMonitors[0].id;
        }
      }
    }
    
    // Optimize window sizes for better space utilization
    for (const monitor of monitors) {
      const windowsOnMonitor = optimized.filter(w => w.monitor === monitor.id);
      
      if (windowsOnMonitor.length === 2) {
        // Split screen 50/50
        windowsOnMonitor[0].position = {
          x: monitor.bounds.x,
          y: monitor.bounds.y,
          width: monitor.bounds.width / 2,
          height: monitor.bounds.height
        };
        windowsOnMonitor[1].position = {
          x: monitor.bounds.x + monitor.bounds.width / 2,
          y: monitor.bounds.y,
          width: monitor.bounds.width / 2,
          height: monitor.bounds.height
        };
      }
    }
    
    return optimized;
  }

  // Monitor display changes
  private onDisplaysChanged(): void {
    this.monitorCache.clear();
    this.emit('displaysChanged');
  }

  // Get cached monitor info
  getMonitorInfo(monitorId: string): MonitorInfo | undefined {
    return this.monitorCache.get(monitorId);
  }

  // Get last analysis
  getLastAnalysis(): WorkspaceAnalysis | null {
    return this.lastAnalysis;
  }
}