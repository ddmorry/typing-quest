import { GameState, Word, PerformanceMetrics } from '../types';

/**
 * Main game scene for Phaser 3
 * Handles rendering, animations, and visual effects for the typing RPG
 */

export interface GameSceneElements {
  // UI Elements
  titleText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  comboText: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
  
  // HP Bars
  playerHPBar: Phaser.GameObjects.Graphics;
  playerHPBackground: Phaser.GameObjects.Graphics;
  enemyHPBar: Phaser.GameObjects.Graphics;
  enemyHPBackground: Phaser.GameObjects.Graphics;
  
  // Word Displays
  attackWordText: Phaser.GameObjects.Text;
  healWordText: Phaser.GameObjects.Text;
  guardWordText: Phaser.GameObjects.Text;
  inputText: Phaser.GameObjects.Text;
  
  // Characters
  playerSprite: Phaser.GameObjects.Sprite;
  enemySprite: Phaser.GameObjects.Sprite;
  
  // Effects
  particleManager?: Phaser.GameObjects.Particles.ParticleEmitter;
  damageNumbers: Phaser.GameObjects.Group;
}

export class GameScene extends Phaser.Scene {
  private elements: Partial<GameSceneElements> = {};
  private gameState: GameState | null = null;
  private currentInput = '';
  private animationTweens: Phaser.Tweens.Tween[] = [];

  // Scene configuration
  private readonly SCENE_WIDTH = 800;
  private readonly SCENE_HEIGHT = 600;
  
