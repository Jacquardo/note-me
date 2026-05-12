import { describe, expect, it } from 'vitest';

import {
  applyNoteColorVariables,
  darkenColor,
  getContrastRatio,
  getLuminance,
  getReadableTextColor,
  hexToRgb,
  isValidHexColor,
  lightenColor,
  mixColors,
  normalizeHexColor,
  rgbToHex
} from '../js/utils/colors.js';

describe('utils/colors.js', () => {
  describe('isValidHexColor', () => {
    it('accepte une couleur hexadécimale valide', () => {
      expect(isValidHexColor('#fff8a6')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
      expect(isValidHexColor('#ABCDEF')).toBe(true);
    });

    it('refuse une couleur invalide', () => {
      expect(isValidHexColor('fff8a6')).toBe(false);
      expect(isValidHexColor('#fff')).toBe(false);
      expect(isValidHexColor('#zzzzzz')).toBe(false);
      expect(isValidHexColor('')).toBe(false);
    });
  });

  describe('normalizeHexColor', () => {
    it('normalise une couleur sur 6 caractères', () => {
      expect(normalizeHexColor('#ABCDEF')).toBe('#abcdef');
    });

    it('développe une couleur courte sur 3 caractères', () => {
      expect(normalizeHexColor('#fa3')).toBe('#ffaa33');
    });

    it('retourne le fallback si la couleur est invalide', () => {
      expect(normalizeHexColor('red', '#000000')).toBe('#000000');
    });
  });

  describe('hexToRgb', () => {
    it('convertit une couleur hex en RGB', () => {
      expect(hexToRgb('#ffffff')).toEqual({
        r: 255,
        g: 255,
        b: 255
      });

      expect(hexToRgb('#000000')).toEqual({
        r: 0,
        g: 0,
        b: 0
      });
    });
  });

  describe('rgbToHex', () => {
    it('convertit RGB en hex', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(255, 170, 51)).toBe('#ffaa33');
    });

    it('borne les valeurs RGB', () => {
      expect(rgbToHex(300, -10, 255)).toBe('#ff00ff');
    });
  });

  describe('getReadableTextColor', () => {
    it('retourne un texte sombre sur fond clair', () => {
      expect(getReadableTextColor('#ffffff')).toBe('#111827');
      expect(getReadableTextColor('#fff8a6')).toBe('#111827');
    });

    it('retourne un texte clair sur fond sombre', () => {
      expect(getReadableTextColor('#000000')).toBe('#ffffff');
      expect(getReadableTextColor('#07111f')).toBe('#ffffff');
    });
  });

  describe('getLuminance', () => {
    it('retourne une luminance faible pour le noir', () => {
      expect(getLuminance('#000000')).toBeCloseTo(0, 5);
    });

    it('retourne une luminance élevée pour le blanc', () => {
      expect(getLuminance('#ffffff')).toBeCloseTo(1, 5);
    });
  });

  describe('getContrastRatio', () => {
    it('calcule un contraste fort entre noir et blanc', () => {
      expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    });
  });

  describe('mixColors', () => {
    it('mélange deux couleurs', () => {
      expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    });

    it('retourne la première couleur si weight vaut 0', () => {
      expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000');
    });

    it('retourne la deuxième couleur si weight vaut 1', () => {
      expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff');
    });
  });

  describe('lightenColor et darkenColor', () => {
    it('éclaircit une couleur', () => {
      expect(lightenColor('#000000', 0.5)).toBe('#808080');
    });

    it('assombrit une couleur', () => {
      expect(darkenColor('#ffffff', 0.5)).toBe('#808080');
    });
  });

  describe('applyNoteColorVariables', () => {
    it('applique les variables CSS sur un élément', () => {
      const element = document.createElement('div');

      applyNoteColorVariables(element, '#fff8a6');

      expect(element.style.getPropertyValue('--note-bg-base')).toBe('#fff8a6');
      expect(element.style.getPropertyValue('--note-text')).toBe('#111827');
    });

    it('ne plante pas si element est null', () => {
      expect(() => applyNoteColorVariables(null, '#fff8a6')).not.toThrow();
    });
  });
});