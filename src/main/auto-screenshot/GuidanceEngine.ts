import { EventEmitter } from 'events';
import { ScreenInsight, ScreenAnalysis } from './AutoScreenshotIntegration';

export type Priority = 'high' | 'medium' | 'low';

export interface Suggestion {
  text: string;
  shortcut?: string;
  action?: string;
  confidence: number;
}

export interface Guidance {
  id: string;
  timestamp: number;
  title: string;
  summary: string;
  priority: Priority;
  suggestions: Suggestion[];
  context: Context;
  category: GuidanceCategory;
}

export interface Context {
  application: string;
  screenState: string;
  userActivity: UserActivity;
  timestamp: number;
}

export interface UserActivity {
  isStuck: boolean;
  stuckDuration?: number;
  hasErrors: boolean;
  isRepetitive: boolean;
  lastActionTime: number;
}

export enum GuidanceCategory {
  ERROR_HELP = 'error-help',
  EFFICIENCY_TIP = 'efficiency-tip',
  NAVIGATION_HELP = 'navigation-help',
  FEATURE_DISCOVERY = 'feature-discovery',
  WORKFLOW_OPTIMIZATION = 'workflow-optimization'
}

interface ContextHistory {
  timestamp: number;
  application: string;
  screenState: string;
  hadErrors: boolean;
  suggestions: string[];
}

interface UserPattern {
  application: string;
  commonActions: string[];
  averageTimeOnScreen: number;
  errorRate: number;
}

export class GuidanceEngine extends EventEmitter {
  private contextHistory: ContextHistory[] = [];
  private userPatterns: Map<string, UserPattern> = new Map();
  private recentInsights: ScreenInsight[] = [];
  private lastActionTime = Date.now();
  
  // Configuration
  private readonly STUCK_THRESHOLD_MS = 30000; // 30 seconds
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly PATTERN_THRESHOLD = 3; // Minimum occurrences to establish pattern

  constructor() {
    super();
  }

  // 🧠 Process insight and generate guidance
  async process(insight: ScreenInsight): Promise<Guidance> {
    // Update recent insights
    this.recentInsights.push(insight);
    if (this.recentInsights.length > 10) {
      this.recentInsights.shift();
    }

    // Build context
    const context = this.buildContext(insight);
    
    // Determine guidance priority
    const priority = this.calculatePriority(insight, context);
    
    // Generate personalized guidance
    const guidance = await this.generateGuidance(insight, context, priority);
    
    // Update history and patterns
    this.updateHistory(context, insight);
    this.updatePatterns(insight);
    
    // Update last action time if suggestions indicate activity
    if (insight.analysis.suggestions.length > 0) {
      this.lastActionTime = Date.now();
    }
    
    return guidance;
  }

  // 🏗️ Build context from insight
  private buildContext(insight: ScreenInsight): Context {
    const now = Date.now();
    const timeSinceLastAction = now - this.lastActionTime;
    
    // Check if user is stuck
    const isStuck = this.detectIfStuck(insight, timeSinceLastAction);
    
    // Check for errors
    const hasErrors = insight.analysis.errors.length > 0;
    
    // Check for repetitive behavior
    const isRepetitive = this.detectRepetitiveBehavior(insight);
    
    return {
      application: insight.analysis.application,
      screenState: insight.analysis.summary,
      userActivity: {
        isStuck,
        stuckDuration: isStuck ? timeSinceLastAction : undefined,
        hasErrors,
        isRepetitive,
        lastActionTime: this.lastActionTime
      },
      timestamp: now
    };
  }

  // 🎯 Calculate guidance priority
  private calculatePriority(insight: ScreenInsight, context: Context): Priority {
    // High priority conditions
    if (context.userActivity.hasErrors) return 'high';
    if (context.userActivity.isStuck && context.userActivity.stuckDuration! > this.STUCK_THRESHOLD_MS) return 'high';
    if (this.detectCriticalWorkflow(insight)) return 'high';
    
    // Medium priority conditions
    if (context.userActivity.isRepetitive) return 'medium';
    if (this.detectInefficiency(insight)) return 'medium';
    if (this.hasUnusedFeatures(insight)) return 'medium';
    
    // Default to low priority
    return 'low';
  }

