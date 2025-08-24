import {
  CompletedWord,
  KeystrokeEvent,
  KeystrokePattern,
  ValidationResult,
  GameValidationRules,
  Word,
  ActionType,
} from '../types';

/**
 * Input validation utilities for typing accuracy, speed, and anti-cheat measures
 */

export interface TypingSession {
  word: Word;
  startTime: number;
  endTime: number;
  keystrokes: KeystrokeEvent[];
  currentInput: string;
  errors: number;
  corrections: number;
  perfectStreak: number;
}

export interface TypingMetrics {
  wpm: number;
  accuracy: number;
  timeMs: number;
  keystrokePattern: KeystrokePattern;
  isValid: boolean;
  flags: string[];
}

export interface AntiCheatFlags {
  impossibleSpeed: boolean;
  tooConsistent: boolean;
  suspiciousPattern: boolean;
  invalidKeystrokes: boolean;
  timingAnomalies: boolean;
}

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

const DEFAULT_VALIDATION_RULES: GameValidationRules = {
  maxWPM: 250,           // Human typing limit
  minCharTime: 50,       // Minimum 50ms per character
  maxConsecutivePerfect: 15, // Max perfect words in a row
  minVariance: 10,       // Minimum timing variance (ms)
};

const SUSPICIOUS_PATTERNS = {
  PERFECT_INTERVALS: 'perfect_intervals',
  NO_CORRECTIONS: 'no_corrections',
  IMPOSSIBLE_SPEED: 'impossible_speed',
  ZERO_VARIANCE: 'zero_variance',
  INVALID_PROGRESSION: 'invalid_progression',
};

// =============================================================================
// INPUT VALIDATOR CLASS
// =============================================================================

export class InputValidator {
  private rules: GameValidationRules;
  private perfectWordCount = 0;
  private sessionFlags = new Set<string>();

  constructor(rules: Partial<GameValidationRules> = {}) {
    this.rules = { ...DEFAULT_VALIDATION_RULES, ...rules };
  }

  // =============================================================================
  // MAIN VALIDATION METHODS
  // =============================================================================

  /**
   * Validate a completed word for legitimacy and calculate metrics
   */
  validateCompletedWord(session: TypingSession): TypingMetrics {
    const flags: string[] = [];
    
    // Calculate basic metrics
    const timeMs = session.endTime - session.startTime;
    const wpm = this.calculateWPM(session.word.text, timeMs);
    const accuracy = this.calculateAccuracy(session.word.text, session.currentInput, session.errors);
    const keystrokePattern = this.analyzeKeystrokePattern(session.keystrokes);

    // Speed validation
    if (wpm > this.rules.maxWPM) {
      flags.push(SUSPICIOUS_PATTERNS.IMPOSSIBLE_SPEED);
    }

    const minTime = session.word.text.length * this.rules.minCharTime;
    if (timeMs < minTime) {
      flags.push(SUSPICIOUS_PATTERNS.IMPOSSIBLE_SPEED);
    }

    // Pattern validation
    const patternFlags = this.validateKeystrokePattern(keystrokePattern, session);
    flags.push(...patternFlags);

    // Perfect word tracking
    if (accuracy >= 1.0 && session.errors === 0) {
      this.perfectWordCount++;
      if (this.perfectWordCount > this.rules.maxConsecutivePerfect) {
        flags.push(SUSPICIOUS_PATTERNS.NO_CORRECTIONS);
      }
    } else {
      this.perfectWordCount = 0;
    }

    const isValid = flags.length === 0;
    
    // Update session flags
    flags.forEach(flag => this.sessionFlags.add(flag));

    return {
      wpm,
      accuracy,
      timeMs,
      keystrokePattern,
      isValid,
      flags,
    };
  }

