import {
  GameState,
  GameConfig,
  GameDifficulty,
  ActionResult,
  CompletedWord,
  ValidationResult,
  HealthPoints,
  GameStats,
  Word,
  ActionType,
} from '../types';
import { EventBus } from '../events/EventBus';

/**
 * Centralized game state management with validation and history tracking
 */

export interface StateTransition {
  from: GameState;
  to: GameState;
  timestamp: number;
  trigger: string;
  valid: boolean;
}

export interface StateManagerOptions {
  enableHistory: boolean;
  maxHistorySize: number;
  validateTransitions: boolean;
  enableLogging: boolean;
}

export class GameStateManager {
  private currentState: GameState;
  private stateHistory: StateTransition[] = [];
  private subscribers: Set<(state: GameState) => void> = new Set();
  private options: StateManagerOptions;
  private eventBus: EventBus;

  constructor(
    initialState: GameState,
    eventBus: EventBus,
    options: Partial<StateManagerOptions> = {}
  ) {
    this.currentState = { ...initialState };
    this.eventBus = eventBus;
    this.options = {
      enableHistory: true,
      maxHistorySize: 50,
      validateTransitions: true,
      enableLogging: process.env.NODE_ENV === 'development',
      ...options,
    };
  }

  // =============================================================================
  // STATE ACCESS
  // =============================================================================

  getState(): GameState {
    return { ...this.currentState };
  }