  // 🎨 Generate personalized guidance
  private async generateGuidance(
    insight: ScreenInsight,
    context: Context,
    priority: Priority
  ): Promise<Guidance> {
    const category = this.determineCategory(insight, context);
    const suggestions = this.buildSuggestions(insight, context, category);
    
    return {
      id: this.generateGuidanceId(),
      timestamp: Date.now(),
      title: this.generateTitle(category, context),
      summary: this.generateSummary(insight, context),
      priority,
      suggestions,
      context,
      category
    };
  }

  // 🏷️ Determine guidance category
  private determineCategory(insight: ScreenInsight, context: Context): GuidanceCategory {
    if (context.userActivity.hasErrors) {
      return GuidanceCategory.ERROR_HELP;
    }
    
    if (context.userActivity.isStuck) {
      return GuidanceCategory.NAVIGATION_HELP;
    }
    
    if (context.userActivity.isRepetitive) {
      return GuidanceCategory.EFFICIENCY_TIP;
    }
    
    const pattern = this.userPatterns.get(context.application);
    if (pattern && this.hasUnusedFeatures(insight)) {
      return GuidanceCategory.FEATURE_DISCOVERY;
    }
    
    return GuidanceCategory.WORKFLOW_OPTIMIZATION;
  }

  // 💡 Build suggestions
  private buildSuggestions(
    insight: ScreenInsight,
    context: Context,
    category: GuidanceCategory
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Add AI-generated suggestions
    insight.analysis.suggestions.forEach((text, index) => {
      suggestions.push({
        text,
        shortcut: insight.analysis.shortcuts[index],
        confidence: insight.analysis.confidence
      });
    });
    
    // Add category-specific suggestions
    switch (category) {
      case GuidanceCategory.ERROR_HELP:
        suggestions.unshift({
          text: 'Fix the error to continue',
          confidence: 1.0
        });
        break;
        
      case GuidanceCategory.NAVIGATION_HELP:
        if (context.userActivity.isStuck) {
          suggestions.push({
            text: 'Try using the search function',
            shortcut: 'Cmd+F',
            confidence: 0.8
          });
        }
        break;
        
      case GuidanceCategory.EFFICIENCY_TIP:
        suggestions.push({
          text: 'Consider using keyboard shortcuts for faster navigation',
          confidence: 0.7
        });
        break;
    }
    
    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    // Limit to top 3
    return suggestions.slice(0, 3);
  }

  // 🔍 Detect if user is stuck
  private detectIfStuck(insight: ScreenInsight, timeSinceLastAction: number): boolean {
    // Check if on same screen for too long
    if (timeSinceLastAction > this.STUCK_THRESHOLD_MS) {
      return true;
    }
    
    // Check if recent insights show no progress
    const recentSummaries = this.recentInsights
      .slice(-5)
      .map(i => i.analysis.summary);
    
    const uniqueSummaries = new Set(recentSummaries);
    return uniqueSummaries.size === 1 && recentSummaries.length >= 5;
  }

