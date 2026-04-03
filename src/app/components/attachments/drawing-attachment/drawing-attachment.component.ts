import {
  Component, Input, Output, EventEmitter, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef, HostListener, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Attachment } from '../../../models/note.model';
import { AttachmentStoreService } from '../../../services/attachment-store.service';

const COLORS = ['#0f172a','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ffffff'];

@Component({
  selector: 'app-drawing-attachment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drawing-attachment.component.html',
  styleUrl: './drawing-attachment.component.scss',
})
export class DrawingAttachmentComponent implements AfterViewInit, OnDestroy {
  @ViewChild('drawCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() set attachments(value: Attachment[]) {
    this._attachments = value;
    this.loadUrls(value);
  }
  get attachments(): Attachment[] { return this._attachments; }
  private _attachments: Attachment[] = [];

  @Output() attachmentAdded   = new EventEmitter<{ blob: Blob; name: string; mimeType: string }>();
  @Output() attachmentRemoved = new EventEmitter<string>();
  @Output() attachmentUpdated = new EventEmitter<{ id: string; blob: Blob }>();

  readonly colors = COLORS;
  color     = COLORS[0];
  brushSize = 4;
  isEraser  = false;

  urls = new Map<string, string>();
  editingId: string | null = null;
  private destroyed = false;

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private store: AttachmentStoreService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.urls.forEach(url => URL.revokeObjectURL(url));
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width  = canvas.offsetWidth || 600;
    canvas.height = 320;
    this.ctx = canvas.getContext('2d')!;
    this.fillWhite();
    this.applyCtxStyle();
  }

  private fillWhite(): void {
    const c = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, c.width, c.height);
  }

  private applyCtxStyle(): void {
    this.ctx.strokeStyle = this.isEraser ? '#ffffff' : this.color;
    this.ctx.lineWidth   = this.isEraser ? this.brushSize * 3 : this.brushSize;
    this.ctx.lineCap     = 'round';
    this.ctx.lineJoin    = 'round';
  }

  // ── Pointer events (mouse + touch via pointer events API) ─────────────────

  onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    this.drawing = true;
    const { x, y } = this.getPos(e);
    this.lastX = x; this.lastY = y;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drawing) return;
    e.preventDefault();
    const { x, y } = this.getPos(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x; this.lastY = y;
  }

  onPointerUp(): void { this.drawing = false; }

  private getPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  setColor(c: string): void {
    this.color    = c;
    this.isEraser = false;
    this.applyCtxStyle();
  }

  setBrush(size: number): void {
    this.brushSize = size;
    this.applyCtxStyle();
  }

  toggleEraser(): void {
    this.isEraser = !this.isEraser;
    this.applyCtxStyle();
  }

  clear(): void { this.fillWhite(); }

  // ── Save drawing ──────────────────────────────────────────────────────────

  async loadForEdit(att: Attachment): Promise<void> {
    this.editingId = att.id;
    const blob = await this.store.get(att.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => this.ngZone.run(() => {
      const canvas = this.canvasRef.nativeElement;
      this.fillWhite();
      this.ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
    });
    img.src = url;
  }

  saveDrawing(): void {
    this.canvasRef.nativeElement.toBlob(blob => {
      if (!blob) return;
      this.ngZone.run(() => {
        if (this.editingId) {
          this.attachmentUpdated.emit({ id: this.editingId, blob });
          this.editingId = null;
        } else {
          const name = `drawing-${Date.now()}.png`;
          this.attachmentAdded.emit({ blob, name, mimeType: 'image/png' });
        }
        this.fillWhite();
      });
    }, 'image/png');
  }

  // ── Thumbnail loading ─────────────────────────────────────────────────────

  private async loadUrls(attachments: Attachment[]): Promise<void> {
    for (const att of attachments) {
      if (!this.urls.has(att.id)) {
        const url = await this.store.createObjectUrl(att.id);
        if (url) this.urls.set(att.id, url);
      }
    }
    if (!this.destroyed) this.cdr.detectChanges();
  }

  getUrl(id: string): string { return this.urls.get(id) ?? ''; }

  remove(id: string): void {
    if (confirm('Remove this drawing?')) this.attachmentRemoved.emit(id);
  }

  download(att: Attachment): void { this.store.download(att.id, att.name); }
}
