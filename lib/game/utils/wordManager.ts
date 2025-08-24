import {
  Word,
  WordLevel,
  GameDifficulty,
  CurrentWords,
  WordLock,
  SessionSeed,
  ActionType,
} from '../types';

/**
 * Word management utilities for selecting, locking, and managing game words
 */

export interface WordSelection {
  heal: Word;
  attack: Word;
  guard?: Word;
}

export interface WordSelectionOptions {
  difficulty: GameDifficulty;
  playerLevel: number;
  round: number;
  timeRemaining: number;
  previousWords: Word[];
  avoidRecentWords: boolean;
}

export interface WordLockManager {
  canLock(wordType: ActionType): boolean;
  lock(wordType: ActionType): boolean;
  unlock(): boolean;
  isLocked(): boolean;
  getLockedType(): WordLock;
}

export interface WordPoolConfig {
  minLevel: WordLevel;
  maxLevel: WordLevel;
  categoryWeights: Record<string, number>;
  lengthRange: { min: number; max: number };
  excludeIds: Set<string>;
}

// =============================================================================
// WORD SELECTION CONSTANTS
// =============================================================================

const DIFFICULTY_LEVEL_RANGES: Record<GameDifficulty, { min: WordLevel; max: WordLevel }> = {
  EASY: { min: 1, max: 3 },
  NORMAL: { min: 2, max: 4 },
  HARD: { min: 3, max: 5 },
};

const DIFFICULTY_LENGTH_RANGES: Record<GameDifficulty, { min: number; max: number }> = {
  EASY: { min: 3, max: 8 },
  NORMAL: { min: 4, max: 12 },
  HARD: { min: 5, max: 15 },
};

const LEVEL_WEIGHTS_BY_ROUND: Record<number, Record<WordLevel, number>> = {
  1: { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.0 },
  2: { 1: 0.3, 2: 0.3, 3: 0.3, 4: 0.1, 5: 0.0 },
  3: { 1: 0.2, 2: 0.3, 3: 0.3, 4: 0.2, 5: 0.0 },
  4: { 1: 0.1, 2: 0.2, 3: 0.3, 4: 0.3, 5: 0.1 },
  5: { 1: 0.0, 2: 0.1, 3: 0.3, 4: 0.4, 5: 0.2 },
};

const WORD_TYPE_PREFERENCES: Record<ActionType, { 
  preferShorter: boolean; 
  levelBias: number; 
  categoryPreferences: Record<string, number> 
}> = {
  HEAL: {
    preferShorter: true, // Healing words should be quicker to type
    levelBias: -0.5, // Slightly prefer lower levels
    categoryPreferences: { 'common': 1.2, 'medical': 1.5, 'basic': 1.3 },
  },
  ATTACK: {
    preferShorter: false, // Attack words can be longer for more damage
    levelBias: 0.3, // Slightly prefer higher levels
    categoryPreferences: { 'action': 1.4, 'power': 1.3, 'advanced': 1.2 },
  },
  GUARD: {
    preferShorter: false, // Guard words should be challenging but not impossible
    levelBias: 0.0, // Neutral level preference
    categoryPreferences: { 'defense': 1.5, 'shield': 1.4, 'protect': 1.3 },
  },
};

// =============================================================================
// MAIN WORD MANAGER CLASS
// =============================================================================

export class WordManager {
  private wordPool: Word[];
  private recentWords: Map<string, number> = new Map(); // wordId -> round used
  private currentSelection: WordSelection | null = null;
  private lockState: WordLock = null;
  private lockStartTime = 0;

  constructor(sessionSeed: SessionSeed) {
    this.wordPool = [...sessionSeed.words];
    this.validateWordPool();
  }

  // =============================================================================
  // WORD SELECTION METHODS
  // =============================================================================

  /**
   * Select a new set of words for the current game state
   */
  selectWords(options: WordSelectionOptions): WordSelection {
    const config = this.createWordPoolConfig(options);
    
    const selection: WordSelection = {
      heal: this.selectWordForType('HEAL', config),
      attack: this.selectWordForType('ATTACK', config),
    };

    // Add guard word for higher difficulties or later rounds
    if (this.shouldIncludeGuardWord(options)) {
      selection.guard = this.selectWordForType('GUARD', config);
    }

    this.currentSelection = selection;
    this.updateRecentWords(selection, options.round);

    return selection;
  }

