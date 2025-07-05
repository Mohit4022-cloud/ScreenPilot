import { EventEmitter } from 'events';
import OpenAI from 'openai';

export interface WorkflowStep {
  action: string;
  target: string;
  timestamp: number;
  screenshot?: Buffer;
}

export interface DetectedPattern {
  steps: WorkflowStep[];
  frequency: number;
  timeSaved: number; // in seconds
  automationPotential: 'high' | 'medium' | 'low';
  suggestedAutomation: string;
}

export interface AutomationSuggestion {
  pattern: DetectedPattern;
  implementation: string;
  estimatedTimeSaved: number; // per day
  difficulty: 'easy' | 'medium' | 'hard';
  tools: string[]; // e.g., 'Keyboard Maestro', 'AutoHotkey', 'Shell Script'
}

export class WorkflowAutomationDetector extends EventEmitter {
  private workflowHistory: WorkflowStep[] = [];
  private detectedPatterns: Map<string, DetectedPattern> = new Map();
  private openai: OpenAI;
  
  // Configuration
  private readonly PATTERN_THRESHOLD = 3; // Min repetitions to detect pattern
  private readonly TIME_WINDOW = 3600000; // 1 hour window for pattern detection
  private readonly MAX_HISTORY = 1000;
  private readonly MIN_TIME_SAVED = 30; // Min 30 seconds saved to suggest automation

  constructor(openai: OpenAI) {
    super();
    this.openai = openai;
    
    // Periodic pattern analysis
    setInterval(() => this.analyzePatterns(), 60000); // Every minute
  }

  // Record workflow step
  recordStep(step: WorkflowStep): void {
    this.workflowHistory.push(step);
    
    // Maintain history size
    if (this.workflowHistory.length > this.MAX_HISTORY) {
      this.workflowHistory.shift();
    }
    
    // Check for immediate patterns
    this.checkRecentPattern();
  }

  // Analyze historical patterns
  private async analyzePatterns(): Promise<void> {
    const now = Date.now();
    const recentSteps = this.workflowHistory.filter(
      step => now - step.timestamp < this.TIME_WINDOW
    );
    
    if (recentSteps.length < this.PATTERN_THRESHOLD * 2) return;
    
    // Find repeated sequences
    const patterns = this.findRepeatedSequences(recentSteps);
    
    for (const pattern of patterns) {
      if (pattern.timeSaved >= this.MIN_TIME_SAVED) {
        const suggestion = await this.generateAutomationSuggestion(pattern);
        
        if (suggestion) {
          this.emit('automationDetected', suggestion);
          this.detectedPatterns.set(this.patternKey(pattern), pattern);
        }
      }
    }
  }

  // Find repeated sequences in workflow
  private findRepeatedSequences(steps: WorkflowStep[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const sequenceMap = new Map<string, WorkflowStep[][]>();
    
    // Try different sequence lengths
    for (let length = 2; length <= 10 && length <= steps.length / 2; length++) {
      for (let i = 0; i <= steps.length - length; i++) {
        const sequence = steps.slice(i, i + length);
        const key = this.sequenceKey(sequence);
        
        if (!sequenceMap.has(key)) {
          sequenceMap.set(key, []);
        }
        sequenceMap.get(key)!.push(sequence);
      }
    }
    
    // Find sequences that repeat
    for (const [key, occurrences] of sequenceMap) {
      if (occurrences.length >= this.PATTERN_THRESHOLD) {
        const pattern = this.analyzeSequence(occurrences);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  }

  // Check for patterns in recent actions
  private checkRecentPattern(): void {
    const recentSteps = this.workflowHistory.slice(-20); // Last 20 steps
    
    if (recentSteps.length < 6) return;
    
    // Quick check for immediate repetition
    for (let length = 2; length <= 5; length++) {
      const lastSequence = recentSteps.slice(-length);
      const previousSequence = recentSteps.slice(-length * 2, -length);
      
      if (this.sequencesMatch(lastSequence, previousSequence)) {
        this.emit('repetitivePattern', {
          steps: lastSequence,
          message: `You've repeated this ${length}-step sequence`
        });
        break;
      }
    }
  }

  // Generate automation suggestion using GPT-4o
  private async generateAutomationSuggestion(
    pattern: DetectedPattern
  ): Promise<AutomationSuggestion | null> {
    try {
      const prompt = this.buildAutomationPrompt(pattern);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 300,
        temperature: 0.3
      });
      
      return this.parseAutomationSuggestion(response.choices[0]?.message?.content || '', pattern);
    } catch (error) {
      console.error('Failed to generate automation suggestion:', error);
      return null;
    }
  }

  private buildAutomationPrompt(pattern: DetectedPattern): string {
    const steps = pattern.steps
      .map((s, i) => `${i + 1}. ${s.action} on "${s.target}"`)
      .join('\n');
    
    return `Analyze this repeated workflow pattern and suggest automation:

Pattern (repeated ${pattern.frequency} times):
${steps}

Time per repetition: ${Math.round(pattern.timeSaved / pattern.frequency)}s
Total time spent: ${pattern.timeSaved}s

Suggest the BEST automation approach for ${process.platform} platform.

FORMAT YOUR RESPONSE AS:
TOOL: [Best automation tool]
DIFFICULTY: [easy/medium/hard]
IMPLEMENTATION:
[Step-by-step implementation]
TIME_SAVED_DAILY: [estimated hours]

Be specific and practical.`;
  }

  private parseAutomationSuggestion(
    response: string,
    pattern: DetectedPattern
  ): AutomationSuggestion | null {
    const lines = response.split('\n');
    let tool = '';
    let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    let implementation = '';
    let timeSavedDaily = 0;
    
    let inImplementation = false;
    
    for (const line of lines) {
      if (line.startsWith('TOOL:')) {
        tool = line.substring(5).trim();
      } else if (line.startsWith('DIFFICULTY:')) {
        difficulty = line.substring(11).trim().toLowerCase() as any;
      } else if (line.startsWith('IMPLEMENTATION:')) {
        inImplementation = true;
      } else if (line.startsWith('TIME_SAVED_DAILY:')) {
        const match = line.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          timeSavedDaily = parseFloat(match[1]) * 3600; // Convert hours to seconds
        }
      } else if (inImplementation && line.trim()) {
        implementation += line + '\n';
      }
    }
    
    if (!tool || !implementation) return null;
    
    return {
      pattern,
      implementation: implementation.trim(),
      estimatedTimeSaved: timeSavedDaily,
      difficulty,
      tools: [tool]
    };
  }

