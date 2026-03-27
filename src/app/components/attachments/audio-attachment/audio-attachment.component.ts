import {
  Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Attachment } from '../../../models/note.model';
import { AttachmentStoreService } from '../../../services/attachment-store.service';

@Component({
  selector: 'app-audio-attachment',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './audio-attachment.component.html',
  styleUrl: './audio-attachment.component.scss',
})
export class AudioAttachmentComponent implements OnDestroy {
  @Input() set attachments(value: Attachment[]) {
    this._attachments = value;
    this.loadUrls(value);
  }
  get attachments(): Attachment[] { return this._attachments; }
  private _attachments: Attachment[] = [];

  @Output() attachmentAdded   = new EventEmitter<{ blob: Blob; name: string; mimeType: string }>();
  @Output() attachmentRemoved = new EventEmitter<string>();

  recording = false;
  recordTime = 0;

  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private timerRef?: ReturnType<typeof setInterval>;
  private stream?: MediaStream;

  /** Object URLs keyed by attachment id. Revoked on destroy. */
  urls = new Map<string, string>();

  constructor(
    private store: AttachmentStoreService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.stopRecording();
    this.urls.forEach(url => URL.revokeObjectURL(url));
  }

  // ── Playback URLs ─────────────────────────────────────────────────────────

  private async loadUrls(attachments: Attachment[]): Promise<void> {
    for (const att of attachments) {
      if (!this.urls.has(att.id)) {
        const url = await this.store.createObjectUrl(att.id);
        if (url) this.urls.set(att.id, url);
      }
    }
    this.cdr.markForCheck();
  }

  getUrl(id: string): string { return this.urls.get(id) ?? ''; }

  // ── Upload ────────────────────────────────────────────────────────────────

  onFileChange(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    Array.from(files).forEach(file => {
      this.attachmentAdded.emit({ blob: file, name: file.name, mimeType: file.type || 'audio/webm' });
    });
    (event.target as HTMLInputElement).value = '';
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  async toggleRecord(): Promise<void> {
    this.recording ? this.stopRecording() : await this.startRecording();
  }

  private async startRecording(): Promise<void> {
    try {
      this.stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this.recorder  = new MediaRecorder(this.stream, { mimeType });
      this.chunks    = [];
      this.recorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.recorder.onstop = () => this.finalise(mimeType);
      this.recorder.start(100);
      this.recording  = true;
      this.recordTime = 0;
      this.timerRef   = setInterval(() => { this.recordTime++; this.cdr.markForCheck(); }, 1000);
    } catch {
      alert('Microphone access denied or unavailable.');
    }
  }

  private stopRecording(): void {
    clearInterval(this.timerRef);
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.recording = false;
  }

  private finalise(mimeType: string): void {
    const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const blob = new Blob(this.chunks, { type: mimeType });
    const name = `recording-${Date.now()}.${ext}`;
    this.attachmentAdded.emit({ blob, name, mimeType });
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  remove(id: string): void {
    if (confirm('Remove this recording?')) this.attachmentRemoved.emit(id);
  }

  download(att: Attachment): void {
    this.store.download(att.id, att.name);
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