  /**
   * Select a word for a specific action type
   */
  private selectWordForType(type: ActionType, config: WordPoolConfig): Word {
    const candidates = this.filterWordPool(config);
    const typePrefs = WORD_TYPE_PREFERENCES[type];
    
    // Score each candidate word
    const scoredCandidates = candidates.map(word => ({
      word,
      score: this.scoreWordForType(word, type, typePrefs),
    }));

    // Sort by score (higher is better)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Use weighted random selection from top candidates
    const topCandidates = scoredCandidates.slice(0, Math.max(5, Math.floor(scoredCandidates.length * 0.3)));
    
    return this.weightedRandomSelect(topCandidates.map(c => c.word), topCandidates.map(c => c.score));
  }

  /**
   * Score a word for how suitable it is for a specific action type
   */
  private scoreWordForType(word: Word, type: ActionType, preferences: typeof WORD_TYPE_PREFERENCES[ActionType]): number {
    let score = 100; // Base score

    // Length preference
    if (preferences.preferShorter) {
      score += Math.max(0, 15 - word.length) * 2; // Bonus for shorter words
    } else {
      score += Math.min(15, word.length) * 1.5; // Bonus for longer words
    }

    // Level preference
    score += (word.level + preferences.levelBias) * 10;

    // Category preferences
    if (word.category && preferences.categoryPreferences[word.category]) {
      score *= preferences.categoryPreferences[word.category];
    }

    // Avoid recent words
    if (this.recentWords.has(word.id)) {
      const roundsAgo = Date.now() - (this.recentWords.get(word.id) || 0);
      score *= Math.max(0.3, 1.0 - (5 - roundsAgo) * 0.1);
    }

    // Add some randomness
    score *= 0.8 + Math.random() * 0.4;

    return score;
  }

  // =============================================================================
  // WORD LOCKING SYSTEM
  // =============================================================================

  createLockManager(): WordLockManager {
    return {
      canLock: (wordType: ActionType) => this.canLockWord(wordType),
      lock: (wordType: ActionType) => this.lockWord(wordType),
      unlock: () => this.unlockWord(),
      isLocked: () => this.lockState !== null,
      getLockedType: () => this.lockState,
    };
  }

  private canLockWord(wordType: ActionType): boolean {
    // Can't lock if already locked to a different type
    const lockMap: Record<ActionType, WordLock> = {
      'ATTACK': 'attack',
      'HEAL': 'heal', 
      'GUARD': 'guard'
    };
    
    const lockKey = lockMap[wordType];
    if (!lockKey) {
      return false;
    }

    if (this.lockState !== null && this.lockState !== lockKey) {
      return false;
    }

    // Can't lock if current selection doesn't have this word type
    if (!this.currentSelection) {
      return false;
    }

    return this.currentSelection[lockKey] !== undefined;
  }

  private lockWord(wordType: ActionType): boolean {
    if (!this.canLockWord(wordType)) {
      return false;
    }

    const lockMap: Record<ActionType, WordLock> = {
      'ATTACK': 'attack',
      'HEAL': 'heal', 
      'GUARD': 'guard'
    };

    this.lockState = lockMap[wordType];
    this.lockStartTime = Date.now();
    return true;
  }

  private unlockWord(): boolean {
    if (this.lockState === null) {
      return false;
    }

    this.lockState = null;
    this.lockStartTime = 0;
    return true;
  }

  // =============================================================================
  // WORD POOL MANAGEMENT
  // =============================================================================

  private createWordPoolConfig(options: WordSelectionOptions): WordPoolConfig {
    const difficultyRange = DIFFICULTY_LEVEL_RANGES[options.difficulty];
    const lengthRange = DIFFICULTY_LENGTH_RANGES[options.difficulty];

    // Adjust ranges based on player level and round
    const levelAdjustment = Math.floor(options.playerLevel / 5);
    const roundAdjustment = Math.floor(options.round / 3);

    const adjustedMinLevel = Math.max(1, difficultyRange.min + levelAdjustment) as WordLevel;
    const adjustedMaxLevel = Math.min(5, difficultyRange.max + roundAdjustment) as WordLevel;

    const excludeIds = new Set<string>();
    if (options.avoidRecentWords) {
      this.recentWords.forEach((round, wordId) => {
        if (options.round - round < 3) { // Avoid words used in last 3 rounds
          excludeIds.add(wordId);
        }
      });
    }

    return {
      minLevel: adjustedMinLevel,
      maxLevel: adjustedMaxLevel,
      categoryWeights: this.calculateCategoryWeights(options),
      lengthRange,
      excludeIds,
    };
  }

