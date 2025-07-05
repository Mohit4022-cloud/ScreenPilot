import { EventEmitter } from 'events';
import ElectronStore from "../utils/store";

export type Priority = 'high' | 'medium' | 'low';

export interface CostConfig {
  dailyBudget: number; // in dollars
  costPerAnalysis: number;
  adaptiveQuality: boolean;
  priorityThresholds: {
    high: number; // % of budget remaining
    medium: number;
    low: number;
  };
}

export interface UsageStats {
  date: string;
  totalCost: number;
  analysisCount: number;
  cachedCount: number;
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface QualitySettings {
  imageQuality: number; // JPEG quality 0-100
  resolution: { width: number; height: number };
  captureRate: number; // FPS
  enableDiffDetection: boolean;
  diffThreshold: number;
}

export class CostOptimizer extends EventEmitter {
  private store: ElectronStore<Record<string, any>>;
  private config: CostConfig;
  private currentUsage: UsageStats = {
    date: '',
    totalCost: 0,
    analysisCount: 0,
    cachedCount: 0,
    priorityBreakdown: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  
  private readonly DEFAULT_CONFIG: CostConfig = {
    dailyBudget: 10.0, // $10/day
    costPerAnalysis: 0.001, // $0.001 per GPT-4o call
    adaptiveQuality: true,
    priorityThresholds: {
      high: 20, // Process high priority when < 20% budget
      medium: 50, // Process medium priority when < 50% budget
      low: 80 // Process low priority when < 80% budget
    }
  };

  constructor(customConfig?: Partial<CostConfig>) {
    super();
    
    this.store = new ElectronStore<Record<string, any>>({
      name: 'cost-optimizer',
      defaults: {
        config: this.DEFAULT_CONFIG,
        usageHistory: []
      }
    });
    
    this.config = { ...this.DEFAULT_CONFIG, ...customConfig };
    this.loadTodayUsage();
    
    // Reset daily usage at midnight
    this.scheduleDailyReset();
  }

  async shouldProcess(priority: Priority): Promise<boolean> {
    const budgetPercentage = this.getBudgetPercentage();
    
    // Always process if under budget
    if (this.currentUsage.totalCost < this.config.dailyBudget) {
      // Check priority thresholds
      switch (priority) {
        case 'high':
          return true; // Always process high priority
        case 'medium':
          return budgetPercentage >= this.config.priorityThresholds.medium;
        case 'low':
          return budgetPercentage >= this.config.priorityThresholds.low;
      }
    }
    
    // Over budget - only process high priority
    if (priority === 'high') {
      this.emit('budgetWarning', {
        dailyBudget: this.config.dailyBudget,
        currentCost: this.currentUsage.totalCost,
        message: 'Daily budget exceeded - processing high priority only'
      });
      return true;
    }
    
    return false;
  }

  recordAnalysis(priority: Priority, cached: boolean = false): void {
    if (!cached) {
      this.currentUsage.totalCost += this.config.costPerAnalysis;
      this.currentUsage.analysisCount++;
    } else {
      this.currentUsage.cachedCount++;
    }
    
    this.currentUsage.priorityBreakdown[priority]++;
    
    // Save to store
    this.saveUsage();
    
    // Emit cost update
    this.emit('costUpdate', {
      totalCost: this.currentUsage.totalCost,
      remainingBudget: Math.max(0, this.config.dailyBudget - this.currentUsage.totalCost),
      analysisCount: this.currentUsage.analysisCount
    });
    
    // Check budget alerts
    this.checkBudgetAlerts();
  }

  getAdaptiveQualitySettings(): QualitySettings {
    if (!this.config.adaptiveQuality) {
      return this.getDefaultQualitySettings();
    }
    
    const budgetPercentage = this.getBudgetPercentage();
    
    // Adjust quality based on remaining budget
    if (budgetPercentage > 70) {
      // High quality when plenty of budget
      return {
        imageQuality: 85,
        resolution: { width: 1024, height: 1024 },
        captureRate: 5,
        enableDiffDetection: true,
        diffThreshold: 0.5
      };
    } else if (budgetPercentage > 40) {
      // Medium quality
      return {
        imageQuality: 75,
        resolution: { width: 800, height: 800 },
        captureRate: 3,
        enableDiffDetection: true,
        diffThreshold: 1.0
      };
    } else if (budgetPercentage > 20) {
      // Lower quality to conserve budget
      return {
        imageQuality: 65,
        resolution: { width: 640, height: 640 },
        captureRate: 2,
        enableDiffDetection: true,
        diffThreshold: 2.0
      };
    } else {
      // Minimum quality when low on budget
      return {
        imageQuality: 50,
        resolution: { width: 512, height: 512 },
        captureRate: 1,
        enableDiffDetection: true,
        diffThreshold: 5.0
      };
    }
  }

  private getDefaultQualitySettings(): QualitySettings {
    return {
      imageQuality: 85,
      resolution: { width: 1024, height: 1024 },
      captureRate: 5,
      enableDiffDetection: true,
      diffThreshold: 0.5
    };
  }

  getBudgetPercentage(): number {
    const remaining = this.config.dailyBudget - this.currentUsage.totalCost;
    return Math.max(0, (remaining / this.config.dailyBudget) * 100);
  }

  getTodayUsage(): UsageStats {
    return { ...this.currentUsage };
  }

  getUsageHistory(days: number = 30): UsageStats[] {
    const history = this.store.get('usageHistory', []) as UsageStats[];
    return history.slice(-days);
  }

  updateConfig(newConfig: Partial<CostConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.store.set('config', this.config);
    this.emit('configUpdated', this.config);
  }

  private loadTodayUsage(): void {
    const today = new Date().toISOString().split('T')[0];
    const history = this.store.get('usageHistory', []) as UsageStats[];
    
    const todayUsage = history.find(u => u.date === today);
    
    if (todayUsage) {
      this.currentUsage = todayUsage;
    } else {
      this.currentUsage = {
        date: today,
        totalCost: 0,
        analysisCount: 0,
        cachedCount: 0,
        priorityBreakdown: {
          high: 0,
          medium: 0,
          low: 0
        }
      };
    }
  }

  private saveUsage(): void {
    const history = this.store.get('usageHistory', []) as UsageStats[];
    const index = history.findIndex(u => u.date === this.currentUsage.date);
    
    if (index >= 0) {
      history[index] = this.currentUsage;
    } else {
      history.push(this.currentUsage);
    }
    
    // Keep only last 90 days
    const trimmed = history.slice(-90);
    this.store.set('usageHistory', trimmed);
  }

  private checkBudgetAlerts(): void {
    const percentage = this.getBudgetPercentage();
    
    if (percentage <= 10 && this.currentUsage.analysisCount % 10 === 0) {
      this.emit('budgetCritical', {
        remainingBudget: this.config.dailyBudget - this.currentUsage.totalCost,
        remainingPercentage: percentage
      });
    } else if (percentage <= 25 && this.currentUsage.analysisCount % 20 === 0) {
      this.emit('budgetLow', {
        remainingBudget: this.config.dailyBudget - this.currentUsage.totalCost,
        remainingPercentage: percentage
      });
    }
  }

  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyUsage();
      // Schedule next reset
      this.scheduleDailyReset();
    }, msUntilMidnight);
  }

  private resetDailyUsage(): void {
    this.loadTodayUsage();
    this.emit('dailyReset', {
      date: this.currentUsage.date,
      previousDayCost: 0
    });
  }

  // Export cost report
  exportReport(): string {
    const history = this.getUsageHistory(30);
    const totalCost = history.reduce((sum, day) => sum + day.totalCost, 0);
    const totalAnalyses = history.reduce((sum, day) => sum + day.analysisCount, 0);
    const totalCached = history.reduce((sum, day) => sum + day.cachedCount, 0);
    
    return JSON.stringify({
      period: '30 days',
      totalCost: totalCost.toFixed(2),
      totalAnalyses,
      totalCached,
      averageDailyCost: (totalCost / 30).toFixed(2),
      cacheHitRate: totalCached / (totalAnalyses + totalCached),
      history
    }, null, 2);
  }
}