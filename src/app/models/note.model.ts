export type NoteType = 'text' | 'checklist' | 'audio' | 'video' | 'photo' | 'drawing' | 'universal';

/** Types that use binary attachments stored in IndexedDB. */
export const MEDIA_NOTE_TYPES: readonly NoteType[] = ['audio', 'video', 'photo', 'drawing'];

export function isMediaNote(type: NoteType): boolean {
  return (MEDIA_NOTE_TYPES as readonly string[]).includes(type);
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

/**
 * Metadata for a binary attachment.
 * The actual blob is stored separately in IndexedDB (AttachmentStoreService),
 * keyed by `id`. Only this lightweight descriptor is serialised to localStorage.
 */
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;       // bytes — informational only
  createdAt: string;  // ISO 8601
}

export interface Note {
  id: string;
  title: string;
  type: NoteType;
  content: string;          // free-text body; used by all types as description
  items: ChecklistItem[];   // checklist items (only for type === 'checklist')
  attachments: Attachment[]; // binary attachments (only for media types)
  createdAt: string;
  updatedAt: string;
}
