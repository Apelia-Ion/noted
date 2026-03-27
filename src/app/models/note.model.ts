export type NoteType = 'text' | 'checklist';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

/**
 * A note can be either a plain text note or a checklist.
 * Dates are stored as ISO strings so they survive JSON serialization in localStorage.
 */
export interface Note {
  id: string;
  title: string;
  type: NoteType;
  content: string;        // used by text notes
  items: ChecklistItem[]; // used by checklist notes
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}
