import { GameAdapter } from './GameAdapter';
import {
  GameConfig,
  SessionSeed,
  CompletedWord,
  AttackResult,
  HealResult,
  GuardResult,
  PerformanceMetrics,
  ActionType,
} from './types';
import { GameStateManager } from './state/GameStateManager';
import { EventBus } from './events/EventBus';
import { WordManager } from './utils/wordManager';
import { InputValidator, TypingSession } from './utils/inputValidator';
import {
  calculateAttackDamage,
  calculateHealingAmount,
  calculateGuardEffectiveness,
  createAttackResult,
  createHealResult,
  createGuardResult,
} from './utils/combatCalculations';
// GameScene will be imported dynamically with Phaser
import { PerformanceMonitor } from './utils/performanceMonitor';

/**
 * Phaser-specific implementation of GameAdapter
 * Integrates game logic with Phaser 3 rendering engine
 */

export class PhaserAdapter extends GameAdapter {
  private phaserGame: Phaser.Game | null = null;
  private gameScene: any = null; // Will be typed as GameScene after dynamic import
  private stateManager: GameStateManager;
  private eventBus: EventBus;
  private wordManager: WordManager | null = null;
  private inputValidator: InputValidator;
  private currentTypingSession: TypingSession | null = null;
  private performanceMonitor: PerformanceMonitor;

  // Input handling
  private inputBuffer = '';
  private keyboardEnabled = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();

    // Initialize subsystems
    this.eventBus = new EventBus({
      enableLogging: process.env.NODE_ENV === 'development',
      logLevel: 'warn',
      maxListeners: 100,
    });

    this.stateManager = new GameStateManager(
      this.createInitialState(),
      this.eventBus,
      {
        enableHistory: true,
        maxHistorySize: 100,
        validateTransitions: true,
        enableLogging: process.env.NODE_ENV === 'development',
      }
    );

    this.inputValidator = new InputValidator();
    this.performanceMonitor = new PerformanceMonitor();

