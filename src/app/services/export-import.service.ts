import { Injectable } from '@angular/core';
import { Note, Attachment } from '../models/note.model';
import { NotesService } from './notes.service';
import { AttachmentStoreService } from './attachment-store.service';

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
}

interface ExportedAttachment extends Attachment {
  /** Base64-encoded blob data. */
  data: string;
}

interface ExportedNote extends Omit<Note, 'attachments'> {
  attachments: ExportedAttachment[];
}

interface ExportFile {
  version: 1;
  exportedAt: string;
  notes: ExportedNote[];
}

@Injectable({ providedIn: 'root' })
export class ExportImportService {
  constructor(
    private notesService: NotesService,
    private attachmentStore: AttachmentStoreService,
  ) {}

  // ── Export ────────────────────────────────────────────────────────────────

  async exportSelected(ids: string[]): Promise<void> {
    const notes = this.notesService.allNotes.filter(n => ids.includes(n.id));

    const exportedNotes: ExportedNote[] = await Promise.all(
      notes.map(async note => {
        const attachments: ExportedAttachment[] = await Promise.all(
          note.attachments.map(async att => {
            const blob = await this.attachmentStore.get(att.id);
            const data = blob ? await this.blobToBase64(blob) : '';
            return { ...att, data };
          }),
        );
        return { ...note, attachments };
      }),
    );

    const file: ExportFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: exportedNotes,
    };

    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `noted-export-${new Date().toISOString().slice(0, 10)}.noted`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async importFile(file: File): Promise<ImportResult> {
    const text = await file.text();
    let parsed: ExportFile;

    try {
      parsed = JSON.parse(text) as ExportFile;
    } catch {
      throw new Error('Invalid file — could not parse JSON.');
    }

    if (parsed.version !== 1 || !Array.isArray(parsed.notes)) {
      throw new Error('Invalid file format.');
    }

    const result: ImportResult = { imported: 0, updated: 0, skipped: 0 };

    for (const incoming of parsed.notes) {
      const existing = this.notesService.getNote(incoming.id);

      if (existing) {
        // Keep whichever was modified more recently
        if (existing.updatedAt >= incoming.updatedAt) {
          result.skipped++;
          continue;
        }
        // Incoming is newer — remove old attachment blobs before replacing
        await this.attachmentStore.deleteMany(existing.attachments.map(a => a.id));
        result.updated++;
      } else {
        result.imported++;
      }

      // Restore blobs to IndexedDB
      const attachments: Attachment[] = await Promise.all(
        incoming.attachments.map(async att => {
          if (att.data) {
            const blob = this.base64ToBlob(att.data, att.mimeType);
            await this.attachmentStore.save(att.id, blob);
          }
          const { data: _, ...meta } = att;
          return meta;
        }),
      );

      // Save note metadata (without blob data) to localStorage
      const note: Note = { ...incoming, attachments };
      this.notesService.save(note);
    }

    return result;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(b64: string, mimeType: string): Blob {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  }
}
