import {
  calculateAttackDamage,
  calculateHealingAmount,
  calculateGuardEffectiveness,
  createAttackResult,
  createHealResult,
  createGuardResult,
} from '@/lib/game/utils/combatCalculations';

import type { CompletedWord, CombatConfig } from '@/lib/game/utils/combatCalculations';

describe('Combat Calculations', () => {
  const mockWord: CompletedWord = {
    id: '1',
    text: 'test',
    level: 2,
    length: 4,
    typedText: 'test',
    timeMs: 1000,
    errors: 0,
    accuracy: 1.0,
    wpm: 60,
    score: 100,
  };

  const mockConfig: CombatConfig = {
    difficulty: 'NORMAL',
    playerLevel: 1,
    combo: 0,
    timeRemaining: 300,
    totalTime: 300,
  };

  describe('calculateAttackDamage', () => {
    it('should calculate base damage correctly for different word levels', () => {
      const level1Word = { ...mockWord, level: 1 as const };
      const level5Word = { ...mockWord, level: 5 as const };

      const result1 = calculateAttackDamage(level1Word, mockConfig);
      const result5 = calculateAttackDamage(level5Word, mockConfig);

      expect(result1.baseValue).toBe(15); // L1 base damage
      expect(result5.baseValue).toBe(35); // L5 base damage
      expect(result5.finalValue).toBeGreaterThan(result1.finalValue);
    });

    it('should apply accuracy modifiers correctly', () => {
      const perfectWord = { ...mockWord, accuracy: 1.0 };
      const poorWord = { ...mockWord, accuracy: 0.5 };

      const perfectResult = calculateAttackDamage(perfectWord, mockConfig);
      const poorResult = calculateAttackDamage(poorWord, mockConfig);

      expect(perfectResult.finalValue).toBeGreaterThan(poorResult.finalValue);
      expect(perfectResult.modifiers.accuracy).toBeGreaterThan(poorResult.modifiers.accuracy);
    });

    it('should apply speed modifiers for fast typing', () => {
      const fastWord = { ...mockWord, wpm: 100, expectedWPM: 40 };
      const slowWord = { ...mockWord, wpm: 20, expectedWPM: 40 };

      const fastResult = calculateAttackDamage(fastWord, mockConfig);
      const slowResult = calculateAttackDamage(slowWord, mockConfig);

      expect(fastResult.finalValue).toBeGreaterThan(slowResult.finalValue);
      expect(fastResult.modifiers.speed).toBeGreaterThan(slowResult.modifiers.speed);
    });

    it('should apply combo modifiers', () => {
      const noComboConfig = { ...mockConfig, combo: 0 };
      const highComboConfig = { ...mockConfig, combo: 25 };

      const noComboResult = calculateAttackDamage(mockWord, noComboConfig);
      const highComboResult = calculateAttackDamage(mockWord, highComboConfig);

      expect(highComboResult.finalValue).toBeGreaterThan(noComboResult.finalValue);
      expect(highComboResult.modifiers.combo).toBeGreaterThan(noComboResult.modifiers.combo);
    });

    it('should apply difficulty modifiers', () => {
      const easyConfig = { ...mockConfig, difficulty: 'EASY' as const };
      const hardConfig = { ...mockConfig, difficulty: 'HARD' as const };

      const easyResult = calculateAttackDamage(mockWord, easyConfig);
      const hardResult = calculateAttackDamage(mockWord, hardConfig);

      // Easy mode should do more damage
      expect(easyResult.finalValue).toBeGreaterThan(hardResult.finalValue);
      expect(easyResult.modifiers.difficulty).toBe(1.2);
      expect(hardResult.modifiers.difficulty).toBe(0.8);
    });

    it('should ensure minimum damage of 1', () => {
      const terribleWord = {
        ...mockWord,
        accuracy: 0.1,
        wpm: 5,
        level: 1 as const,
      };

      const result = calculateAttackDamage(terribleWord, mockConfig);

      expect(result.finalValue).toBeGreaterThanOrEqual(1);
    });

    it('should include breakdown information', () => {
      const result = calculateAttackDamage(mockWord, mockConfig);

      expect(result.breakdown).toBeInstanceOf(Array);
      expect(result.breakdown.length).toBeGreaterThan(0);
      expect(result.breakdown[0]).toContain('Base damage');
    });
  });

  describe('calculateHealingAmount', () => {
    it('should calculate base healing correctly', () => {
      const result = calculateHealingAmount(mockWord, mockConfig);

      expect(result.baseValue).toBe(16); // L2 base healing
      expect(result.finalValue).toBeGreaterThan(0);
    });

    it('should have lower critical chance than attacks', () => {
      // Run multiple times to check critical rates
      let criticalCount = 0;
      const runs = 100;

      for (let i = 0; i < runs; i++) {
        const result = calculateHealingAmount(mockWord, mockConfig);
        if (result.isCritical) criticalCount++;
      }

      // Critical rate should be lower than attack (rough check)
      expect(criticalCount).toBeLessThan(runs * 0.3); // Should be less than 30%
    });

    it('should apply lower combo scaling than attacks', () => {
      const highComboConfig = { ...mockConfig, combo: 25 };

      const attackResult = calculateAttackDamage(mockWord, highComboConfig);
      const healResult = calculateHealingAmount(mockWord, highComboConfig);

      // Both should have combo benefits, but healing should be scaled down
      expect(healResult.modifiers.combo).toBeLessThan(attackResult.modifiers.combo);
    });
  });

  describe('calculateGuardEffectiveness', () => {
    const incomingDamage = 50;

    it('should calculate guard effectiveness based on word level', () => {
      const level1Word = { ...mockWord, level: 1 as const };
      const level5Word = { ...mockWord, level: 5 as const };

      const result1 = calculateGuardEffectiveness(level1Word, incomingDamage, mockConfig);
      const result5 = calculateGuardEffectiveness(level5Word, incomingDamage, mockConfig);

      expect(result5.finalValue).toBeGreaterThan(result1.finalValue);
    });

    it('should provide perfect guard for perfect accuracy', () => {
      const perfectWord = { ...mockWord, accuracy: 0.98, errors: 0 };

      const result = calculateGuardEffectiveness(perfectWord, incomingDamage, mockConfig);

      expect(result.isCritical).toBe(true);
      expect(result.finalValue).toBe(incomingDamage); // Full damage blocked
    });

    it('should limit effectiveness between 10% and 95%', () => {
      const terribleWord = { ...mockWord, accuracy: 0.1 };
      const greatWord = { ...mockWord, accuracy: 1.0 };

      const terribleResult = calculateGuardEffectiveness(terribleWord, incomingDamage, mockConfig);
      const greatResult = calculateGuardEffectiveness(greatWord, incomingDamage, mockConfig);

      // Results should be within bounds
      expect(terribleResult.finalValue).toBeGreaterThanOrEqual(incomingDamage * 0.1);
      expect(greatResult.finalValue).toBeLessThanOrEqual(incomingDamage * 0.95);
    });

    it('should provide speed bonus for fast typing', () => {
      const fastWord = { ...mockWord, wpm: 100, expectedWPM: 40 };
      const slowWord = { ...mockWord, wpm: 30, expectedWPM: 40 };

      const fastResult = calculateGuardEffectiveness(fastWord, incomingDamage, mockConfig);
      const slowResult = calculateGuardEffectiveness(slowWord, incomingDamage, mockConfig);

      expect(fastResult.finalValue).toBeGreaterThan(slowResult.finalValue);
    });
  });

  describe('Result Creation Functions', () => {
    describe('createAttackResult', () => {
      it('should create valid attack result', () => {
        const calculation = calculateAttackDamage(mockWord, mockConfig);
        const result = createAttackResult(mockWord, calculation, 100, 5);

        expect(result.type).toBe('ATTACK');
        expect(result.success).toBe(true);
        expect(result.enemyHpBefore).toBe(100);
        expect(result.enemyHpAfter).toBe(100 - calculation.finalValue);
        expect(result.damageDealt).toBe(calculation.finalValue);
        expect(result.combo).toBe(5);
      });

      it('should prevent negative enemy HP', () => {
        const calculation = { ...calculateAttackDamage(mockWord, mockConfig), finalValue: 150 };
        const result = createAttackResult(mockWord, calculation, 100, 5);

        expect(result.enemyHpAfter).toBe(0);
        expect(result.enemyHpAfter).toBeGreaterThanOrEqual(0);
      });

      it('should mark as failed for low accuracy', () => {
        const lowAccuracyWord = { ...mockWord, accuracy: 0.5 };
        const calculation = calculateAttackDamage(lowAccuracyWord, mockConfig);
        const result = createAttackResult(lowAccuracyWord, calculation, 100, 5);

        expect(result.success).toBe(false);
      });
    });

    describe('createHealResult', () => {
      it('should create valid heal result', () => {
        const calculation = calculateHealingAmount(mockWord, mockConfig);
        const result = createHealResult(mockWord, calculation, 80, 100, 3);

        expect(result.type).toBe('HEAL');
        expect(result.playerHpBefore).toBe(80);
        expect(result.healingDone).toBe(calculation.finalValue);
        expect(result.combo).toBe(3);
      });

      it('should prevent overhealing', () => {
        const calculation = { ...calculateHealingAmount(mockWord, mockConfig), finalValue: 50 };
        const result = createHealResult(mockWord, calculation, 90, 100, 3);

        expect(result.playerHpAfter).toBe(100); // Capped at max HP
      });
    });

    describe('createGuardResult', () => {
      it('should create valid guard result', () => {
        const incomingDamage = 40;
        const calculation = calculateGuardEffectiveness(mockWord, incomingDamage, mockConfig);
        const result = createGuardResult(mockWord, calculation, incomingDamage, 2);

        expect(result.type).toBe('GUARD');
        expect(result.damageBlocked).toBe(calculation.finalValue);
        expect(result.damageReceived).toBe(incomingDamage - calculation.finalValue);
        expect(result.combo).toBe(2);
      });

      it('should handle perfect guard', () => {
        const incomingDamage = 40;
        const calculation = { finalValue: 40, isCritical: true } as any;
        const result = createGuardResult(mockWord, calculation, incomingDamage, 2);

        expect(result.blocked).toBe(true);
        expect(result.damageReceived).toBe(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero time gracefully', () => {
      const zeroTimeWord = { ...mockWord, timeMs: 0 };

      const result = calculateAttackDamage(zeroTimeWord, mockConfig);

      expect(result.finalValue).toBeGreaterThan(0);
      expect(isNaN(result.finalValue)).toBe(false);
    });

    it('should handle missing expectedWPM', () => {
      const wordWithoutExpectedWPM = { ...mockWord };
      delete (wordWithoutExpectedWPM as any).expectedWPM;

      const result = calculateAttackDamage(wordWithoutExpectedWPM, mockConfig);

      expect(result.finalValue).toBeGreaterThan(0);
      expect(isNaN(result.finalValue)).toBe(false);
    });

    it('should handle extreme combo values', () => {
      const extremeComboConfig = { ...mockConfig, combo: 1000 };

      const result = calculateAttackDamage(mockWord, extremeComboConfig);

      expect(result.finalValue).toBeGreaterThan(0);
      expect(isFinite(result.finalValue)).toBe(true);
    });
  });
});