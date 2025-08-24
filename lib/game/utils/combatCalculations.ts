import {
  CompletedWord,
  GameDifficulty,
  AttackResult,
  HealResult,
  GuardResult,
  ActionType,
  WordLevel,
} from '../types';

/**
 * Combat calculation utilities for the typing RPG
 * Handles damage, healing, and guard mechanics based on typing performance
 */

export interface CombatConfig {
  difficulty: GameDifficulty;
  playerLevel: number;
  combo: number;
  timeRemaining: number;
  totalTime: number;
}

export interface DamageModifiers {
  base: number;
  accuracy: number;
  speed: number;
  combo: number;
  critical: number;
  level: number;
  difficulty: number;
}

export interface CombatCalculationResult {
  baseValue: number;
  finalValue: number;
  isCritical: boolean;
  modifiers: DamageModifiers;
  breakdown: string[];
}

// =============================================================================
// CORE CALCULATION CONSTANTS
// =============================================================================

const DIFFICULTY_MODIFIERS: Record<GameDifficulty, number> = {
  EASY: 1.2,
  NORMAL: 1.0,
  HARD: 0.8,
};

const WORD_LEVEL_BASE_DAMAGE: Record<WordLevel, number> = {
  1: 15,  // Basic words
  2: 20,  // Common words  
  3: 25,  // Intermediate words
  4: 30,  // Advanced words
  5: 35,  // Expert words
};

const WORD_LEVEL_BASE_HEALING: Record<WordLevel, number> = {
  1: 12,
  2: 16,
  3: 20,
  4: 24,
  5: 28,
};

const COMBO_THRESHOLDS = [0, 5, 10, 20, 35, 50];
const COMBO_MULTIPLIERS = [1.0, 1.1, 1.2, 1.4, 1.7, 2.0];

const CRITICAL_HIT_CHANCE_BASE = 0.05; // 5% base
const CRITICAL_HIT_DAMAGE_MULTIPLIER = 1.8;

const MIN_ACCURACY_FOR_SUCCESS = 0.7;
const PERFECT_ACCURACY_BONUS = 1.3;
const SPEED_BONUS_THRESHOLD = 1.2; // 20% above expected WPM

// =============================================================================
// MAIN CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate attack damage based on typing performance
 */
export function calculateAttackDamage(
  completedWord: CompletedWord,
  config: CombatConfig
): CombatCalculationResult {
  const breakdown: string[] = [];
  
  // Base damage from word level
  const baseDamage = WORD_LEVEL_BASE_DAMAGE[completedWord.level];
  breakdown.push(`Base damage (L${completedWord.level}): ${baseDamage}`);

  // Calculate modifiers
  const modifiers: DamageModifiers = {
    base: baseDamage,
    accuracy: calculateAccuracyModifier(completedWord.accuracy),
    speed: calculateSpeedModifier(completedWord.wpm, completedWord.expectedWPM || getExpectedWPM(completedWord)),
    combo: calculateComboModifier(config.combo),
    critical: 1.0,
    level: calculateLevelModifier(config.playerLevel),
    difficulty: DIFFICULTY_MODIFIERS[config.difficulty],
  };

  breakdown.push(`Accuracy modifier (${(completedWord.accuracy * 100).toFixed(1)}%): ×${modifiers.accuracy.toFixed(2)}`);
  breakdown.push(`Speed modifier (${completedWord.wpm} WPM): ×${modifiers.speed.toFixed(2)}`);
  breakdown.push(`Combo modifier (×${config.combo}): ×${modifiers.combo.toFixed(2)}`);
  breakdown.push(`Level modifier (Lv${config.playerLevel}): ×${modifiers.level.toFixed(2)}`);
  breakdown.push(`Difficulty modifier (${config.difficulty}): ×${modifiers.difficulty.toFixed(2)}`);

  // Check for critical hit
  const criticalChance = calculateCriticalHitChance(completedWord, config);
  const isCritical = Math.random() < criticalChance;
  
  if (isCritical) {
    modifiers.critical = CRITICAL_HIT_DAMAGE_MULTIPLIER;
    breakdown.push(`CRITICAL HIT: ×${CRITICAL_HIT_DAMAGE_MULTIPLIER.toFixed(2)}`);
  }

  // Calculate final damage
  let finalDamage = baseDamage * 
    modifiers.accuracy * 
    modifiers.speed * 
    modifiers.combo * 
    modifiers.level * 
    modifiers.difficulty * 
    modifiers.critical;

  // Minimum damage (can't go below 1)
  finalDamage = Math.max(1, Math.round(finalDamage));

  return {
    baseValue: baseDamage,
    finalValue: finalDamage,
    isCritical,
    modifiers,
    breakdown,
  };
}

/**
 * Calculate healing amount based on typing performance
 */
