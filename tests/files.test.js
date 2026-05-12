import { describe, expect, it } from 'vitest';

import {
  blobToFile,
  fileToSerializableMeta,
  formatBytes,
  getBaseFileName,
  getFileExtension,
  getFileIcon,
  getFileKind,
  getFileKindFromMime,
  getFileKindFromName,
  isImageFile,
  isPdfFile,
  sanitizeFileName,
  sanitizeZipPath
} from '../js/utils/files.js';

describe('utils/files.js', () => {
  describe('sanitizeFileName', () => {
    it('supprime les caractères interdits Windows', () => {
      expect(sanitizeFileName('facture:client/2026?.pdf')).toBe('facture_client_2026_.pdf');
    });

    it('normalise les espaces', () => {
      expect(sanitizeFileName('  mon   fichier   test.pdf  ')).toBe('mon fichier test.pdf');
    });

    it('retourne fichier si le nom est vide', () => {
      expect(sanitizeFileName('')).toBe('fichier');
    });
  });

  describe('sanitizeZipPath', () => {
    it('nettoie un chemin ZIP', () => {
      expect(sanitizeZipPath('files\\facture:client?.pdf')).toBe('files/facture_client_.pdf');
    });

    it('supprime les segments vides', () => {
      expect(sanitizeZipPath('/files//test.pdf')).toBe('files/test.pdf');
    });
  });

  describe('getFileExtension', () => {
    it('retourne l’extension en minuscules', () => {
      expect(getFileExtension('Document.PDF')).toBe('pdf');
    });

    it('retourne une chaîne vide sans extension', () => {
      expect(getFileExtension('README')).toBe('');
    });
  });

  describe('getBaseFileName', () => {
    it('retourne le nom sans extension', () => {
      expect(getBaseFileName('facture.pdf')).toBe('facture');
    });

    it('gère les chemins Windows', () => {
      expect(getBaseFileName('C:\\temp\\facture.pdf')).toBe('facture');
    });

    it('gère les chemins Unix', () => {
      expect(getBaseFileName('/tmp/facture.pdf')).toBe('facture');
    });
  });

  describe('formatBytes', () => {
    it('formate les octets', () => {
      expect(formatBytes(512)).toBe('512 o');
    });

    it('formate les Ko', () => {
      expect(formatBytes(2048)).toBe('2 Ko');
    });

    it('formate les Mo', () => {
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 Mo');
    });

    it('formate les Go', () => {
      expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2 Go');
    });
  });

  describe('getFileKindFromName', () => {
    it('détecte une image', () => {
      expect(getFileKindFromName('photo.jpg')).toBe('image');
      expect(getFileKindFromName('image.png')).toBe('image');
    });

    it('détecte un PDF', () => {
      expect(getFileKindFromName('document.pdf')).toBe('pdf');
    });

    it('détecte un document', () => {
      expect(getFileKindFromName('document.docx')).toBe('document');
    });

    it('détecte un tableur', () => {
      expect(getFileKindFromName('tableau.xlsx')).toBe('spreadsheet');
    });

    it('détecte un texte', () => {
      expect(getFileKindFromName('notes.txt')).toBe('text');
    });

    it('retourne file par défaut', () => {
      expect(getFileKindFromName('archive.bin')).toBe('file');
    });
  });

  describe('getFileKindFromMime', () => {
    it('détecte une image depuis le MIME type', () => {
      expect(getFileKindFromMime('image/png')).toBe('image');
    });

    it('détecte un PDF depuis le MIME type', () => {
      expect(getFileKindFromMime('application/pdf')).toBe('pdf');
    });

    it('détecte un document Word', () => {
      expect(getFileKindFromMime('application/msword')).toBe('document');
    });

    it('détecte un fichier texte', () => {
      expect(getFileKindFromMime('text/plain')).toBe('text');
    });

    it('retourne file par défaut', () => {
      expect(getFileKindFromMime('application/octet-stream')).toBe('file');
    });
  });

  describe('getFileKind', () => {
    it('priorise le MIME type', () => {
      expect(getFileKind({
        name: 'image.pdf',
        type: 'image/png'
      })).toBe('image');
    });

    it('utilise le nom si le MIME type est absent', () => {
      expect(getFileKind({
        name: 'document.pdf',
        type: ''
      })).toBe('file');
    });
  });

  describe('getFileIcon', () => {
    it('retourne une icône image', () => {
      expect(getFileIcon({ name: 'photo.jpg', type: 'image/jpeg' })).toBe('🖼️');
    });

    it('retourne une icône PDF', () => {
      expect(getFileIcon({ name: 'facture.pdf', type: 'application/pdf' })).toBe('📕');
    });

    it('retourne une icône document', () => {
      expect(getFileIcon({ name: 'document.docx', type: 'application/msword' })).toBe('📄');
    });

    it('retourne une icône générique', () => {
      expect(getFileIcon({ name: 'archive.bin', type: 'application/octet-stream' })).toBe('📎');
    });
  });

  describe('isImageFile et isPdfFile', () => {
    it('détecte une image', () => {
      expect(isImageFile({ name: 'photo.png', type: 'image/png' })).toBe(true);
    });

    it('détecte un PDF', () => {
      expect(isPdfFile({ name: 'document.pdf', type: 'application/pdf' })).toBe(true);
    });
  });

  describe('blobToFile', () => {
    it('convertit un Blob en File', () => {
      const blob = new Blob(['hello'], {
        type: 'text/plain'
      });

      const file = blobToFile(blob, 'hello.txt');

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('hello.txt');
      expect(file.type).toBe('text/plain');
      expect(file.size).toBe(5);
    });
  });

  describe('fileToSerializableMeta', () => {
    it('retourne les métadonnées sérialisables', () => {
      const file = new File(['hello'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 123
      });

      expect(fileToSerializableMeta(file)).toEqual({
        name: 'hello.txt',
        type: 'text/plain',
        size: 5,
        lastModified: 123
      });
    });
  });
});