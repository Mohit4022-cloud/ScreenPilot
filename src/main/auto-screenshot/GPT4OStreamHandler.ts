import { EventEmitter } from 'events';
import OpenAI from 'openai';

export interface StreamingInsight {
  type: 'action' | 'error' | 'suggestion' | 'shortcut';
  content: string;
  confidence: number;
  isPartial: boolean;
}

export interface FinalAnalysis {
  summary: string;
  application: string;
  actions: string[];
  errors: string[];
  shortcuts: string[];
  fullResponse: string;
  processingTime: number;
}

export class GPT4OStreamHandler extends EventEmitter {
  private buffer = '';
  private startTime = 0;
  private actionDetected = false;
  private errorDetected = false;
  
  // Pattern matchers for instant detection
  private readonly ACTION_PATTERNS = [
    /click\s+(?:on\s+)?["']?([^"'\n]+)["']?/i,
    /press\s+(?:the\s+)?["']?([^"'\n]+)["']?/i,
    /type\s+["']?([^"'\n]+)["']?/i,
    /navigate\s+to\s+["']?([^"'\n]+)["']?/i,
    /open\s+["']?([^"'\n]+)["']?/i
  ];
  
  private readonly ERROR_PATTERNS = [
    /error:\s*([^\n]+)/i,
    /warning:\s*([^\n]+)/i,
    /failed\s+to\s+([^\n]+)/i,
    /cannot\s+([^\n]+)/i,
    /exception:\s*([^\n]+)/i
  ];
  
  private readonly SHORTCUT_PATTERNS = [
    /((?:cmd|ctrl|alt|shift|⌘|⌃|⌥|⇧)\+\w+)/gi,
    /keyboard\s+shortcut:\s*([^\n]+)/i
  ];

  async processStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  ): Promise<FinalAnalysis> {
    this.reset();
    this.startTime = Date.now();
    
    try {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        this.buffer += token;
        
        // Instant action detection
        if (!this.actionDetected) {
          const action = this.detectActionableInsight(this.buffer);
          if (action) {
            this.actionDetected = true;
            this.emit('instantAction', action);
          }
        }
        
        // Instant error detection
        if (!this.errorDetected) {
          const error = this.detectError(this.buffer);
          if (error) {
            this.errorDetected = true;
            this.emit('instantError', error);
          }
        }
        
        // Progressive UI updates every 20 characters
        if (this.buffer.length % 20 === 0) {
          this.emit('partialUpdate', {
            content: this.buffer,
            length: this.buffer.length
          });
        }
        
        // Detect shortcuts
        const shortcuts = this.detectShortcuts(this.buffer);
        if (shortcuts.length > 0) {
          this.emit('shortcuts', shortcuts);
        }
      }
      
      return this.finalizeAnalysis();
    } catch (error) {
      console.error('Stream processing error:', error);
      throw error;
    }
  }

  private detectActionableInsight(partial: string): StreamingInsight | null {
    for (const pattern of this.ACTION_PATTERNS) {
      const match = partial.match(pattern);
      if (match) {
        return {
          type: 'action',
          content: match[0],
          confidence: this.calculateConfidence(partial, match.index!),
          isPartial: true
        };
      }
    }
    
    return null;
  }

  private detectError(partial: string): StreamingInsight | null {
    for (const pattern of this.ERROR_PATTERNS) {
      const match = partial.match(pattern);
      if (match) {
        return {
          type: 'error',
          content: match[1] || match[0],
          confidence: 0.95, // Errors are usually clear
          isPartial: true
        };
      }
    }
    
    return null;
  }

  private detectShortcuts(partial: string): string[] {
    const shortcuts: string[] = [];
    
    for (const pattern of this.SHORTCUT_PATTERNS) {
      const matches = partial.matchAll(pattern);
      for (const match of matches) {
        const shortcut = match[1] || match[0];
        if (!shortcuts.includes(shortcut)) {
          shortcuts.push(shortcut);
        }
      }
    }
    
    return shortcuts;
  }

  private calculateConfidence(text: string, position: number): number {
    // Higher confidence if found earlier in response
    const positionScore = 1 - (position / text.length);
    
    // Higher confidence if sentence is complete
    const afterPosition = text.substring(position);
    const hasCompleteSentence = /[.!?]/.test(afterPosition.substring(0, 50));
    
    return positionScore * (hasCompleteSentence ? 1 : 0.7);
  }

  public finalizeAnalysis(): FinalAnalysis {
    const processingTime = Date.now() - this.startTime;
    
    // Parse the complete response
    const lines = this.buffer.split('\n').filter(line => line.trim());
    
    const analysis: FinalAnalysis = {
      summary: '',
      application: 'Unknown',
      actions: [],
      errors: [],
      shortcuts: [],
      fullResponse: this.buffer,
      processingTime
    };
    
    // Extract structured data
    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) {
        analysis.summary = line.substring(8).trim();
      } else if (line.startsWith('APP:')) {
        analysis.application = line.substring(4).trim();
      } else if (line.startsWith('SUGGESTIONS:')) {
        // Next lines are suggestions
        continue;
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        analysis.actions.push(line.substring(2).trim());
      } else if (line.startsWith('ERRORS:')) {
        const errorText = line.substring(7).trim();
        if (errorText && errorText !== 'None') {
          analysis.errors.push(errorText);
        }
      } else if (line.startsWith('SHORTCUTS:')) {
        const shortcuts = line.substring(10).trim();
        if (shortcuts && shortcuts !== 'None') {
          analysis.shortcuts = shortcuts.split(',').map(s => s.trim());
        }
      }
    }
    
    // Also extract any inline actions/errors we might have missed
    for (const pattern of this.ACTION_PATTERNS) {
      const matches = this.buffer.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        const action = match[0];
        if (!analysis.actions.some(a => a.includes(action))) {
          analysis.actions.push(action);
        }
      }
    }
    
    this.emit('complete', analysis);
    return analysis;
  }

  private reset(): void {
    this.buffer = '';
    this.startTime = 0;
    this.actionDetected = false;
    this.errorDetected = false;
  }

  // Utility method to create streaming request
  async streamAnalysis(
    openai: OpenAI,
    imageBuffer: Buffer,
    prompt: string
  ): Promise<FinalAnalysis> {
    const stream = await openai.chat.completions.create({
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
              url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
              detail: 'low'
            }
          }
        ]
      }],
      max_tokens: 300,
      temperature: 0.3,
      stream: true
    });
    
    return this.processStream(stream);
  }
}