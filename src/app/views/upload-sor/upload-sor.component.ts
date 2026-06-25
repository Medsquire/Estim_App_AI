import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent, CardBodyComponent, CardHeaderComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

interface ExtractedItem {
  sno?: string;
  description: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
  schedule?: string;
}

interface ScheduleData {
  bidrate: string;
  isabove: boolean;
}

type ReferenceDocumentType = 'LOA_ABSS' | 'STTC' | 'ZONAL_2024' | 'SOR_2024';

@Component({
  selector: 'app-upload-sor',
  template: `
    <c-card class="mb-4">
      <c-card-header>
        <strong>Upload SOR</strong>
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
          
          <h5 class="mb-2">Drag & Drop or Click to Upload SOR</h5>
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
          
          <!-- Extracted Metadata Form -->
          <div class="row g-3 border-top pt-3">
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
        <div *ngIf="extractedItems.length > 0" class="mt-4">
          <h6 class="fw-bold">Extracted Items ({{ extractedItems.length }})</h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>S No.</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Schedule</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of extractedItems; let i = index">
                  <td>{{ i + 1 }}</td>
                  <td>{{ item.description }}</td>
                  <td>{{ item.quantity || '-' }}</td>
                  <td>{{ item.unit || '-' }}</td>
                  <td>{{ item.rate || '-' }}</td>
                  <td>{{ item.amount || '-' }}</td>
                  <td><span class="badge bg-info text-dark">{{ item.schedule || 'N/A' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <details class="mt-3" open>
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
          <button class="btn btn-primary" [disabled]="!selectedFile" (click)="uploadFile()">
            Upload SOR
          </button>
        </div>
      </c-card-body>
    </c-card>

  `,
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, CardBodyComponent, CardHeaderComponent, IconDirective]
})
export class UploadSorComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;

  isDragOver = false;
  selectedFile: File | null = null;
  errorMessage: string = '';

  // Metadata
  letterNo: string = '';
  letterDate: string = '';
  letterSub: string = '';
  letterRef: string = '';
  letterDescription: string = '';
  processedText: string = ''; // For debugging
  extractedItems: ExtractedItem[] = [];
  documentType: ReferenceDocumentType = 'SOR_2024';
  supportedDocumentTypes: { value: ReferenceDocumentType; label: string }[] = [
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

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (validTypes.includes(file.type) || validExtensions.includes(extension)) {
      this.selectedFile = file;
      this.errorMessage = '';
      this.processedText = 'File selected. Analyzing format...';
      this.documentType = this.detectDocumentType(file.name);

      // Auto-extract metadata if it's a DOCX file
      if (extension === '.docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        await this.extractMetadata(file);
      } else if (extension === '.doc' || file.type === 'application/msword') {
        this.processedText = 'Legacy .doc (binary) format detected. Please convert to .docx for auto-extraction.';
        this.errorMessage = 'Legacy .doc files cannot be auto-read. Please enter details manually.';
      } else if (extension === '.pdf' || file.type === 'application/pdf') {
        await this.extractPdfMetadata(file);
      } else {
        this.processedText = 'Unsupported format for auto-extraction.';
        this.letterNo = '';
        this.letterDate = '';
      }
    } else {
      this.selectedFile = null;
      this.errorMessage = 'Invalid file type. Please upload a PDF or Word document.';
      this.processedText = 'Invalid file type.';
    }
  }

  async extractMetadata(file: File) {
    this.processedText = 'Starting extraction...';
    this.extractedItems = [];
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Check for legacy .doc format (binary) which mammoth doesn't support
      if (file.name.toLowerCase().endsWith('.doc')) {
        this.processedText = 'Error: .doc format (binary) is not supported for auto-extraction. Please convert to .docx or PDF and try again.';
        this.errorMessage = 'Legacy .doc files cannot be auto-read. Please enter details manually.';
        return;
      }

      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        this.processedText = 'Extraction complete but no text found. The document might be scanned or empty.';
        this.errorMessage = 'No text found in document.';
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

    } catch (error: any) {
      console.error('Error parsing document:', error);
      this.processedText = 'Error parsing document: ' + (error.message || error);
      this.errorMessage = 'Could not read document text. Please check the file.';
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

  async extractPdfMetadata(file: File) {
    this.processedText = 'Starting PDF extraction...';
    this.extractedItems = [];
    try {
      // Set worker source to use unpkg CDN (more reliable than cdnjs)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      let allTextItems: any[] = []; // Store all text items with positions
      const numPages = pdf.numPages;

      this.processedText = `Scanning ${numPages} page(s)...`;

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

        this.processedText = `Scanning page ${pageNum} of ${numPages}...`;
      }

      if (!fullText || fullText.trim().length === 0) {
        this.processedText = 'PDF extraction complete but no text found. The document might be scanned or image-based.';
        this.errorMessage = 'No text found in PDF.';
        return;
      }

      console.log('Extracted PDF text:', fullText);
      this.processedText = fullText;

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

      // Extract table data
      this.extractTableFromPdf(allTextItems);

    } catch (error: any) {
      console.error('Error parsing PDF:', error);
      this.processedText = 'Error parsing PDF: ' + (error.message || error);
      this.errorMessage = 'Could not read PDF text. Please check the file.';
    }
  }

  extractTableFromPdf(textItems: any[]) {
    try {
      console.log('Sorting and grouping', textItems.length, 'items');

      const rowTolerance = 5;
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
      let columnRanges: { name: string, startX: number, endX: number }[] = [];
      let isTableDetected = false;
      let lastItem: ExtractedItem | null = null;

      const headerKeywords = ['s no', 'itemno', 'description', 'unit', 'qty', 'rate', 'amount'];

      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        const rowText = row.map(item => item.text).join(' ');
        const rowTextLower = rowText.toLowerCase();

        // 1. Detect Schedule
        const scheduleMatch = rowText.match(/(?:Schedule\s*-\s*([A-D])|Schedule\s*([A-D]))/i);
        if (scheduleMatch) {
          const letter = scheduleMatch[1] || scheduleMatch[2];
          currentSchedule = `Schedule ${letter.toUpperCase()}`;
          isTableDetected = false;
          lastItem = null;
          continue;
        }

        // 2. Detect Header Row
        const matchedHeadersCount = headerKeywords.filter(k => rowTextLower.includes(k)).length;
        if (matchedHeadersCount >= 3) {
          columnRanges = [];
          for (let j = 0; j < row.length; j++) {
            const h = row[j];
            const nextX = (j < row.length - 1) ? row[j + 1].x : 1000;
            columnRanges.push({
              name: h.text.toLowerCase().replace(/[\.\s]/g, ''),
              startX: h.x - 5,
              endX: nextX - 5
            });
          }
          isTableDetected = true;
          lastItem = null;
          continue;
        }

        // 3. Stop table parsing on totals
        if (isTableDetected && (rowTextLower.includes('grand total') || rowTextLower.includes('total rs'))) {
          isTableDetected = false;
          lastItem = null;
          continue;
        }

        // 4. Parse Data Row
        if (isTableDetected && row.length > 0) {
          let sNoText = '';
          const sNoCol = columnRanges.find(c => c.name.includes('sno'));
          if (sNoCol) {
            const sNoCell = row.find(c => c.x >= sNoCol.startX && c.x < sNoCol.endX);
            if (sNoCell) sNoText = sNoCell.text.trim();
          }

          if (/^\d+$/.test(sNoText)) {
            // New Primary Row
            const item: ExtractedItem = {
              description: '',
              schedule: currentSchedule,
              sno: sNoText
            };

            row.forEach(cell => {
              const col = columnRanges.find(r => cell.x >= r.startX && cell.x < r.endX);
              if (!col) return;
              const cellText = cell.text.trim();
              const colName = col.name;

              if (colName.includes('description')) item.description = cellText;
              else if (colName.includes('qty')) {
                const val = parseFloat(cellText.replace(/[^0-9\.]/g, ''));
                if (!isNaN(val)) item.quantity = val;
              }
              else if (colName.includes('unit')) item.unit = cellText;
              else if (colName.includes('rate')) {
                const val = parseFloat(cellText.replace(/[^0-9\.]/g, ''));
                if (!isNaN(val)) item.rate = val;
              }
              else if (colName.includes('amount')) {
                const val = parseFloat(cellText.replace(/[^0-9\.]/g, ''));
                if (!isNaN(val)) item.amount = val;
              }
            });

            this.extractedItems.push(item);
            lastItem = item;
          } else if (lastItem) {
            // Continuation Row - Much more robust
            // If row doesn't have a serial number but has text, it's almost certainly a description continuation
            const rowText = row.map(c => c.text).join(' ').trim();
            if (rowText && row.length <= 4) {
              lastItem.description += ' ' + rowText;
            } else {
              // Try to map columns if row is crowded
              row.forEach(cell => {
                const col = columnRanges.find(r => cell.x >= r.startX && cell.x < r.endX);
                if (!col) return;
                const cellText = cell.text.trim();

                if (col.name.includes('description')) {
                  lastItem!.description += ' ' + cellText;
                } else if (col.name.includes('unit') && !lastItem!.unit) {
                  lastItem!.unit = cellText;
                }
              });
            }
          }
        }
      }

      this.extractedItems.forEach(i => i.description = i.description.trim().replace(/\s+/g, ' '));
      console.log('Final extraction result:', this.extractedItems);
    } catch (e) {
      console.error('Extraction error:', e);
    }
  }

  extractItemsFromDocx(text: string) {
    const lines = text.split('\n');
    let currentSchedule = 'General';
    let rawItemBlocks: { sno: string, text: string, schedule: string }[] = [];
    let currentBlock: { sno: string, text: string, schedule: string } | null = null;

    console.log('State-machine DOCX parsing started...');

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // 1. Detect Schedule Changes
      const scheduleMatch = trimmedLine.match(/(?:Schedule\s*-\s*([A-G])|Schedule\s*([A-G]))/i);
      if (scheduleMatch) {
        currentSchedule = `Schedule ${(scheduleMatch[1] || scheduleMatch[2]).toUpperCase()}`;
        return;
      }

      // 2. Detect New Item Start (Line starts with a standalone number)
      const snoMatch = trimmedLine.match(/^(\d+)(?:\s+|$)/);
      if (snoMatch) {
        // Start a new block
        currentBlock = {
          sno: snoMatch[1],
          text: trimmedLine.substring(snoMatch[1].length).trim(),
          schedule: currentSchedule
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
    result.items = this.extractedItems;

    return result;
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

    return this.documentType || 'SOR_2024';
  }

  clearFile(event: Event) {
    if (event) event.stopPropagation();
    this.selectedFile = null;
    this.errorMessage = '';
    this.letterNo = '';
    this.letterDate = '';
    this.letterSub = '';
    this.letterRef = '';
    this.letterDescription = '';
    this.extractedItems = [];
    this.processedText = '';
    this.schedules = {};
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  uploadFile() {
    if (!this.selectedFile) return;
    alert(`File "${this.selectedFile.name}" prepared for upload!\nLetter No: ${this.letterNo}\nDate: ${this.letterDate}\nSubject: ${this.letterSub}\nItems: ${this.extractedItems.length}`);
  }
}
