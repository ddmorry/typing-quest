import {
  GameConfig,
  GameState,
  GameEvent,
  GameEventData,
  SessionSeed,
  CompletedWord,
  AttackResult,
  HealResult,
  GuardResult,
  PerformanceMetrics,
} from './types';

/**
 * Abstract base class for all game adapters
 * Provides a unified interface for game logic independent of rendering engine
 */
export abstract class GameAdapter {
  protected config: GameConfig | null = null;
  protected state: GameState;
  protected sessionSeed: SessionSeed | null = null;
  protected mounted = false;
  protected running = false;
  protected element: HTMLElement | null = null;

  // Event listeners storage
  protected eventListeners: Map<GameEvent, Set<(data: any) => void>> = new Map();
  protected stateSubscribers: Set<(state: GameState) => void> = new Set();

  constructor() {
    this.state = this.createInitialState();
    this.initializeEventSystem();
  }

  // =============================================================================
  // LIFECYCLE METHODS (Abstract - must be implemented by adapters)
  // =============================================================================

  abstract mount(element: HTMLElement, config: GameConfig): Promise<void>;
  abstract start(sessionSeed: SessionSeed): Promise<void>;
  abstract pause(): void;
  abstract resume(): void;
  abstract destroy(): void;

  // =============================================================================
  // GAME ACTIONS (Abstract - must be implemented by adapters)
  // =============================================================================

  abstract processKeystroke(key: string): Promise<void>;
  abstract executeAttack(wordData: CompletedWord): Promise<AttackResult>;
  abstract executeHeal(wordData: CompletedWord): Promise<HealResult>;
  abstract executeGuard(wordData: CompletedWord): Promise<GuardResult>;

  // =============================================================================
  // PERFORMANCE MONITORING (Abstract - adapter specific)
  // =============================================================================

  abstract getPerformanceMetrics(): PerformanceMetrics;

  // =============================================================================
  // STATE MANAGEMENT (Concrete implementations)
  // =============================================================================

  getState(): GameState {
    return { ...this.state }; // Return deep copy
  }

  protected setState(updates: Partial<GameState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify state subscribers
    this.stateSubscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });

    // Emit state change event
    this.emit('state-change', { oldState, newState: this.state });
  }

  subscribe(callback: (state: GameState) => void): () => void {
    this.stateSubscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  // =============================================================================
  // EVENT SYSTEM (Concrete implementations)
  // =============================================================================

  on<T extends GameEvent>(
    event: T, 
    callback: (data: GameEventData[T]) => void
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off<T extends GameEvent>(
    event: T, 
    callback: (data: GameEventData[T]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit<T extends GameEvent>(event: T, data: GameEventData[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
          this.emit('error', { error: error as Error, context: `Event: ${event}` });
        }
      });
    }
  }

  // =============================================================================
  // UTILITY METHODS (Protected - for use by adapter implementations)
  // =============================================================================

  protected createInitialState(): GameState {
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
      timeLeft: 300, // 5 minutes default
      round: 1,
    };
  }

  protected initializeEventSystem(): void {
    // Initialize event listener storage for all event types
    const events: GameEvent[] = [
      'state-change',
      'word-started',
      'word-completed', 
      'word-failed',
      'word-locked',
      'word-unlocked',
      'action-executed',
      'damage-dealt',
      'healing-applied',
      'guard-executed',
      'enemy-attack',
      'combo-changed',
      'game-over',
      'session-ended',
      'error'
    ];

    events.forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  protected validateConfig(config: GameConfig): void {
    if (!config.sessionId) {
      throw new Error('GameAdapter: sessionId is required');
    }
    if (!config.packId) {
      throw new Error('GameAdapter: packId is required');
    }
    if (config.width <= 0 || config.height <= 0) {
      throw new Error('GameAdapter: Invalid dimensions');
    }
    if (!['EASY', 'NORMAL', 'HARD'].includes(config.difficulty)) {
      throw new Error('GameAdapter: Invalid difficulty level');
    }
  }

  protected validateSessionSeed(sessionSeed: SessionSeed): void {
    if (!sessionSeed.sessionId) {
      throw new Error('GameAdapter: SessionSeed sessionId is required');
    }
    if (!sessionSeed.words || sessionSeed.words.length === 0) {
      throw new Error('GameAdapter: SessionSeed must contain words');
    }
    if (!sessionSeed.packId) {
      throw new Error('GameAdapter: SessionSeed packId is required');
    }
  }

  // =============================================================================
  // GAME LOGIC HELPERS (Protected)
  // =============================================================================

  protected updateCombo(newCombo: number): void {
    const oldCombo = this.state.combo;
    if (newCombo !== oldCombo) {
      this.setState({
        combo: newCombo,
        stats: {
          ...this.state.stats,
          maxCombo: Math.max(this.state.stats.maxCombo, newCombo),
        },
      });
      this.emit('combo-changed', { oldCombo, newCombo });
    }
  }

  protected updateStats(updates: Partial<GameState['stats']>): void {
    this.setState({
      stats: {
        ...this.state.stats,
        ...updates,
      },
    });
  }

  protected checkGameOver(): void {
    if (this.state.hp.player <= 0) {
      this.setState({ status: 'ENDED' });
      this.emit('game-over', { result: 'LOSE', finalStats: this.state.stats });
    } else if (this.state.hp.enemy <= 0) {
      this.setState({ status: 'ENDED' });
      this.emit('game-over', { result: 'WIN', finalStats: this.state.stats });
    } else if (this.state.timeLeft <= 0) {
      this.setState({ status: 'ENDED' });
      const result = this.state.hp.player > this.state.hp.enemy ? 'WIN' : 'LOSE';
      this.emit('game-over', { result, finalStats: this.state.stats });
    }
  }

  protected isValidKeystroke(key: string): boolean {
    // Allow letters, numbers, space, and common punctuation
    return /^[a-zA-Z0-9\s\-'.,!?;:]$/.test(key);
  }

  // =============================================================================
  // PUBLIC HELPER METHODS
  // =============================================================================

  isRunning(): boolean {
    return this.running && this.state.status === 'PLAYING';
  }

  isMounted(): boolean {
    return this.mounted && this.element !== null;
  }

  getConfig(): GameConfig | null {
    return this.config;
  }

  getSessionSeed(): SessionSeed | null {
    return this.sessionSeed;
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  protected cleanup(): void {
    // Clear all event listeners
    this.eventListeners.clear();
    this.stateSubscribers.clear();
    
    // Reset state
    this.state = this.createInitialState();
    this.config = null;
    this.sessionSeed = null;
    this.mounted = false;
    this.running = false;
    this.element = null;
  }
}