    this.setupEventListeners();
  }

  // =============================================================================
  // LIFECYCLE METHODS
  // =============================================================================

  async mount(element: HTMLElement, config: GameConfig): Promise<void> {
    try {
      this.validateConfig(config);

      // Clean up any existing canvas elements in the target element
      const existingCanvases = element.querySelectorAll('canvas');
      existingCanvases.forEach(canvas => canvas.remove());

      this.config = config;
      this.element = element;

      // Dynamic import of Phaser to ensure it's only loaded when needed
      const Phaser = await import('phaser');

      // Create optimized Phaser configuration for 60fps and responsive design
      const phaserConfig = {
        type: Phaser.AUTO, // Automatically choose WebGL or Canvas
        width: config.width,
        height: config.height,
        parent: element,
        backgroundColor: '#2c3e50',

        // Physics configuration
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: process.env.NODE_ENV === 'development',
          },
        },

        // Optimized FPS configuration
        fps: {
          target: 60,
          forceSetTimeOut: true,
          deltaHistory: 10, // Keep delta history for smoother performance
        },

        // Responsive scaling configuration
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: config.width,
          height: config.height,
          min: {
            width: 320,
            height: 240,
          },
          max: {
            width: 1920,
            height: 1080,
          },
        },

        // Render configuration for better performance
        render: {
          antialias: true,
          pixelArt: false,
          roundPixels: true,
          transparent: false,
          powerPreference: 'high-performance', // Use dedicated GPU if available
        },

        // Use a simple inline scene for testing
        scene: {
          key: 'GameScene',
          preload: function() {
            console.log('Phaser scene preload');
          },
          create: function() {
            console.log('Phaser scene created successfully');
            
            // Store reference to adapter
            (this.game as any).adapter = (this.game as any).adapter;
            
            // Create basic UI
            this.add.text(400, 50, 'Typing Quest', {
              fontSize: '32px',
              color: '#ffffff',
            }).setOrigin(0.5);

            this.add.text(400, 300, 'Game Engine Ready!', {
              fontSize: '24px',
              color: '#4ecdc4',
            }).setOrigin(0.5);

            this.add.text(400, 400, 'Press any key to test input...', {
              fontSize: '16px',
              color: '#cccccc',
            }).setOrigin(0.5);
          },
          update: function() {
            // Basic update loop
          }
        },

        // Audio configuration
        audio: {
          disableWebAudio: false,
        },

        // Input configuration
        input: {
          keyboard: true,
          mouse: true,
          touch: true,
          gamepad: false,
        },
      };

      // Create Phaser game instance
      this.phaserGame = new Phaser.Game(phaserConfig);

      // Attach this adapter to the game for scene access
      (this.phaserGame as Phaser.Game & { adapter: PhaserAdapter }).adapter =
        this;

      // Set up resize handling
      this.setupResizeHandling();

      // Wait for scene to be ready
      await this.waitForSceneReady();

      // Initialize performance monitoring
      this.startPerformanceMonitoring();

      this.mounted = true;
      this.setState({ status: 'READY' });

      console.log('PhaserAdapter mounted successfully');
    } catch (error) {
      console.error('Failed to mount PhaserAdapter:', error);
      this.emit('error', { error: error as Error, context: 'mount' });
      throw error;
    }
  }

  async start(sessionSeed: SessionSeed): Promise<void> {
    try {
      this.validateSessionSeed(sessionSeed);
      this.sessionSeed = sessionSeed;

      // Initialize word manager
      this.wordManager = new WordManager(sessionSeed);

      // Set up initial game state
      this.setState({
        status: 'PLAYING',
        timeLeft: this.config?.durationSec || 300,
      });

      // Select initial words
      this.selectNewWords();

      // Enable input handling
      this.enableInput();

      // Start game timer
      this.startGameTimer();

      this.running = true;
      console.log('PhaserAdapter started');
    } catch (error) {
      console.error('Failed to start PhaserAdapter:', error);
      this.emit('error', { error: error as Error, context: 'start' });
      throw error;
    }
  }

  pause(): void {
    if (this.state.status === 'PLAYING') {
      this.setState({ status: 'PAUSED' });
      this.disableInput();

      if (this.gameScene) {
        this.gameScene.scene.pause();
      }
    }
  }

  resume(): void {
    if (this.state.status === 'PAUSED') {
      this.setState({ status: 'PLAYING' });
      this.enableInput();

      if (this.gameScene) {
        this.gameScene.scene.resume();
      }
    }
  }

  destroy(): void {
    this.running = false;
    this.disableInput();

    // Stop performance monitoring
    this.stopPerformanceMonitoring();

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.phaserGame) {
      this.phaserGame.destroy(true, false);
      this.phaserGame = null;
    }

    // Clean up any remaining canvas elements
    if (this.element) {
      const canvases = this.element.querySelectorAll('canvas');
      canvases.forEach(canvas => canvas.remove());
    }

    this.stateManager?.destroy();
    this.eventBus?.destroy();
    this.inputValidator?.reset();
    this.wordManager?.reset();
    this.gameScene = null;

    this.cleanup();
    console.log('PhaserAdapter destroyed');
  }

  // =============================================================================
  // GAME ACTIONS
  // =============================================================================

  async processKeystroke(key: string): Promise<void> {
    if (!this.keyboardEnabled || !this.isRunning()) {
      return;
    }

    try {
      // Handle special keys
      if (key === 'Backspace') {
        this.handleBackspace();
        return;
      }

      if (key === 'Enter') {
        await this.handleEnterKey();
        return;
      }

      // Handle regular character input (only English letters and space)
      if (/^[a-zA-Z ]$/.test(key)) {
        this.handleCharacterInput(key);
      }
    } catch (error) {
      this.emit('error', {
        error: error as Error,
        context: 'processKeystroke',
      });
    }
  }

  async executeAttack(wordData: CompletedWord): Promise<AttackResult> {
    try {
      const config = {
        difficulty: this.config!.difficulty,
        playerLevel: 1, // TODO: Get from player stats
        combo: this.state.combo,
        timeRemaining: this.state.timeLeft,
        totalTime: this.config!.durationSec,
      };

      const calculation = calculateAttackDamage(wordData, config);
      const result = createAttackResult(
        wordData,
        calculation,
        this.state.hp.enemy,
        this.state.combo + (calculation.isCritical ? 2 : 1)
      );

      // Apply result to state
      await this.stateManager.applyActionResult(result);

      // Update combo
      this.updateCombo(result.combo);

      // Emit events
      this.emit('action-executed', { result });
      this.emit('damage-dealt', {
        damage: result.damageDealt,
        critical: result.critical,
        enemyHp: result.enemyHpAfter,
      });

      return result;
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'executeAttack' });
      throw error;
    }
  }

  async executeHeal(wordData: CompletedWord): Promise<HealResult> {
    try {
      const config = {
        difficulty: this.config!.difficulty,
        playerLevel: 1,
        combo: this.state.combo,
        timeRemaining: this.state.timeLeft,
        totalTime: this.config!.durationSec,
      };

      const calculation = calculateHealingAmount(wordData, config);
      const result = createHealResult(
        wordData,
        calculation,
        this.state.hp.player,
        this.state.hp.playerMax,
        this.state.combo + (calculation.isCritical ? 2 : 1)
      );

      // Apply result to state
      await this.stateManager.applyActionResult(result);

      // Update combo
      this.updateCombo(result.combo);

      // Emit events
      this.emit('action-executed', { result });
      this.emit('healing-applied', {
        healing: result.healingDone,
        critical: result.critical,
        playerHp: result.playerHpAfter,
      });

      return result;
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'executeHeal' });
      throw error;
    }
  }

  async executeGuard(wordData: CompletedWord): Promise<GuardResult> {
    try {
      const incomingDamage = 25; // TODO: Calculate based on enemy attack
      const config = {
        difficulty: this.config!.difficulty,
        playerLevel: 1,
        combo: this.state.combo,
        timeRemaining: this.state.timeLeft,
        totalTime: this.config!.durationSec,
      };

      const calculation = calculateGuardEffectiveness(
        wordData,
        incomingDamage,
        config
      );
      const result = createGuardResult(
        wordData,
        calculation,
        incomingDamage,
        this.state.combo + (calculation.isCritical ? 2 : 1)
      );

      // Apply result to state
      await this.stateManager.applyActionResult(result);

      // Update combo
      this.updateCombo(result.combo);

      // Apply remaining damage if guard wasn't perfect
      if (result.damageReceived > 0) {
        const newPlayerHp = Math.max(
          0,
          this.state.hp.player - result.damageReceived
        );
        await this.stateManager.updateHP({ player: newPlayerHp });
      }

      // Emit events
      this.emit('action-executed', { result });
      this.emit('guard-executed', {
        blocked: result.blocked,
        damageBlocked: result.damageBlocked,
      });

      return result;
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'executeGuard' });
      throw error;
    }
  }

  // =============================================================================
  // PERFORMANCE MONITORING
  // =============================================================================

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  // =============================================================================
  // PHASER SCENE METHODS (removed - functionality moved inline to mount method)
  // =============================================================================

  // =============================================================================
  // INPUT HANDLING
  // =============================================================================

  private enableInput(): void {
    if (!this.gameScene) return;

    this.keyboardEnabled = true;

    // Set up optimized keyboard input handling
    const keyboard = this.gameScene.input.keyboard;

    // Clear any existing listeners first
    keyboard?.removeAllListeners('keydown');

    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.keyboardEnabled) return;

      // Prevent default for game keys to avoid browser shortcuts
      if (this.shouldPreventDefault(event.key)) {
        event.preventDefault();
      }

      // Only process valid keystrokes
      if (this.isValidGameKeystroke(event.key)) {
        this.processKeystroke(event.key);
      }
    });
  }

  private disableInput(): void {
    this.keyboardEnabled = false;

    if (this.gameScene) {
      this.gameScene.input.keyboard?.removeAllListeners();
    }
  }

  private handleCharacterInput(key: string): void {
    this.inputBuffer += key;

    // Update GameScene with current input
    if (this.gameScene) {
      this.gameScene.updateCurrentInput(this.inputBuffer);
    }

    // Update typing session
    if (this.currentTypingSession) {
      this.currentTypingSession = this.inputValidator.updateTypingSession(
        this.currentTypingSession,
        key,
        this.inputBuffer
      );
    }

    // Check for word completion
    const targetWord = this.getCurrentTargetWord();
    if (targetWord && this.inputBuffer === targetWord.text) {
      this.completeCurrentWord();
    }
  }

  private handleBackspace(): void {
    if (this.inputBuffer.length > 0) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);

      // Update GameScene with current input
      if (this.gameScene) {
        this.gameScene.updateCurrentInput(this.inputBuffer);
      }

      if (this.currentTypingSession) {
        this.currentTypingSession = this.inputValidator.updateTypingSession(
          this.currentTypingSession,
          'Backspace',
          this.inputBuffer
        );
      }
    }
  }

  private async handleEnterKey(): Promise<void> {
    const targetWord = this.getCurrentTargetWord();
    if (targetWord && this.inputBuffer.length > 0) {
      await this.completeCurrentWord();
    }
  }

  // =============================================================================
  // WORD MANAGEMENT
  // =============================================================================

  private selectNewWords(): void {
    if (!this.wordManager || !this.config) return;

    const selection = this.wordManager.selectWords({
      difficulty: this.config.difficulty,
      playerLevel: 1,
      round: this.state.round,
      timeRemaining: this.state.timeLeft,
      previousWords: [],
      avoidRecentWords: true,
    });

    this.stateManager.updateCurrentWords({
      attack: selection.attack,
      heal: selection.heal,
      guard: selection.guard,
    });

    // Start typing session for first available word
    const firstWord = selection.attack || selection.heal;
    if (firstWord) {
      this.currentTypingSession = this.inputValidator.createTypingSession(
        firstWord,
        selection.attack ? 'ATTACK' : 'HEAL'
      );
    }
  }

  private getCurrentTargetWord(): import('./types').Word | null {
    if (this.state.locked) {
      return this.state.currentWords[this.state.locked] || null;
    }

    // Default to attack word if nothing is locked
    return this.state.currentWords.attack || null;
  }

  private async completeCurrentWord(): Promise<void> {
    if (!this.currentTypingSession) return;

    const completedSession = this.inputValidator.completeTypingSession(
      this.currentTypingSession
    );
    const metrics = this.inputValidator.validateCompletedWord(completedSession);
    const completedWord = this.inputValidator.createCompletedWord(
      completedSession,
      metrics
    );

    // Determine action type
    const actionType = this.getActionTypeForCurrentWord();

    // Execute the appropriate action
    let result;
    switch (actionType) {
      case 'ATTACK':
        result = await this.executeAttack(completedWord);
        break;
      case 'HEAL':
        result = await this.executeHeal(completedWord);
        break;
      case 'GUARD':
        result = await this.executeGuard(completedWord);
        break;
    }

    // Clear input and select new words
    this.inputBuffer = '';
    this.currentTypingSession = null;
    this.selectNewWords();

    this.emit('word-completed', { completedWord, result });
  }

  private getActionTypeForCurrentWord(): ActionType {
    if (this.state.locked) {
      return this.state.locked as ActionType;
    }
    return 'ATTACK'; // Default
  }

  // =============================================================================
  // UI UPDATES
  // =============================================================================

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async waitForSceneReady(): Promise<void> {
    return new Promise(resolve => {
      const checkScene = () => {
        if (this.phaserGame && this.phaserGame.scene.isActive('GameScene')) {
          // Get reference to the GameScene instance
          this.gameScene = this.phaserGame.scene.getScene('GameScene');

          // Store reference to adapter in game object for scene access
          (
            this.phaserGame as Phaser.Game & { adapter: PhaserAdapter }
          ).adapter = this;

          resolve();
        } else {
          setTimeout(checkScene, 100);
        }
      };
      checkScene();
    });
  }

  private startGameTimer(): void {
    if (!this.config) return;

    const interval = setInterval(() => {
      if (this.state.status === 'PLAYING' && this.state.timeLeft > 0) {
        this.setState({ timeLeft: this.state.timeLeft - 1 });
      } else {
        clearInterval(interval);
        this.checkGameOver();
      }
    }, 1000);
  }

  private setupEventListeners(): void {
    // Listen to state changes from state manager
    this.stateManager.subscribe(state => {
      this.state = state;

      // Update GameScene with new state
      if (this.gameScene) {
        this.gameScene.updateGameState(state);
      }
    });
  }

  // =============================================================================
  // RESIZE HANDLING
  // =============================================================================

  private setupResizeHandling(): void {
    if (!this.element || !this.phaserGame) return;

    // Set up ResizeObserver for responsive behavior
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.handleResize(width, height);
      }
    });

    this.resizeObserver.observe(this.element);

    // Also listen to window resize as fallback
    window.addEventListener('resize', () => {
      if (this.element) {
        const rect = this.element.getBoundingClientRect();
        this.handleResize(rect.width, rect.height);
      }
    });
  }

  private handleResize(containerWidth: number, containerHeight: number): void {
    if (!this.phaserGame || !this.config) return;

    // Calculate the best fit while maintaining aspect ratio
    const gameAspectRatio = this.config.width / this.config.height;
    const containerAspectRatio = containerWidth / containerHeight;

    let newWidth: number;
    let newHeight: number;

    if (containerAspectRatio > gameAspectRatio) {
      // Container is wider than game aspect ratio
      newHeight = containerHeight;
      newWidth = newHeight * gameAspectRatio;
    } else {
      // Container is taller than game aspect ratio
      newWidth = containerWidth;
      newHeight = newWidth / gameAspectRatio;
    }

    // Update Phaser game size
    this.phaserGame.scale.resize(newWidth, newHeight);

    // Notify GameScene about resize if needed
    if (this.gameScene) {
      this.gameScene.events.emit('resize', {
        width: newWidth,
        height: newHeight,
      });
    }
  }

  // =============================================================================
  // PERFORMANCE MONITORING
  // =============================================================================

  private startPerformanceMonitoring(): void {
    if (!this.phaserGame) return;

    // Update performance metrics each frame
    this.phaserGame.events.on('step', () => {
      this.performanceMonitor.update();
    });

    // Log performance summary every 10 seconds in development
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        this.performanceMonitor.logPerformanceSummary();
      }, 10000);
    }
  }

  private stopPerformanceMonitoring(): void {
    if (this.phaserGame) {
      this.phaserGame.events.off('step');
    }
    this.performanceMonitor.reset();
  }

  // =============================================================================
  // IMPROVED INPUT HANDLING
  // =============================================================================

  private shouldPreventDefault(key: string): boolean {
    // Prevent default for keys we handle in the game
    const gameKeys = /^[a-zA-Z]$|^Backspace$|^Enter$|^Space$/;
    return gameKeys.test(key);
  }

  private isValidGameKeystroke(key: string): boolean {
    // Only allow English letters, Backspace, Enter, and Space
    return /^[a-zA-Z]$/.test(key) || ['Backspace', 'Enter', ' '].includes(key);
  }
}
