import { describe, expect, it } from 'vitest';

import {
  normalizeNoteForMigration
} from '../js/db/migrations.js';

import {
  NOTE_SCHEMA_VERSION
} from '../js/config/constants.js';

describe('db/migrations.js', () => {
  describe('normalizeNoteForMigration', () => {
    it('normalise une note minimale', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test'
      });

      expect(note.id).toBe('note-1');
      expect(note.schemaVersion).toBe(NOTE_SCHEMA_VERSION);
      expect(note.title).toBe('Test');
      expect(note.category).toBe('');
      expect(note.tags).toEqual([]);
      expect(note.color).toBe('#fff8a6');
      expect(note.backgroundImage).toBe('');
      expect(note.favorite).toBe(false);
      expect(note.content).toBe('');
      expect(note.fileId).toBe('');
      expect(note.fileName).toBe('');
      expect(note.fileType).toBe('');
      expect(note.fileSize).toBe(0);
      expect(typeof note.createdAt).toBe('number');
      expect(typeof note.updatedAt).toBe('number');
      expect(note.deletedAt).toBe(null);
      expect(typeof note.order).toBe('number');
    });

    it('normalise les tags depuis une chaîne', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        tags: 'client, urgent, facture'
      });

      expect(note.tags).toEqual([
        'client',
        'urgent',
        'facture'
      ]);
    });

    it('normalise les tags depuis un tableau', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        tags: ['#client', 'urgent']
      });

      expect(note.tags).toEqual([
        'client',
        'urgent'
      ]);
    });

    it('convertit favorite en booléen', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        favorite: 1
      });

      expect(note.favorite).toBe(true);
    });

    it('convertit les tailles fichier en nombre', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        fileSize: '1234'
      });

      expect(note.fileSize).toBe(1234);
    });

    it('conserve les dates existantes', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        createdAt: 1000,
        updatedAt: 2000,
        order: 3000
      });

      expect(note.createdAt).toBe(1000);
      expect(note.updatedAt).toBe(2000);
      expect(note.order).toBe(3000);
    });

    it('utilise createdAt comme updatedAt si updatedAt est absent', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        createdAt: 1000
      });

      expect(note.updatedAt).toBe(1000);
    });

    it('utilise createdAt comme order si order est absent', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        createdAt: 1000
      });

      expect(note.order).toBe(1000);
    });

    it('conserve deletedAt si présent', () => {
      const note = normalizeNoteForMigration({
        id: 'note-1',
        title: 'Test',
        deletedAt: 1234
      });

      expect(note.deletedAt).toBe(1234);
    });
  });
});