export function calculateHealingAmount(
  completedWord: CompletedWord,
  config: CombatConfig
): CombatCalculationResult {
  const breakdown: string[] = [];
  
  // Base healing from word level
  const baseHealing = WORD_LEVEL_BASE_HEALING[completedWord.level];
  breakdown.push(`Base healing (L${completedWord.level}): ${baseHealing}`);

  // Calculate modifiers (similar to damage but with different scaling)
  const modifiers: DamageModifiers = {
    base: baseHealing,
    accuracy: calculateAccuracyModifier(completedWord.accuracy, true),
    speed: calculateSpeedModifier(completedWord.wpm, completedWord.expectedWPM || getExpectedWPM(completedWord), true),
    combo: calculateComboModifier(config.combo, 0.7), // Lower combo scaling for healing
    critical: 1.0,
    level: calculateLevelModifier(config.playerLevel, 0.8), // Lower level scaling
    difficulty: DIFFICULTY_MODIFIERS[config.difficulty],
  };

  breakdown.push(`Accuracy modifier: ×${modifiers.accuracy.toFixed(2)}`);
  breakdown.push(`Speed modifier: ×${modifiers.speed.toFixed(2)}`);
  breakdown.push(`Combo modifier: ×${modifiers.combo.toFixed(2)}`);
  breakdown.push(`Level modifier: ×${modifiers.level.toFixed(2)}`);

  // Critical healing check (lower chance than damage)
  const criticalChance = calculateCriticalHitChance(completedWord, config) * 0.6;
  const isCritical = Math.random() < criticalChance;
  
  if (isCritical) {
    modifiers.critical = 1.5; // Lower critical multiplier for healing
    breakdown.push(`CRITICAL HEAL: ×${modifiers.critical.toFixed(2)}`);
  }

  // Calculate final healing
  let finalHealing = baseHealing * 
    modifiers.accuracy * 
    modifiers.speed * 
    modifiers.combo * 
    modifiers.level * 
    modifiers.difficulty * 
    modifiers.critical;

  finalHealing = Math.max(1, Math.round(finalHealing));

  return {
    baseValue: baseHealing,
    finalValue: finalHealing,
    isCritical,
    modifiers,
    breakdown,
  };
}

/**
 * Calculate guard effectiveness
 */
export function calculateGuardEffectiveness(
  completedWord: CompletedWord,
  incomingDamage: number,
  config: CombatConfig
): CombatCalculationResult {
  const breakdown: string[] = [];
  
  // Base guard effectiveness (percentage of damage blocked)
  const baseEffectiveness = 0.4 + (completedWord.level * 0.1); // 50-90% base
  breakdown.push(`Base guard (L${completedWord.level}): ${(baseEffectiveness * 100).toFixed(1)}%`);

  // Modifiers affect how much damage is blocked
  const accuracyBonus = (completedWord.accuracy - MIN_ACCURACY_FOR_SUCCESS) * 0.5;
  const speedBonus = completedWord.wpm > (completedWord.expectedWPM || getExpectedWPM(completedWord)) ? 0.1 : 0;
  
  let finalEffectiveness = baseEffectiveness + accuracyBonus + speedBonus;
  finalEffectiveness = Math.min(0.95, Math.max(0.1, finalEffectiveness)); // 10-95% range

  breakdown.push(`Accuracy bonus: +${(accuracyBonus * 100).toFixed(1)}%`);
  if (speedBonus > 0) {
    breakdown.push(`Speed bonus: +${(speedBonus * 100).toFixed(1)}%`);
  }

  const damageBlocked = Math.round(incomingDamage * finalEffectiveness);
  const damageReceived = incomingDamage - damageBlocked;

  const isCritical = completedWord.accuracy >= 0.98 && completedWord.errors === 0;
  if (isCritical) {
    breakdown.push('PERFECT GUARD: Full damage blocked!');
  }

  return {
    baseValue: Math.round(incomingDamage * baseEffectiveness),
    finalValue: isCritical ? incomingDamage : damageBlocked,
    isCritical,
    modifiers: {
      base: baseEffectiveness,
      accuracy: accuracyBonus,
      speed: speedBonus,
      combo: 0,
      critical: isCritical ? 1.0 : 0,
      level: 0,
      difficulty: 1.0,
    },
    breakdown,
  };
}

// =============================================================================
// MODIFIER CALCULATION HELPERS
// =============================================================================

function calculateAccuracyModifier(accuracy: number, isHealing: boolean = false): number {
  if (accuracy < MIN_ACCURACY_FOR_SUCCESS) {
    return 0.5; // Heavily penalize low accuracy
  }
  
  if (accuracy >= 1.0) {
    return isHealing ? PERFECT_ACCURACY_BONUS * 0.8 : PERFECT_ACCURACY_BONUS;
  }
  
  // Linear scaling from 0.7 to 1.0 accuracy
  const normalizedAccuracy = (accuracy - MIN_ACCURACY_FOR_SUCCESS) / (1.0 - MIN_ACCURACY_FOR_SUCCESS);
  return 0.8 + (normalizedAccuracy * 0.5);
}

