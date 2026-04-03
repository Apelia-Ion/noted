import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Note } from '../../models/note.model';
import { NotesService, FilterOption, SortOption } from '../../services/notes.service';
import { ExportImportService } from '../../services/export-import.service';
import { NoteCardComponent } from '../note-card/note-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, NoteCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  allNotes: Note[] = [];
  filteredNotes: Note[] = [];

  searchQuery = '';
  filterType: FilterOption = 'all';
  sortBy: SortOption = 'newest';

  // Export
  exporting = false;
  showExportPicker = false;
  exportSelection = new Set<string>();

  // Import
  importStatus: string | null = null;
  private importStatusTimer?: ReturnType<typeof setTimeout>;

  // Combine
  showCombinePicker = false;
  combineSelection = new Set<string>();
  combineTitle = '';

  private sub?: Subscription;

  constructor(
    private notesService: NotesService,
    private router: Router,
    private exportImport: ExportImportService,
  ) {}

  ngOnInit(): void {
    this.sub = this.notesService.notes$.subscribe(notes => {
      this.allNotes = notes;
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.importStatusTimer);
  }

  applyFilters(): void {
    this.filteredNotes = this.notesService.applyFilters(
      this.allNotes, this.searchQuery, this.filterType, this.sortBy,
    );
  }

  setFilter(type: FilterOption): void {
    this.filterType = type;
    this.applyFilters();
  }

  createNote(): void {
    this.router.navigate(['/note/new'], { queryParams: { type: 'universal' } });
  }

  onDeleteNote(id: string): void {
    this.notesService.delete(id);
  }

  get totalCount(): number { return this.allNotes.length; }

  // ── Export ────────────────────────────────────────────────────────────────

  openExportPicker(): void {
    this.exportSelection = new Set(this.allNotes.map(n => n.id));
    this.showExportPicker = true;
  }

  toggleExportNote(id: string): void {
    if (this.exportSelection.has(id)) { this.exportSelection.delete(id); }
    else { this.exportSelection.add(id); }
    this.exportSelection = new Set(this.exportSelection);
  }

  toggleSelectAll(): void {
    this.exportSelection = this.exportSelection.size === this.allNotes.length
      ? new Set()
      : new Set(this.allNotes.map(n => n.id));
  }

  async confirmExport(): Promise<void> {
    this.showExportPicker = false;
    this.exporting = true;
    try {
      await this.exportImport.exportSelected([...this.exportSelection]);
    } finally {
      this.exporting = false;
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async onImport(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      const result = await this.exportImport.importFile(file);
      const parts: string[] = [];
      if (result.imported) parts.push(`${result.imported} imported`);
      if (result.updated)  parts.push(`${result.updated} updated`);
      if (result.skipped)  parts.push(`${result.skipped} skipped`);
      this.showStatus(parts.length ? parts.join(', ') : 'Nothing to import');
    } catch (err) {
      this.showStatus((err as Error).message);
    }
  }

  private showStatus(msg: string): void {
    this.importStatus = msg;
    clearTimeout(this.importStatusTimer);
    this.importStatusTimer = setTimeout(() => { this.importStatus = null; }, 4000);
  }

  // ── Combine ───────────────────────────────────────────────────────────────

  openCombinePicker(): void {
    this.combineSelection = new Set();
    this.combineTitle = '';
    this.showCombinePicker = true;
  }

  toggleCombineNote(id: string): void {
    if (this.combineSelection.has(id)) { this.combineSelection.delete(id); }
    else { this.combineSelection.add(id); }
    this.combineSelection = new Set(this.combineSelection);
  }

  confirmCombine(): void {
    if (this.combineSelection.size < 2 || !this.combineTitle.trim()) return;
    const combined = this.notesService.combine([...this.combineSelection], this.combineTitle.trim());
    this.showCombinePicker = false;
    this.router.navigate(['/note', combined.id]);
  }
}
