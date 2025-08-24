import { GameStateManager } from '@/lib/game/state/GameStateManager';
import { EventBus } from '@/lib/game/events/EventBus';
import type { GameState, ActionResult, HealthPoints } from '@/lib/game/types';

describe('GameStateManager', () => {
  let gameStateManager: GameStateManager;
  let eventBus: EventBus;
  let initialState: GameState;

  beforeEach(() => {
    eventBus = new EventBus({ enableLogging: false });
    
    initialState = {
      status: 'LOADING',
      hp: {
        player: 100,
        enemy: 100,
        playerMax: 100,
        enemyMax: 100,
      },
      currentWords: {
        heal: { id: '1', text: 'heal', level: 1, length: 4 },
        attack: { id: '2', text: 'attack', level: 2, length: 6 },
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

    gameStateManager = new GameStateManager(initialState, eventBus);
  });

  afterEach(() => {
    gameStateManager.destroy();
    eventBus.destroy();
  });

  describe('State Access', () => {
    it('should return current state', () => {
      const state = gameStateManager.getState();
      
      expect(state).toEqual(initialState);
      expect(state).not.toBe(initialState); // Should be a copy
    });

    it('should notify subscribers of state changes', (done) => {
      const unsubscribe = gameStateManager.subscribe((state) => {
        expect(state.combo).toBe(5);
        unsubscribe();
        done();
      });

      gameStateManager.updateState({ combo: 5 }, 'test');
    });
  });

  describe('State Updates', () => {
    it('should update state successfully', () => {
      const result = gameStateManager.updateState({ combo: 10 }, 'combo-test');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(gameStateManager.getState().combo).toBe(10);
    });

    it('should validate state transitions', () => {
      // Try invalid status transition
      gameStateManager.updateState({ status: 'READY' }, 'valid-transition');
      const invalidResult = gameStateManager.updateState({ status: 'PLAYING' }, 'skip-to-playing');

      expect(gameStateManager.getState().status).toBe('READY'); // Should remain READY
    });

    it('should reject invalid HP values', () => {
      const result = gameStateManager.updateState({ 
        hp: { ...initialState.hp, player: -10 } 
      }, 'invalid-hp');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Player HP out of bounds: -10');
    });

    it('should reject negative combo values', () => {
      const result = gameStateManager.updateState({ combo: -5 }, 'negative-combo');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Combo cannot be negative: -5');
    });

    it('should reject out-of-bounds accuracy', () => {
      const result = gameStateManager.updateState({ 
        stats: { ...initialState.stats, accuracy: 1.5 } 
      }, 'invalid-accuracy');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Accuracy out of bounds: 1.5');
    });

    it('should emit state-change events', (done) => {
      eventBus.on('state-change', (data) => {
        expect(data.oldState.combo).toBe(0);
        expect(data.newState.combo).toBe(7);
        done();
      });

      gameStateManager.updateState({ combo: 7 }, 'event-test');
    });
  });

  describe('Batch Updates', () => {
    it('should apply multiple updates atomically', () => {
      const updates = [
        { updates: { combo: 5 }, trigger: 'update1' },
        { updates: { timeLeft: 250 }, trigger: 'update2' },
        { updates: { round: 2 }, trigger: 'update3' },
      ];

      const result = gameStateManager.batchUpdate(updates);

      expect(result.valid).toBe(true);
      const state = gameStateManager.getState();
      expect(state.combo).toBe(5);
      expect(state.timeLeft).toBe(250);
      expect(state.round).toBe(2);
    });

    it('should reject batch if any update is invalid', () => {
      const updates = [
        { updates: { combo: 5 }, trigger: 'valid' },
        { updates: { hp: { ...initialState.hp, player: -50 } }, trigger: 'invalid' },
        { updates: { round: 2 }, trigger: 'valid2' },
      ];

      const result = gameStateManager.batchUpdate(updates);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // State should remain unchanged
      const state = gameStateManager.getState();
      expect(state.combo).toBe(0);
      expect(state.round).toBe(1);
    });
  });

  describe('Specialized Updates', () => {
    describe('updateHP', () => {
      it('should update HP with bounds checking', () => {
        const result = gameStateManager.updateHP({ player: 80, enemy: 60 });

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.hp.player).toBe(80);
        expect(state.hp.enemy).toBe(60);
      });

      it('should clamp HP to valid ranges', () => {
        const result = gameStateManager.updateHP({ player: 150, enemy: -10 });

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.hp.player).toBe(100); // Clamped to max
        expect(state.hp.enemy).toBe(0);   // Clamped to min
      });
    });

    describe('updateStats', () => {
      it('should update stats with validation', () => {
        const result = gameStateManager.updateStats({ 
          wpm: 65,
          accuracy: 0.95,
          totalDamage: 100,
        });

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.stats.wpm).toBe(65);
        expect(state.stats.accuracy).toBe(0.95);
        expect(state.stats.totalDamage).toBe(100);
      });

      it('should prevent negative stats', () => {
        const result = gameStateManager.updateStats({ totalDamage: -50 });

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.stats.totalDamage).toBe(0); // Corrected to 0
      });

      it('should clamp accuracy between 0 and 1', () => {
        const result = gameStateManager.updateStats({ accuracy: 1.5 });

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.stats.accuracy).toBe(1.0); // Clamped to max
      });
    });

    describe('applyActionResult', () => {
      it('should apply attack result correctly', () => {
        const attackResult: ActionResult = {
          success: true,
          type: 'ATTACK',
          word: { id: '1', text: 'test', level: 2, length: 4, typedText: 'test', timeMs: 1000, errors: 0, accuracy: 1.0, wpm: 60, score: 100 },
          value: 25,
          critical: false,
          combo: 3,
        };

        const result = gameStateManager.applyActionResult(attackResult);

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.combo).toBe(3);
        expect(state.hp.enemy).toBe(75); // 100 - 25
        expect(state.stats.attackCount).toBe(1);
        expect(state.stats.totalDamage).toBe(25);
        expect(state.stats.wordsCompleted).toBe(1);
      });

      it('should apply heal result correctly', () => {
        // First damage the player
        gameStateManager.updateHP({ player: 70 });

        const healResult: ActionResult = {
          success: true,
          type: 'HEAL',
          word: { id: '1', text: 'heal', level: 1, length: 4, typedText: 'heal', timeMs: 1200, errors: 0, accuracy: 1.0, wpm: 50, score: 80 },
          value: 20,
          critical: true,
          combo: 2,
        };

        const result = gameStateManager.applyActionResult(healResult);

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.combo).toBe(2);
        expect(state.hp.player).toBe(90); // 70 + 20
        expect(state.stats.healCount).toBe(1);
        expect(state.stats.totalHealing).toBe(20);
      });

      it('should apply guard result correctly', () => {
        const guardResult: ActionResult = {
          success: true,
          type: 'GUARD',
          word: { id: '1', text: 'block', level: 3, length: 5, typedText: 'block', timeMs: 800, errors: 0, accuracy: 1.0, wpm: 75, score: 120 },
          value: 30,
          critical: false,
          combo: 1,
        };

        const result = gameStateManager.applyActionResult(guardResult);

        expect(result.valid).toBe(true);
        const state = gameStateManager.getState();
        expect(state.combo).toBe(1);
        expect(state.stats.guardCount).toBe(1);
      });

      it('should update max combo correctly', () => {
        const result1: ActionResult = {
          success: true,
          type: 'ATTACK',
          word: { id: '1', text: 'test', level: 2, length: 4, typedText: 'test', timeMs: 1000, errors: 0, accuracy: 1.0, wpm: 60, score: 100 },
          value: 25,
          critical: false,
          combo: 5,
        };

        const result2: ActionResult = {
          success: true,
          type: 'ATTACK',
          word: { id: '2', text: 'test2', level: 2, length: 5, typedText: 'test2', timeMs: 1100, errors: 0, accuracy: 1.0, wpm: 60, score: 100 },
          value: 30,
          critical: true,
          combo: 8,
        };

        gameStateManager.applyActionResult(result1);
        gameStateManager.applyActionResult(result2);

        const state = gameStateManager.getState();
        expect(state.stats.maxCombo).toBe(8);
      });
    });

    describe('setWordLock', () => {
      it('should lock/unlock words correctly', () => {
        const lockResult = gameStateManager.setWordLock('attack');
        expect(lockResult.valid).toBe(true);
        expect(gameStateManager.getState().locked).toBe('attack');

        const unlockResult = gameStateManager.setWordLock(null);
        expect(unlockResult.valid).toBe(true);
        expect(gameStateManager.getState().locked).toBe(null);
      });

      it('should handle duplicate locks gracefully', () => {
        gameStateManager.setWordLock('heal');
        const result = gameStateManager.setWordLock('heal');
        
        expect(result.valid).toBe(true);
        expect(gameStateManager.getState().locked).toBe('heal');
      });
    });
  });

  describe('State History', () => {
    it('should track state transitions', () => {
      gameStateManager.updateState({ combo: 1 }, 'first');
      gameStateManager.updateState({ combo: 2 }, 'second');

      const history = gameStateManager.getStateHistory();
      expect(history).toHaveLength(2);
      expect(history[0].trigger).toBe('first');
      expect(history[1].trigger).toBe('second');
    });

    it('should return last transition', () => {
      gameStateManager.updateState({ combo: 5 }, 'test-trigger');

      const lastTransition = gameStateManager.getLastTransition();
      expect(lastTransition).toBeTruthy();
      expect(lastTransition?.trigger).toBe('test-trigger');
      expect(lastTransition?.to.combo).toBe(5);
    });

    it('should limit history size', () => {
      const stateManager = new GameStateManager(
        initialState, 
        eventBus, 
        { maxHistorySize: 3 }
      );

      for (let i = 0; i < 5; i++) {
        stateManager.updateState({ combo: i }, `update-${i}`);
      }

      const history = stateManager.getStateHistory();
      expect(history).toHaveLength(3);
      expect(history[0].trigger).toBe('update-2');
      expect(history[2].trigger).toBe('update-4');

      stateManager.destroy();
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset to initial state', () => {
      gameStateManager.updateState({ combo: 10, timeLeft: 100 }, 'modify');
      
      gameStateManager.reset();
      
      const state = gameStateManager.getState();
      expect(state.combo).toBe(0);
      expect(state.timeLeft).toBe(300);
      expect(state.status).toBe('LOADING');
    });

    it('should reset to new initial state if provided', () => {
      const newInitialState = { 
        ...initialState, 
        combo: 5, 
        timeLeft: 200,
        status: 'READY' as const
      };
      
      gameStateManager.reset(newInitialState);
      
      const state = gameStateManager.getState();
      expect(state.combo).toBe(5);
      expect(state.timeLeft).toBe(200);
      expect(state.status).toBe('READY');
    });

    it('should emit state-change on reset', (done) => {
      eventBus.on('state-change', (data) => {
        expect(data.newState.combo).toBe(0);
        done();
      });

      gameStateManager.updateState({ combo: 10 }, 'setup');
      gameStateManager.reset();
    });

    it('should clean up resources on destroy', () => {
      const subscriberFn = jest.fn();
      const unsubscribe = gameStateManager.subscribe(subscriberFn);

      gameStateManager.destroy();
      gameStateManager.updateState({ combo: 5 }, 'after-destroy');

      expect(subscriberFn).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle subscriber errors gracefully', () => {
      const faultySubscriber = jest.fn(() => {
        throw new Error('Subscriber error');
      });
      const validSubscriber = jest.fn();

      gameStateManager.subscribe(faultySubscriber);
      gameStateManager.subscribe(validSubscriber);

      // Should not throw error
      expect(() => {
        gameStateManager.updateState({ combo: 1 }, 'test');
      }).not.toThrow();

      expect(validSubscriber).toHaveBeenCalled();
    });

    it('should validate word data in updateCurrentWords', () => {
      const invalidWords = {
        attack: { id: '', text: '', level: 0 as any, length: 0 },
      };

      const result = gameStateManager.updateCurrentWords(invalidWords);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Word has empty text: ');
      expect(result.errors).toContain('Word level out of bounds: 0');
    });
  });
});