function calculateSpeedModifier(actualWPM: number, expectedWPM: number, isHealing: boolean = false): number {
  const speedRatio = actualWPM / expectedWPM;
  
  if (speedRatio < 0.8) {
    return 0.7; // Penalty for slow typing
  }
  
  if (speedRatio >= SPEED_BONUS_THRESHOLD) {
    const bonus = isHealing ? 1.2 : 1.3;
    return Math.min(bonus, 1.0 + (speedRatio - 1.0) * 0.5);
  }
  
  return 1.0;
}

function calculateComboModifier(combo: number, scaling: number = 1.0): number {
  let multiplierIndex = 0;
  
  for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
    if (combo >= COMBO_THRESHOLDS[i]) {
      multiplierIndex = i;
      break;
    }
  }
  
  const baseMultiplier = COMBO_MULTIPLIERS[multiplierIndex];
  return 1.0 + (baseMultiplier - 1.0) * scaling;
}

function calculateLevelModifier(playerLevel: number, scaling: number = 1.0): number {
  const baseBonus = 1.0 + (playerLevel - 1) * 0.05; // 5% per level
  return 1.0 + (baseBonus - 1.0) * scaling;
}

function calculateCriticalHitChance(completedWord: CompletedWord, config: CombatConfig): number {
  let critChance = CRITICAL_HIT_CHANCE_BASE;
  
  // Accuracy bonus
  if (completedWord.accuracy >= 0.95) {
    critChance += 0.1;
  }
  
  // Perfect typing bonus
  if (completedWord.errors === 0 && completedWord.accuracy >= 1.0) {
    critChance += 0.15;
  }
  
  // Speed bonus
  const expectedWPM = completedWord.expectedWPM || getExpectedWPM(completedWord);
  if (completedWord.wpm > expectedWPM * 1.3) {
    critChance += 0.08;
  }
  
  // Combo bonus
  critChance += Math.min(0.2, config.combo * 0.01);
  
  return Math.min(0.5, critChance); // Cap at 50%
}

function getExpectedWPM(word: CompletedWord): number {
  // Estimate expected WPM based on word characteristics
  const baseDifficulty: Record<WordLevel, number> = {
    1: 45, // Easy words
    2: 40, // Common words
    3: 35, // Intermediate
    4: 30, // Advanced  
    5: 25, // Expert
  };
  
  const lengthPenalty = Math.max(0, word.length - 6) * 2; // Penalty for long words
  return Math.max(20, baseDifficulty[word.level] - lengthPenalty);
}

// =============================================================================
// RESULT CREATION HELPERS
// =============================================================================

/**
 * Create an AttackResult from calculation
 */
export function createAttackResult(
  completedWord: CompletedWord,
  calculation: CombatCalculationResult,
  enemyHpBefore: number,
  combo: number
): AttackResult {
  const damageDealt = calculation.finalValue;
  const enemyHpAfter = Math.max(0, enemyHpBefore - damageDealt);

  return {
    success: completedWord.accuracy >= MIN_ACCURACY_FOR_SUCCESS,
    type: 'ATTACK',
    word: completedWord,
    value: damageDealt,
    critical: calculation.isCritical,
    combo,
    enemyHpBefore,
    enemyHpAfter,
    damageDealt,
    message: calculation.isCritical ? 'Critical Hit!' : undefined,
  };
}

/**
 * Create a HealResult from calculation
 */
export function createHealResult(
  completedWord: CompletedWord,
  calculation: CombatCalculationResult,
  playerHpBefore: number,
  playerMaxHp: number,
  combo: number
): HealResult {
  const healingDone = calculation.finalValue;
  const playerHpAfter = Math.min(playerMaxHp, playerHpBefore + healingDone);

  return {
    success: completedWord.accuracy >= MIN_ACCURACY_FOR_SUCCESS,
    type: 'HEAL',
    word: completedWord,
    value: healingDone,
    critical: calculation.isCritical,
    combo,
    playerHpBefore,
    playerHpAfter,
    healingDone,
    message: calculation.isCritical ? 'Critical Heal!' : undefined,
  };
}

/**
 * Create a GuardResult from calculation
 */
export function createGuardResult(
  completedWord: CompletedWord,
  calculation: CombatCalculationResult,
  incomingDamage: number,
  combo: number
): GuardResult {
  const damageBlocked = calculation.finalValue;
  const damageReceived = Math.max(0, incomingDamage - damageBlocked);
  const blocked = calculation.isCritical || damageReceived === 0;

  return {
    success: completedWord.accuracy >= MIN_ACCURACY_FOR_SUCCESS,
    type: 'GUARD',
    word: completedWord,
    value: damageBlocked,
    critical: calculation.isCritical,
    combo,
    blocked,
    damageBlocked,
    damageReceived,
    message: calculation.isCritical ? 'Perfect Guard!' : undefined,
  };
}