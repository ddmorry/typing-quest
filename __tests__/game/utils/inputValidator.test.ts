import { InputValidator } from '@/lib/game/utils/inputValidator';
import type { TypingSession, KeystrokeEvent, Word } from '@/lib/game/types';

describe('InputValidator', () => {
  let inputValidator: InputValidator;
  let mockWord: Word;

  beforeEach(() => {
    inputValidator = new InputValidator();
    mockWord = {
      id: '1',
      text: 'test',
      level: 2,
      length: 4,
    };
  });

  afterEach(() => {
    inputValidator.reset();
  });

  describe('Real-time Keystroke Validation', () => {
    it('should validate valid characters', () => {
      const result = inputValidator.validateKeystroke('a', '', 'test', Date.now());
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate numbers and punctuation', () => {
      const validChars = ['1', '!', '?', '.', ',', '-', '\''];
      
      validChars.forEach(char => {
        const result = inputValidator.validateKeystroke(char, '', 'test', Date.now());
        expect(result.valid).toBe(true);
      });
    });

    it('should accept control keys', () => {
      const controlKeys = ['Backspace', 'Delete', 'Tab', 'Enter'];
      
      controlKeys.forEach(key => {
        const result = inputValidator.validateKeystroke(key, '', 'test', Date.now());
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid characters', () => {
      const invalidChars = ['©', '®', '™', '¿'];
      
      invalidChars.forEach(char => {
        const result = inputValidator.validateKeystroke(char, '', 'test', Date.now());
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`Invalid character: "${char}"`);
      });
    });

    it('should prevent input longer than target word', () => {
      const result = inputValidator.validateKeystroke('a', 'test', 'test', Date.now());
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input exceeds target word length');
    });

    it('should detect unrealistic typing speed', () => {
      const result = inputValidator.validateKeystroke('a', 'te', 'test', 10); // Very fast
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Typing speed too fast');
    });
  });

  describe('Completed Word Validation', () => {
    let mockSession: TypingSession;

    beforeEach(() => {
      mockSession = {
        word: mockWord,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        keystrokes: [
          { key: 't', timestamp: Date.now() - 800, inputLength: 1, isCorrection: false },
          { key: 'e', timestamp: Date.now() - 600, inputLength: 2, isCorrection: false },
          { key: 's', timestamp: Date.now() - 400, inputLength: 3, isCorrection: false },
          { key: 't', timestamp: Date.now() - 200, inputLength: 4, isCorrection: false },
        ],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };
    });

    it('should calculate WPM correctly', () => {
      const metrics = inputValidator.validateCompletedWord(mockSession);
      
      // Expected WPM for "test" (4 chars) in 1000ms: (4/5) / (1/60) = 48 WPM
      expect(metrics.wpm).toBeCloseTo(48, 1);
    });

    it('should calculate accuracy correctly', () => {
      const perfectSession = { ...mockSession, currentInput: 'test' };
      const imperfectSession = { ...mockSession, currentInput: 'tset', errors: 1 };

      const perfectMetrics = inputValidator.validateCompletedWord(perfectSession);
      const imperfectMetrics = inputValidator.validateCompletedWord(imperfectSession);

      expect(perfectMetrics.accuracy).toBe(1.0);
      expect(imperfectMetrics.accuracy).toBeLessThan(1.0);
    });

    it('should detect impossible speeds', () => {
      const fastSession = {
        ...mockSession,
        startTime: Date.now() - 100, // 100ms for 4 characters = way too fast
        endTime: Date.now(),
      };

      const metrics = inputValidator.validateCompletedWord(fastSession);
      
      expect(metrics.isValid).toBe(false);
      expect(metrics.flags).toContain('impossible_speed');
    });

    it('should detect suspicious timing patterns', () => {
      const robotSession = {
        ...mockSession,
        keystrokes: [
          { key: 't', timestamp: Date.now() - 1000, inputLength: 1, isCorrection: false },
          { key: 'e', timestamp: Date.now() - 900, inputLength: 2, isCorrection: false },
          { key: 's', timestamp: Date.now() - 800, inputLength: 3, isCorrection: false },
          { key: 't', timestamp: Date.now() - 700, inputLength: 4, isCorrection: false },
        ], // Perfectly consistent timing
      };

      const metrics = inputValidator.validateCompletedWord(robotSession);
      
      // Should be flagged for too consistent timing
      expect(metrics.flags.length).toBeGreaterThan(0);
    });

    it('should track perfect word streaks', () => {
      // Create multiple perfect sessions
      for (let i = 0; i < 5; i++) {
        inputValidator.validateCompletedWord({
          ...mockSession,
          currentInput: 'test',
          errors: 0,
        });
      }

      // This should still be valid
      const metrics = inputValidator.validateCompletedWord({
        ...mockSession,
        currentInput: 'test',
        errors: 0,
      });

      expect(metrics.isValid).toBe(true);

      // But many more should trigger suspicion
      for (let i = 0; i < 20; i++) {
        inputValidator.validateCompletedWord({
          ...mockSession,
          currentInput: 'test',
          errors: 0,
        });
      }

      const suspiciousMetrics = inputValidator.validateCompletedWord({
        ...mockSession,
        currentInput: 'test',
        errors: 0,
      });

      expect(suspiciousMetrics.flags).toContain('no_corrections');
    });
  });

  describe('Keystroke Pattern Analysis', () => {
    it('should analyze keystroke intervals', () => {
      const session = inputValidator.createTypingSession(mockWord, 'ATTACK');
      
      let updatedSession = session;
      const keys = ['t', 'e', 's', 't'];
      keys.forEach((key, index) => {
        updatedSession = inputValidator.updateTypingSession(
          updatedSession,
          key,
          keys.slice(0, index + 1).join('')
        );
      });

      const completedSession = inputValidator.completeTypingSession(updatedSession);
      const metrics = inputValidator.validateCompletedWord(completedSession);

      expect(metrics.keystrokePattern.intervals).toBeDefined();
      expect(Object.keys(metrics.keystrokePattern.intervals)).toHaveLength(4);
    });

    it('should track corrections and backspaces', () => {
      let session = inputValidator.createTypingSession(mockWord, 'ATTACK');
      
      // Type with errors and corrections
      session = inputValidator.updateTypingSession(session, 't', 't');
      session = inputValidator.updateTypingSession(session, 'x', 'tx'); // Error
      session = inputValidator.updateTypingSession(session, 'Backspace', 't');
      session = inputValidator.updateTypingSession(session, 'e', 'te');
      session = inputValidator.updateTypingSession(session, 's', 'tes');
      session = inputValidator.updateTypingSession(session, 't', 'test');

      const completedSession = inputValidator.completeTypingSession(session);
      const metrics = inputValidator.validateCompletedWord(completedSession);

      expect(metrics.keystrokePattern.corrections).toBeGreaterThan(0);
      expect(metrics.keystrokePattern.backspaceCount).toBeGreaterThan(0);
    });

    it('should calculate perfect streaks', () => {
      const session = inputValidator.createTypingSession(mockWord, 'ATTACK');
      
      let updatedSession = session;
      updatedSession = inputValidator.updateTypingSession(updatedSession, 't', 't');
      updatedSession = inputValidator.updateTypingSession(updatedSession, 'e', 'te');
      updatedSession = inputValidator.updateTypingSession(updatedSession, 's', 'tes');
      updatedSession = inputValidator.updateTypingSession(updatedSession, 't', 'test');

      const completedSession = inputValidator.completeTypingSession(updatedSession);
      const metrics = inputValidator.validateCompletedWord(completedSession);

      expect(metrics.keystrokePattern.perfectStreak).toBe(4);
    });
  });

  describe('Session Management', () => {
    it('should create typing session correctly', () => {
      const session = inputValidator.createTypingSession(mockWord, 'ATTACK');

      expect(session.word).toBe(mockWord);
      expect(session.currentInput).toBe('');
      expect(session.errors).toBe(0);
      expect(session.keystrokes).toHaveLength(0);
      expect(session.startTime).toBeGreaterThan(0);
    });

    it('should update typing session with keystrokes', () => {
      let session = inputValidator.createTypingSession(mockWord, 'ATTACK');
      
      session = inputValidator.updateTypingSession(session, 't', 't');

      expect(session.currentInput).toBe('t');
      expect(session.keystrokes).toHaveLength(1);
      expect(session.keystrokes[0].key).toBe('t');
    });

    it('should complete typing session', () => {
      let session = inputValidator.createTypingSession(mockWord, 'ATTACK');
      session = inputValidator.updateTypingSession(session, 't', 't');
      
      const completedSession = inputValidator.completeTypingSession(session);

      expect(completedSession.endTime).toBeGreaterThan(session.startTime);
    });

    it('should create completed word from session', () => {
      let session = inputValidator.createTypingSession(mockWord, 'ATTACK');
      
      // Type the word
      'test'.split('').forEach((char, index) => {
        session = inputValidator.updateTypingSession(
          session, 
          char, 
          'test'.slice(0, index + 1)
        );
      });

      const completedSession = inputValidator.completeTypingSession(session);
      const metrics = inputValidator.validateCompletedWord(completedSession);
      const completedWord = inputValidator.createCompletedWord(completedSession, metrics);

      expect(completedWord.id).toBe(mockWord.id);
      expect(completedWord.text).toBe(mockWord.text);
      expect(completedWord.typedText).toBe('test');
      expect(completedWord.timeMs).toBeGreaterThan(0);
      expect(completedWord.wpm).toBeGreaterThan(0);
      expect(completedWord.score).toBeGreaterThan(0);
    });
  });

  describe('Anti-Cheat Features', () => {
    it('should provide anti-cheat flags summary', () => {
      // Create some suspicious sessions
      const suspiciousSession = {
        word: mockWord,
        startTime: Date.now() - 50, // Way too fast
        endTime: Date.now(),
        keystrokes: [],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };

      inputValidator.validateCompletedWord(suspiciousSession);
      
      const flags = inputValidator.getAntiCheatFlags();

      expect(flags.impossibleSpeed).toBe(true);
    });

    it('should provide session risk assessment', () => {
      // Create multiple suspicious sessions
      for (let i = 0; i < 3; i++) {
        const suspiciousSession = {
          word: { ...mockWord, id: `${i}` },
          startTime: Date.now() - 50,
          endTime: Date.now(),
          keystrokes: [],
          currentInput: 'test',
          errors: 0,
          corrections: 0,
          perfectStreak: 4,
        };
        inputValidator.validateCompletedWord(suspiciousSession);
      }

      const report = inputValidator.getSessionReport();

      expect(report.totalFlags).toBeGreaterThan(0);
      expect(report.riskLevel).toBe('HIGH');
      expect(report.flagBreakdown).toBeDefined();
    });

    it('should handle normal sessions without false positives', () => {
      const normalSession = {
        word: mockWord,
        startTime: Date.now() - 2000, // 2 seconds for 4 characters is reasonable
        endTime: Date.now(),
        keystrokes: [
          { key: 't', timestamp: Date.now() - 1600, inputLength: 1, isCorrection: false },
          { key: 'e', timestamp: Date.now() - 1200, inputLength: 2, isCorrection: false },
          { key: 's', timestamp: Date.now() - 800, inputLength: 3, isCorrection: false },
          { key: 't', timestamp: Date.now() - 400, inputLength: 4, isCorrection: false },
        ],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };

      const metrics = inputValidator.validateCompletedWord(normalSession);

      expect(metrics.isValid).toBe(true);
      expect(metrics.flags).toHaveLength(0);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate higher scores for better performance', () => {
      const goodSession = {
        word: mockWord,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        keystrokes: [],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };

      const poorSession = {
        ...goodSession,
        startTime: Date.now() - 5000, // Much slower
        errors: 3,
      };

      const goodMetrics = inputValidator.validateCompletedWord(goodSession);
      const poorMetrics = inputValidator.validateCompletedWord(poorSession);

      const goodWord = inputValidator.createCompletedWord(goodSession, goodMetrics);
      const poorWord = inputValidator.createCompletedWord(poorSession, poorMetrics);

      expect(goodWord.score).toBeGreaterThan(poorWord.score);
    });

    it('should provide bonus for perfect typing', () => {
      const perfectSession = {
        word: mockWord,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        keystrokes: [],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };

      const metrics = inputValidator.validateCompletedWord(perfectSession);
      const completedWord = inputValidator.createCompletedWord(perfectSession, metrics);

      expect(completedWord.score).toBeGreaterThan(100); // Should get perfect bonus
    });

    it('should scale score with word difficulty', () => {
      const easyWord = { ...mockWord, level: 1 };
      const hardWord = { ...mockWord, level: 5 };

      const easySession = {
        word: easyWord,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        keystrokes: [],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };

      const hardSession = { ...easySession, word: hardWord };

      const easyMetrics = inputValidator.validateCompletedWord(easySession);
      const hardMetrics = inputValidator.validateCompletedWord(hardSession);

      const easyCompletedWord = inputValidator.createCompletedWord(easySession, easyMetrics);
      const hardCompletedWord = inputValidator.createCompletedWord(hardSession, hardMetrics);

      expect(hardCompletedWord.score).toBeGreaterThan(easyCompletedWord.score);
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset all counters and flags', () => {
      // Create some suspicious activity
      const suspiciousSession = {
        word: mockWord,
        startTime: Date.now() - 50,
        endTime: Date.now(),
        keystrokes: [],
        currentInput: 'test',
        errors: 0,
        corrections: 0,
        perfectStreak: 4,
      };

      inputValidator.validateCompletedWord(suspiciousSession);
      
      let report = inputValidator.getSessionReport();
      expect(report.totalFlags).toBeGreaterThan(0);

      inputValidator.reset();
      
      report = inputValidator.getSessionReport();
      expect(report.totalFlags).toBe(0);
      expect(report.perfectWordCount).toBe(0);
      expect(report.riskLevel).toBe('LOW');
    });
  });
});