  // Analyze a sequence of occurrences
  private analyzeSequence(occurrences: WorkflowStep[][]): DetectedPattern | null {
    if (occurrences.length < this.PATTERN_THRESHOLD) return null;
    
    const firstSequence = occurrences[0];
    let totalTime = 0;
    
    // Calculate total time spent on this pattern
    for (const sequence of occurrences) {
      const duration = sequence[sequence.length - 1].timestamp - sequence[0].timestamp;
      totalTime += duration / 1000; // Convert to seconds
    }
    
    // Determine automation potential
    let automationPotential: 'high' | 'medium' | 'low' = 'low';
    
    if (totalTime > 300) { // > 5 minutes total
      automationPotential = 'high';
    } else if (totalTime > 120) { // > 2 minutes total
      automationPotential = 'medium';
    }
    
    return {
      steps: firstSequence,
      frequency: occurrences.length,
      timeSaved: totalTime,
      automationPotential,
      suggestedAutomation: this.generateQuickSuggestion(firstSequence)
    };
  }

  // Generate quick automation suggestion
  private generateQuickSuggestion(steps: WorkflowStep[]): string {
    const actions = steps.map(s => s.action).join(' → ');
    
    if (actions.includes('click') && actions.includes('type')) {
      return 'Create a keyboard shortcut or macro for this form filling';
    } else if (actions.includes('navigate')) {
      return 'Bookmark frequently visited pages or create quick links';
    } else if (steps.every(s => s.action === 'click')) {
      return 'Use keyboard navigation instead of multiple clicks';
    } else {
      return 'Consider automating this repetitive task';
    }
  }

  // Helper methods
  private sequenceKey(steps: WorkflowStep[]): string {
    return steps.map(s => `${s.action}:${s.target}`).join('|');
  }

  private patternKey(pattern: DetectedPattern): string {
    return this.sequenceKey(pattern.steps);
  }

  private sequencesMatch(seq1: WorkflowStep[], seq2: WorkflowStep[]): boolean {
    if (seq1.length !== seq2.length) return false;
    
    return seq1.every((step, i) => 
      step.action === seq2[i].action && 
      step.target === seq2[i].target
    );
  }

  // Get automation suggestions
  getAutomationSuggestions(): AutomationSuggestion[] {
    const suggestions: AutomationSuggestion[] = [];
    
    for (const pattern of this.detectedPatterns.values()) {
      if (pattern.automationPotential !== 'low') {
        suggestions.push({
          pattern,
          implementation: pattern.suggestedAutomation,
          estimatedTimeSaved: pattern.timeSaved * 10, // Estimate 10x daily
          difficulty: 'medium',
          tools: this.getToolsForPlatform()
        });
      }
    }
    
    return suggestions.sort((a, b) => b.estimatedTimeSaved - a.estimatedTimeSaved);
  }

  private getToolsForPlatform(): string[] {
    switch (process.platform) {
      case 'darwin':
        return ['Keyboard Maestro', 'Automator', 'Shortcuts', 'BetterTouchTool'];
      case 'win32':
        return ['AutoHotkey', 'Power Automate', 'PowerShell'];
      case 'linux':
        return ['AutoKey', 'xdotool', 'Shell Script'];
      default:
        return ['Custom Script'];
    }
  }

  // Clear history
  clear(): void {
    this.workflowHistory = [];
    this.detectedPatterns.clear();
    this.emit('cleared');
  }
}