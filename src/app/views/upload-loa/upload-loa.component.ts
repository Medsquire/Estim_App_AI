import { ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent, CardBodyComponent, CardHeaderComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import * as Tesseract from 'tesseract.js';

interface ExtractedItem {
  sno?: string;
  itemNo?: string;
  pageNo?: number;
  scheduleNo?: string;
  description: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
  schedule?: string;
  itemtype?: 'SOR' | 'NOT_SOR';
}

interface SorReferenceItem {
  itemNo: string;
  item: string;
  unit: string;
  rate: string;
  page: number;
}

interface ComparisonItem {
  index: number;
  itemtype: 'SOR' | 'NOT_SOR';
  status: 'correct' | 'wrong';
  matchScore: number;
  loaItem: ExtractedItem;
  sorItem: SorReferenceItem | null;
  reason: string;
}

interface ComparisonActionState {
  originalItem: ComparisonItem;
  isLockedCorrect: boolean;
}

interface ComparisonSummary {
  totalItems: number;
  correctItems: number;
  wrongItems: number;
}

interface SorItemsByPagePayload {
  items_by_page: {
    [page: string]: Array<{
      'ITEM No': string;
      ITEM: string;
      unit: string;
      Rate: string;
    }>;
  };
}

interface SorConvertedPayload {
  chapters?: {
    [chapter: string]: {
      items?: Array<{
        item_no?: string;
        description?: string;
        unit?: string;
        rate?: number | string;
        chapter?: number | string;
      }>;
    };
  };
}

interface ScheduleData {
  bidrate: string;
  isabove: boolean;
}

interface NormalizedLoaItem {
  slNo: number;
  description: string;
  qty?: number;
  unit: string;
  rateInRs: number;
  totalCashRs: number;
  totalRs: number;
  reference: string;
  schedule: string;
  page_no: number;
  bidRate: number;
  fileType: 'SOR' | 'NOT';
  Matched_items_no: string;
}

type ReferenceDocumentType = 'LOA_ABSS' | 'STTC' | 'ZONAL_2024' | 'SOR_2024';

@Component({
  selector: 'app-upload-loa',
  template: `
    <c-card class="mb-4">
      <c-card-header>
        <strong>Upload LOA</strong>
      </c-card-header>
      <c-card-body>
        <!-- Drag & Drop Zone -->
        <div 
          class="upload-zone d-flex flex-column align-items-center justify-content-center p-5 border rounded bg-light"
          [class.drag-over]="isDragOver"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="triggerFileInput()"
          style="border-style: dashed !important; border-width: 2px; min-height: 200px; cursor: pointer; transition: all 0.2s;">
          
          <svg cIcon name="cilCloudUpload" size="3xl" class="mb-3 text-primary"></svg>
          
          <h5 class="mb-2">Drag & Drop or Click to Upload</h5>
          <p class="text-body-secondary small mb-0">Supported formats: PDF, DOC, DOCX</p>
        </div>

        <!-- Hidden File Input -->
        <input #fileInput type="file" (change)="onFileSelected($event)" accept=".pdf,.doc,.docx" style="display: none;" />

        <!-- Selected File Display -->
        <div *ngIf="selectedFile" class="mt-3 p-3 border rounded bg-white shadow-sm">
          <div class="d-flex align-items-center mb-3">
            <svg cIcon name="cilFile" class="me-3 text-success" size="xl"></svg>
            <div class="flex-grow-1">
              <h6 class="mb-0">{{ selectedFile.name }}</h6>
              <small class="text-body-secondary">{{ (selectedFile.size / 1024 / 1024) | number:'1.2-2' }} MB</small>
            </div>
            <button class="btn btn-sm btn-outline-danger" (click)="clearFile($event)">Remove</button>
          </div>

          <div *ngIf="isExtracting || extractionProgress > 0" class="mb-3">
            <div class="d-flex justify-content-between align-items-center small mb-1">
              <span class="text-body-secondary">Extraction Progress</span>
              <span class="fw-bold">{{ extractionProgress }}%</span>
            </div>
            <div class="progress" style="height: 8px;">
              <div
                class="progress-bar"
                role="progressbar"
                [style.width.%]="extractionProgress"
                [attr.aria-valuenow]="extractionProgress"
                aria-valuemin="0"
                aria-valuemax="100">
              </div>
            </div>
          </div>

          <div *ngIf="extractionComplete && !isExtracting" class="mb-3 p-3 border rounded bg-light">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h6 class="mb-1 fw-bold">Extraction Complete</h6>
                <small class="text-body-secondary">All detected details are shown below.</small>
              </div>
              <div class="btn-group btn-group-sm">
                <button *ngIf="currentPdfObjectUrl" class="btn btn-outline-primary" type="button" (click)="openPdf(currentPdfObjectUrl)">
                  Current PDF
                </button>
                <button *ngIf="previousPdfObjectUrl" class="btn btn-outline-secondary" type="button" (click)="openPdf(previousPdfObjectUrl)">
                  Previous PDF
                </button>
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-6 col-lg-4"><strong class="d-block small text-muted">Document Type</strong>{{ documentType }}</div>
              <div class="col-md-6 col-lg-4"><strong class="d-block small text-muted">Letter No</strong>{{ letterNo || '-' }}</div>
              <div class="col-md-6 col-lg-4"><strong class="d-block small text-muted">Date</strong>{{ letterDate || '-' }}</div>
              <div class="col-12"><strong class="d-block small text-muted">Subject</strong>{{ letterSub || '-' }}</div>
              <div class="col-12"><strong class="d-block small text-muted">Reference</strong>{{ letterRef || '-' }}</div>
              <div class="col-12"><strong class="d-block small text-muted">Description</strong>{{ letterDescription || '-' }}</div>
              <div class="col-md-6 col-lg-4"><strong class="d-block small text-muted">Extracted Items</strong>{{ extractedItems.length }}</div>
              <div class="col-md-6 col-lg-4"><strong class="d-block small text-muted">Correct Items</strong>{{ comparisonSummary.correctItems }}</div>
              <div class="col-md-6 col-lg-4"><strong class="d-block small text-muted">Wrong Items</strong>{{ comparisonSummary.wrongItems }}</div>
            </div>
          </div>

          <div *ngIf="extractionComplete && !isExtracting" class="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <small class="text-body-secondary">
              {{ uploadReady ? 'Ready to upload.' : 'Preparing upload...' }}
            </small>
            <span class="badge bg-secondary">
              {{ uploadReady ? '0s' : waitingSecondsLeft + 's' }}
            </span>
          </div>
          
          <!-- Extracted Metadata Form -->
          <div *ngIf="extractionComplete" class="row g-3 border-top pt-3">
            <div class="col-md-6">
              <label class="form-label small fw-bold">Reference Doc Type</label>
              <select class="form-select" [(ngModel)]="documentType">
                <option *ngFor="let t of supportedDocumentTypes" [ngValue]="t.value">{{ t.label }}</option>
              </select>
              <small class="text-body-secondary">Auto-detected from reference/letter content when available.</small>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold">Letter No</label>
              <input type="text" class="form-control" [(ngModel)]="letterNo" placeholder="Extracted Letter No">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold">Date</label>
              <input type="date" class="form-control" [(ngModel)]="letterDate">
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold">Subject</label>
              <input type="text" class="form-control" [(ngModel)]="letterSub" placeholder="Extracted Subject">
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold">Reference</label>
              <textarea class="form-control" rows="2" [(ngModel)]="letterRef" placeholder="Extracted Reference"></textarea>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold">Description</label>
              <textarea class="form-control" rows="4" [(ngModel)]="letterDescription" placeholder="Extracted Letter Description"></textarea>
            </div>
            <!-- DEBUG: Raw Text Preview -->
            <div class="col-12 mt-3">
               <details>
                 <summary class="small text-muted cursor-pointer">Debug: View Raw Extracted Text</summary>
                 <textarea class="form-control mt-2" rows="5" [value]="processedText" readonly style="font-size: 0.8rem; font-family: monospace;"></textarea>
               </details>
            </div>
          </div>
        </div>

        <!-- Extracted Items Table -->
        <div *ngIf="extractionComplete && extractedItems.length > 0" class="mt-4">
          <h6 class="fw-bold">Extracted Items ({{ extractedItems.length }})</h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>S No.</th>
                  <th>Item No</th>
                  <th>Page No</th>
                  <th>Schedule No</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Schedule</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of extractedItems; let i = index">
                  <td>{{ item.sno || (i + 1) }}</td>
                  <td>{{ item.itemNo || '-' }}</td>
                  <td>{{ item.pageNo || '-' }}</td>
                  <td>{{ item.scheduleNo || '-' }}</td>
                  <td>{{ item.description }}</td>
                  <td>{{ item.quantity || '-' }}</td>
                  <td>{{ item.unit || '-' }}</td>
                  <td>{{ item.rate || '-' }}</td>
                  <td>{{ item.amount || '-' }}</td>
                  <td><span class="badge bg-info text-dark">{{ item.schedule || 'N/A' }}</span></td>
                  <td class="text-nowrap">
                    <button class="btn btn-sm me-1" [class.btn-success]="item.itemtype === 'SOR'" [class.btn-outline-success]="item.itemtype !== 'SOR'" (click)="markItemAsSor(i)">
                      <svg cIcon name="cilCheckAlt"></svg>
                    </button>
                    <button class="btn btn-sm" [class.btn-danger]="item.itemtype === 'NOT_SOR'" [class.btn-outline-danger]="item.itemtype !== 'NOT_SOR'" (click)="markItemAsWrong(i)">
                      <svg cIcon name="cilX"></svg>
                    </button>
                    <span class="ms-2 text-muted fw-bold">==</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- LOA vs SOR Comparison -->
          <div *ngIf="extractionComplete && comparisonItems.length > 0" class="mt-4 p-3 border rounded bg-white shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold mb-0">LOA vs SOR Check</h6>
              <div class="small text-body-secondary">
                Correct: <strong class="text-success">{{ comparisonSummary.correctItems }}</strong> |
                Wrong: <strong class="text-danger">{{ comparisonSummary.wrongItems }}</strong>
              </div>
            </div>

            <div class="row g-3">
              <div class="col-lg-6">
                <div class="border rounded p-3 h-100">
                  <h6 class="fw-bold mb-3">SOR Matched List</h6>
                  <div class="table-responsive" style="max-height: 420px; overflow: auto;">
                    <table class="table table-sm table-bordered align-middle mb-0">
                      <thead class="table-light sticky-top">
                        <tr>
                          <th>#</th>
                          <th>ITEM No</th>
                          <th>ITEM</th>
                          <th>Unit</th>
                          <th>Rate</th>
                          <th>Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let matched of sorMatchedItems; let i = index">
                          <ng-container *ngIf="matched.sorItem">
                            <td>{{ i + 1 }}</td>
                            <td>{{ matched.sorItem.itemNo }}</td>
                            <td>{{ matched.sorItem.item }}</td>
                            <td>{{ matched.sorItem.unit }}</td>
                            <td>{{ matched.sorItem.rate }}</td>
                            <td>{{ matched.sorItem.page }}</td>
                          </ng-container>
                          <ng-container *ngIf="!matched.sorItem">
                            <td>{{ i + 1 }}</td>
                            <td colspan="5" class="text-muted">No SOR match</td>
                          </ng-container>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div class="col-lg-6">
                <div class="border rounded p-3 h-100">
                  <h6 class="fw-bold mb-3">LOA Wrong List</h6>
                  <div class="table-responsive" style="max-height: 420px; overflow: auto;">
                    <table class="table table-sm table-bordered align-middle mb-0">
                      <thead class="table-light sticky-top">
                        <tr>
                          <th>#</th>
                          <th>Description</th>
                          <th>Unit</th>
                          <th>Rate</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let matched of loaWrongItems; let i = index">
                          <td>{{ i + 1 }}</td>
                          <td>{{ matched.loaItem.description }}</td>
                          <td>{{ matched.loaItem.unit || '-' }}</td>
                          <td>{{ matched.loaItem.rate || '-' }}</td>
                          <td>
                            <button class="btn btn-sm btn-success me-1" (click)="markComparisonCorrect(matched.index - 1)">
                              <svg cIcon name="cilCheckAlt"></svg>
                            </button>
                            <button class="btn btn-sm btn-danger" (click)="markComparisonWrong(matched.index - 1)">
                              <svg cIcon name="cilX"></svg>
                            </button>
                            <span class="ms-2 text-muted fw-bold">==</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <details class="mt-3" open>
              <summary class="small text-muted cursor-pointer">View Comparison JSON</summary>
              <pre class="mt-2 p-3 bg-light border rounded" style="font-size: 0.8rem; max-height: 400px; overflow-y: auto;">{{ getComparisonJson() | json }}</pre>
            </details>
          </div>
          
          <details *ngIf="extractionComplete" class="mt-3" open>
            <summary class="small text-muted cursor-pointer">View as JSON</summary>
            <pre class="mt-2 p-3 bg-light border rounded" style="font-size: 0.8rem; max-height: 400px; overflow-y: auto;">{{ getFinalJson() | json }}</pre>
          </details>
        </div>

        <!-- Error Message -->
        <div *ngIf="errorMessage" class="mt-3 alert alert-danger">
          {{ errorMessage }}
        </div>

        <!-- Upload Button -->
        <div class="mt-4 text-end">
          <button class="btn btn-primary" [disabled]="!selectedFile || !uploadReady" (click)="uploadFile()">
            Upload Document
          </button>
        </div>
      </c-card-body>
    </c-card>

  `,
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, CardBodyComponent, CardHeaderComponent, IconDirective]
})
export class UploadLoaComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;

  private readonly ocrMaxPages = 5;
  private readonly ocrTimeBudgetMs = 3 * 60 * 1000;
  private readonly largePdfManualThresholdBytes = 4 * 1024 * 1024;

  isDragOver = false;
  selectedFile: File | null = null;
  errorMessage: string = '';
  isExtracting = false;
  extractionProgress = 0;
  sorReferenceLoaded = false;
  extractionComplete = false;
  uploadReady = false;
  waitingSecondsLeft = 0;
  private uploadReadyTimer: number | null = null;
  currentPdfObjectUrl: string | null = null;
  previousPdfObjectUrl: string | null = null;
  currentPdfName = '';
  previousPdfName = '';

  constructor(private changeDetectorRef: ChangeDetectorRef) {}

  // Metadata
  letterNo: string = '';
  letterDate: string = '';
  letterSub: string = '';
  letterRef: string = '';
  letterDescription: string = '';
  processedText: string = ''; // For debugging
  extractedItems: ExtractedItem[] = [];
  sorReferenceItems: SorReferenceItem[] = [];
  comparisonItems: ComparisonItem[] = [];
  sorMatchedItems: ComparisonItem[] = [];
  loaWrongItems: ComparisonItem[] = [];
  comparisonSummary: ComparisonSummary = {
    totalItems: 0,
    correctItems: 0,
    wrongItems: 0
  };
  documentType: ReferenceDocumentType = 'LOA_ABSS';
  supportedDocumentTypes: { value: ReferenceDocumentType; label: string }[] = [
    { value: 'LOA_ABSS', label: 'LOA ABSS' },
    { value: 'STTC', label: 'STTC' },
    { value: 'ZONAL_2024', label: 'ZONAL 2024' },
    { value: 'SOR_2024', label: 'SOR 2024' }
  ];

  schedules: { [key: string]: ScheduleData } = {};

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndSetFile(files[0]);
    }
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  async validateAndSetFile(file: File) {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.doc', '.docx'];

    const extension = '.' + (file.name.split('.').pop() || '').toLowerCase().trim();
    const mimeType = (file.type || '').toLowerCase().trim();
    const isPdf = extension === '.pdf' || mimeType.includes('pdf');
    const isDocx = extension === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isDoc = extension === '.doc' || mimeType === 'application/msword';
    this.extractionProgress = 0;
    this.isExtracting = false;
    this.extractionComplete = false;
    this.uploadReady = false;
    this.waitingSecondsLeft = 0;
    this.processedText = '';

    this.updatePdfHistory(file);

    if (validTypes.includes(file.type) || validExtensions.includes(extension)) {
      this.selectedFile = file;
      this.errorMessage = '';
      this.processedText = 'File selected. Analyzing format...';
      this.documentType = this.detectDocumentType(file.name);

      // Auto-extract metadata if it's a DOCX file
      if (isDocx) {
        await this.extractMetadata(file);
      } else if (isDoc) {
        this.processedText = 'Legacy .doc (binary) format detected. Please convert to .docx for auto-extraction.';
        this.errorMessage = 'Legacy .doc files cannot be auto-read. Please enter details manually.';
      } else if (isPdf) {
        this.updateExtractionProgress(1, 'PDF detected. Initializing extraction...');
        await this.extractPdfMetadataWithTimeout(file, 300000);
      } else {
        this.processedText = 'Unsupported format for auto-extraction.';
        this.letterNo = '';
        this.letterDate = '';
      }

      await this.buildSorComparison();
    } else {
      this.selectedFile = null;
      this.errorMessage = 'Invalid file type. Please upload a PDF or Word document.';
      this.processedText = 'Invalid file type.';
      this.extractionProgress = 0;
    }
  }

  async extractMetadata(file: File) {
    this.isExtracting = true;
    this.extractionComplete = false;
    this.uploadReady = false;
    this.waitingSecondsLeft = 0;
    this.clearUploadReadyTimer();
    this.updateExtractionProgress(10, 'Starting extraction...');
    this.processedText = 'Starting extraction...';
    this.extractedItems = [];
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Check for legacy .doc format (binary) which mammoth doesn't support
      if (file.name.toLowerCase().endsWith('.doc')) {
        this.processedText = 'Error: .doc format (binary) is not supported for auto-extraction. Please convert to .docx or PDF and try again.';
        this.errorMessage = 'Legacy .doc files cannot be auto-read. Please enter details manually.';
        this.isExtracting = false;
        return;
      }

      const result = await mammoth.extractRawText({ arrayBuffer });
      this.updateExtractionProgress(70, 'Reading document text...');
      const text = result.value;

      if (!text || text.trim().length === 0) {
        this.processedText = 'Extraction complete but no text found. The document might be scanned or empty.';
        this.errorMessage = 'No text found in document.';
        this.updateExtractionProgress(100);
        this.isExtracting = false;
        this.extractionComplete = true;
        this.beginUploadReadyCountdown();
        return;
      }

      console.log('Extracted text:', text); // For debugging
      this.processedText = text; // DEBUG: Show extracted text in UI

      // Extract Letter No
      // Matches: "Letter No: 123", "L.No. 123", "No. 123"
      const letterNoRegex = /(?:Letter\s*No|L\.?\s*No\.?|No\.?)\s*[:\-\s]\s*([A-Za-z0-9\/\-]+)/i;
      const letterMatch = text.match(letterNoRegex);
      if (letterMatch && letterMatch[1]) {
        this.letterNo = letterMatch[1].trim();
      } else {
        this.letterNo = '';
      }

      // Extract Date
      // Matches: "Date: 01/01/2026", "Dated: 2026-01-01", or just date patterns
      const dateRegex = /(?:Date|Dated)\s*[:\-\s]\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i;
      const dateMatch = text.match(dateRegex);

      if (dateMatch && dateMatch[1]) {
        // Convert to YYYY-MM-DD for input type="date"
        this.letterDate = this.parseDate(dateMatch[1]);
      } else {
        // Fallback: search for any date pattern if explicit label not found
        const generalDateRegex = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/;
        const generalMatch = text.match(generalDateRegex);
        if (generalMatch) {
          this.letterDate = `${generalMatch[3]}-${generalMatch[2].padStart(2, '0')}-${generalMatch[1].padStart(2, '0')}`;
        } else {
          this.letterDate = '';
        }
      }

      // Extract Sub, Ref, and Description
      this.extractSubRefDesc(text);
      this.documentType = this.detectDocumentType(text);

      // Detect Schedules
      this.detectSchedules(text);

      // Extract Items (DOCX)
      this.extractItemsFromDocx(text);
      this.updateExtractionProgress(100);
      this.extractionComplete = true;
      this.beginUploadReadyCountdown();

    } catch (error: any) {
      console.error('Error parsing document:', error);
      this.processedText = 'Error parsing document: ' + (error.message || error);
      this.errorMessage = 'Could not read document text. Please check the file.';
    } finally {
      this.isExtracting = false;
    }
  }

  parseDate(dateString: string): string {
    // Basic parser for DD/MM/YYYY or DD-MM-YYYY
    const parts = dateString.split(/[\/\.\-]/);
    if (parts.length === 3) {
      // Assuming DD-MM-YYYY
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  }

  private hasUsablePdfText(text: string): boolean {
    const normalized = (text || '').replace(/\s+/g, ' ').trim();
    if (!normalized || normalized.length < 60) {
      return false;
    }

    const alphaNumCount = (normalized.match(/[A-Za-z0-9]/g) || []).length;
    const hasDocKeywords = /(letter|subject|reference|ref\.?|date|schedule|item|description)/i.test(normalized);

    // Accept if either: enough clear structure keywords, or enough OCR-like dense text.
    return (hasDocKeywords && alphaNumCount >= 40) || alphaNumCount >= 200;
  }

  private async runPdfOcr(pdf: any, numPages: number): Promise<string> {
    let fullText = '';
    const pagesToProcess = Math.min(numPages, this.ocrMaxPages);
    const startedAt = Date.now();

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      if (Date.now() - startedAt > this.ocrTimeBudgetMs) {
        this.updateExtractionProgress(90, `OCR time budget reached after ${pageNum - 1} page(s). Finishing with partial text...`);
        break;
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to initialize OCR canvas context.');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport } as any).promise;

      const imageUrl = canvas.toDataURL('image/png');
      const ocrResult = await Tesseract.recognize(imageUrl, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            const ocrOverall = 40 + Math.round((((pageNum - 1) + m.progress) / pagesToProcess) * 50);
            this.updateExtractionProgress(ocrOverall, `Running OCR on page ${pageNum} of ${pagesToProcess}... ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      fullText += (ocrResult?.data?.text || '') + '\n';
      const completedPageProgress = 40 + Math.round((pageNum / pagesToProcess) * 50);
      this.updateExtractionProgress(completedPageProgress, `Running OCR on page ${pageNum} of ${pagesToProcess}... 100%`);
      await this.yieldToUi();
    }

    if (numPages > pagesToProcess) {
      this.updateExtractionProgress(90, `OCR processed first ${pagesToProcess} of ${numPages} pages. Finishing extraction...`);
    }

    return fullText;
  }

  private getScheduleNo(scheduleText: string): string {
    const match = (scheduleText || '').match(/Schedule\s*([A-Z0-9]+)/i);
    return match ? match[1].toUpperCase() : '';
  }

  async extractPdfMetadata(file: File) {
    this.isExtracting = true;
    this.extractionComplete = false;
    this.uploadReady = false;
    this.waitingSecondsLeft = 0;
    this.clearUploadReadyTimer();
    this.updateExtractionProgress(0, 'Starting PDF extraction...');
    this.processedText = 'Starting PDF extraction...';
    this.extractedItems = [];
    try {
      // Prefer local bundled worker to avoid CDN/network failures during extraction.
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.loadPdfDocument(arrayBuffer, 120000);

      let fullText = '';
      let allTextItems: any[] = []; // Store all text items with positions
      const numPages = pdf.numPages;
      let usedOcrFallback = false;

      this.processedText = `Scanning ${numPages} page(s)...`;
      this.updateExtractionProgress(5, `Scanning ${numPages} page(s)...`);

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';

        // Collect positioned text items for table extraction with page context
        const itemsWithPage = textContent.items.map((item: any) => ({
          ...item,
          pageNum: pageNum
        }));
        allTextItems.push(...itemsWithPage);

        const scanProgress = 5 + Math.round((pageNum / numPages) * 35);
        this.updateExtractionProgress(scanProgress, `Scanning page ${pageNum} of ${numPages}...`);
        await this.yieldToUi();
      }

      if (!this.hasUsablePdfText(fullText)) {
        usedOcrFallback = true;
        const hadSomeText = !!(fullText && fullText.trim().length > 0);
        const ocrStartMessage = hadSomeText
          ? 'PDF text layer is weak/unusable. Starting OCR on first pages for faster extraction...'
          : 'PDF contains no text layer. Starting OCR on first pages...';
        this.updateExtractionProgress(40, ocrStartMessage);
        this.processedText = ocrStartMessage;
        allTextItems = [];
        const ocrText = await this.runPdfOcr(pdf, numPages);
        fullText = [fullText, ocrText].filter(Boolean).join('\n');

        if (!fullText || fullText.trim().length === 0) {
          this.processedText = 'OCR complete but no text could be recognized. The document might be image-only or unclear.';
          this.errorMessage = 'Could not extract text from scanned PDF.';
          this.updateExtractionProgress(100);
            this.extractionComplete = true;
          this.beginUploadReadyCountdown();
          return;
        }
      }

      console.log('Extracted PDF text:', fullText);
      this.processedText = fullText;
      this.updateExtractionProgress(93, 'Parsing extracted text...');

      // Extract Letter No
      const letterNoRegex = /(?:Letter\s*No|L\.?\s*No\.?|No\.?)\s*[:\-\s]*([A-Za-z0-9\s\/\-]+?)(?=\s*(?:Date|Dated|Subject|\n\n|$))/is;
      const letterMatch = fullText.match(letterNoRegex);
      if (letterMatch && letterMatch[1]) {
        this.letterNo = letterMatch[1].trim().replace(/\s+/g, ' ');
      } else {
        this.letterNo = '';
      }

      // Extract Date
      const dateRegex = /(?:Date|Dated)\s*[:\-\s]\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i;
      const dateMatch = fullText.match(dateRegex);

      if (dateMatch && dateMatch[1]) {
        this.letterDate = this.parseDate(dateMatch[1]);
      } else {
        const generalDateRegex = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/;
        const generalMatch = fullText.match(generalDateRegex);
        this.letterDate = generalMatch ? `${generalMatch[3]}-${generalMatch[2].padStart(2, '0')}-${generalMatch[1].padStart(2, '0')}` : '';
      }

      // Extract Sub, Ref, and Description
      this.extractSubRefDesc(fullText);
      this.documentType = this.detectDocumentType(fullText);

      // Detect Schedules
      this.detectSchedules(fullText);

      // Prefer parsing the textual Item Breakup stream when available because
      // many IREPS PDFs flatten visual table cells but still preserve ordered text.
      const breakupItems = this.extractItemsFromAwardedBreakupText(fullText);

      // Extract table data
      if (!usedOcrFallback && allTextItems.length > 0) {
        this.extractTableFromPdf(allTextItems);
      } else {
        this.extractItemsFromDocx(fullText);
      }

      // If column-based parser couldn't populate numeric fields, recover them from raw text
      this.enrichItemsFromRawText(fullText);

      if (breakupItems.length > this.extractedItems.length) {
        this.extractedItems = breakupItems;
      }

      this.updateExtractionProgress(100, 'Extraction complete.');
      this.extractionComplete = true;
      this.beginUploadReadyCountdown();

    } catch (error: any) {
      console.error('Error parsing PDF:', error);
      this.processedText = 'Error parsing PDF: ' + (error.message || error);
      this.errorMessage = 'Could not read PDF text. Please check the file.';
    } finally {
      this.isExtracting = false;
    }
  }

  private async extractPdfMetadataWithTimeout(file: File, timeoutMs: number): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('PDF_EXTRACTION_TIMEOUT')), timeoutMs);
    });

    try {
      await Promise.race([this.extractPdfMetadata(file), timeoutPromise]);
    } catch (error: any) {
      if (error?.message === 'PDF_EXTRACTION_TIMEOUT') {
        this.isExtracting = false;
        this.errorMessage = 'PDF extraction timed out. Please fill details manually or try a smaller PDF.';
        this.updateExtractionProgress(100, 'Extraction timed out. Manual entry mode enabled.');
        this.extractionComplete = true;
        this.beginUploadReadyCountdown();
        return;
      }
      throw error;
    }
  }

  private completeLargePdfManualMode(file: File): void {
    this.isExtracting = false;
    this.errorMessage = '';
    this.extractedItems = [];
    this.comparisonItems = [];
    this.sorMatchedItems = [];
    this.loaWrongItems = [];
    this.comparisonSummary = {
      totalItems: 0,
      correctItems: 0,
      wrongItems: 0
    };
    this.letterNo = '';
    this.letterDate = '';
    this.letterSub = '';
    this.letterRef = '';
    this.letterDescription = '';
    this.updateExtractionProgress(100, 'Large PDF detected. Auto-extraction skipped; manual entry is ready.');
    this.processedText = `Skipped auto-extraction for large PDF: ${file.name}. Fill the details below and continue.`;
    this.extractionComplete = true;
    this.beginUploadReadyCountdown();
  }

  private updateExtractionProgress(progress: number, statusMessage?: string) {
    this.extractionProgress = Math.max(0, Math.min(100, Math.round(progress)));
    if (statusMessage) {
      this.processedText = statusMessage;
    }
  }

  private async loadPdfDocument(data: ArrayBuffer, timeoutMs: number): Promise<any> {
    const loadingTask = pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableStream: false
    } as any);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('PDF load timeout')), timeoutMs);
      });
      return await Promise.race([loadingTask.promise, timeoutPromise]);
    } finally {
      // no-op
    }
  }

  private async yieldToUi(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  extractTableFromPdf(textItems: any[]) {
    try {
      console.log('Sorting and grouping', textItems.length, 'items');

      const rowTolerance = 6;
      const rows: Map<string, any[]> = new Map();

      textItems.forEach(item => {
        if (!item.transform || !item.str || item.str.trim() === '') return;

        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        const pageNum = item.pageNum || 1;

        let foundRow = false;
        const pagePrefix = `${pageNum}_`;
        for (const [key, rowItems] of rows.entries()) {
          if (key.startsWith(pagePrefix)) {
            const rowY = parseInt(key.split('_')[1]);
            if (Math.abs(rowY - y) <= rowTolerance) {
              rowItems.push({ text: item.str, x, y: rowY, pageNum });
              foundRow = true;
              break;
            }
          }
        }

        if (!foundRow) {
          rows.set(`${pageNum}_${y}`, [{ text: item.str, x, y, pageNum }]);
        }
      });

      const sortedRows = Array.from(rows.entries())
        .sort((a, b) => {
          const [pA, yA] = a[0].split('_').map(Number);
          const [pB, yB] = b[0].split('_').map(Number);
          if (pA !== pB) return pA - pB;
          return yB - yA;
        })
        .map(([_, items]) => items.sort((a, b) => a.x - b.x));

      this.extractedItems = [];
      let currentSchedule = 'General';
      let currentScheduleNo = '';
      // columnRanges maps logical field names to X ranges
      let columnRanges: { role: string, startX: number, endX: number }[] = [];
      let isTableDetected = false;
      let lastItem: ExtractedItem | null = null;
      // Accumulate multi-row header cells keyed by X-bucket
      let pendingHeaderBuckets: Map<number, string[]> = new Map();
      let inHeaderAccumulation = false;
      let headerAccumulationRows = 0;

      /** Map a normalised column label string to a logical role */
      const resolveRole = (label: string): string => {
        const l = label.toLowerCase().replace(/[\s\.\(\)\/]/g, '');
        if (/^(itemsno|sno|item\.?sno|sl\.?no|s\.?no|srno|no\.?)$/.test(l)) return 'sno';
        if (/itemcode/.test(l)) return 'itemno';
        if (/(itemdesc|desc|description)/.test(l)) return 'description';
        if (/(itemqty|qty)/.test(l) && !l.includes('unit')) return 'quantity';
        if (/(qtyunit|unitqty)/.test(l)) return 'unit';
        if (/(unitrate|rate)/.test(l) && !l.includes('bid') && !l.includes('advt')) return 'rate';
        if (/(advt|advertisedvalue|advtvalue)/.test(l)) return 'advt';
        if (/(escl|escalation)/.test(l)) return 'escl';
        if (/(bidrate|bidamount|bidamt)/.test(l)) return 'amount';
        if (/amount/.test(l)) return 'amount';
        if (/unit/.test(l)) return 'unit';
        return l;
      };

      /** Try to build column ranges from accumulated header buckets */
      const buildColumnRanges = (buckets: Map<number, string[]>, rowXs: number[]): { role: string, startX: number, endX: number }[] => {
        const cols: { role: string, startX: number, endX: number }[] = [];
        const sortedXs = Array.from(buckets.keys()).sort((a, b) => a - b);
        sortedXs.forEach((xKey, idx) => {
          const label = (buckets.get(xKey) || []).join(' ');
          const role = resolveRole(label);
          const nextX = sortedXs[idx + 1] ?? 9999;
          cols.push({ role, startX: xKey - 8, endX: nextX - 8 });
        });
        return cols;
      };

      /** Classify a row based on what's in it */
      const isHeaderLike = (rowTextLower: string): boolean => {
        const triggers = ['item sno', 'item sno.', 'item desc', 'item code', 'item qty',
                          'qty unit', 'unit rate', 'escl', 'advt', 'bid rate', 'bid amount',
                          // fallback generic
                          'description', 'quantity', 'unit', 'rate', 'amount',
                          's no', 's.no', 'sno', 'sl.no'];
        return triggers.filter(t => rowTextLower.includes(t)).length >= 2;
      };

      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        const rowText = row.map(item => item.text).join(' ');
        const rowTextLower = rowText.toLowerCase();

        // ── 1. Schedule label rows ──────────────────────────────────────────
        const scheduleMatch = rowText.match(/Schedule\s*[-–]?\s*([A-G])\b/i);
        if (scheduleMatch) {
          const letter = scheduleMatch[1].toUpperCase();
          currentSchedule = `Schedule ${letter}`;
          currentScheduleNo = letter;
          // Keep table active across schedule headers (items continue below)
          lastItem = null;
          continue;
        }

        // Stop on schedule/grand totals lines
        if (/schedule\s+total|grand\s+total|total\s+value/i.test(rowTextLower)) {
          lastItem = null;
          continue;
        }

        // ── 2. Header row detection (handles multi-row headers) ────────────
        if (isHeaderLike(rowTextLower)) {
          if (!inHeaderAccumulation) {
            pendingHeaderBuckets = new Map();
            inHeaderAccumulation = true;
            headerAccumulationRows = 0;
          }
          // Bucket each cell by its X position (rounded to nearest 4px)
          row.forEach(cell => {
            const xBucket = Math.round(cell.x / 4) * 4;
            if (!pendingHeaderBuckets.has(xBucket)) pendingHeaderBuckets.set(xBucket, []);
            pendingHeaderBuckets.get(xBucket)!.push(cell.text.trim());
          });
          headerAccumulationRows++;
          // Allow up to 3 rows for the header then lock in
          const nextRow = sortedRows[i + 1];
          const nextText = (nextRow || []).map((c: any) => c.text).join(' ').toLowerCase();
          if (!isHeaderLike(nextText) || headerAccumulationRows >= 3) {
            columnRanges = buildColumnRanges(pendingHeaderBuckets, row.map(c => c.x));
            isTableDetected = columnRanges.some(c => c.role === 'sno' || c.role === 'description');
            inHeaderAccumulation = false;
            lastItem = null;
          }
          continue;
        }
        inHeaderAccumulation = false;

        // ── 3. Data row parsing ─────────────────────────────────────────────
        if (isTableDetected && row.length > 0 && columnRanges.length > 0) {
          // Find S.No cell value
          let sNoText = '';
          const sNoCol = columnRanges.find(c => c.role === 'sno');
          if (sNoCol) {
            const sNoCell = row.find(c => c.x >= sNoCol.startX && c.x < sNoCol.endX);
            if (sNoCell) sNoText = sNoCell.text.trim();
          } else {
            // Fallback: first cell if it looks numeric
            sNoText = row[0]?.text?.trim() ?? '';
          }

          if (/^\d+$/.test(sNoText)) {
            // ── New item row ─────────────────────────────────────────────
            const item: ExtractedItem = {
              description: '',
              schedule: currentSchedule,
              scheduleNo: currentScheduleNo || this.getScheduleNo(currentSchedule),
              pageNo: row[0]?.pageNum || 1,
              sno: sNoText
            };

            row.forEach(cell => {
              const col = columnRanges.find(r => cell.x >= r.startX && cell.x < r.endX);
              if (!col) return;
              const cellText = cell.text.trim();
              switch (col.role) {
                case 'sno':        item.sno = cellText; break;
                case 'itemno':     item.itemNo = cellText; break;
                case 'description':item.description += (item.description ? ' ' : '') + cellText; break;
                case 'quantity': {
                  const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                  if (!isNaN(v)) item.quantity = v;
                  break;
                }
                case 'unit':       if (!item.unit) item.unit = cellText; break;
                case 'rate': {
                  const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                  if (!isNaN(v)) item.rate = v;
                  break;
                }
                case 'amount': {
                  const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                  if (!isNaN(v)) item.amount = v;
                  break;
                }
                // advt.value → use as rate if rate not yet set
                case 'advt': {
                  const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                  if (!isNaN(v) && !item.rate) item.rate = v;
                  break;
                }
              }
            });

            this.extractedItems.push(item);
            lastItem = item;

          } else if (lastItem) {
            // ── Continuation row ──────────────────────────────────────────
            const allText = row.map(c => c.text).join(' ').trim();
            if (!allText) continue;

            let appended = false;
            row.forEach(cell => {
              const col = columnRanges.find(r => cell.x >= r.startX && cell.x < r.endX);
              if (!col) return;
              const cellText = cell.text.trim();
              if (!cellText) return;
              switch (col.role) {
                case 'description':
                  lastItem!.description += ' ' + cellText;
                  appended = true;
                  break;
                case 'quantity':
                  if (!lastItem!.quantity) {
                    const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(v)) { lastItem!.quantity = v; appended = true; }
                  }
                  break;
                case 'unit':
                  if (!lastItem!.unit) { lastItem!.unit = cellText; appended = true; }
                  break;
                case 'rate':
                  if (!lastItem!.rate) {
                    const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(v)) { lastItem!.rate = v; appended = true; }
                  }
                  break;
                case 'amount':
                  if (!lastItem!.amount) {
                    const v = parseFloat(cellText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(v)) { lastItem!.amount = v; appended = true; }
                  }
                  break;
              }
            });
            // If nothing was column-mapped, append all text to description
            if (!appended) {
              lastItem.description += ' ' + allText;
            }
          }
        }
      }

      this.extractedItems.forEach(i => i.description = i.description.trim().replace(/\s+/g, ' '));
      console.log('Final extraction result:', this.extractedItems.length, 'items', this.extractedItems);
    } catch (e) {
      console.error('Extraction error:', e);
    }
  }

  /**
   * For items whose numeric fields are missing after X-based table extraction,
   * scan the item's own description string for embedded unit + number sequences
   * (produced by ireps.gov.in PDFs where column values concatenate into one text stream).
   */
  enrichItemsFromRawText(_fullText: string): void {
    // Remove false header-row items: real item sno values are small integers
    this.extractedItems = this.extractedItems.filter(item => {
      const n = parseInt(item.sno ?? '0', 10);
      return !isNaN(n) && n > 0 && n <= 9999;
    });

    // All unit alternatives end with \b to prevent partial-word matches like
    // "no" matching inside "normal".
    const unitRe = /(?:\[|\b)(Nos?\.?\b|Rmts?\b|Rmts?\b|Mtrs?\b|Kms?\b|Sqms?\b|Cums?\b|Kgs?\b|Tons?\b|Ltrs?\b|Sets?\b|Jobs?\b|Pairs?\b|Lots?\b|Eachs?\b|L\.?S\.?\b|Running\s+Meter|Numbers?\b|Mtr\b|Rm\b|M\b)/i;

    for (const item of this.extractedItems) {
      if (item.quantity || item.unit || item.rate || item.amount) continue;

      const desc = item.description || '';
      const unitMatch = unitRe.exec(desc);
      if (!unitMatch) continue;

      // Make sure the unit is not immediately followed by ':' (e.g. "No: ..." is a label)
      const charAfterUnit = desc[unitMatch.index + unitMatch[0].length];
      if (charAfterUnit === ':') continue;

      const unitWord = unitMatch[1].replace(/\s+/g, ' ').trim();
      const afterUnit = desc.slice(unitMatch.index + unitMatch[0].length);

      // Collect up to 3 positive numbers after the unit keyword
      const nums = (afterUnit.match(/[\d,]+\.?\d*/g) || [])
        .map(n => parseFloat(n.replace(/,/g, '')))
        .filter(n => !isNaN(n) && n > 0)
        .slice(0, 3);

      if (nums.length < 1) continue;

      // Sanity: the last number should be a plausible amount (> 1)
      if (nums[nums.length - 1] < 1) continue;

      item.unit = unitWord;

      if (nums.length >= 3) {
        item.quantity = nums[0];
        item.rate     = nums[1];
        item.amount   = nums[2];
      } else if (nums.length === 2) {
        // qty  amount  (rate = At Par / SOR rate)
        item.quantity = nums[0];
        item.amount   = nums[1];
      } else {
        item.amount = nums[0];
      }

      // Strip the embedded numeric tail from the description so the table looks clean
      item.description = desc.slice(0, unitMatch.index)
        .replace(/\[?\s*$/, '')   // strip trailing bracket/space
        .trim()
        .replace(/\s+/g, ' ');
    }
  }

  private extractItemsFromAwardedBreakupText(fullText: string): ExtractedItem[] {
    const start = fullText.indexOf('Item Breakup');
    if (start < 0) {
      return [];
    }

    const workingText = fullText
      .slice(start)
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi, ' ')
      .replace(/ireps\.gov\.in\S*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const unitAlternatives = [
      'Square\\s+Foot',
      'Running\\s+Meter',
      'Kilometre',
      'Numbers?',
      'Lumpsum',
      'Metre',
      'Meter',
      'RMT',
      'Mtr',
      'Set',
      'Pair',
      'Sheet',
      'Each',
      'Cum',
      'Sqm',
      'Kg',
      'Ton',
      'Lot',
      'Job',
      'No\\.?',
      'Nos\\.?'
    ].join('|');

    const sectionRegex = /Schedule\s+([A-G])\s*-\s*Schedule[\s\S]*?S\s*No\.?\s*Item\s*No\s*Description of Item\s*Unit\s*Qty\s*Rate\s*Amount\s*([\s\S]*?)(?=\bSchedule\s+[A-G]\s*-\s*Schedule|\bTotal Value\b|\bNet Bid Value\b|$)/gi;
    const blockTailRegex = new RegExp(
      `^(.+?)\\s+(${unitAlternatives})\\s+(\\d[\\d,]*\\.?\\d*)\\s+(\\d[\\d,]*\\.?\\d*)\\s+(\\d[\\d,]*\\.?\\d*)$`,
      'i'
    );

    const extracted: ExtractedItem[] = [];
    let sectionMatch: RegExpExecArray | null;

    while ((sectionMatch = sectionRegex.exec(workingText)) !== null) {
      const scheduleNo = sectionMatch[1].toUpperCase();
      const schedule = `Schedule ${scheduleNo}`;
      const sectionBody = sectionMatch[2];
      const starts = Array.from(sectionBody.matchAll(/\b(\d+)\s+(\d+)\s+/g));

      for (let index = 0; index < starts.length; index++) {
        const current = starts[index];
        const next = starts[index + 1];
        const blockStart = current.index ?? 0;
        const blockEnd = next?.index ?? sectionBody.length;
        const block = sectionBody.slice(blockStart, blockEnd).replace(/\s+/g, ' ').trim();
        const headMatch = block.match(/^(\d+)\s+(\d+)\s+([\s\S]+)$/);
        if (!headMatch) {
          continue;
        }

        const sno = headMatch[1];
        const itemNo = headMatch[2];
        const remainder = headMatch[3].trim();
        const tailMatch = remainder.match(blockTailRegex);
        if (!tailMatch) {
          continue;
        }

        const quantity = parseFloat(tailMatch[3].replace(/,/g, ''));
        const rate = parseFloat(tailMatch[4].replace(/,/g, ''));
        const amount = parseFloat(tailMatch[5].replace(/,/g, ''));

        extracted.push({
          sno,
          itemNo,
          description: tailMatch[1].replace(/\s+/g, ' ').trim(),
          unit: tailMatch[2].replace(/\s+/g, ' ').trim(),
          quantity: Number.isFinite(quantity) ? quantity : undefined,
          rate: Number.isFinite(rate) ? rate : undefined,
          amount: Number.isFinite(amount) ? amount : undefined,
          schedule,
          scheduleNo
        });
      }
    }

    return extracted;
  }

  extractItemsFromDocx(text: string) {
    const lines = text.split('\n');
    let currentSchedule = 'General';
    let currentScheduleNo = '';
    let rawItemBlocks: { sno: string, text: string, schedule: string, scheduleNo: string }[] = [];
    let currentBlock: { sno: string, text: string, schedule: string, scheduleNo: string } | null = null;

    console.log('State-machine DOCX parsing started...');

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // 1. Detect Schedule Changes
      const scheduleMatch = trimmedLine.match(/(?:Schedule\s*-\s*([A-G])|Schedule\s*([A-G]))/i);
      if (scheduleMatch) {
        currentScheduleNo = (scheduleMatch[1] || scheduleMatch[2]).toUpperCase();
        currentSchedule = `Schedule ${currentScheduleNo}`;
        return;
      }

      // 2. Detect New Item Start (Line starts with a standalone number)
      const snoMatch = trimmedLine.match(/^(\d+)(?:\s+|$)/);
      if (snoMatch) {
        // Start a new block
        currentBlock = {
          sno: snoMatch[1],
          text: trimmedLine.substring(snoMatch[1].length).trim(),
          schedule: currentSchedule,
          scheduleNo: currentScheduleNo
        };
        rawItemBlocks.push(currentBlock);
      } else if (currentBlock) {
        // Append to current block's description text
        currentBlock.text += ' ' + trimmedLine;
      }
    });

    // 3. Process Blocks to isolate numeric data (Qty, Unit, Rate, Amount)
    // We assume numbers appear at the END of the captured text block
    rawItemBlocks.forEach(block => {
      // Regex looks for: [Qty] [Unit] [Rate] [Amount] at the end, ignoring trailing punctuation
      // Example: ... some text ... 10.00 NOS 1500.00 15000.00
      const dataRegex = /(\d+\.\d+|\d+)\s+(Nos|No|Each|Cum|Sqm|Kg|Ton|Ltr|M|Rm|Job|Set)\s+(\d+\.\d+|\d+)\s+(\d+\.\d+|\d+)$/i;      const match = block.text.match(dataRegex);

      const item: ExtractedItem = {
        description: block.text,
        schedule: block.schedule,
        scheduleNo: block.scheduleNo || this.getScheduleNo(block.schedule),
        sno: block.sno
      };

      if (match) {
        item.description = block.text.substring(0, match.index).trim();
        item.quantity = parseFloat(match[1]);
        item.unit = match[2];
        item.rate = parseFloat(match[3]);
        item.amount = parseFloat(match[4]);
      }

      // Final cleanup
      item.description = item.description.trim().replace(/\s+/g, ' ');
      if (item.description.length > 5) { // Filter out header noise
        this.extractedItems.push(item);
      }
    });
  }

  detectSchedules(text: string) {
    this.schedules = {};
    // Matches: "Schedule A", "Schedule - A", "Schedule-A"
    // Then looks for a percentage and "above/below" keyword nearby
    const scheduleNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    
    scheduleNames.forEach(name => {
      // Look for "Schedule A" followed by some text then a percentage then above/below
      // Or just a percentage then above/below near the schedule name
      const regex = new RegExp(`Schedule\\s*[-]?\\s*${name}[\\s\\S]{0,150}?(\\d+(?:\\.\\d+)?\\s*%)[\\s\\S]{0,50}?(above|below|excess|less|higher|lower)`, 'i');
      const match = text.match(regex);
      
      if (match) {
        const bidrate = match[1].trim();
        const keyword = match[2].toLowerCase();
        const isabove = ['above', 'excess', 'higher'].includes(keyword);
        
        this.schedules[name.toLowerCase()] = {
          bidrate,
          isabove
        };
      }
    });

    console.log('Detected Schedules:', this.schedules);
  }

  extractSubRefDesc(text: string) {
    // Common body start phrases that should terminate Sub/Ref sections
    const bodyStartPhrases = [
      'The Competent Authority',
      'I am directed to',
      'With reference to',
      'In continuation to',
      'Sir/Madam',
      'Dear Sir',
      'Dear Madam',
      'It is to advise',
      'This is to inform'
    ];
    const bodyStartLookahead = '(?:' + bodyStartPhrases.join('|') + ')';

    // 1. Extract Subject (Sub:)
    const subRegex = new RegExp(`(?:Sub(?:ject)?)\\s*[:\\-\\s]\\s*([\\s\\S]+?)(?=\\s*(?:Ref(?:erence)?|Dated|Sir|Madam|\\n\\n|${bodyStartLookahead}|$))`, 'i');
    const subMatch = text.match(subRegex);
    this.letterSub = subMatch ? subMatch[1].trim().replace(/\s+/g, ' ') : '';

    // 2. Extract Reference (Ref:)
    const refRegex = new RegExp(`(?:Ref(?:erence)?)\\s*[:\\-\\s]\\s*([\\s\\S]+?)(?=\\s*(?:Sir|Madam|Subject|Sub|Dear|\\n\\n|${bodyStartLookahead}|$))`, 'i');
    const refMatch = text.match(refRegex);
    this.letterRef = refMatch ? refMatch[1].trim().replace(/\s+/g, ' ') : '';

    // 3. Extract Description (Between Ref/Sub/Salutation and Closing)
    // Common closings/signatures to cut off description
    const closings = [
      'Yours faithfully',
      'Yours sincerely',
      'Thanking you',
      'With regards',
      'Sd/-',
      'Signature',
      'Digitally Signed',
      'View Signature Details',
      'Awarded Quantities',
      'Item Sno\\.',
      'Schedule [A-G]-',
      // Designations only at start of line or far down
      'Sr\\.DSTE',
      'ADSTE',
      'DSTE',
      'Sr\\.DFM',
      'ADSTE/\\w+',
      'Sr\\.DSTE/\\w+'
    ];

    // Find the end of the ref section or salutation to start description
    const salutationRegex = /(?:Sir|Madam|Dear\s+Sir|Dear\s+Madam|Dear\s+\w+)/i;
    const salutationMatch = text.match(salutationRegex);
    
    let startIndex = 0;
    if (salutationMatch) {
      startIndex = salutationMatch.index! + salutationMatch[0].length;
    } else if (refMatch) {
      // Find the end of the captured ref text in the original text
      const refIndex = text.indexOf(refMatch[1]);
      if (refIndex !== -1) {
        startIndex = refIndex + refMatch[1].length;
      }
    } else if (subMatch) {
      const subIndex = text.indexOf(subMatch[1]);
      if (subIndex !== -1) {
        startIndex = subIndex + subMatch[1].length;
      }
    }

    if (startIndex > 0) {
      let content = text.substring(startIndex).trim();
      
      // Remove any leftover colons or leading small/empty words at the start
      content = content.replace(/^[:\-\s\.]+/ , '').trim();

      let minEndIndex = content.length;
      
      // 1. Prioritize definite signature markers found anywhere (usually at the end)
      const majorMarkers = ['Digitally Signed', 'View Signature Details', 'Awarded Quantities', 'Schedule [A-G]-', 'Yours faithfully', 'Yours sincerely'];
      majorMarkers.forEach(marker => {
        const regex = new RegExp('\\b' + marker, 'i');
        const match = content.match(regex);
        if (match && match.index !== undefined && match.index > 50) {
          if (match.index < minEndIndex) minEndIndex = match.index;
        }
      });

      // 2. Look for ALL CAPS name (2-3 words, total len > 8) which usually starts the signature.
      // We look for it especially if it follows a sentence-ending period or is on a new line.
      // Refined to be more aggressive for names like TAMADA NEELA PAVANI
      const nameRegex = /(?:[\.\n\r]\s*|^)([A-Z]{3,}(?:\s+[A-Z]{2,}){1,4})(?:\s+Digitally|\s+Sr\.|\s+ADSTE|\s+Sd\/|-|\s*[(]|\s*\n|$)/;
      const nameMatch = content.match(nameRegex);
      if (nameMatch && nameMatch.index !== undefined) {
          const namePart = nameMatch[1].trim();
          const nameStartAbs = content.indexOf(namePart, nameMatch.index);
          if (nameStartAbs !== -1 && nameStartAbs < minEndIndex && nameStartAbs > content.length * 0.4) {
              minEndIndex = nameStartAbs;
          }
      }

      // 3. Handle designations (Sr.DSTE etc) carefully
      const minorMarkers = ['Sr\\.DSTE', 'ADSTE', 'DSTE', 'Sr\\.DFM', 'Sd/-', 'Signature', 'Sr\\. Divisional'];
      minorMarkers.forEach(marker => {
        const regex = new RegExp('(?<!authority:\\s*|charge:\\s*|Offi:\\s*|Supe:\\s*|Portion:\\s*)\\b' + marker + '\\b', 'i');
        const match = content.match(regex);
        if (match && match.index !== undefined && match.index > 50) {
           if (match.index < minEndIndex && match.index > content.length * 0.7) {
             minEndIndex = match.index;
           }
        }
      });

      // 4. Protection & Precise Cut: Ensure "All Other terms and conditions" is kept, 
      // but anything after its period is candidates for cutting.
      const protectPhrase = "All Other terms and conditions";
      const protectIndex = content.toLowerCase().lastIndexOf(protectPhrase.toLowerCase());
      
      if (protectIndex !== -1) {
          // Find the period immediately following the protected phrase
          const afterProtect = content.substring(protectIndex);
          const periodIdx = afterProtect.indexOf('.');
          if (periodIdx !== -1) {
              const fullSentenceEnd = protectIndex + periodIdx + 1;
              
              // If we have a signature match that cut the sentence too early, restore it
              if (minEndIndex < fullSentenceEnd) {
                  minEndIndex = fullSentenceEnd;
              }
              
              // CRITICAL: If there's text after the period, and we didn't already cut it off,
              // check if it looks like a signature start (Name or Designation).
              const residue = content.substring(fullSentenceEnd).trim();
              if (residue.length > 0) {
                  // If residue starts with ALL CAPS (name) or a known designation, cut at the period.
                  const startsWithCaps = /^[A-Z]{3,}/.test(residue);
                  const startsWithDesignation = /^(?:TAMADA|Sr\.|ADSTE|DSTE|Sd\/|Yours|Digitally)/i.test(residue);
                  
                  if (startsWithCaps || startsWithDesignation) {
                      minEndIndex = fullSentenceEnd;
                  }
              }
          }
      }

      this.letterDescription = content.substring(0, minEndIndex).trim().replace(/\s+/g, ' ');

      // Final check: if description was completely swallowed by Ref/Sub, 
      // check if the body starts immediately after Ref/Sub
      if (this.letterDescription === '' || this.letterDescription.length < 10) {
          // Fallback logic could go here if needed
      }
    } else {
      this.letterDescription = '';
    }
  }

  getFinalJson() {
    // Construct JSON with schedules between letterNo and letterDate
    const result: any = {
      documentType: this.documentType,
      letterNo: this.letterNo,
      subject: this.letterSub,
      reference: this.letterRef,
      description: this.letterDescription
    };

    // Add schedules in order
    Object.keys(this.schedules).sort().forEach(key => {
      result[`schedule ${key}`] = this.schedules[key];
    });

    result.letterDate = this.letterDate;
    result.items = this.getNormalizedItems();
    result.comparison = this.getComparisonJson();

    return result;
  }

  private getNormalizedItems(): NormalizedLoaItem[] {
    return this.extractedItems.map((item, index) => {
      const matchedComparison = this.comparisonItems.find(comparison =>
        comparison.index === index + 1 ||
        this.normalizeForExactMatch(comparison.loaItem.description) === this.normalizeForExactMatch(item.description)
      );
      const matchedSorItemNo = matchedComparison?.itemtype === 'SOR' ? (matchedComparison.sorItem?.itemNo || '') : '';
      const scheduleNo = item.scheduleNo || this.getScheduleNo(item.schedule || '');
      const pageNo = item.pageNo || 1;
      const rate = Number(item.rate ?? 0);
      const amount = Number(item.amount ?? 0);

      return {
        slNo: index + 1,
        description: item.description || '',
        qty: item.quantity,
        unit: item.unit || '',
        rateInRs: rate,
        totalCashRs: amount,
        totalRs: amount,
        reference: this.buildItemReference(scheduleNo),
        schedule: scheduleNo,
        page_no: pageNo,
        bidRate: rate,
        fileType: item.itemtype === 'SOR' ? 'SOR' : 'NOT',
        Matched_items_no: matchedSorItemNo
      };
    });
  }

  private buildItemReference(scheduleNo: string): string {
    const baseReference = this.letterRef || this.letterNo || '';
    const normalizedSchedule = (scheduleNo || '').trim().toUpperCase();

    if (!normalizedSchedule) {
      return baseReference;
    }

    if (baseReference.toLowerCase().includes(`schedule ${normalizedSchedule.toLowerCase()}`)) {
      return baseReference;
    }

    return baseReference ? `${baseReference} / Schedule ${normalizedSchedule}` : `Schedule ${normalizedSchedule}`;
  }

  getComparisonJson() {
    return {
      referenceType: 'SOR',
      summary: this.comparisonSummary,
      matchedItems: this.comparisonItems.filter(item => item.itemtype === 'SOR'),
      wrongItems: this.comparisonItems.filter(item => item.itemtype !== 'SOR'),
      items: this.comparisonItems
    };
  }

  private normalizeText(value: string): string {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(value: string): string[] {
    return this.normalizeText(value)
      .split(' ')
      .filter(token => token.length > 2);
  }

  private scoreMatch(loaItem: ExtractedItem, sorItem: SorReferenceItem): number {
    const loaText = this.normalizeText(loaItem.description);
    const sorText = this.normalizeText(sorItem.item);

    if (!loaText || !sorText) {
      return 0;
    }

    if (loaText === sorText) {
      return 1;
    }

    const loaTokens = new Set(this.tokenize(loaText));
    const sorTokens = new Set(this.tokenize(sorText));
    const intersection = [...loaTokens].filter(token => sorTokens.has(token)).length;
    const union = new Set([...loaTokens, ...sorTokens]).size || 1;
    return intersection / union;
  }

  private normalizeForExactMatch(value: string): string {
    return this.normalizeText(value).replace(/\b(no|nos|number|item|items)\b/g, '').replace(/\s+/g, ' ').trim();
  }

  private async loadSorReferenceItems(): Promise<void> {
    if (this.sorReferenceLoaded) {
      return;
    }

    try {
      const response = await fetch('assets/converted/SOR.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload: SorConvertedPayload = await response.json();
      const flattened: SorReferenceItem[] = [];

      Object.keys(payload.chapters || {})
        .sort((a, b) => Number(a) - Number(b))
        .forEach(chapterKey => {
          const chapter = payload.chapters?.[chapterKey];
          (chapter?.items || []).forEach(item => {
            flattened.push({
              itemNo: item.item_no || '',
              item: item.description || '',
              unit: item.unit || '',
              rate: String(item.rate ?? ''),
              page: Number(item.chapter ?? chapterKey)
            });
          });
        });

      this.sorReferenceItems = flattened;
      this.sorReferenceLoaded = true;
    } catch (error) {
      console.error('Failed to load SOR reference items', error);
      this.sorReferenceItems = [];
    }
  }

  private async buildSorComparison(): Promise<void> {
    await this.loadSorReferenceItems();

    if (!this.extractedItems.length || !this.sorReferenceItems.length) {
      this.comparisonItems = [];
      this.sorMatchedItems = [];
      this.loaWrongItems = [];
      this.comparisonSummary = {
        totalItems: this.extractedItems.length,
        correctItems: 0,
        wrongItems: this.extractedItems.length
      };
      this.extractedItems = this.extractedItems.map(item => ({
        ...item,
        itemtype: 'NOT_SOR'
      }));
      return;
    }

    const results: ComparisonItem[] = [];

    this.extractedItems = this.extractedItems.map((loaItem, index) => {
      let bestMatch: SorReferenceItem | null = null;
      let bestScore = 0;
      const loaExact = this.normalizeForExactMatch(loaItem.description);

      for (const sorItem of this.sorReferenceItems) {
        const score = this.scoreMatch(loaItem, sorItem);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = sorItem;
        }
      }

      const exactMatch = bestMatch ? this.normalizeForExactMatch(bestMatch.item) === loaExact : false;
      const itemtype: 'SOR' | 'NOT_SOR' = exactMatch ? 'SOR' : 'NOT_SOR';
      const comparisonItem: ComparisonItem = {
        index: index + 1,
        itemtype,
        status: itemtype === 'SOR' ? 'correct' : 'wrong',
        matchScore: Number((exactMatch ? 1 : bestScore).toFixed(2)),
        loaItem: {
          ...loaItem,
          itemtype
        },
        sorItem: bestMatch,
        reason: itemtype === 'SOR' ? 'Exact description match with SOR' : 'Description does not exactly match SOR'
      };

      results.push(comparisonItem);

      return {
        ...loaItem,
        itemtype
      };
    });

    this.comparisonItems = results;
    this.refreshComparisonLists();
    this.comparisonSummary = {
      totalItems: results.length,
      correctItems: results.filter(item => item.itemtype === 'SOR').length,
      wrongItems: results.filter(item => item.itemtype !== 'SOR').length
    };
  }

  private refreshComparisonLists(): void {
    this.sorMatchedItems = this.comparisonItems.filter(item => item.itemtype === 'SOR');
    this.loaWrongItems = this.comparisonItems.filter(item => item.itemtype !== 'SOR');
    this.comparisonSummary = {
      totalItems: this.comparisonItems.length,
      correctItems: this.sorMatchedItems.length,
      wrongItems: this.loaWrongItems.length
    };
  }

  markComparisonCorrect(index: number): void {
    const item = this.comparisonItems[index];
    if (!item) return;
    item.itemtype = 'SOR';
    item.status = 'correct';
    item.reason = 'Manually marked as SOR';
    item.loaItem.itemtype = 'SOR';
    this.refreshComparisonLists();
  }

  markComparisonWrong(index: number): void {
    const item = this.comparisonItems[index];
    if (!item) return;
    item.itemtype = 'NOT_SOR';
    item.status = 'wrong';
    item.reason = 'Removed from SOR list';
    item.loaItem.itemtype = 'NOT_SOR';
    this.refreshComparisonLists();
  }

  markItemAsSor(index: number): void {
    const item = this.comparisonItems[index];
    if (!item) return;
    item.itemtype = 'SOR';
    item.status = 'correct';
    item.reason = 'Marked as SOR via action';
    item.loaItem.itemtype = 'SOR';
    this.refreshComparisonLists();
  }

  markItemAsWrong(index: number): void {
    const item = this.comparisonItems[index];
    if (!item) return;
    item.itemtype = 'NOT_SOR';
    item.status = 'wrong';
    item.reason = 'Marked as wrong via action';
    item.loaItem.itemtype = 'NOT_SOR';
    this.refreshComparisonLists();
  }

  detectDocumentType(text: string): ReferenceDocumentType {
    const v = (text || '').toLowerCase();

    if (v.includes('01052610112449') || v.includes('s&t/t/cr/2024') || v.includes('training centre')) {
      return 'STTC';
    }

    if (v.includes('01052610118677') || v.includes('zonal/engg/2024') || v.includes('zonal')) {
      return 'ZONAL_2024';
    }

    if (v.includes('00850890090468') || v.includes('abss') || v.includes('y-sg-36-2023-24-09')) {
      return 'LOA_ABSS';
    }

    if (v.includes('sor 2024') || v.includes('sor')) {
      return 'SOR_2024';
    }

    return this.documentType || 'LOA_ABSS';
  }

  clearFile(event: Event) {
    if (event) event.stopPropagation();
    this.selectedFile = null;
    this.errorMessage = '';
    this.isExtracting = false;
    this.extractionProgress = 0;
    this.extractionComplete = false;
    this.uploadReady = false;
    this.waitingSecondsLeft = 0;
    this.letterNo = '';
    this.letterDate = '';
    this.letterSub = '';
    this.letterRef = '';
    this.letterDescription = '';
    this.extractedItems = [];
    this.sorReferenceItems = [];
    this.comparisonItems = [];
    this.comparisonSummary = {
      totalItems: 0,
      correctItems: 0,
      wrongItems: 0
    };
    this.processedText = '';
    this.schedules = {};
    this.clearUploadReadyTimer();
    this.clearPdfHistory();
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private beginUploadReadyCountdown(seconds = 3): void {
    this.clearUploadReadyTimer();
    this.waitingSecondsLeft = Math.max(0, Math.floor(seconds));

    if (this.waitingSecondsLeft === 0) {
      this.uploadReady = true;
      this.changeDetectorRef.detectChanges();
      return;
    }

    this.uploadReady = false;
    this.uploadReadyTimer = window.setInterval(() => {
      this.waitingSecondsLeft = Math.max(0, this.waitingSecondsLeft - 1);

      if (this.waitingSecondsLeft <= 0) {
        this.clearUploadReadyTimer();
        this.uploadReady = true;
      }

      this.changeDetectorRef.detectChanges();
    }, 1000);
  }

  private clearUploadReadyTimer(): void {
    if (this.uploadReadyTimer !== null) {
      window.clearInterval(this.uploadReadyTimer);
      this.uploadReadyTimer = null;
    }
  }

  private updatePdfHistory(file: File): void {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf && this.currentPdfObjectUrl) {
      if (this.previousPdfObjectUrl) {
        URL.revokeObjectURL(this.previousPdfObjectUrl);
      }
      this.previousPdfObjectUrl = this.currentPdfObjectUrl;
      this.previousPdfName = this.currentPdfName;
    }

    if (isPdf) {
      this.currentPdfObjectUrl = URL.createObjectURL(file);
      this.currentPdfName = file.name;
    }
  }

  private clearPdfHistory(): void {
    if (this.currentPdfObjectUrl) {
      URL.revokeObjectURL(this.currentPdfObjectUrl);
    }
    if (this.previousPdfObjectUrl) {
      URL.revokeObjectURL(this.previousPdfObjectUrl);
    }
    this.currentPdfObjectUrl = null;
    this.previousPdfObjectUrl = null;
    this.currentPdfName = '';
    this.previousPdfName = '';
  }

  openPdf(url: string | null): void {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  uploadFile() {
    if (!this.selectedFile || !this.uploadReady) return;
    alert(`File "${this.selectedFile.name}" prepared for upload!\nLetter No: ${this.letterNo}\nDate: ${this.letterDate}\nSubject: ${this.letterSub}\nItems: ${this.extractedItems.length}\nCorrect: ${this.comparisonSummary.correctItems}\nWrong: ${this.comparisonSummary.wrongItems}`);
  }
}