  subscribe(callback: (state: GameState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // =============================================================================
  // STATE UPDATES
  // =============================================================================

  /**
   * Update state with validation and history tracking
   */
  updateState(
    updates: Partial<GameState>,
    trigger: string = 'manual'
  ): ValidationResult {
    const previousState = { ...this.currentState };
    const newState = { ...this.currentState, ...updates };

    // Validate transition if enabled
    if (this.options.validateTransitions) {
      const validation = this.validateStateTransition(previousState, newState, trigger);
      if (!validation.valid) {
        this.log('State transition rejected', { from: previousState, to: newState, errors: validation.errors });
        return validation;
      }
    }

    // Apply the state change
    this.currentState = newState;

    // Record in history
    if (this.options.enableHistory) {
      this.recordStateTransition(previousState, newState, trigger, true);
    }

    // Notify subscribers
    this.notifySubscribers();

    // Emit state change event
    this.eventBus.emit('state-change', {
      oldState: previousState,
      newState: this.currentState,
    });

    this.log('State updated', { trigger, updates });

    return { valid: true, errors: [] };
  }

  /**
   * Batch update multiple state properties atomically
   */
  batchUpdate(updates: Array<{
    updates: Partial<GameState>;
    trigger: string;
  }>): ValidationResult {
    let cumulativeState = { ...this.currentState };
    const errors: string[] = [];

    // Validate all updates first
    for (const { updates: stateUpdates, trigger } of updates) {
      const testState = { ...cumulativeState, ...stateUpdates };
      const validation = this.validateStateTransition(cumulativeState, testState, trigger);
      
      if (!validation.valid) {
        errors.push(...validation.errors.map(err => `${trigger}: ${err}`));
      } else {
        cumulativeState = testState;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Apply all updates at once
    return this.updateState(
      this.diffStates(this.currentState, cumulativeState),
      'batch-update'
    );
  }

  // =============================================================================
  // SPECIALIZED STATE UPDATES
  // =============================================================================

  /**
   * Update HP with bounds checking
   */
  updateHP(updates: Partial<HealthPoints>): ValidationResult {
    const newHP = { ...this.currentState.hp, ...updates };
    
    // Clamp values to valid ranges
    newHP.player = Math.max(0, Math.min(newHP.playerMax, newHP.player));
    newHP.enemy = Math.max(0, Math.min(newHP.enemyMax, newHP.enemy));

    return this.updateState({ hp: newHP }, 'hp-update');
  }

  /**
   * Update stats with calculated values
   */
  updateStats(updates: Partial<GameStats>): ValidationResult {
    const newStats = { ...this.currentState.stats, ...updates };
    
    // Ensure non-negative values
    Object.keys(newStats).forEach(key => {
      const value = newStats[key as keyof GameStats];
      if (typeof value === 'number' && value < 0) {
        newStats[key as keyof GameStats] = 0;
      }
    });

    // Update accuracy to be between 0 and 1
    if ('accuracy' in updates) {
      newStats.accuracy = Math.max(0, Math.min(1, newStats.accuracy));
    }

    return this.updateState({ stats: newStats }, 'stats-update');
  }

  /**
   * Apply action result to state
   */
  applyActionResult(result: ActionResult): ValidationResult {
    const updates: Partial<GameState> = {
      combo: result.combo,
      stats: {
        ...this.currentState.stats,
        wordsCompleted: this.currentState.stats.wordsCompleted + 1,
      },
    };

    // Update type-specific stats
    switch (result.type) {
      case 'ATTACK':
        updates.hp = {
          ...this.currentState.hp,
          enemy: Math.max(0, this.currentState.hp.enemy - result.value),
        };
        updates.stats!.attackCount = this.currentState.stats.attackCount + 1;
        updates.stats!.totalDamage = this.currentState.stats.totalDamage + result.value;
        break;

      case 'HEAL':
        updates.hp = {
          ...this.currentState.hp,
          player: Math.min(this.currentState.hp.playerMax, this.currentState.hp.player + result.value),
        };
        updates.stats!.healCount = this.currentState.stats.healCount + 1;
        updates.stats!.totalHealing = this.currentState.stats.totalHealing + result.value;
        break;

      case 'GUARD':
        updates.stats!.guardCount = this.currentState.stats.guardCount + 1;
        break;
    }

    // Update max combo
    if (result.combo > this.currentState.stats.maxCombo) {
      updates.stats!.maxCombo = result.combo;
    }

    return this.updateState(updates, `${result.type.toLowerCase()}-result`);
  }

  /**
   * Lock/unlock word selection
   */
  setWordLock(lockType: GameState['locked']): ValidationResult {
    if (this.currentState.locked === lockType) {
      return { valid: true, errors: [] };
    }

    return this.updateState(
      { locked: lockType },
      lockType ? `lock-${lockType}` : 'unlock-word'
    );
  }

  /**
   * Update current words
   */
  updateCurrentWords(words: Partial<GameState['currentWords']>): ValidationResult {
    const newWords = { ...this.currentState.currentWords, ...words };
    
    // Validate words have required properties
    const validation = this.validateWords(Object.values(newWords).filter(Boolean));
    if (!validation.valid) {
      return validation;
    }

    return this.updateState({ currentWords: newWords }, 'update-words');
  }

  // =============================================================================
  // STATE VALIDATION
  // =============================================================================

  private validateStateTransition(
    from: GameState,
    to: GameState,
    trigger: string
  ): ValidationResult {
    const errors: string[] = [];

    // Validate status transitions
    if (!this.isValidStatusTransition(from.status, to.status)) {
      errors.push(`Invalid status transition: ${from.status} -> ${to.status}`);
    }

    // Validate HP bounds
    if (to.hp.player < 0 || to.hp.player > to.hp.playerMax) {
      errors.push(`Player HP out of bounds: ${to.hp.player}`);
    }
    if (to.hp.enemy < 0 || to.hp.enemy > to.hp.enemyMax) {
      errors.push(`Enemy HP out of bounds: ${to.hp.enemy}`);
    }

    // Validate combo
    if (to.combo < 0) {
      errors.push(`Combo cannot be negative: ${to.combo}`);
    }

    // Validate stats
    if (to.stats.accuracy < 0 || to.stats.accuracy > 1) {
      errors.push(`Accuracy out of bounds: ${to.stats.accuracy}`);
    }

    // Validate time
    if (to.timeLeft < 0) {
      errors.push(`Time cannot be negative: ${to.timeLeft}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidStatusTransition(from: GameState['status'], to: GameState['status']): boolean {
    const validTransitions: Record<GameState['status'], GameState['status'][]> = {
      'LOADING': ['READY', 'ENDED'],
      'READY': ['PLAYING', 'ENDED'],
      'PLAYING': ['PAUSED', 'ENDED'],
      'PAUSED': ['PLAYING', 'ENDED'],
      'ENDED': [], // Terminal state
    };

    return validTransitions[from].includes(to) || from === to;
  }

  private validateWords(words: Word[]): ValidationResult {
    const errors: string[] = [];

    for (const word of words) {
      if (!word.text || word.text.length === 0) {
        errors.push(`Word has empty text: ${word.id}`);
      }
      if (word.level < 1 || word.level > 5) {
        errors.push(`Word level out of bounds: ${word.level}`);
      }
      if (word.length !== word.text.length) {
        errors.push(`Word length mismatch: expected ${word.text.length}, got ${word.length}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =============================================================================
  // STATE HISTORY
  // =============================================================================

  private recordStateTransition(
    from: GameState,
    to: GameState,
    trigger: string,
    valid: boolean
  ): void {
    const transition: StateTransition = {
      from: { ...from },
      to: { ...to },
      timestamp: Date.now(),
      trigger,
      valid,
    };

    this.stateHistory.push(transition);

    // Limit history size
    if (this.stateHistory.length > this.options.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  getStateHistory(count?: number): StateTransition[] {
    const history = [...this.stateHistory];
    return count ? history.slice(-count) : history;
  }

  getLastTransition(): StateTransition | null {
    return this.stateHistory.length > 0 
      ? this.stateHistory[this.stateHistory.length - 1] 
      : null;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private diffStates(oldState: GameState, newState: GameState): Partial<GameState> {
    const diff: Partial<GameState> = {};

    (Object.keys(newState) as Array<keyof GameState>).forEach(key => {
      if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
        (diff as any)[key] = newState[key];
      }
    });

    return diff;
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.currentState);
      } catch (error) {
        this.log('Error in state subscriber', error);
      }
    });
  }

  private log(message: string, data?: any): void {
    if (this.options.enableLogging) {
      console.debug(`[GameStateManager] ${message}`, data);
    }
  }

  // =============================================================================
  // RESET AND CLEANUP
  // =============================================================================

  /**
   * Reset state to initial values
   */
  reset(newInitialState?: GameState): void {
    const previousState = { ...this.currentState };
    
    if (newInitialState) {
      this.currentState = { ...newInitialState };
    } else {
      // Reset to default initial state
      this.currentState = this.createDefaultState();
    }

    if (this.options.enableHistory) {
      this.recordStateTransition(previousState, this.currentState, 'reset', true);
    }

    this.notifySubscribers();
    this.eventBus.emit('state-change', {
      oldState: previousState,
      newState: this.currentState,
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.subscribers.clear();
    this.stateHistory.length = 0;
    this.log('GameStateManager destroyed');
  }

  private createDefaultState(): GameState {
    return {
      status: 'LOADING',
      hp: {
        player: 100,
        enemy: 100,
        playerMax: 100,
        enemyMax: 100,
      },
      currentWords: {
        heal: { id: '', text: '', level: 1, length: 0 },
        attack: { id: '', text: '', level: 1, length: 0 },
      },
      locked: null,
      combo: 0,
      stats: {
        wpm: 0,
        accuracy: 1.0,
        totalDamage: 0,
        totalHealing: 0,
        attackCount: 0,
        healCount: 0,
        guardCount: 0,
        maxCombo: 0,
        wordsCompleted: 0,
      },
      timeLeft: 300,
      round: 1,
    };
  }
}