  private filterWordPool(config: WordPoolConfig): Word[] {
    return this.wordPool.filter(word => {
      // Level filter
      if (word.level < config.minLevel || word.level > config.maxLevel) {
        return false;
      }

      // Length filter
      if (word.length < config.lengthRange.min || word.length > config.lengthRange.max) {
        return false;
      }

      // Exclusion filter
      if (config.excludeIds.has(word.id)) {
        return false;
      }

      return true;
    });
  }

  private calculateCategoryWeights(options: WordSelectionOptions): Record<string, number> {
    const baseWeights: Record<string, number> = {
      'basic': 1.0,
      'common': 1.0,
      'advanced': 1.0,
    };

    // Adjust weights based on difficulty
    switch (options.difficulty) {
      case 'EASY':
        baseWeights['basic'] = 1.5;
        baseWeights['common'] = 1.2;
        break;
      case 'HARD':
        baseWeights['advanced'] = 1.3;
        baseWeights['expert'] = 1.2;
        break;
    }

    return baseWeights;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private shouldIncludeGuardWord(options: WordSelectionOptions): boolean {
    // Include guard words in harder difficulties
    if (options.difficulty === 'HARD') return true;
    
    // Include guard words in later rounds
    if (options.round >= 3) return true;
    
    // Include guard words for higher level players
    if (options.playerLevel >= 5) return true;
    
    // Random chance for normal difficulty
    return options.difficulty === 'NORMAL' && Math.random() < 0.3;
  }

  private weightedRandomSelect<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length || items.length === 0) {
      throw new Error('Invalid weighted selection parameters');
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    // Fallback to last item
    return items[items.length - 1];
  }

  private updateRecentWords(selection: WordSelection, round: number): void {
    Object.values(selection).forEach(word => {
      if (word) {
        this.recentWords.set(word.id, round);
      }
    });

    // Clean up old entries (keep only last 10 rounds)
    const cutoff = round - 10;
    this.recentWords.forEach((usedRound, wordId) => {
      if (usedRound < cutoff) {
        this.recentWords.delete(wordId);
      }
    });
  }

  private validateWordPool(): void {
    if (this.wordPool.length === 0) {
      throw new Error('WordManager: Empty word pool');
    }

    // Check for required properties
    for (const word of this.wordPool) {
      if (!word.id || !word.text || !word.level) {
        throw new Error(`WordManager: Invalid word structure: ${JSON.stringify(word)}`);
      }
      
      if (word.level < 1 || word.level > 5) {
        throw new Error(`WordManager: Invalid word level: ${word.level} for word ${word.id}`);
      }

      if (word.text.length !== word.length) {
        console.warn(`WordManager: Length mismatch for word ${word.id}: expected ${word.text.length}, got ${word.length}`);
        word.length = word.text.length; // Fix the issue
      }
    }
  }

  // =============================================================================
  // PUBLIC ACCESS METHODS
  // =============================================================================

  getCurrentSelection(): WordSelection | null {
    return this.currentSelection;
  }

  getWordById(id: string): Word | null {
    return this.wordPool.find(word => word.id === id) || null;
  }

  getWordPoolStats(): {
    totalWords: number;
    levelDistribution: Record<WordLevel, number>;
    categoryDistribution: Record<string, number>;
    averageLength: number;
  } {
    const levelCounts: Record<WordLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const categoryCounts: Record<string, number> = {};
    let totalLength = 0;

    this.wordPool.forEach(word => {
      levelCounts[word.level]++;
      
      if (word.category) {
        categoryCounts[word.category] = (categoryCounts[word.category] || 0) + 1;
      }
      
      totalLength += word.length;
    });

    return {
      totalWords: this.wordPool.length,
      levelDistribution: levelCounts,
      categoryDistribution: categoryCounts,
      averageLength: totalLength / this.wordPool.length,
    };
  }

  reset(): void {
    this.currentSelection = null;
    this.lockState = null;
    this.lockStartTime = 0;
    this.recentWords.clear();
  }
}