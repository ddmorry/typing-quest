/**
 * Core types for the Typing Quest game engine
 * Provides type-safe interfaces for game logic abstraction
 */

// =============================================================================
// GAME CONFIGURATION TYPES
// =============================================================================

export interface GameConfig {
  width: number;
  height: number;
  difficulty: GameDifficulty;
  packId: string;
  sessionId: string;
  durationSec: number;
  settings?: {
    a11y?: A11ySettings;
    sound?: SoundSettings;
  };
}

export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface A11ySettings {
  highContrast: boolean;
  openDyslexic: boolean;
  reduceMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  letterSpacing: 'normal' | 'wide';
  soundEnabled: boolean;
  voiceEnabled: boolean;
}

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
  effects: boolean;
  music: boolean;
}

// =============================================================================
// GAME STATE TYPES
// =============================================================================

export interface GameState {
  status: GameStatus;
  hp: HealthPoints;
  currentWords: CurrentWords;
  locked: WordLock;
  combo: number;
  stats: GameStats;
  timeLeft: number;
  round: number;
}

export type GameStatus = 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED';

export interface HealthPoints {
  player: number;
  enemy: number;
  playerMax: number;
  enemyMax: number;
}

export interface CurrentWords {
  heal: Word;
  attack: Word;
  guard?: Word; // Optional guard word for defending against enemy attacks
}

export type WordLock = 'heal' | 'attack' | 'guard' | null;

export interface GameStats {
  wpm: number;
  accuracy: number;
  totalDamage: number;
  totalHealing: number;
  attackCount: number;
  healCount: number;
  guardCount: number;
  maxCombo: number;
  wordsCompleted: number;
}

// =============================================================================
// WORD TYPES
// =============================================================================

export interface Word {
  id: string;
  text: string;
  level: WordLevel; // L1-L5 difficulty
  category?: string; // NGSL, TOEIC, etc.
  length: number;
  expectedWPM?: number; // Expected WPM for this word at current difficulty
}

export type WordLevel = 1 | 2 | 3 | 4 | 5;

export interface CompletedWord extends Word {
  typedText: string;
  timeMs: number;
  errors: number;
  accuracy: number;
  wpm: number;
  score: number;
  keystrokePattern?: KeystrokePattern;
}

export interface KeystrokePattern {
  intervals: Record<string, number>; // Key -> time interval
  corrections: number;
  backspaceCount: number;
  perfectStreak: number;
}

// =============================================================================
// ACTION RESULT TYPES
// =============================================================================

export interface ActionResult {
  success: boolean;
  type: ActionType;
  word: CompletedWord;
  value: number; // damage/healing amount
  critical: boolean;
  combo: number;
  message?: string;
}

export interface AttackResult extends ActionResult {
  type: 'ATTACK';
  enemyHpBefore: number;
  enemyHpAfter: number;
  damageDealt: number;
}

export interface HealResult extends ActionResult {
  type: 'HEAL';
  playerHpBefore: number;
  playerHpAfter: number;
  healingDone: number;
}

export interface GuardResult extends ActionResult {
  type: 'GUARD';
  blocked: boolean;
  damageBlocked: number;
  damageReceived: number;
}

export type ActionType = 'ATTACK' | 'HEAL' | 'GUARD';

// =============================================================================
// SESSION TYPES
// =============================================================================

export interface SessionSeed {
  sessionId: string;
  packId: string;
  difficulty: GameDifficulty;
  words: Word[];
  playerStats?: PlayerStats;
}

export interface PlayerStats {
  level: number;
  experience: number;
  averageWPM: number;
  averageAccuracy: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface SessionResult {
  sessionId: string;
  result: 'WIN' | 'LOSE' | 'ABORT';
  finalStats: GameStats;
  duration: number;
  attempts: CompletedWord[];
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type GameEvent =
  | 'state-change'
  | 'word-started'
  | 'word-completed'
  | 'word-failed'
  | 'action-executed'
  | 'damage-dealt'
  | 'healing-applied'
  | 'guard-executed'
  | 'enemy-attack'
  | 'combo-changed'
  | 'game-over'
  | 'session-ended'
  | 'error';

export interface GameEventData {
  'state-change': { oldState: GameState; newState: GameState };
  'word-started': { word: Word; type: ActionType };
  'word-completed': { completedWord: CompletedWord; result: ActionResult };
  'word-failed': { word: Word; typedText: string; errors: number };
  'action-executed': { result: ActionResult };
  'damage-dealt': { damage: number; critical: boolean; enemyHp: number };
  'healing-applied': { healing: number; critical: boolean; playerHp: number };
  'guard-executed': { blocked: boolean; damageBlocked: number };
  'enemy-attack': { damage: number; playerHp: number };
  'combo-changed': { oldCombo: number; newCombo: number };
  'game-over': { result: 'WIN' | 'LOSE'; finalStats: GameStats };
  'session-ended': { sessionResult: SessionResult };
  'error': { error: Error; context: string };
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface InputState {
  currentInput: string;
  targetWord: Word;
  wordType: ActionType;
  errors: number;
  startTime: number;
  lastKeyTime: number;
  keystrokePattern: KeystrokePattern;
}

export interface KeystrokeEvent {
  key: string;
  timestamp: number;
  inputLength: number;
  isCorrection: boolean;
}

// =============================================================================
// GAME ADAPTER INTERFACE
// =============================================================================

export interface GameAdapter {
  // Lifecycle methods
  mount(element: HTMLElement, config: GameConfig): Promise<void>;
  start(sessionSeed: SessionSeed): Promise<void>;
  pause(): void;
  resume(): void;
  destroy(): void;

  // Game actions
  processKeystroke(key: string): Promise<void>;
  executeAttack(wordData: CompletedWord): Promise<AttackResult>;
  executeHeal(wordData: CompletedWord): Promise<HealResult>;
  executeGuard(wordData: CompletedWord): Promise<GuardResult>;

  // State management
  getState(): GameState;
  subscribe(callback: (state: GameState) => void): () => void;

  // Event system
  on<T extends GameEvent>(event: T, callback: (data: GameEventData[T]) => void): () => void;
  off<T extends GameEvent>(event: T, callback: (data: GameEventData[T]) => void): void;
  emit<T extends GameEvent>(event: T, data: GameEventData[T]): void;

  // Performance monitoring
  getPerformanceMetrics(): PerformanceMetrics;
}

export interface PerformanceMetrics {
  fps: number;
  averageFPS: number;
  memoryUsage: number;
  renderTime: number;
  updateTime: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface GameValidationRules {
  maxWPM: number;
  minCharTime: number;
  maxConsecutivePerfect: number;
  minVariance: number;
}