import { EventEmitter } from 'events';
import OpenAI from 'openai';

export interface UserAction {
  type: 'click' | 'type' | 'keypress' | 'navigate';
  target?: string;
  value?: string;
  timestamp: number;
}

export interface PredictedAction {
  action: string;
  confidence: number;
  reasoning: string;
  shortcut?: string;
}

export interface AutocompleteContext {
  application: string;
  currentScreen: string;
  recentActions: UserAction[];
  timeOnScreen: number;
}

export class SmartAutocomplete extends EventEmitter {
  private actionHistory: UserAction[] = [];
  private predictions: Map<string, PredictedAction[]> = new Map();
  private openai: OpenAI;
  
  // Configuration
  private readonly MAX_HISTORY = 100;
  private readonly PREDICTION_THRESHOLD = 3; // Min actions to predict
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(openai: OpenAI) {
    super();
    this.openai = openai;
  }

  // Record user action
  recordAction(action: UserAction): void {
    this.actionHistory.push(action);
    
    // Maintain history size
    if (this.actionHistory.length > this.MAX_HISTORY) {
      this.actionHistory.shift();
    }
    
    this.emit('actionRecorded', action);
  }

  // Predict next actions based on screenshot and history
  async predict(
    screenshot: Buffer,
    context: AutocompleteContext
  ): Promise<PredictedAction[]> {
    // Check cache first
    const cacheKey = this.generateCacheKey(context);
    const cached = this.predictions.get(cacheKey);
    
    if (cached && this.isCacheValid(cacheKey)) {
      return cached;
    }
    
    // Only predict if we have enough history
    if (context.recentActions.length < this.PREDICTION_THRESHOLD) {
      return [];
    }
    
    try {
      const predictions = await this.generatePredictions(screenshot, context);
      
      // Cache predictions
      this.predictions.set(cacheKey, predictions);
      setTimeout(() => this.predictions.delete(cacheKey), this.CACHE_TTL);
      
      return predictions;
    } catch (error) {
      console.error('Prediction error:', error);
      return [];
    }
  }

  private async generatePredictions(
    screenshot: Buffer,
    context: AutocompleteContext
  ): Promise<PredictedAction[]> {
    const prompt = this.buildPredictionPrompt(context);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
              detail: 'low'
            }
          }
        ]
      }],
      max_tokens: 200,
      temperature: 0.3
    });
    
    return this.parsePredictions(response.choices[0]?.message?.content || '');
  }

  private buildPredictionPrompt(context: AutocompleteContext): string {
    const recentActions = context.recentActions
      .slice(-5)
      .map(a => `${a.type}: ${a.target || a.value || 'unknown'}`)
      .join('\n');
    
    return `Based on the screenshot and user's recent actions, predict the next 3 most likely actions.

Application: ${context.application}
Time on screen: ${Math.round(context.timeOnScreen / 1000)}s

Recent actions:
${recentActions}

FORMAT YOUR RESPONSE EXACTLY AS:
PREDICTION 1: [action description] | Confidence: [0-1] | Reason: [why]
PREDICTION 2: [action description] | Confidence: [0-1] | Reason: [why]
PREDICTION 3: [action description] | Confidence: [0-1] | Reason: [why]

Each prediction should be a specific, actionable step.`;
  }

  private parsePredictions(response: string): PredictedAction[] {
    const predictions: PredictedAction[] = [];
    const lines = response.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const match = line.match(/PREDICTION\s+\d+:\s*([^|]+)\s*\|\s*Confidence:\s*([\d.]+)\s*\|\s*Reason:\s*(.+)/i);
      if (match) {
        predictions.push({
          action: match[1].trim(),
          confidence: parseFloat(match[2]),
          reasoning: match[3].trim()
        });
      }
    }
    
    // Add keyboard shortcuts if detected
    return predictions.map(p => this.enhanceWithShortcuts(p));
  }

  private enhanceWithShortcuts(prediction: PredictedAction): PredictedAction {
    // Common action to shortcut mappings
    const shortcuts: Record<string, string> = {
      'save': process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
      'copy': process.platform === 'darwin' ? 'Cmd+C' : 'Ctrl+C',
      'paste': process.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+V',
      'undo': process.platform === 'darwin' ? 'Cmd+Z' : 'Ctrl+Z',
      'find': process.platform === 'darwin' ? 'Cmd+F' : 'Ctrl+F',
      'new': process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
      'open': process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O'
    };
    
    const actionLower = prediction.action.toLowerCase();
    for (const [key, shortcut] of Object.entries(shortcuts)) {
      if (actionLower.includes(key)) {
        prediction.shortcut = shortcut;
        break;
      }
    }
    
    return prediction;
  }

  private generateCacheKey(context: AutocompleteContext): string {
    const actions = context.recentActions
      .map(a => `${a.type}:${a.target}`)
      .join('|');
    
    return `${context.application}:${context.currentScreen}:${actions}`;
  }

  private isCacheValid(key: string): boolean {
    // Simple validation - cache exists
    return this.predictions.has(key);
  }

  // Analyze patterns in action history
  analyzePatterns(): {
    commonSequences: Array<{ actions: string[]; count: number }>;
    averageTimePerAction: number;
    mostFrequentActions: Array<{ action: string; count: number }>;
  } {
    // Find common action sequences
    const sequences = new Map<string, number>();
    const windowSize = 3;
    
    for (let i = 0; i <= this.actionHistory.length - windowSize; i++) {
      const sequence = this.actionHistory
        .slice(i, i + windowSize)
        .map(a => `${a.type}:${a.target || a.value}`)
        .join(' → ');
      
      sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
    }
    
    // Calculate average time between actions
    let totalTime = 0;
    let actionCount = 0;
    
    for (let i = 1; i < this.actionHistory.length; i++) {
      totalTime += this.actionHistory[i].timestamp - this.actionHistory[i - 1].timestamp;
      actionCount++;
    }
    
    const averageTimePerAction = actionCount > 0 ? totalTime / actionCount : 0;
    
    // Find most frequent actions
    const actionCounts = new Map<string, number>();
    
    for (const action of this.actionHistory) {
      const key = `${action.type}:${action.target || action.value}`;
      actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
    }
    
    return {
      commonSequences: Array.from(sequences.entries())
        .map(([actions, count]) => ({ actions: actions.split(' → '), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      averageTimePerAction,
      mostFrequentActions: Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
  }

  // Clear history and predictions
  clear(): void {
    this.actionHistory = [];
    this.predictions.clear();
    this.emit('cleared');
  }

  // Get current history
  getHistory(): UserAction[] {
    return [...this.actionHistory];
  }
}