  /**
   * Validate a keystroke in real-time
   */
  validateKeystroke(
    key: string, 
    currentInput: string, 
    targetWord: string,
    timestamp: number
  ): ValidationResult {
    const errors: string[] = [];

    // Basic character validation
    if (!this.isValidCharacter(key)) {
      errors.push(`Invalid character: "${key}"`);
    }

    // Input length validation
    if (currentInput.length >= targetWord.length && key !== 'Backspace') {
      errors.push('Input exceeds target word length');
    }

    // Check for reasonable typing speed (real-time)
    const expectedMinTime = currentInput.length * this.rules.minCharTime;
    if (timestamp < expectedMinTime) {
      errors.push('Typing speed too fast');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =============================================================================
  // METRIC CALCULATION
  // =============================================================================

  private calculateWPM(text: string, timeMs: number): number {
    if (timeMs <= 0) return 0;
    
    // WPM = (characters / 5) / (time in minutes)
    const words = text.length / 5;
    const minutes = timeMs / 60000;
    return Math.round((words / minutes) * 100) / 100;
  }

  private calculateAccuracy(targetText: string, typedText: string, errors: number): number {
    if (targetText.length === 0) return 1.0;
    
    // Calculate character-level accuracy
    let correct = 0;
    const minLength = Math.min(targetText.length, typedText.length);
    
    for (let i = 0; i < minLength; i++) {
      if (targetText[i] === typedText[i]) {
        correct++;
      }
    }

    // Penalize for length differences
    const lengthPenalty = Math.abs(targetText.length - typedText.length);
    const totalCharacters = targetText.length;
    
    const baseAccuracy = correct / totalCharacters;
    const penaltyAccuracy = Math.max(0, baseAccuracy - (lengthPenalty / totalCharacters));
    
    return Math.max(0, Math.min(1, penaltyAccuracy));
  }

  private analyzeKeystrokePattern(keystrokes: KeystrokeEvent[]): KeystrokePattern {
    if (keystrokes.length < 2) {
      return {
        intervals: {},
        corrections: 0,
        backspaceCount: 0,
        perfectStreak: 0,
      };
    }

    const intervals: Record<string, number> = {};
    let corrections = 0;
    let backspaceCount = 0;
    let perfectStreak = 0;
    let currentStreak = 0;

    for (let i = 1; i < keystrokes.length; i++) {
      const current = keystrokes[i];
      const previous = keystrokes[i - 1];
      
      const interval = current.timestamp - previous.timestamp;
      intervals[current.key] = interval;

      if (current.key === 'Backspace') {
        backspaceCount++;
        corrections++;
        currentStreak = 0;
      } else if (current.isCorrection) {
        corrections++;
        currentStreak = 0;
      } else {
        currentStreak++;
        perfectStreak = Math.max(perfectStreak, currentStreak);
      }
    }

    return {
      intervals,
      corrections,
      backspaceCount,
      perfectStreak,
    };
  }

  // =============================================================================
  // ANTI-CHEAT VALIDATION
  // =============================================================================

  private validateKeystrokePattern(pattern: KeystrokePattern, session: TypingSession): string[] {
    const flags: string[] = [];

    // Check for impossible consistency
    const intervals = Object.values(pattern.intervals).filter(i => i > 0);
    if (intervals.length > 3) {
      const variance = this.calculateVariance(intervals);
      if (variance < this.rules.minVariance) {
        flags.push(SUSPICIOUS_PATTERNS.ZERO_VARIANCE);
      }
    }

    // Check for suspicious perfect streaks
    if (pattern.perfectStreak === session.word.text.length && pattern.corrections === 0) {
      const wordComplexity = this.calculateWordComplexity(session.word);
      if (wordComplexity > 0.7 && session.endTime - session.startTime < session.word.text.length * 80) {
        flags.push(SUSPICIOUS_PATTERNS.PERFECT_INTERVALS);
      }
    }

    // Check keystroke count vs. word length
    const expectedMinKeystrokes = session.word.text.length;
    const expectedMaxKeystrokes = session.word.text.length + pattern.corrections + 5;
    
    if (session.keystrokes.length < expectedMinKeystrokes) {
      flags.push(SUSPICIOUS_PATTERNS.INVALID_PROGRESSION);
    }

    return flags;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private calculateWordComplexity(word: Word): number {
    let complexity = 0;
    
    // Length complexity
    complexity += Math.min(0.3, word.length / 20);
    
    // Character variety complexity
    const uniqueChars = new Set(word.text.toLowerCase()).size;
    complexity += Math.min(0.3, uniqueChars / 15);
    
    // Level complexity
    complexity += (word.level - 1) * 0.1;
    
    // Special characters complexity
    const specialChars = word.text.match(/[^a-zA-Z\s]/g);
    if (specialChars) {
      complexity += specialChars.length * 0.05;
    }
    
    return Math.min(1.0, complexity);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private isValidCharacter(char: string): boolean {
    // Allow letters, numbers, common punctuation, space, and control keys
    return /^[a-zA-Z0-9\s\-'.,!?;:()\[\]"@#$%&*+=/_\\|`~]$/.test(char) ||
           ['Backspace', 'Delete', 'Tab', 'Enter'].includes(char);
  }

  /**
   * Create a completed word from a typing session
   */
  createCompletedWord(session: TypingSession, metrics: TypingMetrics): CompletedWord {
    return {
      ...session.word,
      typedText: session.currentInput,
      timeMs: metrics.timeMs,
      errors: session.errors,
      accuracy: metrics.accuracy,
      wpm: metrics.wpm,
      score: this.calculateScore(metrics, session.word),
      keystrokePattern: metrics.keystrokePattern,
    };
  }

  private calculateScore(metrics: TypingMetrics, word: Word): number {
    let score = 100;
    
    // Accuracy bonus/penalty
    score *= metrics.accuracy;
    
    // Speed bonus
    const expectedWPM = this.getExpectedWPMForWord(word);
    if (metrics.wpm > expectedWPM) {
      score *= 1 + ((metrics.wpm - expectedWPM) / expectedWPM) * 0.5;
    }
    
    // Word difficulty bonus
    score *= 1 + (word.level - 1) * 0.1;
    
    // Perfect typing bonus
    if (metrics.accuracy >= 1.0 && metrics.keystrokePattern.corrections === 0) {
      score *= 1.2;
    }
    
    return Math.max(0, Math.round(score));
  }

  private getExpectedWPMForWord(word: Word): number {
    const baseSpeeds: Record<number, number> = {
      1: 45, 2: 40, 3: 35, 4: 30, 5: 25
    };
    
    const baseWPM = baseSpeeds[word.level] || 35;
    const lengthPenalty = Math.max(0, word.length - 6) * 2;
    
    return Math.max(20, baseWPM - lengthPenalty);
  }

  // =============================================================================
  // SESSION MANAGEMENT
  // =============================================================================

  /**
   * Create a new typing session for a word
   */
  createTypingSession(word: Word, actionType: ActionType): TypingSession {
    return {
      word,
      startTime: Date.now(),
      endTime: 0,
      keystrokes: [],
      currentInput: '',
      errors: 0,
      corrections: 0,
      perfectStreak: 0,
    };
  }

  /**
   * Update a typing session with a new keystroke
   */
  updateTypingSession(
    session: TypingSession, 
    key: string, 
    newInput: string
  ): TypingSession {
    const timestamp = Date.now();
    const isCorrection = key === 'Backspace' || 
                        (newInput.length > session.currentInput.length && 
                         newInput[newInput.length - 1] !== session.word.text[newInput.length - 1]);

    const keystroke: KeystrokeEvent = {
      key,
      timestamp,
      inputLength: newInput.length,
      isCorrection,
    };

    return {
      ...session,
      keystrokes: [...session.keystrokes, keystroke],
      currentInput: newInput,
      errors: isCorrection ? session.errors + 1 : session.errors,
      corrections: key === 'Backspace' ? session.corrections + 1 : session.corrections,
    };
  }

  /**
   * Complete a typing session
   */
  completeTypingSession(session: TypingSession): TypingSession {
    return {
      ...session,
      endTime: Date.now(),
    };
  }

  // =============================================================================
  // ANTI-CHEAT REPORTING
  // =============================================================================

  getAntiCheatFlags(): AntiCheatFlags {
    return {
      impossibleSpeed: this.sessionFlags.has(SUSPICIOUS_PATTERNS.IMPOSSIBLE_SPEED),
      tooConsistent: this.sessionFlags.has(SUSPICIOUS_PATTERNS.ZERO_VARIANCE),
      suspiciousPattern: this.sessionFlags.has(SUSPICIOUS_PATTERNS.PERFECT_INTERVALS),
      invalidKeystrokes: this.sessionFlags.has(SUSPICIOUS_PATTERNS.INVALID_PROGRESSION),
      timingAnomalies: this.sessionFlags.has(SUSPICIOUS_PATTERNS.IMPOSSIBLE_SPEED),
    };
  }

  getSessionReport(): {
    totalFlags: number;
    flagBreakdown: Record<string, number>;
    perfectWordCount: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const flagCounts: Record<string, number> = {};
    this.sessionFlags.forEach(flag => {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    });

    const totalFlags = this.sessionFlags.size;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    
    if (totalFlags >= 3 || this.sessionFlags.has(SUSPICIOUS_PATTERNS.IMPOSSIBLE_SPEED)) {
      riskLevel = 'HIGH';
    } else if (totalFlags >= 1) {
      riskLevel = 'MEDIUM';
    }

    return {
      totalFlags,
      flagBreakdown: flagCounts,
      perfectWordCount: this.perfectWordCount,
      riskLevel,
    };
  }

  reset(): void {
    this.perfectWordCount = 0;
    this.sessionFlags.clear();
  }
}