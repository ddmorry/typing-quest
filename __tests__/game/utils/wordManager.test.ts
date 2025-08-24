import { WordManager } from '@/lib/game/utils/wordManager';
import type { SessionSeed, Word, WordSelection } from '@/lib/game/types';

describe('WordManager', () => {
  let wordManager: WordManager;
  let mockWords: Word[];

  beforeEach(() => {
    mockWords = [
      { id: '1', text: 'cat', level: 1, length: 3, category: 'basic' },
      { id: '2', text: 'dog', level: 1, length: 3, category: 'basic' },
      { id: '3', text: 'house', level: 2, length: 5, category: 'common' },
      { id: '4', text: 'computer', level: 3, length: 8, category: 'advanced' },
      { id: '5', text: 'elephant', level: 2, length: 8, category: 'common' },
      { id: '6', text: 'extraordinary', level: 5, length: 13, category: 'expert' },
      { id: '7', text: 'heal', level: 1, length: 4, category: 'medical' },
      { id: '8', text: 'attack', level: 2, length: 6, category: 'action' },
      { id: '9', text: 'defend', level: 2, length: 6, category: 'defense' },
      { id: '10', text: 'shield', level: 3, length: 6, category: 'defense' },
    ];

    const sessionSeed: SessionSeed = {
      sessionId: 'test-session',
      packId: 'test-pack',
      difficulty: 'NORMAL',
      words: mockWords,
    };

    wordManager = new WordManager(sessionSeed);
  });

  describe('Initialization', () => {
    it('should initialize with valid session seed', () => {
      expect(() => new WordManager({
        sessionId: 'test',
        packId: 'test',
        difficulty: 'EASY',
        words: mockWords,
      })).not.toThrow();
    });

    it('should throw error with empty word pool', () => {
      expect(() => new WordManager({
        sessionId: 'test',
        packId: 'test',
        difficulty: 'EASY',
        words: [],
      })).toThrow('WordManager: Empty word pool');
    });

    it('should validate word structure', () => {
      const invalidWords = [
        { id: '', text: '', level: 0, length: 0 } as any,
      ];

      expect(() => new WordManager({
        sessionId: 'test',
        packId: 'test',
        difficulty: 'EASY',
        words: invalidWords,
      })).toThrow('WordManager: Invalid word structure');
    });

    it('should fix length mismatches', () => {
      const wordsWithMismatch = [
        { id: '1', text: 'test', level: 1, length: 10 }, // Wrong length
      ];

      expect(() => new WordManager({
        sessionId: 'test',
        packId: 'test',
        difficulty: 'EASY',
        words: wordsWithMismatch,
      })).not.toThrow();
    });
  });

  describe('Word Selection', () => {
    const defaultOptions = {
      difficulty: 'NORMAL' as const,
      playerLevel: 1,
      round: 1,
      timeRemaining: 300,
      previousWords: [],
      avoidRecentWords: false,
    };

    it('should select appropriate words for difficulty', () => {
      const easySelection = wordManager.selectWords({
        ...defaultOptions,
        difficulty: 'EASY',
      });

      const hardSelection = wordManager.selectWords({
        ...defaultOptions,
        difficulty: 'HARD',
      });

      // Easy mode should tend towards lower levels
      expect(easySelection.attack.level).toBeLessThanOrEqual(3);
      expect(easySelection.heal.level).toBeLessThanOrEqual(3);

      // Hard mode should allow higher levels
      expect(hardSelection.attack.level).toBeGreaterThanOrEqual(3);
    });

    it('should select different words for attack and heal', () => {
      const selection = wordManager.selectWords(defaultOptions);

      expect(selection.attack.id).not.toBe(selection.heal.id);
      expect(selection.attack.text).not.toBe(selection.heal.text);
    });

    it('should include guard words for higher difficulties', () => {
      const hardSelection = wordManager.selectWords({
        ...defaultOptions,
        difficulty: 'HARD',
      });

      expect(hardSelection.guard).toBeDefined();
    });

    it('should include guard words for later rounds', () => {
      const lateRoundSelection = wordManager.selectWords({
        ...defaultOptions,
        round: 5,
      });

      expect(lateRoundSelection.guard).toBeDefined();
    });

    it('should prefer shorter words for healing', () => {
      const selections = Array.from({ length: 10 }, () => 
        wordManager.selectWords(defaultOptions)
      );

      const avgHealLength = selections.reduce((sum, s) => sum + s.heal.length, 0) / selections.length;
      const avgAttackLength = selections.reduce((sum, s) => sum + s.attack.length, 0) / selections.length;

      // Healing words should tend to be shorter on average
      expect(avgHealLength).toBeLessThanOrEqual(avgAttackLength + 1);
    });

    it('should adapt to player level', () => {
      const beginnerSelection = wordManager.selectWords({
        ...defaultOptions,
        playerLevel: 1,
      });

      const advancedSelection = wordManager.selectWords({
        ...defaultOptions,
        playerLevel: 10,
      });

      // Advanced players should get more challenging words
      const beginnerAvgLevel = (beginnerSelection.attack.level + beginnerSelection.heal.level) / 2;
      const advancedAvgLevel = (advancedSelection.attack.level + advancedSelection.heal.level) / 2;

      expect(advancedAvgLevel).toBeGreaterThanOrEqual(beginnerAvgLevel);
    });

    it('should avoid recent words when enabled', () => {
      // Select words multiple times
      const selection1 = wordManager.selectWords({
        ...defaultOptions,
        avoidRecentWords: true,
        round: 1,
      });
      
      const selection2 = wordManager.selectWords({
        ...defaultOptions,
        avoidRecentWords: true,
        round: 2,
      });

      // Second selection should avoid words from first selection
      expect(selection2.attack.id).not.toBe(selection1.attack.id);
      expect(selection2.heal.id).not.toBe(selection1.heal.id);
    });

    it('should respect length constraints', () => {
      const easySelection = wordManager.selectWords({
        ...defaultOptions,
        difficulty: 'EASY',
      });

      const hardSelection = wordManager.selectWords({
        ...defaultOptions,
        difficulty: 'HARD',
      });

      // Easy mode should have shorter words
      expect(easySelection.attack.length).toBeLessThanOrEqual(8);
      expect(easySelection.heal.length).toBeLessThanOrEqual(8);

      // Hard mode allows longer words
      expect(hardSelection.attack.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Word Lock Manager', () => {
    let lockManager: ReturnType<typeof wordManager.createLockManager>;

    beforeEach(() => {
      // Set up a selection first
      wordManager.selectWords({
        difficulty: 'NORMAL',
        playerLevel: 1,
        round: 1,
        timeRemaining: 300,
        previousWords: [],
        avoidRecentWords: false,
      });

      lockManager = wordManager.createLockManager();
    });

    it('should allow locking valid word types', () => {
      expect(lockManager.canLock('ATTACK')).toBe(true);
      expect(lockManager.canLock('HEAL')).toBe(true);
    });

    it('should lock words successfully', () => {
      const lockResult = lockManager.lock('ATTACK');

      expect(lockResult).toBe(true);
      expect(lockManager.isLocked()).toBe(true);
      expect(lockManager.getLockedType()).toBe('attack');
    });

    it('should prevent multiple locks', () => {
      lockManager.lock('ATTACK');
      const secondLockResult = lockManager.lock('HEAL');

      expect(secondLockResult).toBe(false);
      expect(lockManager.getLockedType()).toBe('attack');
    });

    it('should allow re-locking the same type', () => {
      lockManager.lock('ATTACK');
      const reLockResult = lockManager.lock('ATTACK');

      expect(reLockResult).toBe(true);
      expect(lockManager.getLockedType()).toBe('attack');
    });

    it('should unlock words successfully', () => {
      lockManager.lock('HEAL');
      const unlockResult = lockManager.unlock();

      expect(unlockResult).toBe(true);
      expect(lockManager.isLocked()).toBe(false);
      expect(lockManager.getLockedType()).toBe(null);
    });

    it('should handle unlock when not locked', () => {
      const unlockResult = lockManager.unlock();

      expect(unlockResult).toBe(false);
      expect(lockManager.isLocked()).toBe(false);
    });

    it('should not lock unavailable word types', () => {
      // If no guard word is selected
      const selection = wordManager.getCurrentSelection();
      if (!selection?.guard) {
        expect(lockManager.canLock('GUARD')).toBe(false);
        expect(lockManager.lock('GUARD')).toBe(false);
      }
    });
  });

  describe('Word Pool Management', () => {
    it('should return word by ID', () => {
      const word = wordManager.getWordById('1');
      
      expect(word).toBeTruthy();
      expect(word?.text).toBe('cat');
    });

    it('should return null for non-existent ID', () => {
      const word = wordManager.getWordById('nonexistent');
      
      expect(word).toBe(null);
    });

    it('should provide word pool statistics', () => {
      const stats = wordManager.getWordPoolStats();

      expect(stats.totalWords).toBe(10);
      expect(stats.levelDistribution).toBeDefined();
      expect(stats.categoryDistribution).toBeDefined();
      expect(stats.averageLength).toBeGreaterThan(0);
    });

    it('should track level distribution correctly', () => {
      const stats = wordManager.getWordPoolStats();

      // Check that we have the expected number of each level
      expect(stats.levelDistribution[1]).toBe(3); // cat, dog, heal
      expect(stats.levelDistribution[2]).toBe(4); // house, elephant, attack, defend
      expect(stats.levelDistribution[3]).toBe(2); // computer, shield
      expect(stats.levelDistribution[5]).toBe(1); // extraordinary
    });

    it('should track category distribution', () => {
      const stats = wordManager.getWordPoolStats();

      expect(stats.categoryDistribution['basic']).toBe(2);
      expect(stats.categoryDistribution['common']).toBe(2);
      expect(stats.categoryDistribution['defense']).toBe(2);
    });

    it('should calculate average length correctly', () => {
      const stats = wordManager.getWordPoolStats();
      
      // Manually calculated average: (3+3+5+8+8+13+4+6+6+6) / 10 = 6.2
      expect(stats.averageLength).toBeCloseTo(6.2, 1);
    });
  });

  describe('Reset and State Management', () => {
    it('should reset to initial state', () => {
      // Make some selections
      wordManager.selectWords({
        difficulty: 'NORMAL',
        playerLevel: 1,
        round: 1,
        timeRemaining: 300,
        previousWords: [],
        avoidRecentWords: false,
      });

      const lockManager = wordManager.createLockManager();
      lockManager.lock('ATTACK');

      // Reset
      wordManager.reset();

      expect(wordManager.getCurrentSelection()).toBe(null);
      expect(lockManager.isLocked()).toBe(false);
    });

    it('should maintain word pool after reset', () => {
      wordManager.reset();

      const stats = wordManager.getWordPoolStats();
      expect(stats.totalWords).toBe(10);
    });
  });

  describe('Word Type Preferences', () => {
    it('should prefer medical/heal categories for healing words', () => {
      const selections = Array.from({ length: 20 }, () => 
        wordManager.selectWords({
          difficulty: 'NORMAL',
          playerLevel: 1,
          round: 1,
          timeRemaining: 300,
          previousWords: [],
          avoidRecentWords: false,
        })
      );

      const healMedicalCount = selections.filter(s => s.heal.category === 'medical').length;
      const attackMedicalCount = selections.filter(s => s.attack.category === 'medical').length;

      // Heal words should favor medical category more than attack words
      expect(healMedicalCount).toBeGreaterThanOrEqual(attackMedicalCount);
    });

    it('should prefer action categories for attack words', () => {
      const selections = Array.from({ length: 20 }, () => 
        wordManager.selectWords({
          difficulty: 'NORMAL',
          playerLevel: 1,
          round: 1,
          timeRemaining: 300,
          previousWords: [],
          avoidRecentWords: false,
        })
      );

      const attackActionCount = selections.filter(s => s.attack.category === 'action').length;
      const healActionCount = selections.filter(s => s.heal.category === 'action').length;

      // Attack words should favor action category more than heal words
      expect(attackActionCount).toBeGreaterThanOrEqual(healActionCount);
    });

    it('should prefer defense categories for guard words', () => {
      const selections = Array.from({ length: 20 }, () => 
        wordManager.selectWords({
          difficulty: 'HARD', // Ensure guard words are selected
          playerLevel: 5,
          round: 5,
          timeRemaining: 300,
          previousWords: [],
          avoidRecentWords: false,
        })
      ).filter(s => s.guard); // Only consider selections with guard words

      if (selections.length > 0) {
        const defenseGuardCount = selections.filter(s => s.guard?.category === 'defense').length;
        
        // Guard words should tend towards defense category
        expect(defenseGuardCount / selections.length).toBeGreaterThan(0.3);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle limited word pool gracefully', () => {
      const limitedWords = mockWords.slice(0, 3); // Only 3 words
      const limitedWordManager = new WordManager({
        sessionId: 'test',
        packId: 'test',
        difficulty: 'NORMAL',
        words: limitedWords,
      });

      const selection = limitedWordManager.selectWords({
        difficulty: 'NORMAL',
        playerLevel: 1,
        round: 1,
        timeRemaining: 300,
        previousWords: [],
        avoidRecentWords: false,
      });

      expect(selection.attack).toBeDefined();
      expect(selection.heal).toBeDefined();
      expect(selection.attack.id).not.toBe(selection.heal.id);
    });

    it('should handle extreme player levels', () => {
      const extremeSelection = wordManager.selectWords({
        difficulty: 'NORMAL',
        playerLevel: 100,
        round: 1,
        timeRemaining: 300,
        previousWords: [],
        avoidRecentWords: false,
      });

      expect(extremeSelection.attack).toBeDefined();
      expect(extremeSelection.heal).toBeDefined();
    });

    it('should handle extreme rounds', () => {
      const extremeSelection = wordManager.selectWords({
        difficulty: 'NORMAL',
        playerLevel: 1,
        round: 100,
        timeRemaining: 300,
        previousWords: [],
        avoidRecentWords: false,
      });

      expect(extremeSelection.attack).toBeDefined();
      expect(extremeSelection.heal).toBeDefined();
    });
  });
});