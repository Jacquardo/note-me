import { describe, expect, it } from 'vitest';

import {
  capitalize,
  compareText,
  countCharacters,
  countWords,
  escapeHtml,
  escapeRegExp,
  highlightText,
  isBlank,
  normalizeText,
  normalizeWhitespace,
  parseTags,
  removeControlCharacters,
  safeText,
  slugify,
  stripHtml,
  tagsToString,
  truncateText
} from '../js/utils/text.js';

describe('utils/text.js', () => {
  describe('parseTags', () => {
    it('parse des tags séparés par virgule', () => {
      expect(parseTags('client, urgent, facture')).toEqual([
        'client',
        'urgent',
        'facture'
      ]);
    });

    it('supprime les # en début de tag', () => {
      expect(parseTags('#client, #urgent')).toEqual([
        'client',
        'urgent'
      ]);
    });

    it('supprime les doublons', () => {
      expect(parseTags('client, urgent, client')).toEqual([
        'client',
        'urgent'
      ]);
    });

    it('accepte un tableau', () => {
      expect(parseTags(['client', 'urgent'])).toEqual([
        'client',
        'urgent'
      ]);
    });

    it('limite le nombre de tags', () => {
      const result = parseTags('a,b,c,d', {
        maxCount: 2
      });

      expect(result).toEqual(['a', 'b']);
    });

    it('limite la longueur des tags', () => {
      const result = parseTags('abcdefghijklmnop', {
        maxLength: 5
      });

      expect(result).toEqual(['abcde']);
    });
  });

  describe('tagsToString', () => {
    it('convertit un tableau de tags en chaîne', () => {
      expect(tagsToString(['client', 'urgent'])).toBe('client, urgent');
    });

    it('retourne une chaîne vide si ce n’est pas un tableau', () => {
      expect(tagsToString(null)).toBe('');
    });
  });

  describe('normalizeText', () => {
    it('normalise les accents et la casse', () => {
      expect(normalizeText('Éléphant À Noël')).toBe('elephant a noel');
    });
  });

  describe('normalizeWhitespace', () => {
    it('normalise les espaces multiples', () => {
      expect(normalizeWhitespace('  hello   world  ')).toBe('hello world');
    });
  });

  describe('truncateText', () => {
    it('tronque un texte long', () => {
      expect(truncateText('Bonjour le monde', 10)).toBe('Bonjour l…');
    });

    it('ne tronque pas un texte court', () => {
      expect(truncateText('Bonjour', 10)).toBe('Bonjour');
    });
  });

  describe('escapeHtml', () => {
    it('échappe le HTML', () => {
      expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    });
  });

  describe('stripHtml', () => {
    it('supprime le HTML', () => {
      expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    });
  });

  describe('slugify', () => {
    it('crée un slug propre', () => {
      expect(slugify('Facture Client Été 2026')).toBe('facture-client-ete-2026');
    });
  });

  describe('capitalize', () => {
    it('met la première lettre en majuscule', () => {
      expect(capitalize('bonjour')).toBe('Bonjour');
    });

    it('retourne vide pour une chaîne vide', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('countWords', () => {
    it('compte les mots', () => {
      expect(countWords('Bonjour le monde')).toBe(3);
    });

    it('retourne 0 pour une chaîne vide', () => {
      expect(countWords('')).toBe(0);
    });
  });

  describe('countCharacters', () => {
    it('compte les caractères', () => {
      expect(countCharacters('abc')).toBe(3);
    });
  });

  describe('highlightText', () => {
    it('surligne une occurrence', () => {
      expect(highlightText('Bonjour client', 'client')).toBe('Bonjour <mark>client</mark>');
    });

    it('échappe le texte avant de surligner', () => {
      expect(highlightText('<b>client</b>', 'client')).toBe('&lt;b&gt;<mark>client</mark>&lt;/b&gt;');
    });
  });

  describe('escapeRegExp', () => {
    it('échappe les caractères spéciaux regex', () => {
      expect(escapeRegExp('a+b*c?')).toBe('a\\+b\\*c\\?');
    });
  });

  describe('compareText', () => {
    it('compare deux textes', () => {
      expect(compareText('a', 'b')).toBeLessThan(0);
      expect(compareText('b', 'a')).toBeGreaterThan(0);
      expect(compareText('a', 'a')).toBe(0);
    });
  });

  describe('isBlank', () => {
    it('détecte une chaîne vide ou blanche', () => {
      expect(isBlank('')).toBe(true);
      expect(isBlank('   ')).toBe(true);
      expect(isBlank('a')).toBe(false);
    });
  });

  describe('removeControlCharacters', () => {
    it('supprime les caractères de contrôle', () => {
      expect(removeControlCharacters('a\u0000b\u0007c')).toBe('abc');
    });
  });

  describe('safeText', () => {
    it('supprime les caractères de contrôle et limite la longueur', () => {
      expect(safeText('a\u0000bcdef', 3)).toBe('abc');
    });
  });
});