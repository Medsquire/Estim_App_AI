import { Component, ElementRef, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import * as Tesseract from 'tesseract.js';

import {
  BadgeComponent,
  ButtonCloseDirective,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  RowComponent,
  TableDirective,
  PaginationComponent,
  PageItemDirective,
  PageLinkDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

export interface ExtractedLocItem {
  sno?: string;
  itemNo?: string;
  description: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
  schedule?: string;
}

export interface Estimation {
  fileNo: string;
  ph: string;
  workName: string;
  stCost: number;
  storesCost: number;
  rcilProvision: number;
  status: string;
  remarks: string;
  locSubject?: string;
}

@Component({
  selector: 'app-estimations',
  templateUrl: 'estimations.component.html',
  styleUrls: ['estimations.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    RowComponent,
    ColComponent,
    TableDirective,
    BadgeComponent,
    ButtonDirective,
    ButtonCloseDirective,
    IconDirective,
    PaginationComponent,
    PageItemDirective,
    PageLinkDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent
  ]
})
export class EstimationsComponent implements OnInit {
  // Modal visibility
  isModalVisible = false;

  // LOC Entry Mode
  locEntryMode: 'upload' | 'manual' = 'upload';

  // Manual LOC Entry Data
  manualLocData = {
    fileNo: '',
    ph: '',
    workName: '',
    stCost: 0,
    storesCost: 0,
    rcilProvision: 0,
    status: 'Pending',
    remarks: ''
  };

  // LOC Edit Data (for Work Name and PH in both modes)
  locEditData = {
    ph: '',
    workName: ''
  };

  // Next Estim No tracker
  nextEstimNumber: number = 1;

  // LOC Upload state
  @ViewChild('locFileInput') locFileInput!: ElementRef;
  isLocDragOver = false;
  isLocProcessing = false;
  selectedLocFile: File | null = null;
  locErrorMessage: string = '';
  locLetterNo: string = '';
  locLetterDate: string = '';
  locSubject: string = '';
  locProcessedText: string = '';
  locExtractedItems: ExtractedLocItem[] = [];

  // Form
  estimationForm: FormGroup;

  // Estimations list starts empty
  estimations: Estimation[] = [];

  // Status options
  statusOptions = ['Pending', 'Approved', 'Rejected', 'Completed'];

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;

  constructor(private fb: FormBuilder, private router: Router, private cdr: ChangeDetectorRef) {
    this.estimationForm = this.fb.group({
      fileNo: [''],
      ph: [''],
      workName: ['', Validators.required],
      stCost: [0],
      storesCost: [0],
      rcilProvision: [0],
      status: ['Pending'],
      remarks: ['']
    });
  }

  ngOnInit(): void {
    this.clearEstimationsListOnce();
    this.loadEstimations();
    this.updateNextEstimNumber();
  }

  private clearEstimationsListOnce(): void {
    const clearFlagKey = 'estimationsDataCleared_v1';
    if (localStorage.getItem(clearFlagKey)) {
      return;
    }

    localStorage.removeItem('estimationsData');
    localStorage.setItem(clearFlagKey, 'true');
    this.estimations = [];
    this.currentPage = 1;
  }

  private updateNextEstimNumber(): void {
    // Extract the highest EST number from existing estimations
    let maxNum = 0;
    for (const est of this.estimations) {
      const match = est.fileNo.match(/EST-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
    this.nextEstimNumber = maxNum + 1;
  }

  private getNextEstimNo(): string {
    const estimNo = `Y/AS/Est/26-27/EST-${String(this.nextEstimNumber).padStart(3, '0')}`;
    this.nextEstimNumber++;
    return estimNo;
  }

  private getNextFileNo(): string {
    const fileNo = `EST-${String(this.estimations.length).padStart(3, '0')}`;
    return fileNo;
  }

  loadEstimations(): void {
    const savedEstimations = localStorage.getItem('estimationsData');
    if (savedEstimations) {
      try {
        this.estimations = JSON.parse(savedEstimations);
      } catch (e) {
        console.error('Failed to parse estimations from local storage', e);
      }
    }
  }

  saveEstimationsToStorage(): void {
    localStorage.setItem('estimationsData', JSON.stringify(this.estimations));
  }

  get totalPages(): number {
    return Math.ceil(this.estimations.length / this.itemsPerPage);
  }

  get paginatedEstimations(): Estimation[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.estimations.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      case 'completed': return 'info';
      default: return 'secondary';
    }
  }

  onNewWork(): void {
    this.locEntryMode = 'upload';
    this.resetLocForm();
    this.isModalVisible = true;
  }

  onModalVisibilityChange(isVisible: boolean): void {
    this.isModalVisible = isVisible;
    if (!isVisible) {
      this.resetLocForm();
    }
  }

  resetLocForm(): void {
    this.locEntryMode = 'upload';
    this.selectedLocFile = null;
    this.locLetterNo = '';
    this.locLetterDate = '';
    this.locSubject = '';
    this.locProcessedText = '';
    this.locErrorMessage = '';
    this.locExtractedItems = [];
    this.locEditData = {
      ph: '',
      workName: ''
    };
    this.manualLocData = {
      fileNo: '',
      ph: '',
      workName: '',
      stCost: 0,
      storesCost: 0,
      rcilProvision: 0,
      status: 'Pending',
      remarks: ''
    };
  }

  onSubjectChange(): void {
    // Keep Work Name exactly same as Subject.
    this.locEditData.workName = this.locSubject || '';
  }

  onWorkNameChange(): void {
    // Sync Work Name to Subject
    this.locSubject = this.locEditData.workName || '';
  }

  private extractLocSubject(text: string): string {
    const source = String(text || '');
    if (!source.trim()) {
      return '';
    }

    const subjectStart = source.match(/\bsub(?:ject)?\b\s*[:\-]\s*([\s\S]{0,500})/i);
    if (!subjectStart?.[1]) {
      return '';
    }

    let candidate = subjectStart[1]
      .replace(/^[\s:;,.\-–]+/, '')
      .trim();

    // Stop at typical markers where body/signature begins so only Sub matter remains.
    const stopRegex = /(\*{3,}|\bref(?:erence)?\b|\bdate\b|\bdated\b|\bdear\s+sir\b|\bdear\s+madam\b|\bsir\/?madam\b|\bin\s+connection\b|\bwith\s+reference\b|\bi\s+am\s+directed\b|\bthe\s+competent\s+authority\b|\bview\s+signature\s+details\b|\bawarded\s+quantities\b)/i;
    const stopIdx = candidate.search(stopRegex);
    if (stopIdx >= 0) {
      candidate = candidate.slice(0, stopIdx);
    }

    return candidate.replace(/\s+/g, ' ').trim();
  }

  async onSaveLocFromModal(): Promise<void> {
    if (!this.locEditData.workName || !this.locEditData.workName.trim()) {
      this.locErrorMessage = 'Work Name is required';
      return;
    }

    let fileNo: string;
    let ph: string;
    let workName: string;
    let stCost: number = 0;
    let storesCost: number = 0;
    let rcilProvision: number = 0;
    let status: string = 'Pending';
    let remarks: string = '';

    if (this.locEntryMode === 'upload') {
      // Upload mode - use extracted data
      fileNo = this.getNextFileNo();
      ph = this.locEditData.ph || '';
      workName = this.locEditData.workName;
      remarks = '';
    } else {
      // Manual mode - use manually entered data
      fileNo = this.getNextFileNo();
      ph = this.locEditData.ph || '';
      workName = this.locEditData.workName;
      stCost = this.manualLocData.stCost || 0;
      storesCost = this.manualLocData.storesCost || 0;
      rcilProvision = this.manualLocData.rcilProvision || 0;
      status = this.manualLocData.status || 'Pending';
      remarks = '';
    }

    const newEstimation: Estimation = {
      fileNo: fileNo,
      ph: ph,
      workName: workName,
      stCost: stCost,
      storesCost: storesCost,
      rcilProvision: rcilProvision,
      status: status,
      remarks: remarks,
      locSubject: (this.locSubject || '').trim()
    };

    // Add the new estimation to the list
    this.estimations.unshift(newEstimation);
    this.saveEstimationsToStorage();

    // Persist uploaded LOC PDF so Work Details can load it in "Letter from Concerned Dept."
    await this.saveUploadedLocPdfToStorage(fileNo);

    // Close modal and redirect to work-details page
    this.isModalVisible = false;
    this.resetLocForm();
    this.router.navigate(['/estimations/work-details', fileNo]);
  }

  private async saveUploadedLocPdfToStorage(fileNo: string): Promise<void> {
    if (this.locEntryMode !== 'upload' || !this.selectedLocFile) {
      return;
    }

    const file = this.selectedLocFile;
    const extension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const isPdf = file.type === 'application/pdf' || extension === '.pdf';

    // Letter tab renders PDF, so only store uploaded PDF for direct binding.
    if (!isPdf) {
      return;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    if (dataUrl) {
      localStorage.setItem(`letterPdf_${fileNo}`, dataUrl);
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  onSaveEstimation(): void {
    if (this.estimationForm.valid) {
      const formValue = this.estimationForm.value;
      const newEstimation: Estimation = {
        fileNo: formValue.fileNo || `EST-${String(this.estimations.length + 1).padStart(3, '0')}`,
        ph: formValue.ph || '',
        workName: formValue.workName,
        stCost: formValue.stCost || 0,
        storesCost: formValue.storesCost || 0,
        rcilProvision: formValue.rcilProvision || 0,
        status: formValue.status || 'Pending',
        remarks: formValue.remarks || ''
      };
      this.estimations.unshift(newEstimation);
      this.saveEstimationsToStorage();
      this.isModalVisible = false;
      this.currentPage = 1;
      // Redirect to work details
      this.router.navigate(['/estimations/work-details', newEstimation.fileNo]);
    }
  }

  onView(estimation: Estimation): void {
    this.router.navigate(['/estimations/work-details', estimation.fileNo]);
  }

  onEdit(estimation: Estimation): void {
    this.router.navigate(['/estimations/work-details', estimation.fileNo]);
  }

  onDelete(estimation: Estimation): void {
    const confirmed = confirm(`Delete estimation ${estimation.fileNo}?`);
    if (!confirmed) {
      return;
    }

    this.estimations = this.estimations.filter(item => item.fileNo !== estimation.fileNo);
    this.saveEstimationsToStorage();
    this.removeScopedEstimationData(estimation.fileNo);

    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }

    this.updateNextEstimNumber();
  }

  private removeScopedEstimationData(fileNo: string): void {
    if (!fileNo) {
      return;
    }

    const scopedPrefixes = [
      'inventory_',
      'letterPdf_',
      'justification_',
      'coveringLetter_',
      'drawingDocuments_'
    ];

    for (const prefix of scopedPrefixes) {
      localStorage.removeItem(`${prefix}${fileNo}`);
    }
  }

  // --- LOC Upload Methods ---
  onLocDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isLocDragOver = true;
  }

  onLocDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isLocDragOver = false;
  }

  onLocDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isLocDragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.startLocProcessing(files[0]);
    }
  }

  triggerLocFileInput() {
    this.locFileInput?.nativeElement.click();
  }

  onLocFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.startLocProcessing(file);
    }

    // Allow selecting the same file again and retriggering extraction.
    if (event?.target) {
      event.target.value = '';
    }
  }

  private startLocProcessing(file: File): void {
    this.isLocProcessing = true;
    this.locErrorMessage = '';
    this.updateLocStatus('Preparing file...');

    // Force a paint before heavy extraction starts.
    this.cdr.detectChanges();

    setTimeout(() => {
      void this.validateAndSetLocFile(file);
    }, 0);
  }

  async validateAndSetLocFile(file: File) {
    this.isLocProcessing = true;
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (validTypes.includes(file.type) || validExtensions.includes(extension)) {
      this.selectedLocFile = file;
      this.locErrorMessage = '';
      this.updateLocStatus('File selected. Analyzing format...');

      if (extension === '.docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        await this.extractLocMetadata(file);
      } else if (extension === '.doc' || file.type === 'application/msword') {
        this.updateLocStatus('Legacy .doc (binary) format detected. Please convert to .docx for auto-extraction.');
        this.locErrorMessage = 'Legacy .doc files cannot be auto-read. Please enter details manually.';
      } else if (extension === '.pdf' || file.type === 'application/pdf') {
        await this.extractLocPdfMetadata(file);
      } else {
        this.updateLocStatus('Unsupported format for auto-extraction.');
        this.locLetterNo = '';
        this.locLetterDate = '';
      }
    } else {
      this.selectedLocFile = null;
      this.locErrorMessage = 'Invalid file type. Please upload a PDF or Word document.';
      this.updateLocStatus('Invalid file type.');
    }
    this.isLocProcessing = false;
    this.cdr.detectChanges();
  }

  private updateLocStatus(message: string): void {
    this.locProcessedText = message;
    this.cdr.detectChanges();
  }

  private async yieldToUi(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  async extractLocMetadata(file: File) {
    this.locProcessedText = 'Starting extraction...';
    this.locExtractedItems = [];
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (file.name.toLowerCase().endsWith('.doc')) {
        this.locProcessedText = 'Error: .doc format (binary) is not supported for auto-extraction.';
        this.locErrorMessage = 'Legacy .doc files cannot be auto-read. Please enter details manually.';
        return;
      }

      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        this.locProcessedText = 'Extraction complete but no text found.';
        this.locErrorMessage = 'No text found in document.';
        return;
      }

      this.locProcessedText = text;
      const letterNoRegex = /(?:(?:Letter\s*No|L\.?\s*No\.?|No\.?|File\s*No)\s*[:\-\s]*([A-Za-z0-9\s\/\-]+?)(?=\s*(?:Date|Dated|Subject|Sub|\n\n|$))|([A-Za-z\.]+\d+[\/\-\.][A-Za-z0-9\/\-]+[\/\-]20\d{2}-\d{2}))/i;
      const letterMatch = text.match(letterNoRegex);
      this.locLetterNo = letterMatch ? (letterMatch[1] || letterMatch[2]).trim() : '';

      const dateRegex = /(?:Date|Dated|Dt\.?)\s*[:\-\s]\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i;
      const dateMatch = text.match(dateRegex);

      if (dateMatch && dateMatch[1]) {
        this.locLetterDate = this.parseDate(dateMatch[1]);
      } else {
        const generalDateRegex = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/;
        const generalMatch = text.match(generalDateRegex);
        if (generalMatch) {
          this.locLetterDate = `${generalMatch[3]}-${generalMatch[2].padStart(2, '0')}-${generalMatch[1].padStart(2, '0')}`;
        } else {
          this.locLetterDate = '';
        }
      }

      this.locSubject = this.extractLocSubject(text);
      
      this.autoFillEstimationForm();
    } catch (error: any) {
      this.locProcessedText = 'Error parsing document: ' + (error.message || error);
      this.locErrorMessage = 'Could not read document text. Please check the file.';
    }
  }

  parseDate(dateString: string): string {
    const parts = dateString.split(/[\/\.\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  }

  async extractLocPdfMetadata(file: File) {
    this.updateLocStatus('Starting PDF extraction...');
    this.locExtractedItems = [];
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      let allTextItems: any[] = [];
      const numPages = pdf.numPages;

      this.updateLocStatus(`Scanning ${numPages} page(s)...`);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        this.updateLocStatus(`Scanning page ${pageNum} of ${numPages}...`);
        await this.yieldToUi();
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';

        const itemsWithPage = textContent.items.map((item: any) => ({
          ...item,
          pageNum: pageNum
        }));
        allTextItems.push(...itemsWithPage);
      }

      if (!fullText || fullText.trim().length === 0) {
        this.updateLocStatus('PDF contains no text layer. Attempting OCR on scanned pages...');
        fullText = '';
        allTextItems = [];

        // For metadata extraction, OCR first pages is usually enough and much faster.
        const ocrPagesToScan = Math.min(numPages, 2);
        for (let pageNum = 1; pageNum <= ocrPagesToScan; pageNum++) {
            this.updateLocStatus(`Running OCR on page ${pageNum} of ${ocrPagesToScan}...`);
            await this.yieldToUi();
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context!,
              viewport: viewport
            } as any;

            await page.render(renderContext).promise;
            
            // Convert to image and run OCR
            const imageUrl = canvas.toDataURL('image/png');
            const ocrResult = await Tesseract.recognize(imageUrl, 'eng', {
              logger: m => {
                if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                  const percent = Math.round(m.progress * 100);
                  this.updateLocStatus(`Running OCR on page ${pageNum} of ${ocrPagesToScan}... ${percent}%`);
                }
              }
            });
            
            fullText += ocrResult.data.text + '\n';
        }

        if (!fullText || fullText.trim().length === 0) {
            this.updateLocStatus('OCR complete but no text could be recognized. The document might be illegible.');
            this.locErrorMessage = 'Could not extract text from scanned PDF.';
            return;
        }
      }

      this.locProcessedText = fullText;
      const letterNoRegex = /(?:(?:Letter\s*No|L\.?\s*No\.?|No\.?|File\s*No)\s*[:\-\s]*([A-Za-z0-9\s\/\-]+?)(?=\s*(?:Date|Dated|Subject|Sub|\n\n|$))|([A-Za-z\.]+\d+[\/\-\.][A-Za-z0-9\/\-]+[\/\-]20\d{2}-\d{2}))/is;
      const letterMatch = fullText.match(letterNoRegex);
      this.locLetterNo = letterMatch ? (letterMatch[1] || letterMatch[2]).trim().replace(/\s+/g, ' ') : '';

      const dateRegex = /(?:Date|Dated|Dt\.?)\s*[:\-\s]\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i;
      const dateMatch = fullText.match(dateRegex);

      if (dateMatch && dateMatch[1]) {
        this.locLetterDate = this.parseDate(dateMatch[1]);
      } else {
        const generalDateRegex = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/;
        const generalMatch = fullText.match(generalDateRegex);
        this.locLetterDate = generalMatch ? `${generalMatch[3]}-${generalMatch[2].padStart(2, '0')}-${generalMatch[1].padStart(2, '0')}` : '';
      }

      this.locSubject = this.extractLocSubject(fullText);
      
      this.autoFillEstimationForm();

      this.extractLocTableFromPdf(allTextItems);

    } catch (error: any) {
      this.locProcessedText = 'Error parsing PDF: ' + (error.message || error);
      this.locErrorMessage = 'Could not read PDF text. Please check the file.';
    }
  }

  extractLocTableFromPdf(textItems: any[]) {
    try {
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

      this.locExtractedItems = [];
      let currentSchedule = 'General';
      let columnRanges: { name: string, startX: number, endX: number }[] = [];
      let isTableDetected = false;
      let lastItem: ExtractedLocItem | null = null;

      const headerKeywords = ['s no', 'itemno', 'description', 'unit', 'qty', 'rate', 'amount'];

      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        const rowText = row.map(item => item.text).join(' ');
        const rowTextLower = rowText.toLowerCase();

        const scheduleMatch = rowText.match(/(?:Schedule\s*-\s*([A-D])|Schedule\s*([A-D]))/i);
        if (scheduleMatch) {
          const letter = scheduleMatch[1] || scheduleMatch[2];
          currentSchedule = `Schedule ${letter.toUpperCase()}`;
          isTableDetected = false;
          lastItem = null;
          continue;
        }

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

        if (isTableDetected && (rowTextLower.includes('grand total') || rowTextLower.includes('total rs'))) {
          isTableDetected = false;
          lastItem = null;
          continue;
        }

        if (isTableDetected && row.length > 0) {
          let sNoText = '';
          const sNoCol = columnRanges.find(c => c.name.includes('sno'));
          if (sNoCol) {
            const sNoCell = row.find(c => c.x >= sNoCol.startX && c.x < sNoCol.endX);
            if (sNoCell) sNoText = sNoCell.text.trim();
          }

          if (/^\d+$/.test(sNoText)) {
            const item: ExtractedLocItem = {
              description: '',
              schedule: currentSchedule,
              sno: sNoText
            };

            row.forEach(cell => {
              const col = columnRanges.find(r => cell.x >= r.startX && cell.x < r.endX);
              if (!col) return;
              const cellText = cell.text.trim();
              const colName = col.name;

              if (colName.includes('itemno')) item.itemNo = cellText;
              else if (colName.includes('description')) item.description = cellText;
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

            this.locExtractedItems.push(item);
            lastItem = item;
          } else if (lastItem) {
            row.forEach(cell => {
              const col = columnRanges.find(r => cell.x >= r.startX && cell.x < r.endX);
              if (!col) return;
              const cellText = cell.text.trim();

              if (col.name.includes('description')) {
                lastItem!.description += ' ' + cellText;
              } else if (col.name.includes('itemno') && !lastItem!.itemNo) {
                lastItem!.itemNo = cellText;
              } else if (col.name.includes('unit') && !lastItem!.unit) {
                lastItem!.unit = cellText;
              }
            });
          }
        }
      }

      this.locExtractedItems.forEach(i => i.description = i.description.trim().replace(/\s+/g, ' '));
    } catch (e) {
      console.error('Extraction error:', e);
    }
  }

  clearLocFile(event: Event) {
    if (event) event.stopPropagation();
    this.selectedLocFile = null;
    this.locErrorMessage = '';
    this.locLetterNo = '';
    this.locLetterDate = '';
    this.locSubject = '';
    this.locExtractedItems = [];
    this.locProcessedText = '';
    if (this.locFileInput) {
      this.locFileInput.nativeElement.value = '';
    }
  }

  autoFillEstimationForm() {
    if (this.locLetterNo && !this.estimationForm.get('fileNo')?.value) {
      this.estimationForm.patchValue({ fileNo: this.locLetterNo });
    }
    if (this.locSubject && !this.estimationForm.get('workName')?.value) {
      this.estimationForm.patchValue({ workName: this.locSubject });
    }

    // Keep modal Work Name in sync with extracted/entered Subject.
    this.onSubjectChange();
  }

  onSaveLoc(): void {
    const newLocEstimation: Estimation = {
      fileNo: this.locLetterNo || `LOC-${String(this.estimations.length + 1).padStart(3, '0')}`,
      ph: 'NA',
      workName: this.locSubject || 'Unnamed LOC Work',
      stCost: 0,
      storesCost: 0,
      rcilProvision: 0,
      status: 'Pending',
      remarks: 'NA'
    };

    this.estimations.unshift(newLocEstimation);
    this.saveEstimationsToStorage();
    this.isModalVisible = false;
    this.currentPage = 1;
    this.clearLocFile(new Event('clear'));
  }
}
