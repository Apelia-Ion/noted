import {
  Component, Input, Output, EventEmitter, OnDestroy,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Attachment } from '../../../models/note.model';
import { AttachmentStoreService } from '../../../services/attachment-store.service';

@Component({
  selector: 'app-photo-attachment',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './photo-attachment.component.html',
  styleUrl: './photo-attachment.component.scss',
})
export class PhotoAttachmentComponent implements OnDestroy {
  @ViewChild('camPreview', { static: false }) camRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('snapCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  @Input() set attachments(value: Attachment[]) {
    this._attachments = value;
    this.loadUrls(value);
  }
  get attachments(): Attachment[] { return this._attachments; }
  private _attachments: Attachment[] = [];

  @Output() attachmentAdded   = new EventEmitter<{ blob: Blob; name: string; mimeType: string }>();
  @Output() attachmentRemoved = new EventEmitter<string>();

  cameraOpen = false;
  urls = new Map<string, string>();
  private stream?: MediaStream;

  constructor(
    private store: AttachmentStoreService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.closeCamera();
    this.urls.forEach(url => URL.revokeObjectURL(url));
  }

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
    Array.from(files).forEach(file =>
      this.attachmentAdded.emit({ blob: file, name: file.name, mimeType: file.type || 'image/jpeg' }),
    );
    (event.target as HTMLInputElement).value = '';
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  async openCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.cameraOpen = true;
      this.cdr.markForCheck();
      // Wait one tick for the <video> element to be rendered
      setTimeout(() => {
        if (this.camRef) this.camRef.nativeElement.srcObject = this.stream!;
      }, 0);
    } catch {
      alert('Camera access denied or unavailable.');
    }
  }

  capture(): void {
    const video  = this.camRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const name = `photo-${Date.now()}.jpg`;
      this.attachmentAdded.emit({ blob, name, mimeType: 'image/jpeg' });
    }, 'image/jpeg', 0.92);
  }

  closeCamera(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream    = undefined;
    this.cameraOpen = false;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  remove(id: string): void {
    if (confirm('Remove this photo?')) this.attachmentRemoved.emit(id);
  }

  download(att: Attachment): void { this.store.download(att.id, att.name); }
}