  // Layout constants
  private readonly LAYOUT = {
    // Header
    TITLE_Y: 40,
    TIMER_Y: 40,
    COMBO_Y: 40,
    SCORE_Y: 40,
    
    // HP Bars
    PLAYER_HP_X: 50,
    PLAYER_HP_Y: 80,
    ENEMY_HP_X: 550,
    ENEMY_HP_Y: 80,
    HP_BAR_WIDTH: 200,
    HP_BAR_HEIGHT: 20,
    
    // Characters
    PLAYER_X: 150,
    PLAYER_Y: 250,
    ENEMY_X: 650,
    ENEMY_Y: 250,
    
    // Words
    ATTACK_WORD_X: 150,
    ATTACK_WORD_Y: 400,
    HEAL_WORD_X: 400,
    HEAL_WORD_Y: 400,
    GUARD_WORD_X: 650,
    GUARD_WORD_Y: 400,
    INPUT_X: 400,
    INPUT_Y: 500,
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  // =============================================================================
  // PHASER LIFECYCLE METHODS
  // =============================================================================

  preload(): void {
    // Load game assets
    this.loadAssets();
  }

  create(): void {
    // Initialize scene elements
    this.createBackground();
    this.createUI();
    this.createCharacters();
    this.createEffects();
    
    // Set up input handling
    this.setupInput();
    
    console.log('GameScene created successfully');
  }

  update(time: number, delta: number): void {
    // Update animations and effects
    this.updateEffects(delta);
    
    // Update UI if state has changed
    this.updateUI();
  }

  // =============================================================================
  // ASSET LOADING
  // =============================================================================

  private loadAssets(): void {
    // Create simple colored rectangles for sprites (can be replaced with actual assets)
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('enemy', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    
    // Placeholder for particle textures
    this.load.image('spark', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  // =============================================================================
  // SCENE CREATION
  // =============================================================================

  private createBackground(): void {
    // Create gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x2c3e50, 0x34495e, 0x2c3e50, 0x34495e, 1);
    graphics.fillRect(0, 0, this.SCENE_WIDTH, this.SCENE_HEIGHT);
  }

  private createUI(): void {
    // Title
    this.elements.titleText = this.add.text(this.SCENE_WIDTH / 2, this.LAYOUT.TITLE_Y, 'Typing Quest', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial Black',
    }).setOrigin(0.5);

    // Timer
    this.elements.timerText = this.add.text(this.SCENE_WIDTH - 50, this.LAYOUT.TIMER_Y, '5:00', {
      fontSize: '20px',
      color: '#e74c3c',
      fontFamily: 'Arial',
    }).setOrigin(1, 0.5);

    // Combo
    this.elements.comboText = this.add.text(50, this.LAYOUT.COMBO_Y, 'Combo: 0', {
      fontSize: '16px',
      color: '#f39c12',
      fontFamily: 'Arial',
    }).setOrigin(0, 0.5);

    // Score
    this.elements.scoreText = this.add.text(this.SCENE_WIDTH / 2, this.LAYOUT.SCORE_Y + 30, 'Score: 0', {
      fontSize: '16px',
      color: '#3498db',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // HP Bars
    this.createHPBars();

    // Word display areas
    this.createWordDisplays();

    // Input display
    this.elements.inputText = this.add.text(this.LAYOUT.INPUT_X, this.LAYOUT.INPUT_Y, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Courier New',
      backgroundColor: '#34495e',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5);
  }

  private createHPBars(): void {
    // Player HP Bar
    this.elements.playerHPBackground = this.add.graphics();
    this.elements.playerHPBar = this.add.graphics();
    
    // Enemy HP Bar
    this.elements.enemyHPBackground = this.add.graphics();
    this.elements.enemyHPBar = this.add.graphics();

    // HP Labels
    this.add.text(this.LAYOUT.PLAYER_HP_X, this.LAYOUT.PLAYER_HP_Y - 25, 'Player HP', {
      fontSize: '14px',
      color: '#ffffff',
    });

    this.add.text(this.LAYOUT.ENEMY_HP_X, this.LAYOUT.ENEMY_HP_Y - 25, 'Enemy HP', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0);
  }

  private createWordDisplays(): void {
    // Attack word (red)
    this.elements.attackWordText = this.add.text(this.LAYOUT.ATTACK_WORD_X, this.LAYOUT.ATTACK_WORD_Y, '', {
      fontSize: '20px',
      color: '#e74c3c',
      fontFamily: 'Courier New',
      backgroundColor: '#2c3e50',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    this.add.text(this.LAYOUT.ATTACK_WORD_X, this.LAYOUT.ATTACK_WORD_Y - 30, 'ATTACK', {
      fontSize: '12px',
      color: '#e74c3c',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Heal word (green)
    this.elements.healWordText = this.add.text(this.LAYOUT.HEAL_WORD_X, this.LAYOUT.HEAL_WORD_Y, '', {
      fontSize: '20px',
      color: '#27ae60',
      fontFamily: 'Courier New',
      backgroundColor: '#2c3e50',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    this.add.text(this.LAYOUT.HEAL_WORD_X, this.LAYOUT.HEAL_WORD_Y - 30, 'HEAL', {
      fontSize: '12px',
      color: '#27ae60',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Guard word (yellow)
    this.elements.guardWordText = this.add.text(this.LAYOUT.GUARD_WORD_X, this.LAYOUT.GUARD_WORD_Y, '', {
      fontSize: '20px',
      color: '#f1c40f',
      fontFamily: 'Courier New',
      backgroundColor: '#2c3e50',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    this.add.text(this.LAYOUT.GUARD_WORD_X, this.LAYOUT.GUARD_WORD_Y - 30, 'GUARD', {
      fontSize: '12px',
      color: '#f1c40f',
      fontFamily: 'Arial',
    }).setOrigin(0.5);
  }

  private createCharacters(): void {
    // Player character (placeholder rectangle)
    this.elements.playerSprite = this.add.sprite(this.LAYOUT.PLAYER_X, this.LAYOUT.PLAYER_Y, 'player');
    this.elements.playerSprite.setDisplaySize(60, 80);
    this.elements.playerSprite.setTint(0x3498db); // Blue

    // Enemy character (placeholder rectangle)
    this.elements.enemySprite = this.add.sprite(this.LAYOUT.ENEMY_X, this.LAYOUT.ENEMY_Y, 'enemy');
    this.elements.enemySprite.setDisplaySize(60, 80);
    this.elements.enemySprite.setTint(0xe74c3c); // Red

    // Character labels
    this.add.text(this.LAYOUT.PLAYER_X, this.LAYOUT.PLAYER_Y + 60, 'Hero', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(this.LAYOUT.ENEMY_X, this.LAYOUT.ENEMY_Y + 60, 'Enemy', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  private createEffects(): void {
    // Particle system for effects - simplified for now
    try {
      const particles = this.add.particles(0, 0, 'spark', {
        scale: { start: 0.5, end: 0 },
        speed: { min: 50, max: 100 },
        lifespan: 300,
        emitting: false,
      });
      
      // Note: Particle system will be created but we'll skip the complex emitter management for now
      this.elements.particleManager = particles as any;
    } catch (error) {
      console.warn('Could not create particle system:', error);
    }

    // Group for floating damage numbers
    this.elements.damageNumbers = this.add.group();
  }

  private setupInput(): void {
    // Input handling is managed by the PhaserAdapter
    // Scene just needs to be prepared to receive input events
  }

  // =============================================================================
  // PUBLIC UPDATE METHODS
  // =============================================================================

  updateGameState(state: GameState): void {
    this.gameState = state;
  }

  updateCurrentInput(input: string): void {
    this.currentInput = input;
    if (this.elements.inputText) {
      this.elements.inputText.setText(input);
    }
  }

  // =============================================================================
  // ANIMATION METHODS
  // =============================================================================

  playAttackAnimation(): void {
    if (!this.elements.playerSprite) return;

    // Player attack animation
    const attackTween = this.tweens.add({
      targets: this.elements.playerSprite,
      x: this.LAYOUT.PLAYER_X + 50,
      duration: 200,
      ease: 'Power2',
      yoyo: true,
      onComplete: () => {
        // Add screen shake
        this.cameras.main.shake(100, 0.01);
      }
    });

    this.animationTweens.push(attackTween);
  }

  playHealAnimation(): void {
    if (!this.elements.playerSprite) return;

    // Healing glow effect
    const healTween = this.tweens.add({
      targets: this.elements.playerSprite,
      scale: 1.2,
      duration: 300,
      ease: 'Power2',
      yoyo: true,
    });

    // Temporary green tint
    this.elements.playerSprite.setTint(0x27ae60);
    this.time.delayedCall(300, () => {
      if (this.elements.playerSprite) {
        this.elements.playerSprite.setTint(0x3498db);
      }
    });

    this.animationTweens.push(healTween);
  }

  playGuardAnimation(): void {
    if (!this.elements.playerSprite) return;

    // Shield effect
    const shield = this.add.graphics();
    shield.fillStyle(0xf1c40f, 0.5);
    shield.fillCircle(this.LAYOUT.PLAYER_X, this.LAYOUT.PLAYER_Y, 50);

    this.tweens.add({
      targets: shield,
      alpha: 0,
      duration: 500,
      onComplete: () => shield.destroy()
    });
  }

  playDamageEffect(damage: number, isCritical: boolean): void {
    if (!this.elements.enemySprite || !this.elements.particleManager) return;

    // Enemy hurt animation
    const hurtTween = this.tweens.add({
      targets: this.elements.enemySprite,
      x: this.LAYOUT.ENEMY_X - 20,
      duration: 100,
      ease: 'Power2',
      yoyo: true,
    });

    // Damage particles
    this.elements.particleManager.setPosition(this.LAYOUT.ENEMY_X, this.LAYOUT.ENEMY_Y);
    this.elements.particleManager.explode(10);

    // Floating damage number
    this.createFloatingText(
      this.LAYOUT.ENEMY_X,
      this.LAYOUT.ENEMY_Y - 30,
      isCritical ? `${damage}!` : damage.toString(),
      isCritical ? '#f39c12' : '#e74c3c'
    );

    this.animationTweens.push(hurtTween);
  }

  playHealEffect(healing: number, isCritical: boolean): void {
    if (!this.elements.playerSprite) return;

    // Healing particles
    if (this.elements.particleManager) {
      this.elements.particleManager.setPosition(this.LAYOUT.PLAYER_X, this.LAYOUT.PLAYER_Y);
      this.elements.particleManager.explode(5);
    }

    // Floating healing number
    this.createFloatingText(
      this.LAYOUT.PLAYER_X,
      this.LAYOUT.PLAYER_Y - 30,
      isCritical ? `+${healing}!` : `+${healing}`,
      isCritical ? '#2ecc71' : '#27ae60'
    );
  }

  // =============================================================================
  // PRIVATE UPDATE METHODS
  // =============================================================================

  private updateUI(): void {
    if (!this.gameState) return;

    // Update timer
    if (this.elements.timerText) {
      const minutes = Math.floor(this.gameState.timeLeft / 60);
      const seconds = this.gameState.timeLeft % 60;
      this.elements.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    // Update combo
    if (this.elements.comboText) {
      this.elements.comboText.setText(`Combo: ${this.gameState.combo}`);
    }

    // Update score
    if (this.elements.scoreText) {
      const totalScore = this.gameState.stats.totalDamage + this.gameState.stats.totalHealing;
      this.elements.scoreText.setText(`Score: ${totalScore}`);
    }

    // Update HP bars
    this.updateHPBars();

    // Update word displays
    this.updateWordDisplays();
  }

  private updateHPBars(): void {
    if (!this.gameState || !this.elements.playerHPBar || !this.elements.enemyHPBar) return;

    const { playerHPBar, playerHPBackground, enemyHPBar, enemyHPBackground } = this.elements;

    // Clear previous bars
    playerHPBackground?.clear();
    playerHPBar.clear();
    enemyHPBackground?.clear();
    enemyHPBar.clear();

    // Player HP bar
    playerHPBackground?.fillStyle(0x7f8c8d);
    playerHPBackground?.fillRect(this.LAYOUT.PLAYER_HP_X, this.LAYOUT.PLAYER_HP_Y, this.LAYOUT.HP_BAR_WIDTH, this.LAYOUT.HP_BAR_HEIGHT);

    const playerHPPercent = this.gameState.hp.player / this.gameState.hp.playerMax;
    playerHPBar.fillStyle(0x27ae60);
    playerHPBar.fillRect(
      this.LAYOUT.PLAYER_HP_X,
      this.LAYOUT.PLAYER_HP_Y,
      this.LAYOUT.HP_BAR_WIDTH * playerHPPercent,
      this.LAYOUT.HP_BAR_HEIGHT
    );

    // Enemy HP bar
    enemyHPBackground?.fillStyle(0x7f8c8d);
    enemyHPBackground?.fillRect(this.LAYOUT.ENEMY_HP_X, this.LAYOUT.ENEMY_HP_Y, this.LAYOUT.HP_BAR_WIDTH, this.LAYOUT.HP_BAR_HEIGHT);

    const enemyHPPercent = this.gameState.hp.enemy / this.gameState.hp.enemyMax;
    enemyHPBar.fillStyle(0xe74c3c);
    enemyHPBar.fillRect(
      this.LAYOUT.ENEMY_HP_X,
      this.LAYOUT.ENEMY_HP_Y,
      this.LAYOUT.HP_BAR_WIDTH * enemyHPPercent,
      this.LAYOUT.HP_BAR_HEIGHT
    );

    // HP text
    this.add.text(this.LAYOUT.PLAYER_HP_X + 5, this.LAYOUT.PLAYER_HP_Y + 2, 
      `${this.gameState.hp.player}/${this.gameState.hp.playerMax}`, {
      fontSize: '12px',
      color: '#ffffff',
    }).setDepth(10);

    this.add.text(this.LAYOUT.ENEMY_HP_X + 5, this.LAYOUT.ENEMY_HP_Y + 2,
      `${this.gameState.hp.enemy}/${this.gameState.hp.enemyMax}`, {
      fontSize: '12px',
      color: '#ffffff',
    }).setDepth(10);
  }

  private updateWordDisplays(): void {
    if (!this.gameState) return;

    // Update word texts
    if (this.elements.attackWordText) {
      this.elements.attackWordText.setText(this.gameState.currentWords.attack?.text || '');
      
      // Highlight if locked
      if (this.gameState.locked === 'attack') {
        this.elements.attackWordText.setStyle({ backgroundColor: '#c0392b' });
      } else {
        this.elements.attackWordText.setStyle({ backgroundColor: '#2c3e50' });
      }
    }

    if (this.elements.healWordText) {
      this.elements.healWordText.setText(this.gameState.currentWords.heal?.text || '');
      
      if (this.gameState.locked === 'heal') {
        this.elements.healWordText.setStyle({ backgroundColor: '#1e8449' });
      } else {
        this.elements.healWordText.setStyle({ backgroundColor: '#2c3e50' });
      }
    }

    if (this.elements.guardWordText) {
      this.elements.guardWordText.setText(this.gameState.currentWords.guard?.text || '');
      
      if (this.gameState.locked === 'guard') {
        this.elements.guardWordText.setStyle({ backgroundColor: '#b7950b' });
      } else {
        this.elements.guardWordText.setStyle({ backgroundColor: '#2c3e50' });
      }
    }
  }

  private updateEffects(delta: number): void {
    // Update floating text animations
    if (this.elements.damageNumbers) {
      this.elements.damageNumbers.children.entries.forEach((text: any) => {
        text.y -= delta * 0.1;
        text.alpha -= delta * 0.001;
        
        if (text.alpha <= 0) {
          this.elements.damageNumbers?.remove(text);
          text.destroy();
        }
      });
    }
  }

  private createFloatingText(x: number, y: number, text: string, color: string): void {
    if (!this.elements.damageNumbers) return;

    const floatingText = this.add.text(x, y, text, {
      fontSize: '20px',
      color: color,
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.elements.damageNumbers.add(floatingText);

    // Animate upward movement
    this.tweens.add({
      targets: floatingText,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        this.elements.damageNumbers?.remove(floatingText);
        floatingText.destroy();
      }
    });
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  cleanupScene(): void {
    // Clean up animations
    this.animationTweens.forEach(tween => {
      if (tween) {
        tween.destroy();
      }
    });
    this.animationTweens = [];

    // Clean up elements
    Object.values(this.elements).forEach(element => {
      if (element && element.destroy) {
        element.destroy();
      }
    });

    // Call parent scene destroy if available
    if (this.scene && this.scene.stop) {
      this.scene.stop();
    }
  }
}