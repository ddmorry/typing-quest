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

/**
 * Phaser-specific implementation of GameAdapter
 * Integrates game logic with Phaser 3 rendering engine
 */

export class PhaserAdapter extends GameAdapter {
  private phaserGame: Phaser.Game | null = null;
  private gameScene: Phaser.Scene | null = null;
  private stateManager: GameStateManager;
  private eventBus: EventBus;
  private wordManager: WordManager | null = null;
  private inputValidator: InputValidator;
  private currentTypingSession: TypingSession | null = null;

  // Performance tracking
  private performanceMetrics: PerformanceMetrics = {
    fps: 60,
    averageFPS: 60,
    memoryUsage: 0,
    renderTime: 0,
    updateTime: 0,
  };

  // Input handling
  private inputBuffer = '';
  private keyboardEnabled = false;

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

      // Create Phaser game configuration
      const phaserConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: config.width,
        height: config.height,
        parent: element,
        backgroundColor: '#2c3e50',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        fps: {
          target: 60,
          forceSetTimeOut: true,
        },
        scale: {
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.NO_CENTER,
          width: config.width,
          height: config.height,
        },
        scene: {
          key: 'GameScene',
          preload: function(this: Phaser.Scene) {
            // Basic loading
            this.load.on('complete', () => {
              console.log('Phaser assets loaded');
            });
          },
          create: function(this: Phaser.Scene) {
            const adapter = (this.game as any).adapter as PhaserAdapter;
            if (adapter) {
              adapter.gameScene = this;
            }

            // Create basic UI elements
            this.add.text(400, 50, 'Typing Quest', {
              fontSize: '32px',
              color: '#ffffff',
            }).setOrigin(0.5);

            // HP bars (placeholder)
            const playerHPBar = this.add.graphics();
            const enemyHPBar = this.add.graphics();
            
            (this.game as any).playerHPBar = playerHPBar;
            (this.game as any).enemyHPBar = enemyHPBar;

            // Word display areas
            const wordDisplays = {
              attack: this.add.text(200, 300, '', { fontSize: '24px', color: '#ff6b6b' }),
              heal: this.add.text(600, 300, '', { fontSize: '24px', color: '#4ecdc4' }),
              guard: this.add.text(400, 400, '', { fontSize: '24px', color: '#ffe66d' }),
            };

            (this.game as any).wordDisplays = wordDisplays;

            console.log('Phaser scene created');
          },
          update: function(this: Phaser.Scene) {
            const adapter = (this.game as any).adapter as PhaserAdapter;
            
            if (!adapter || !adapter.isRunning()) return;

            // Update HP bars
            adapter.updateHPBars(this);
            
            // Update word displays
            adapter.updateWordDisplays(this);
            
            // Check for game over
            adapter.checkGameOver();
          },
        },
      };

      // Create Phaser game instance
      this.phaserGame = new Phaser.Game(phaserConfig);
      
      // Attach this adapter to the game for scene access
      (this.phaserGame as any).adapter = this;
      
      // Wait for scene to be ready
      await this.waitForSceneReady();

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
      // Validate keystroke
      const validation = this.inputValidator.validateKeystroke(
        key,
        this.inputBuffer,
        this.getCurrentTargetWord()?.text || '',
        Date.now()
      );

      if (!validation.valid) {
        this.emit('error', { 
          error: new Error(`Invalid keystroke: ${validation.errors.join(', ')}`), 
          context: 'processKeystroke' 
        });
        return;
      }

      // Handle special keys
      if (key === 'Backspace') {
        this.handleBackspace();
        return;
      }

      if (key === 'Enter') {
        await this.handleEnterKey();
        return;
      }

      // Handle regular character input
      if (this.isValidKeystroke(key)) {
        this.handleCharacterInput(key);
      }
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'processKeystroke' });
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
        enemyHp: result.enemyHpAfter 
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
        playerHp: result.playerHpAfter 
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

      const calculation = calculateGuardEffectiveness(wordData, incomingDamage, config);
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
        const newPlayerHp = Math.max(0, this.state.hp.player - result.damageReceived);
        await this.stateManager.updateHP({ player: newPlayerHp });
      }

      // Emit events
      this.emit('action-executed', { result });
      this.emit('guard-executed', { 
        blocked: result.blocked, 
        damageBlocked: result.damageBlocked 
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
    if (this.phaserGame) {
      const game = this.phaserGame;
      
      this.performanceMetrics = {
        fps: Math.round(game.loop.actualFps),
        averageFPS: Math.round(game.loop.actualFps), // TODO: Calculate actual average
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        renderTime: game.loop.delta,
        updateTime: game.loop.delta,
      };
    }

    return { ...this.performanceMetrics };
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
    
    // Set up keyboard input handling
    const keyboard = this.gameScene.input.keyboard;
    
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.keyboardEnabled) {
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

    const completedSession = this.inputValidator.completeTypingSession(this.currentTypingSession);
    const metrics = this.inputValidator.validateCompletedWord(completedSession);
    const completedWord = this.inputValidator.createCompletedWord(completedSession, metrics);

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

  private updateHPBars(scene: Phaser.Scene): void {
    const playerHPBar = (scene.game as any).playerHPBar as Phaser.GameObjects.Graphics;
    const enemyHPBar = (scene.game as any).enemyHPBar as Phaser.GameObjects.Graphics;

    if (playerHPBar && enemyHPBar) {
      // Clear previous bars
      playerHPBar.clear();
      enemyHPBar.clear();

      // Draw player HP bar
      const playerHPPercent = this.state.hp.player / this.state.hp.playerMax;
      playerHPBar.fillStyle(0x4ecdc4);
      playerHPBar.fillRect(50, 100, 200 * playerHPPercent, 20);

      // Draw enemy HP bar
      const enemyHPPercent = this.state.hp.enemy / this.state.hp.enemyMax;
      enemyHPBar.fillStyle(0xff6b6b);
      enemyHPBar.fillRect(550, 100, 200 * enemyHPPercent, 20);
    }
  }

  private updateWordDisplays(scene: Phaser.Scene): void {
    const wordDisplays = (scene.game as any).wordDisplays;

    if (wordDisplays) {
      wordDisplays.attack.setText(this.state.currentWords.attack.text || '');
      wordDisplays.heal.setText(this.state.currentWords.heal.text || '');
      wordDisplays.guard?.setText(this.state.currentWords.guard?.text || '');
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async waitForSceneReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkScene = () => {
        if (this.phaserGame && this.phaserGame.scene.isActive('GameScene')) {
          // Store reference to adapter in game object for scene access
          (this.phaserGame as any).adapter = this;
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
    this.stateManager.subscribe((state) => {
      this.state = state;
    });
  }
}