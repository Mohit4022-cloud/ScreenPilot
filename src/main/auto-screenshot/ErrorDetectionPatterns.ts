import { EventEmitter } from 'events';

export interface ErrorPattern {
  id: string;
  name: string;
  patterns: RegExp[];
  context: string; // 'javascript', 'python', 'excel', 'web', 'general'
  priority: 'high' | 'medium' | 'low';
  solutions: string[];
  quickFix?: string;
}

export interface DetectedError {
  pattern: ErrorPattern;
  matchedText: string;
  confidence: number;
  suggestedFixes: string[];
  timestamp: number;
}

export class ErrorDetectionEngine extends EventEmitter {
  private patterns: ErrorPattern[] = [
    // JavaScript/TypeScript Errors
    {
      id: 'js-type-error',
      name: 'JavaScript Type Error',
      patterns: [
        /TypeError:\s*([^\n]+)/i,
        /Cannot\s+read\s+propert(?:y|ies)\s+(?:of\s+)?["']?(\w+)["']?\s+of\s+(null|undefined)/i,
        /(\w+)\s+is\s+not\s+a\s+function/i
      ],
      context: 'javascript',
      priority: 'high',
      solutions: [
        'Check if the variable is defined before accessing properties',
        'Use optional chaining (?.) for safe property access',
        'Verify the function exists on the object'
      ],
      quickFix: 'Add null check: if (variable && variable.property)'
    },
    
    {
      id: 'js-reference-error',
      name: 'JavaScript Reference Error',
      patterns: [
        /ReferenceError:\s*([^\n]+)/i,
        /(\w+)\s+is\s+not\s+defined/i,
        /Cannot\s+access\s+["']?(\w+)["']?\s+before\s+initialization/i
      ],
      context: 'javascript',
      priority: 'high',
      solutions: [
        'Ensure the variable is declared before use',
        'Check import statements for missing modules',
        'Verify variable scope and hoisting'
      ],
      quickFix: 'Declare the variable: const variableName = ...'
    },
    
    // Python Errors
    {
      id: 'py-syntax-error',
      name: 'Python Syntax Error',
      patterns: [
        /SyntaxError:\s*([^\n]+)/i,
        /IndentationError:\s*([^\n]+)/i,
        /invalid\s+syntax/i
      ],
      context: 'python',
      priority: 'high',
      solutions: [
        'Check indentation (use 4 spaces)',
        'Verify parentheses, brackets, and quotes are balanced',
        'Ensure colons are present after if/for/def statements'
      ],
      quickFix: 'Fix indentation to match surrounding code'
    },
    
    {
      id: 'py-name-error',
      name: 'Python Name Error',
      patterns: [
        /NameError:\s*name\s+["']?(\w+)["']?\s+is\s+not\s+defined/i,
        /AttributeError:\s*["']?(\w+)["']?\s+object\s+has\s+no\s+attribute/i
      ],
      context: 'python',
      priority: 'high',
      solutions: [
        'Import the missing module or function',
        'Check variable spelling and case',
        'Ensure the variable is defined in the current scope'
      ],
      quickFix: 'Import missing module: import module_name'
    },
    
    // Excel Errors
    {
      id: 'excel-ref-error',
      name: 'Excel Reference Error',
      patterns: [
        /#REF!/,
        /#NAME\?/,
        /#VALUE!/
      ],
      context: 'excel',
      priority: 'medium',
      solutions: [
        '#REF!: Check for deleted cells or invalid references',
        '#NAME?: Verify function names and named ranges',
        '#VALUE!: Check data types in formula arguments'
      ],
      quickFix: 'Click on cell and check formula bar for issues'
    },
    
    {
      id: 'excel-div-zero',
      name: 'Excel Division by Zero',
      patterns: [
        /#DIV\/0!/
      ],
      context: 'excel',
      priority: 'medium',
      solutions: [
        'Use IFERROR to handle division by zero',
        'Check denominator values before division',
        'Use IF statement to check for zero'
      ],
      quickFix: '=IFERROR(A1/B1, 0)'
    },
    
    // Web/HTTP Errors
    {
      id: 'http-404',
      name: 'HTTP 404 Not Found',
      patterns: [
        /404\s*(?:Error|Not\s+Found)/i,
        /The\s+requested\s+URL\s+.*\s+was\s+not\s+found/i
      ],
      context: 'web',
      priority: 'medium',
      solutions: [
        'Check the URL for typos',
        'Verify the resource exists on the server',
        'Check for case sensitivity in the URL path'
      ],
      quickFix: 'Verify URL in address bar'
    },
    
    {
      id: 'http-500',
      name: 'HTTP 500 Server Error',
      patterns: [
        /500\s*(?:Error|Internal\s+Server\s+Error)/i,
        /The\s+server\s+encountered\s+an\s+error/i
      ],
      context: 'web',
      priority: 'high',
      solutions: [
        'Check server logs for detailed error',
        'Verify server configuration',
        'Contact system administrator if persistent'
      ]
    },
    
    // Database Errors
    {
      id: 'sql-syntax',
      name: 'SQL Syntax Error',
      patterns: [
        /SQL\s+syntax\s+error/i,
        /You\s+have\s+an\s+error\s+in\s+your\s+SQL\s+syntax/i,
        /ORA-\d+:/
      ],
      context: 'database',
      priority: 'high',
      solutions: [
        'Check SQL query syntax',
        'Verify table and column names',
        'Ensure quotes are properly used for strings'
      ],
      quickFix: 'Check for missing commas or quotes'
    },
    
    // Git Errors
    {
      id: 'git-merge-conflict',
      name: 'Git Merge Conflict',
      patterns: [
        /CONFLICT\s*\([\w\s]+\):/i,
        /<<<<<<+\s*HEAD/,
        /Automatic\s+merge\s+failed/i
      ],
      context: 'git',
      priority: 'high',
      solutions: [
        'Open conflicted files and resolve manually',
        'Choose between HEAD and incoming changes',
        'Use git status to see conflicted files'
      ],
      quickFix: 'git status to see conflicts'
    },
    
    // General Permission Errors
    {
      id: 'permission-denied',
      name: 'Permission Denied',
      patterns: [
        /Permission\s+denied/i,
        /Access\s+denied/i,
        /Operation\s+not\s+permitted/i
      ],
      context: 'general',
      priority: 'high',
      solutions: [
        'Check file/folder permissions',
        'Run with administrator/sudo privileges',
        'Verify user has necessary access rights'
      ],
      quickFix: 'Try: sudo <command> (macOS/Linux)'
    }
  ];

  detectErrors(text: string): DetectedError[] {
    const detected: DetectedError[] = [];
    
    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = text.match(regex);
        if (match) {
          const error: DetectedError = {
            pattern,
            matchedText: match[0],
            confidence: this.calculateConfidence(match, text),
            suggestedFixes: this.generateFixes(pattern, match),
            timestamp: Date.now()
          };
          
          detected.push(error);
          this.emit('errorDetected', error);
        }
      }
    }
    
    return detected;
  }

  private calculateConfidence(match: RegExpMatchArray, fullText: string): number {
    // Higher confidence for exact pattern matches
    let confidence = 0.8;
    
    // Boost confidence if error appears at start of text
    if (match.index === 0) {
      confidence += 0.1;
    }
    
    // Boost confidence for longer matches
    if (match[0].length > 20) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private generateFixes(pattern: ErrorPattern, match: RegExpMatchArray): string[] {
    const fixes = [...pattern.solutions];
    
    // Add quick fix if available
    if (pattern.quickFix) {
      fixes.unshift(`Quick fix: ${pattern.quickFix}`);
    }
    
    // Add context-specific fixes
    if (match[1]) {
      switch (pattern.context) {
        case 'javascript':
          if (pattern.id === 'js-type-error') {
            fixes.unshift(`Check if '${match[1]}' is defined`);
          }
          break;
        case 'python':
          if (pattern.id === 'py-name-error') {
            fixes.unshift(`Import or define '${match[1]}'`);
          }
          break;
      }
    }
    
    return fixes;
  }

  addCustomPattern(pattern: ErrorPattern): void {
    this.patterns.push(pattern);
    this.emit('patternAdded', pattern);
  }

  getPatternsByContext(context: string): ErrorPattern[] {
    return this.patterns.filter(p => p.context === context);
  }

  getPatternsByPriority(priority: string): ErrorPattern[] {
    return this.patterns.filter(p => p.priority === priority);
  }

  // Quick error analysis for screenshots
  async analyzeScreenshot(text: string): Promise<{
    hasErrors: boolean;
    errors: DetectedError[];
    topPriority: 'high' | 'medium' | 'low' | null;
    quickestFix: string | null;
  }> {
    const errors = this.detectErrors(text);
    const hasErrors = errors.length > 0;
    
    // Find highest priority error
    const priorities = ['high', 'medium', 'low'] as const;
    let topPriority: typeof priorities[number] | null = null;
    
    for (const priority of priorities) {
      if (errors.some(e => e.pattern.priority === priority)) {
        topPriority = priority;
        break;
      }
    }
    
    // Get quickest fix from highest priority error
    const quickestFix = errors
      .filter(e => e.pattern.priority === topPriority)
      .map(e => e.pattern.quickFix)
      .filter(Boolean)[0] || null;
    
    return {
      hasErrors,
      errors,
      topPriority,
      quickestFix
    };
  }
}