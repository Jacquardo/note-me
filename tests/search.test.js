import { describe, expect, it } from 'vitest';

import {
  buildNoteSearchText,
  filterNotesByAdvancedSearch,
  getNoteFileKind,
  matchesDateFilter,
  normalizeSearchText,
  noteMatchesAdvancedSearch,
  parseSearchQuery
} from '../js/services/search.js';

describe('services/search.js', () => {
  describe('normalizeSearchText', () => {
    it('normalise les accents, la casse et les espaces', () => {
      expect(normalizeSearchText('  Facturé À CLIENT ÉTÉ  ')).toBe('facture a client ete');
    });

    it('retourne une chaîne vide pour une valeur vide', () => {
      expect(normalizeSearchText()).toBe('');
      expect(normalizeSearchText(null)).toBe('');
    });
  });

  describe('parseSearchQuery', () => {
    it('parse une recherche texte simple', () => {
      const query = parseSearchQuery('client urgent facture');

      expect(query.text).toEqual(['client', 'urgent', 'facture']);
      expect(query.tags).toEqual([]);
      expect(query.categories).toEqual([]);
    });

    it('parse les tags avec #', () => {
      const query = parseSearchQuery('#urgent #client');

      expect(query.tags).toEqual(['urgent', 'client']);
    });

    it('parse une catégorie avec category:', () => {
      const query = parseSearchQuery('category:compta');

      expect(query.categories).toEqual(['compta']);
    });

    it('parse une expression exacte entre guillemets', () => {
      const query = parseSearchQuery('"facture impayée" relance');

      expect(query.phrases).toEqual(['facture impayee']);
      expect(query.text).toEqual(['relance']);
    });

    it('parse fav:true', () => {
      const query = parseSearchQuery('fav:true');

      expect(query.favorite).toBe(true);
    });

    it('parse fav:false', () => {
      const query = parseSearchQuery('fav:false');

      expect(query.favorite).toBe(false);
    });

    it('parse has:file', () => {
      const query = parseSearchQuery('has:file');

      expect(query.hasFile).toBe(true);
    });

    it('parse has:image', () => {
      const query = parseSearchQuery('has:image');

      expect(query.fileKind).toBe('image');
    });

    it('parse has:pdf', () => {
      const query = parseSearchQuery('has:pdf');

      expect(query.fileKind).toBe('pdf');
    });

    it('parse is:trash', () => {
      const query = parseSearchQuery('is:trash');

      expect(query.status).toBe('trash');
    });

    it('parse is:active', () => {
      const query = parseSearchQuery('is:active');

      expect(query.status).toBe('active');
    });

    it('parse created:today et updated:week', () => {
      const query = parseSearchQuery('created:today updated:week');

      expect(query.created).toBe('today');
      expect(query.updated).toBe('week');
    });
  });

  describe('buildNoteSearchText', () => {
    it('construit un texte de recherche depuis les champs principaux', () => {
      const note = {
        title: 'Facture Client',
        content: 'Relancer demain',
        category: 'Compta',
        tags: ['urgent', 'client'],
        fileName: 'facture.pdf'
      };

      const text = buildNoteSearchText(note);

      expect(text).toContain('facture client');
      expect(text).toContain('relancer demain');
      expect(text).toContain('compta');
      expect(text).toContain('urgent');
      expect(text).toContain('client');
      expect(text).toContain('facture.pdf');
    });
  });

  describe('noteMatchesAdvancedSearch', () => {
    const note = {
      id: 'note-1',
      title: 'Facture client',
      content: 'Relancer le client demain pour facture impayée',
      category: 'Compta',
      tags: ['urgent', 'client'],
      favorite: true,
      fileId: 'file-1',
      fileName: 'facture.pdf',
      fileType: 'application/pdf',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null
    };

    it('trouve une note par mot-clé', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('relancer'))).toBe(true);
    });

    it('trouve une note par expression exacte', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('"facture impayée"'))).toBe(true);
    });

    it('trouve une note par tag', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('#urgent'))).toBe(true);
    });

    it('trouve une note par catégorie', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('category:compta'))).toBe(true);
    });

    it('trouve une note favorite', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('fav:true'))).toBe(true);
    });

    it('exclut une note favorite avec fav:false', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('fav:false'))).toBe(false);
    });

    it('trouve une note avec fichier', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('has:file'))).toBe(true);
    });

    it('trouve une note PDF', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('has:pdf'))).toBe(true);
    });

    it('exclut une note active avec is:trash', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('is:trash'))).toBe(false);
    });

    it('trouve une note active avec is:active', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('is:active'))).toBe(true);
    });

    it('retourne false si un mot-clé est absent', () => {
      expect(noteMatchesAdvancedSearch(note, parseSearchQuery('inexistant'))).toBe(false);
    });
  });

  describe('filterNotesByAdvancedSearch', () => {
    const notes = [
      {
        id: '1',
        title: 'Facture client',
        content: 'À relancer',
        category: 'Compta',
        tags: ['urgent'],
        favorite: true,
        fileId: 'file-1',
        fileName: 'facture.pdf',
        fileType: 'application/pdf'
      },
      {
        id: '2',
        title: 'Idée produit',
        content: 'Nouvelle fonctionnalité',
        category: 'Produit',
        tags: ['idee'],
        favorite: false
      }
    ];

    it('filtre une liste de notes', () => {
      const result = filterNotesByAdvancedSearch(notes, '#urgent has:pdf');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('getNoteFileKind', () => {
    it('détecte une image par MIME type', () => {
      expect(getNoteFileKind({
        fileId: 'file-1',
        fileName: 'image.png',
        fileType: 'image/png'
      })).toBe('image');
    });

    it('détecte un PDF par extension', () => {
      expect(getNoteFileKind({
        fileId: 'file-1',
        fileName: 'document.pdf',
        fileType: ''
      })).toBe('pdf');
    });

    it('détecte un document Word', () => {
      expect(getNoteFileKind({
        fileId: 'file-1',
        fileName: 'document.docx',
        fileType: ''
      })).toBe('document');
    });

    it('retourne null si aucun fichier', () => {
      expect(getNoteFileKind({})).toBe(null);
    });
  });

  describe('matchesDateFilter', () => {
    it('valide today pour la date du jour', () => {
      expect(matchesDateFilter(Date.now(), 'today')).toBe(true);
    });

    it('valide week pour une date récente', () => {
      expect(matchesDateFilter(Date.now() - 2 * 24 * 60 * 60 * 1000, 'week')).toBe(true);
    });

    it('refuse une date invalide', () => {
      expect(matchesDateFilter('not-a-date', 'today')).toBe(false);
    });
  });
});