  // 🔄 Detect repetitive behavior
  private detectRepetitiveBehavior(insight: ScreenInsight): boolean {
    const recentActions = this.recentInsights
      .slice(-10)
      .flatMap(i => i.analysis.suggestions);
    
    // Count occurrences
    const actionCounts = recentActions.reduce((acc, action) => {
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Check if any action repeated too many times
    return Object.values(actionCounts).some(count => count >= this.PATTERN_THRESHOLD);
  }

  // 🚨 Detect critical workflow
  private detectCriticalWorkflow(insight: ScreenInsight): boolean {
    const criticalKeywords = [
      'save', 'delete', 'remove', 'destroy', 'drop', 'truncate',
      'payment', 'checkout', 'confirm', 'submit', 'deploy', 'publish'
    ];
    
    const lowerSummary = insight.analysis.summary.toLowerCase();
    return criticalKeywords.some(keyword => lowerSummary.includes(keyword));
  }

  // 📈 Detect inefficiency
  private detectInefficiency(insight: ScreenInsight): boolean {
    const pattern = this.userPatterns.get(insight.analysis.application);
    if (!pattern) return false;
    
    // Check if taking longer than average
    const currentTime = Date.now() - this.lastActionTime;
    return currentTime > pattern.averageTimeOnScreen * 1.5;
  }

  // 🎁 Check for unused features
  private hasUnusedFeatures(insight: ScreenInsight): boolean {
    // Simple heuristic: if shortcuts are available but pattern shows no keyboard usage
    return insight.analysis.shortcuts.length > 0 && 
           !this.contextHistory.some(h => h.suggestions.some(s => s.includes('Cmd') || s.includes('Ctrl')));
  }

  // 📝 Update history
  private updateHistory(context: Context, insight: ScreenInsight): void {
    this.contextHistory.push({
      timestamp: context.timestamp,
      application: context.application,
      screenState: context.screenState,
      hadErrors: context.userActivity.hasErrors,
      suggestions: insight.analysis.suggestions
    });
    
    // Limit history size
    if (this.contextHistory.length > this.MAX_HISTORY_SIZE) {
      this.contextHistory.shift();
    }
  }

  // 📊 Update user patterns
  private updatePatterns(insight: ScreenInsight): void {
    const app = insight.analysis.application;
    const pattern = this.userPatterns.get(app) || {
      application: app,
      commonActions: [],
      averageTimeOnScreen: 0,
      errorRate: 0
    };
    
    // Update common actions
    insight.analysis.suggestions.forEach(suggestion => {
      if (!pattern.commonActions.includes(suggestion)) {
        pattern.commonActions.push(suggestion);
      }
    });
    
    // Update average time (simple moving average)
    const timeSinceLastAction = Date.now() - this.lastActionTime;
    pattern.averageTimeOnScreen = 
      (pattern.averageTimeOnScreen * 0.8) + (timeSinceLastAction * 0.2);
    
    // Update error rate
    const hasError = insight.analysis.errors.length > 0;
    pattern.errorRate = (pattern.errorRate * 0.9) + (hasError ? 0.1 : 0);
    
    this.userPatterns.set(app, pattern);
  }

  // 🎯 Generate guidance ID
  private generateGuidanceId(): string {
    return `guidance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 📝 Generate title
  private generateTitle(category: GuidanceCategory, context: Context): string {
    switch (category) {
      case GuidanceCategory.ERROR_HELP:
        return '⚠️ Error Detected';
      case GuidanceCategory.EFFICIENCY_TIP:
        return '💡 Efficiency Tip';
      case GuidanceCategory.NAVIGATION_HELP:
        return '🧭 Navigation Help';
      case GuidanceCategory.FEATURE_DISCOVERY:
        return '✨ Feature Discovery';
      case GuidanceCategory.WORKFLOW_OPTIMIZATION:
        return '⚡ Workflow Optimization';
      default:
        return '💡 Suggestion';
    }
  }

  // 📝 Generate summary
  private generateSummary(insight: ScreenInsight, context: Context): string {
    if (context.userActivity.hasErrors) {
      return `Fix the error in ${context.application} to continue`;
    }
    
    if (context.userActivity.isStuck) {
      return `You've been on this screen for ${Math.round(context.userActivity.stuckDuration! / 1000)}s`;
    }
    
    return insight.analysis.summary;
  }

  // 📊 Get recent insights
  getRecentInsights(limit?: number): ScreenInsight[] {
    return limit ? this.recentInsights.slice(-limit) : [...this.recentInsights];
  }

  // 📊 Get user patterns
  getUserPatterns(): Map<string, UserPattern> {
    return new Map(this.userPatterns);
  }

  // 🧹 Clear history
  clearHistory(): void {
    this.contextHistory = [];
    this.recentInsights = [];
    this.lastActionTime = Date.now();
  }
}