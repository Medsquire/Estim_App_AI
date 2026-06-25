import { Component, OnDestroy, OnInit, ViewChild, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import html2pdf from 'html2pdf.js';
import { HttpClient, HttpClientModule, HttpEventType } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  NavComponent,
  NavItemComponent,
  NavLinkDirective,
  RowComponent,
  TableDirective,
  ModalComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  ModalBodyComponent,
  ModalFooterComponent,
  ButtonCloseDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

export interface Estimation {
  estimNo?: string;
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

export interface Document {
  id: number;
  name: string;
  type: string;
  icon: string;
  uploadDate: string;
  size: string;
  status: string;
  originalFileName?: string;
  mimeType?: string;
  fileDataUrl?: string;
}

export interface InventoryItem {
  slNo?: number;
  chapter?: number;
  description: string;
  unit: string;
  rateInRs: number;
  totalCashRs: number;
  totalRs: number;
  reference: string;
  referenceId?: string;
  reference2?: string;
  reference3?: string;
  schedule: string;
  page_no?: number;
  pdfName?: string;
  bidRate?: number;
  defaultQty?: number;
  fileType?: string;
  Matched_items_no?: string;
}

interface PdfPageHint {
  contains: string;
  page: number;
}

interface PdfPageDocConfig {
  defaultPage: number;
  calculationPage?: number;
  schedulePages?: { [schedule: string]: number };
  descriptionHints?: PdfPageHint[];
}

interface PdfPageMap {
  [docType: string]: PdfPageDocConfig;
}

interface PdfPageResolution {
  page: number;
  source: 'page_no' | 'description_hint' | 'schedule' | 'default';
  reason: string;
}

interface PdfHighlightResult {
  score: number;
  yTop: number;
  yBottom: number;
  snippet: string;
}

type PdfHighlightMode = 'description' | 'item-slno' | 'item-no' | 'schedule' | 'chapter';

interface SorWordJsonItem {
  item_no: string;
  description: string;
  unit: string;
  rate: number;
  chapter: number;
  page_no?: number;
  fileType?: string;
}

interface SorWordJsonChapter {
  name: string;
  items: SorWordJsonItem[];
}

interface SorWordJsonData {
  document?: string;
  source?: string;
  chapters: { [chapter: string]: SorWordJsonChapter };
}

interface SorExcelJsonItem {
  item_no: string;
  description: string;
  unit: string;
  rate: number;
  chapter?: number;
  page_no?: number;
  fileType?: string;
  reference_id?: string;
}

interface SorExcelJsonData {
  document?: string;
  source?: string;
  total_items?: number;
  items: SorExcelJsonItem[];
}

@Component({
  selector: 'app-work-details',
  templateUrl: 'work-details.component.html',
  styleUrls: ['work-details.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    RowComponent,
    ColComponent,
    TableDirective,
    BadgeComponent,
    ButtonDirective,
    IconDirective,
    NavComponent,
    NavItemComponent,
    NavLinkDirective,
    FormControlDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonCloseDirective
  ]
})
export class WorkDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef;
  @ViewChild('quantityInput') quantityInput!: ElementRef;
  @ViewChild('inventoryPrintSection') inventoryPrintSection?: ElementRef<HTMLDivElement>;
  @ViewChild('drmApprovalPrintSection') drmApprovalPrintSection?: ElementRef<HTMLDivElement>;
  @ViewChild('pdfFirstPageCanvas') pdfFirstPageCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfScheduleCanvas') pdfScheduleCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfCanvas') pdfCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfScrollContainer') pdfScrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('drawingFileInput') drawingFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('letterFileInput') letterFileInput?: ElementRef<HTMLInputElement>;

  estimation: Estimation | null = null;
  fileNo: string = '';
  private originalFileNo: string = '';
  activeTab = 'letter';
  letterPdfUrl: string = '';
  letterPdfLoading = false;
  letterPdfLoadProgress = 0;
  inventoryPdfViewUrl: string | null = null;
  isPdfModalVisible: boolean = false;
  isPdfLoading: boolean = false;
  selectedDocumentType: string = '';
  selectedReferenceItem: InventoryItem | null = null;
  referenceSearchTerm: string = '';
  pdfPageReason: string = '';
  pdfHighlightStatus: string = '';
  pdfHighlightFound: boolean = false;
  pdfMatchedSnippet: string = '';
  pdfScheduleStatus: string = '';
  pdfScheduleBidRateText: string = '';
  currentPdfPage = 1;
  totalPdfPages = 0;
  private pdfPageMapCache: PdfPageMap | null = null;
  private pdfDocRef: any = null;
  private pdfLoadToken = 0;
  private pdfPageRenderToken = 0;
  private pendingPdfPage = 1;
  private pendingPdfSearch = '';
  private pendingPdfHighlightMode: PdfHighlightMode = 'description';
  private pendingPdfAssetUrl = '';
  private readonly staticLetterPdfUrl = '/uploads/LOC_files/Letter%20from%20conseren%20dep.pdf';
  private letterPdfObjectUrl: string | null = null;
  private letterPdfLoadToken = 0;
  private readonly scheduleBidRatePageOverrides: { [docType: string]: number } = {
    STTC: 55
  };

  // Inventory Management
  inventorySearchQuery = '';
  selectedInventoryItem: InventoryItem | null = null;
  inventoryQuantity = '';
  addedInventoryItems: { item: InventoryItem; quantity: number }[] = [];

  // LOA Schedule mapping: { docType: { schedule: { rate: string, type: string } } }
  loaSchedules: { [docType: string]: { [schedule: string]: { rate: number, type: string } } } = {};

  // In-place editing state
  editingIndex: number | null = null;
  editQuantity: number = 0;
  calculationModalVisible: boolean = false;
  selectedCalculationEntry: { item: InventoryItem; quantity: number } | null = null;

  inventoryItems: InventoryItem[] = [];

  get filteredInventoryItems(): InventoryItem[] {
    const q = (this.inventorySearchQuery || '').trim().toLowerCase();
    if (!q.length) return [];
    const qTokens = q.split(/\s+/).filter(Boolean);

    const matchesQuery = (item: InventoryItem): boolean => {
      const fields = [
        item.description,
        item.reference,
        item.schedule,
        item.fileType || '',
        item.Matched_items_no || '',
        String(item.slNo ?? ''),
        String(item.page_no ?? '')
      ];

      return fields.some(field => {
        const value = String(field).toLowerCase();
        return qTokens.every(token => value.includes(token));
      });
    };

    const primaryMatches = this.inventoryItems.filter(matchesQuery);
    if (primaryMatches.length) {
      return primaryMatches;
    }

    return [];
  }

  get showInventoryResults(): boolean {
    return this.inventorySearchQuery.trim().length > 0;
  }

  get isInventorySelectionComplete(): boolean {
    return !!(
      this.selectedInventoryItem &&
      this.inventorySearchQuery.trim() === this.selectedInventoryItem.description
    );
  }

  get totalAddedInventoryPrice(): number {
    return this.addedInventoryItems.reduce((sum, entry) => {
      return sum + (entry.quantity * this.getAdjustedRateInRs(entry));
    }, 0);
  }

  isSorInventoryEntry(entry: any): boolean {
    return this.isSorReferenceItem(entry?.item);
  }

  getReferenceMiddlePageLabel(item: InventoryItem): string {
    return this.isSorReferenceItem(item) ? 'Chap Pg.' : 'Sche Pg.';
  }

  private isSorReferenceItem(item: InventoryItem | null | undefined): boolean {
    if (!item) {
      return false;
    }

    if (this.isSorFileType(item.fileType)) {
      return true;
    }

    const ref = String(item.reference || '').toUpperCase();
    return ref.includes('SOR');
  }

  getDocTypeFromReference(ref: string): string {
    if (!ref) return 'SOR_2024';
    if (ref.includes('00850890090468')) return 'LOA_ABSS';
    if (ref.includes('01052610112449')) return 'STTC';
    if (ref.includes('01052610118677')) return 'ZONAL_2024';
    return 'SOR_2024';
  }

  getDisplayItemNo(item: InventoryItem): string {
    const directItemNo = String(item?.Matched_items_no || '').trim();
    if (directItemNo) {
      return directItemNo;
    }

    const referenceText = String(item?.reference || '');
    const itemMatch = referenceText.match(/\bItem\s+([^/]+)/i);
    if (itemMatch?.[1]) {
      return itemMatch[1].trim();
    }

    return '';
  }

  getBidRateAdjustment(entry: any): number {
    if (this.isSorInventoryEntry(entry)) {
      return 1;
    }

    const docType = this.getDocTypeFromReference(entry.item.reference);
    const sched = entry.item.schedule;
    const info = this.loaSchedules[docType]?.[sched];

    if (!info) return 1;

    if (info.type.toLowerCase().includes('above')) {
      return 1 + (info.rate / 100);
    } else if (info.type.toLowerCase().includes('below')) {
      return 1 - (info.rate / 100);
    }
    return 1;
  }

  getBidRateDisplay(entry: any): string {
    const docType = this.getDocTypeFromReference(entry.item.reference);
    const sched = entry.item.schedule;
    const info = this.loaSchedules[docType]?.[sched];

    if (!info || info.type === 'At Par') return 'At Par';
    return `${info.rate.toFixed(2)} % ${info.type}`;
  }

  getBidRatePercent(entry: any): number {
    const docType = this.getDocTypeFromReference(entry.item.reference);
    const sched = entry.item.schedule;
    const info = this.loaSchedules[docType]?.[sched];
    return info?.rate ?? 0;
  }

  getBidRateOperator(entry: any): string {
    const docType = this.getDocTypeFromReference(entry.item.reference);
    const sched = entry.item.schedule;
    const info = this.loaSchedules[docType]?.[sched];

    if (!info || info.type === 'At Par') return '+';
    if (info.type.toLowerCase().includes('above')) return '+';
    if (info.type.toLowerCase().includes('below')) return '-';
    return '+';
  }

  getBidRateDecimal(entry: any): number {
    const percent = this.getBidRatePercent(entry) / 100;
    const operator = this.getBidRateOperator(entry);
    if (operator === '-') return -percent;
    if (operator === '+') return percent;
    return 0;
  }

  getRateCalculationFormula(entry: any): string {
    const baseRate = entry.item.rateInRs;
    const signedDecimal = this.getBidRateDecimal(entry);
    const baseText = this.formatFormulaNumber(baseRate, 4);

    if (signedDecimal === 0) {
      return `=${baseText}`;
    }

    const decimalText = this.formatFormulaNumber(signedDecimal, 4);
    return `=${baseText}(Actual Rate)*${decimalText}+${baseText}`;
  }

  getRateFormulaObject(entry: any): { baseRate: string; operator: string; percent: string; closingRate: string } {
    const baseRate = entry.item.rateInRs;
    const signedDecimal = this.getBidRateDecimal(entry);
    const baseText = this.formatFormulaNumber(baseRate, 4);
    const decimalText = this.formatFormulaNumber(signedDecimal, 4);

    return {
      baseRate: baseText,
      operator: signedDecimal < 0 ? '*' : '*',
      percent: decimalText,
      closingRate: baseText
    };
  }

  private formatFormulaNumber(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  getAdjustedRateInRs(entry: any): number {
    if (this.isSorInventoryEntry(entry)) {
      return entry.item.rateInRs;
    }
    return entry.item.rateInRs * this.getBidRateAdjustment(entry);
  }

  async loadAllReferencedLoas(): Promise<void> {
    const docTypes = new Set<string>();
    this.addedInventoryItems.forEach(entry => {
      docTypes.add(this.getDocTypeFromReference(entry.item.reference));
    });

    for (const docType of docTypes) {
      if (docType !== 'SOR_2024' && !this.loaSchedules[docType]) {
        await this.loadLoaSchedules(docType);
      }
    }
  }

  async loadLoaSchedules(docType: string): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<any[][]>(`assets/converted/${docType}.json`));
      if (data && data.length > 0) {
        const mapping: { [schedule: string]: { rate: number, type: string } } = {};
        let currentSchedule = '';

        // Scan all tables in the JSON for schedule-level adjustments
        data.forEach((table: any[][]) => {
          if (!table || table.length === 0) return;

          for (let i = 0; i < table.length; i++) {
            const row = table[i];
            const rowText = row.join(' ');

            // Check for schedule change (e.g., "Schedule A", "Schedule B", etc.)
            const schedMatch = rowText.match(/Schedule\s+([A-Z])/i);
            if (schedMatch) {
              currentSchedule = schedMatch[1].toUpperCase();
            }

            // FILTER: Only summary rows (which contain the bid rates) have "View Details"
            // This prevents item-level data from detailed tables from interfering.
            if (currentSchedule && rowText.includes('View Details')) {
              let foundPercentage = false;
              for (let j = 0; j < row.length - 1; j++) {
                const cell = row[j]?.toString().trim();
                const nextCell = row[j + 1]?.toString().trim();

                if (/^\d+(?:\.\d+)?$/.test(cell) && /%(?:age)?\s+(Above|Below)/i.test(nextCell)) {
                  mapping[currentSchedule] = {
                    rate: parseFloat(cell),
                    type: /Above/i.test(nextCell) ? 'Above' : 'Below'
                  };
                  foundPercentage = true;
                  break;
                }
              }

              // Fallback to "At Par" only if no percentage found in this summary row
              if (!foundPercentage) {
                const rowUpper = rowText.toUpperCase();
                if (rowUpper.includes('AT PAR')) {
                   mapping[currentSchedule] = { rate: 0, type: 'At Par' };
                }
              }
            }
          }
        });
        this.loaSchedules[docType] = mapping;
      }
    } catch (e) {
      console.error(`Failed to load LOA schedules for ${docType}`, e);
    }
  }

  isSelectedItemAlreadyAdded(): boolean {
    if (!this.selectedInventoryItem) return false;
    return this.addedInventoryItems.some(entry => entry.item.description === this.selectedInventoryItem!.description);
  }

  get selectedItemPreviewTotal(): number {
    if (!this.selectedInventoryItem) return 0;
    const qty = parseFloat(this.inventoryQuantity);
    return isNaN(qty) ? 0 : qty * this.selectedInventoryItem.rateInRs;
  }

  selectInventoryItem(item: InventoryItem): void {
    this.inventorySearchQuery = item.description;
    this.selectedInventoryItem = item;
    const prev = this.addedInventoryItems.find(entry => entry.item.description === item.description);
    this.inventoryQuantity = prev ? prev.quantity.toString() : '';

    // Focus quantity
    setTimeout(() => {
      if (this.quantityInput) this.quantityInput.nativeElement.focus();
    }, 0);
  }

  async addInventoryItem(): Promise<void> {
    if (!this.selectedInventoryItem) return;
    const qty = parseFloat(this.inventoryQuantity);
    if (isNaN(qty) || qty <= 0) return;
    const existing = this.addedInventoryItems.find(entry => entry.item.description === this.selectedInventoryItem!.description && entry.item.schedule === this.selectedInventoryItem!.schedule);
    if (existing) {
      existing.quantity = qty;
    } else {
      this.addedInventoryItems.push({ item: this.selectedInventoryItem, quantity: qty });
    }
    this.inventoryQuantity = '';
    this.inventorySearchQuery = '';
    this.selectedInventoryItem = null;

    // Focus search
    setTimeout(() => {
      if (this.searchInput) this.searchInput.nativeElement.focus();
    }, 0);

    await this.loadAllReferencedLoas();
    this.saveInventoryToStorage();
    this.updateCoveringLetterAmount();
  }

  deleteInventoryItem(index: number): void {
    if (confirm('Are you sure you want to delete this item?')) {
      this.addedInventoryItems.splice(index, 1);
      this.saveInventoryToStorage();
      this.updateCoveringLetterAmount();
    }
  }

  moveInventoryItemUp(index: number): void {
    if (index > 0) {
      [this.addedInventoryItems[index], this.addedInventoryItems[index - 1]] = 
      [this.addedInventoryItems[index - 1], this.addedInventoryItems[index]];
      this.saveInventoryToStorage();
    }
  }

  moveInventoryItemDown(index: number): void {
    if (index < this.addedInventoryItems.length - 1) {
      [this.addedInventoryItems[index], this.addedInventoryItems[index + 1]] = 
      [this.addedInventoryItems[index + 1], this.addedInventoryItems[index]];
      this.saveInventoryToStorage();
    }
  }

  startEdit(index: number, quantity: number): void {
    this.editingIndex = index;
    this.editQuantity = quantity;
  }

  saveEdit(index: number): void {
    if (this.editQuantity > 0) {
      this.addedInventoryItems[index].quantity = this.editQuantity;
      this.editingIndex = null;
      this.saveInventoryToStorage();
      this.updateCoveringLetterAmount();
    }
  }

  cancelEdit(): void {
    this.editingIndex = null;
  }

  openCalculationModal(entry: { item: InventoryItem; quantity: number }): void {
    this.selectedCalculationEntry = entry;
    this.calculationModalVisible = true;
  }

  closeCalculationModal(): void {
    this.calculationModalVisible = false;
    this.selectedCalculationEntry = null;
  }

  get calculationBaseAmount(): number {
    if (!this.selectedCalculationEntry) return 0;
    return this.selectedCalculationEntry.quantity * this.selectedCalculationEntry.item.rateInRs;
  }

  get calculationBidRateAdjustment(): number {
    if (!this.selectedCalculationEntry) return 1;
    return this.getBidRateAdjustment(this.selectedCalculationEntry);
  }

  get calculationTotalAmount(): number {
    return this.calculationBaseAmount * this.calculationBidRateAdjustment;
  }

  get calculationBidRateLabel(): string {
    if (!this.selectedCalculationEntry) return 'At Par';
    return this.getBidRateDisplay(this.selectedCalculationEntry);
  }

  saveInventoryToStorage(): void {
    if (this.fileNo) {
      localStorage.setItem(`inventory_${this.fileNo}`, JSON.stringify(this.addedInventoryItems));
      this.updateEstimationSTCost();
    }
  }

  updateEstimationSTCost(): void {
    if (this.estimation) {
      this.estimation.stCost = this.totalAddedInventoryPrice;

      // Sync back to the main estimationsData in Local Storage
      const savedEstimations = localStorage.getItem('estimationsData');
      if (savedEstimations) {
        try {
          const allEstimations: Estimation[] = JSON.parse(savedEstimations);
          const index = allEstimations.findIndex(e => e.fileNo === this.fileNo);
          if (index !== -1) {
            allEstimations[index].stCost = this.totalAddedInventoryPrice;
            localStorage.setItem('estimationsData', JSON.stringify(allEstimations));
          }
        } catch (e) {
          console.error('Failed to sync S & T Cost to estimations', e);
        }
      }
    }
  }

  async loadInventoryFromStorage(): Promise<void> {
    if (this.fileNo) {
      const savedData = localStorage.getItem(`inventory_${this.fileNo}`);
      if (savedData) {
        try {
          const parsed: { item: InventoryItem; quantity: number }[] = JSON.parse(savedData);
          this.addedInventoryItems = parsed.map(entry => ({
            ...entry,
            item: this.normalizeInventoryItem(entry.item)
          }));
          await this.loadAllReferencedLoas();
          this.updateCoveringLetterAmount();
          this.updateEstimationSTCost();
        } catch (e) {
          console.error('Failed to parse inventory from local storage', e);
        }
      }
    }
  }

  updateCoveringLetterAmount(): void {
    const formattedAmount = this.totalAddedInventoryPrice.toLocaleString('en-IN');
    this.coveringLetter.body = this.coveringLetter.body.replace(
      /RS [\d,]+(?:\.\d+)?\/-/ig,
      `RS ${formattedAmount}/-`
    );
  }

  // Document types for Drawing Information
  documents: Document[] = [
    { id: 1, name: 'Site Plan Drawing', type: 'PDF', icon: 'cilFile', uploadDate: '2026-01-15', size: '2.5 MB', status: 'Approved' },
    { id: 2, name: 'Electrical Layout', type: 'DWG', icon: 'cilLayers', uploadDate: '2026-01-18', size: '5.2 MB', status: 'Pending' },
    { id: 3, name: 'Signal Circuit Diagram', type: 'PDF', icon: 'cilFile', uploadDate: '2026-01-20', size: '1.8 MB', status: 'Approved' },
    { id: 4, name: 'Cross Section View', type: 'DWG', icon: 'cilLayers', uploadDate: '2026-01-22', size: '3.4 MB', status: 'Under Review' },
    { id: 5, name: 'Foundation Details', type: 'PDF', icon: 'cilFile', uploadDate: '2026-01-25', size: '4.1 MB', status: 'Approved' },
    { id: 6, name: 'Wiring Schematic', type: 'PDF', icon: 'cilFile', uploadDate: '2026-01-26', size: '890 KB', status: 'Pending' }
  ];



  get computedWorkName(): string {
    const fromEstimation = String(this.estimation?.workName || '').trim();
    if (fromEstimation) {
      return fromEstimation;
    }

    return 'Hyderabad Division: Construction of Running room at MLY Station - Telecom arrangements';
  }

  // Covering Letter Content
  coveringLetter = {
    officeHeader: 'वरिष्ठ मंडल सिगनल व दूर संचार ईंजीनियर का कार्यालय हैदराबाद मंडल, द. म. रे, सिकंदराबाद - 500071\nOFFICE OF THE SENIOR DIVISIONAL SIGNAL & TELECOM ENGINEER,\nHYDERABAD DIVISION, SOUTH CENTRAL RAILWAY, SECUNDERABAD-500071.',
    letterNo: 'Y/SG/Est/25-26/',
    date: '05-11-2024',
    to: 'Sr.DME / HYB',
    subject: 'Hyderabad Division: Construction of Running room at MLY Station - Telecom arrangements',
    reference: 'Y.M.153/PWP/2024-25 . Dt: 21.03.2025',
    body: 'In connection with above work, A abstract estimate for the signalling and telecommunication (S&T) portion has been prepared, highlighting the need for running room. The estimated cost for this work amounts to RS 37,21,510/- (Excel cost). To facilitate the project’s progress, we kindly request to the following.',
    enclosure: 'As above',
    signatory: 'Sr.DSTE /HYB\nCopy to :',
    signatoryName: 'Sr.DSTE/HYB',
    signatoryDesignation: 'Senior Divisional Signal & Telecom Engineer',
    signatoryPlace: 'Secunderabad',
    signatoryDate: ''
  };

  // Justification Content
  justification = {
    title: 'Justification',
    nameOfWork: '', // Will be computed
    body: 'LC no. 18JB is interlocked traffic gate in BDHN. For catering proposed construction of ROB, all the signaling and telecom cables on either side of LC gate location i.e. towards station end and towards home signal end are required to be diverted. The diversion of OFC cable will be carried out by RCIL. Necessary alterations are to be carried out in the relay room and panel to suit the interlocking changes due to closure of interlocked LC gate. All the required quantities have been taken by adopting new Schedule of Rates circulated by HQRs in 2024.',
    signatory: 'Sr.DSTE/HYB',
    signatoryName: 'Sr.DSTE/HYB',
    signatoryDesignation: 'Senior Divisional Signal & Telecom Engineer',
    signatoryPlace: 'Secunderabad',
    signatoryDate: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    console.log('WorkDetailsComponent V2 Loaded');
    this.cleanupOrphanModalBackdrop();
    this.fileNo = this.route.snapshot.paramMap.get('fileNo') || '';
    this.originalFileNo = this.fileNo;
    this.loadEstimation();
    this.initializeInventoryContext();
    this.loadDocumentsDataFromStorage();
    this.syncCoveringLetterSubjectFromLoc();
  }

  private syncCoveringLetterSubjectFromLoc(): void {
    const locSubject = String(this.estimation?.locSubject || '').trim();
    this.coveringLetter.subject = locSubject;
  }

  private cleanupOrphanModalBackdrop(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // If navigation happened while a modal was closing, CoreUI/Bootstrap backdrop can remain and block clicks.
    const strayBackdrops = document.querySelectorAll('.modal-backdrop');
    strayBackdrops.forEach((node) => node.remove());

    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  }

  ngOnDestroy(): void {
    if (this.letterPdfObjectUrl) {
      URL.revokeObjectURL(this.letterPdfObjectUrl);
      this.letterPdfObjectUrl = null;
    }
  }

  private async initializeInventoryContext(): Promise<void> {
    await this.loadInventoryTemplateForCurrentWork();
    await this.loadInventoryFromStorage();
  }

  private getInventoryMergeKey(item: InventoryItem): string {
    const sl = this.parseNumericValue(item.slNo);
    const desc = (item.description || '').trim().toLowerCase();
    const schedule = (item.schedule || '').trim().toUpperCase();
    return `${sl}__${schedule}__${desc}`;
  }

  private async loadInventoryTemplateForCurrentWork(): Promise<void> {
    try {
      const sorExcelData = await firstValueFrom(this.http.get<SorExcelJsonData>('assets/Json/SOR/SOR_EXCEL.json'));
      this.inventoryItems = this.flattenSorExcelInventory(sorExcelData);
    } catch (error) {
      console.error('Failed to load inventory data from SOR_EXCEL.json', error);
      this.inventoryItems = [];
    }
  }

  private flattenSorExcelInventory(data: SorExcelJsonData): InventoryItem[] {
    const items: InventoryItem[] = [];

    for (const sourceItem of data?.items || []) {
      const itemNo = String(sourceItem?.item_no || '').trim();
      const description = String(sourceItem?.description || '').trim();

      if (!itemNo || !description) {
        continue;
      }

      const baseMatch = itemNo.match(/(\d+)/);
      const slNo = baseMatch ? Number(baseMatch[1]) : undefined;
      const rate = Math.abs(this.parseNumericValue(sourceItem?.rate));
      const pageNo = this.parseNumericValue(sourceItem?.page_no);
      const chapterNo = this.parseNumericValue(sourceItem?.chapter);
      const chapterLabel = chapterNo > 0 ? `CHAPTER ${chapterNo}` : 'CHAPTER';

      items.push(this.normalizeInventoryItem({
        slNo,
        chapter: chapterNo > 0 ? chapterNo : undefined,
        description,
        unit: String(sourceItem?.unit || '').trim(),
        rateInRs: rate,
        totalCashRs: rate,
        totalRs: rate,
        reference: `SOR_EXCEL / ${chapterLabel} / Item ${itemNo}`,
        referenceId: String(sourceItem?.reference_id || '').trim() || undefined,
        reference2: chapterLabel,
        reference3: 'SOR_EXCEL',
        schedule: chapterLabel,
        page_no: Number.isFinite(pageNo) && pageNo > 0 ? pageNo : undefined,
        pdfName: 'SOR 2024.pdf',
        bidRate: rate,
        defaultQty: 1,
        fileType: this.normalizeFileType(sourceItem?.fileType),
        Matched_items_no: itemNo
      }));
    }

    return items;
  }

  private parseNumericValue(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value ?? '')
      .replace(/,/g, '')
      .replace(/[^0-9.\-]/g, '')
      .trim();

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeFileType(value: unknown): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    return normalized || 'SOR';
  }

  private isSorFileType(value: unknown): boolean {
    return this.normalizeFileType(value) === 'SOR';
  }

  private extractScheduleFromReference(reference: string): string {
    const match = reference.match(/(?:SCH(?:EDULE)?\s*)([A-Z])/i);
    return match?.[1]?.toUpperCase() || '';
  }

  loadDocumentsDataFromStorage(): void {
    const savedLetterPdfUrl = localStorage.getItem(this.getLetterPdfStorageKey());
    if (savedLetterPdfUrl) {
      this.letterPdfUrl = savedLetterPdfUrl;
      this.letterPdfLoading = false;
      this.letterPdfLoadProgress = 100;
    } else {
      void this.loadStaticLetterPdf();
    }

    if (!this.fileNo) {
      return;
    }

    const savedJustification = localStorage.getItem(`justification_${this.fileNo}`);
    if (savedJustification) {
      try {
        this.justification = JSON.parse(savedJustification);
      } catch (e) { }
    }

    const savedCoveringLetter = localStorage.getItem(`coveringLetter_${this.fileNo}`);
    if (savedCoveringLetter) {
      try {
        this.coveringLetter = JSON.parse(savedCoveringLetter);
      } catch (e) { }
    }

    // Always keep Sub synced from uploaded LOC data.
    this.syncCoveringLetterSubjectFromLoc();

    const savedDocuments = localStorage.getItem(`drawingDocuments_${this.fileNo}`);
    if (savedDocuments) {
      try {
        const parsedDocuments = JSON.parse(savedDocuments);
        if (Array.isArray(parsedDocuments) && parsedDocuments.length > 0) {
          this.documents = parsedDocuments;
        }
      } catch (e) {
        console.error('Failed to parse drawing documents from local storage', e);
      }
    }
  }

  private async loadStaticLetterPdf(): Promise<void> {
    const loadToken = ++this.letterPdfLoadToken;
    this.letterPdfLoading = true;
    this.letterPdfLoadProgress = 0;

    if (this.letterPdfObjectUrl) {
      URL.revokeObjectURL(this.letterPdfObjectUrl);
      this.letterPdfObjectUrl = null;
    }

    this.letterPdfUrl = '';

    try {
      await new Promise<void>((resolve) => {
        this.http.get(this.staticLetterPdfUrl, {
          observe: 'events',
          reportProgress: true,
          responseType: 'blob'
        }).subscribe({
          next: (event) => {
            if (loadToken !== this.letterPdfLoadToken) {
              return;
            }

            if (event.type === HttpEventType.DownloadProgress) {
              const total = event.total ?? 0;
              const progress = total > 0
                ? Math.round((event.loaded / total) * 100)
                : Math.min(99, Math.max(this.letterPdfLoadProgress, 5));
              this.letterPdfLoadProgress = Math.max(this.letterPdfLoadProgress, progress);
              return;
            }

            if (event.type === HttpEventType.Response) {
              const blob = event.body;
              if (blob) {
                this.letterPdfObjectUrl = URL.createObjectURL(blob);
                this.letterPdfUrl = this.letterPdfObjectUrl;
              } else {
                this.letterPdfUrl = this.staticLetterPdfUrl;
              }
              this.letterPdfLoadProgress = 100;
              resolve();
            }
          },
          error: (error) => {
            if (loadToken !== this.letterPdfLoadToken) {
              resolve();
              return;
            }
            console.error('Failed to load static LOC PDF', error);
            this.letterPdfUrl = this.staticLetterPdfUrl;
            this.letterPdfLoadProgress = 100;
            resolve();
          }
        });
      });
    } finally {
      if (loadToken === this.letterPdfLoadToken) {
        this.letterPdfLoading = false;
      }
    }
  }

  triggerLetterUpload(): void {
    this.letterFileInput?.nativeElement.click();
  }

  onLetterFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        return;
      }

      if (this.letterPdfObjectUrl) {
        URL.revokeObjectURL(this.letterPdfObjectUrl);
        this.letterPdfObjectUrl = null;
      }

      this.letterPdfLoadToken++;
      this.letterPdfLoading = false;
      this.letterPdfLoadProgress = 100;
      this.letterPdfUrl = result;
      localStorage.setItem(this.getLetterPdfStorageKey(), result);
      input.value = '';
    };

    reader.onerror = () => {
      alert('Failed to read the PDF file. Please try again.');
      input.value = '';
    };

    reader.readAsDataURL(file);
  }

  useStaticLetterPdf(): void {
    localStorage.removeItem(this.getLetterPdfStorageKey());
    this.letterPdfUrl = '';
    this.letterPdfLoadProgress = 0;
    void this.loadStaticLetterPdf();
  }

  private getLetterPdfStorageKey(): string {
    return `letterPdf_${this.fileNo || 'default'}`;
  }

  private saveDocumentsDataToStorage(): void {
    if (this.fileNo) {
      localStorage.setItem(`drawingDocuments_${this.fileNo}`, JSON.stringify(this.documents));
    }
  }

  loadEstimation(): void {
    // Mock data as fallback
    let allEstimations: Estimation[] = [
      { fileNo: 'Y/SG/Est/24-25/59', ph: 'PH-1', workName: 'Hyderabad Division: Construction of Running room at MLY Station - Telecom arrangements.', stCost: 3721510, storesCost: 25000, rcilProvision: 175000, status: 'Pending', remarks: 'Awaiting approval' },
      { fileNo: 'EST-001', ph: 'PH-1', workName: 'Signal Installation at Station A', stCost: 150000, storesCost: 25000, rcilProvision: 175000, status: 'Pending', remarks: 'Awaiting approval' },
      { fileNo: 'EST-002', ph: 'PH-1', workName: 'OHE Modification', stCost: 89000, storesCost: 12000, rcilProvision: 101000, status: 'Completed', remarks: 'Completed on schedule' },
      { fileNo: 'EST-003', ph: 'PH-2', workName: 'Track Renewal Section B', stCost: 320000, storesCost: 45000, rcilProvision: 365000, status: 'Approved', remarks: 'Work in progress' },
      { fileNo: 'EST-004', ph: 'PH-3', workName: 'Bridge Strengthening Work', stCost: 450000, storesCost: 78000, rcilProvision: 528000, status: 'Pending', remarks: 'Under review' },
      { fileNo: 'EST-005', ph: 'PH-2', workName: 'Platform Extension', stCost: 220000, storesCost: 35000, rcilProvision: 255000, status: 'Approved', remarks: 'Tender process initiated' },
      { fileNo: 'EST-006', ph: 'PH-1', workName: 'Level Crossing Gate Automation', stCost: 180000, storesCost: 28000, rcilProvision: 208000, status: 'Pending', remarks: 'Feasibility study ongoing' },
      { fileNo: 'EST-007', ph: 'PH-2', workName: 'Station Building Renovation', stCost: 560000, storesCost: 92000, rcilProvision: 652000, status: 'Rejected', remarks: 'Budget constraints' },
      { fileNo: 'EST-008', ph: 'PH-3', workName: 'Signaling System Upgrade', stCost: 890000, storesCost: 145000, rcilProvision: 1035000, status: 'Approved', remarks: 'High priority project' },
      { fileNo: 'EST-009', ph: 'PH-1', workName: 'Foot Over Bridge Construction', stCost: 340000, storesCost: 55000, rcilProvision: 395000, status: 'Pending', remarks: 'Design phase' },
      { fileNo: 'EST-010', ph: 'PH-2', workName: 'Yard Remodeling', stCost: 720000, storesCost: 118000, rcilProvision: 838000, status: 'Completed', remarks: 'Successfully completed' },
      { fileNo: 'EST-011', ph: 'PH-3', workName: 'Drainage Improvement', stCost: 95000, storesCost: 15000, rcilProvision: 110000, status: 'Pending', remarks: 'Monsoon preparation' },
      { fileNo: 'EST-012', ph: 'PH-1', workName: 'Electrification Work', stCost: 1200000, storesCost: 198000, rcilProvision: 1398000, status: 'Approved', remarks: 'Major project' }
    ];

    const savedEstimations = localStorage.getItem('estimationsData');
    if (savedEstimations) {
      try {
        allEstimations = JSON.parse(savedEstimations);
      } catch (e) {
        console.error('Failed to parse estimations from local storage', e);
      }
    }

    this.estimation = allEstimations.find(e => e.fileNo === this.fileNo) || null;
    if (this.estimation && !this.estimation.estimNo) {
      this.estimation.estimNo = 'Y/SG/Est/25-26/';
    }
  }

  private migrateScopedStorageKeys(oldFileNo: string, newFileNo: string): void {
    if (!oldFileNo || !newFileNo || oldFileNo === newFileNo) {
      return;
    }

    const scopedPrefixes = ['inventory_', 'letterPdf_', 'justification_', 'coveringLetter_', 'drawingDocuments_'];

    for (const prefix of scopedPrefixes) {
      const oldKey = `${prefix}${oldFileNo}`;
      const newKey = `${prefix}${newFileNo}`;
      const value = localStorage.getItem(oldKey);

      if (value !== null) {
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      }
    }
  }

  onSaveEstimationDetails(): void {
    if (!this.estimation || !this.originalFileNo) {
      return;
    }

    this.estimation.estimNo = (this.estimation.estimNo || '').trim();
    this.estimation.fileNo = (this.estimation.fileNo || '').trim();
    this.estimation.ph = (this.estimation.ph || '').trim();
    this.estimation.workName = (this.estimation.workName || '').trim();

    let allEstimations: Estimation[] = [];
    const savedEstimations = localStorage.getItem('estimationsData');
    if (savedEstimations) {
      try {
        allEstimations = JSON.parse(savedEstimations);
      } catch (e) {
        console.error('Failed to parse estimations from local storage', e);
      }
    }

    const index = allEstimations.findIndex(e => e.fileNo === this.originalFileNo);
    if (index !== -1) {
      allEstimations[index] = { ...allEstimations[index], ...this.estimation };
    } else {
      allEstimations.push({ ...this.estimation });
    }

    localStorage.setItem('estimationsData', JSON.stringify(allEstimations));

    const updatedFileNo = this.estimation.fileNo || this.originalFileNo;
    if (updatedFileNo !== this.originalFileNo) {
      this.migrateScopedStorageKeys(this.originalFileNo, updatedFileNo);
      this.fileNo = updatedFileNo;
      this.originalFileNo = updatedFileNo;
    }
  }

  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      case 'completed': return 'info';
      case 'under review': return 'primary';
      default: return 'secondary';
    }
  }

  getDocumentIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'pdf': return 'cilFile';
      case 'dwg': return 'cilLayers';
      case 'doc': case 'docx': return 'cilDescription';
      case 'xls': case 'xlsx': return 'cilSpreadsheet';
      default: return 'cilFile';
    }
  }

  triggerDrawingUpload(): void {
    this.drawingFileInput?.nativeElement.click();
  }

  async onDrawingFileUpload(event: any): Promise<void> {
    const files: FileList | undefined = event?.target?.files;
    if (!files || files.length === 0) {
      return;
    }

    const uploadedDocs = await Promise.all(
      Array.from(files).map((file, idx) => this.buildDocumentFromFile(file, idx))
    );

    this.documents = [...uploadedDocs, ...this.documents];
    this.saveDocumentsDataToStorage();

    if (event?.target) {
      event.target.value = '';
    }
  }

  private buildDocumentFromFile(file: File, index: number): Promise<Document> {
    const extension = this.getFileExtension(file.name);
    const type = extension ? extension.toUpperCase() : 'FILE';
    const uploadDate = new Date().toISOString().split('T')[0];
    const id = Date.now() + index;

    return new Promise<Document>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id,
          name: this.getFileNameWithoutExtension(file.name),
          type,
          icon: this.getDocumentIcon(type),
          uploadDate,
          size: this.formatFileSize(file.size),
          status: 'Pending',
          originalFileName: file.name,
          mimeType: file.type || undefined,
          fileDataUrl: typeof reader.result === 'string' ? reader.result : undefined
        });
      };

      reader.onerror = () => {
        resolve({
          id,
          name: this.getFileNameWithoutExtension(file.name),
          type,
          icon: this.getDocumentIcon(type),
          uploadDate,
          size: this.formatFileSize(file.size),
          status: 'Pending',
          originalFileName: file.name
        });
      };

      reader.readAsDataURL(file);
    });
  }

  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return '';
    }
    return fileName.slice(lastDotIndex + 1).toLowerCase();
  }

  private getFileNameWithoutExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return fileName;
    }
    return fileName.slice(0, lastDotIndex);
  }

  private formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${bytes} B`;
  }

  onViewDocument(doc: Document): void {
    if (doc.fileDataUrl) {
      window.open(doc.fileDataUrl, '_blank');
      return;
    }

    alert('Preview is available for uploaded documents.');
  }

  onDownloadDocument(doc: Document): void {
    if (!doc.fileDataUrl) {
      alert('Download is available for uploaded documents.');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = doc.fileDataUrl;
    anchor.download = doc.originalFileName || `${doc.name}.${doc.type.toLowerCase()}`;
    anchor.click();
  }

  onSaveCoveringLetter(): void {
    if (this.fileNo) {
      localStorage.setItem(`coveringLetter_${this.fileNo}`, JSON.stringify(this.coveringLetter));
      alert('Covering letter saved successfully to local storage!');
    }
  }

  onSaveEstimationWorkName(): void {
    if (this.estimation && this.fileNo) {
      // Find and update in the list of all estimations
      let allEstimations: any[] = [];
      const savedEstimations = localStorage.getItem('estimationsData');
      if (savedEstimations) {
        try {
          allEstimations = JSON.parse(savedEstimations);
        } catch (e) { }
      }

      const index = allEstimations.findIndex(e => e.fileNo === this.fileNo);
      if (index !== -1) {
        allEstimations[index].workName = this.estimation.workName;
        localStorage.setItem('estimationsData', JSON.stringify(allEstimations));
      }
    }
  }

  onSaveJustification(): void {
    if (this.fileNo) {
      localStorage.setItem(`justification_${this.fileNo}`, JSON.stringify(this.justification));
      alert('Justification saved successfully to local storage!');
    }
  }

  onPrintJustification(): void {
    window.print();
  }

  printInventoryTable(): void {
    const printable = this.buildInventoryPrintableHtml();
    if (!printable) {
      alert('No inventory table data available to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      alert('Unable to open print preview. Please allow pop-ups for this site.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printable);
    printWindow.document.close();
  }

  downloadInventoryTable(): void {
    const tableClone = this.prepareInventoryPrintClone();
    if (!tableClone || !this.addedInventoryItems.length) {
      alert('No inventory table data available to download.');
      return;
    }

    const safeFileNo = (this.fileNo || 'inventory')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '_');
    const fileName = `${safeFileNo}_inventory_table.pdf`;

    const footerHtml = this.buildInventoryFooterHtml('Page 1');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'font-family:Arial,sans-serif;color:#111827;padding:10px;';
    wrapper.appendChild(tableClone);
    wrapper.insertAdjacentHTML('beforeend', footerHtml);
    document.body.appendChild(wrapper);

    const opt = {
      margin: 8,
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
    };

    const pdfWorker: any = html2pdf().set(opt).from(wrapper);

    pdfWorker.toPdf().get('pdf').then((pdf: any) => {
      const pageCount = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const footerY = pageHeight - 6;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        const footerLine = this.buildInventoryFooterLine();
        const footerText = `${footerLine} / Page ${page}`;
        pdf.text(footerText, 8, footerY, { maxWidth: pageWidth - 16 });
      }
      return pdfWorker.save();
    }).then(() => {
      document.body.removeChild(wrapper);
    });
  }

  private buildInventoryPrintableHtml(autoPrint = true): string | null {
    const tableClone = this.prepareInventoryPrintClone();
    if (!tableClone) return null;

    const tableHtml = tableClone.outerHTML;
    const footerHtml = this.buildInventoryFooterHtml();
    const printScript = autoPrint
      ? '<script>window.onload = function() { window.print(); };</script>'
      : '';

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Inventory Table - ${this.fileNo || 'Estimate'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
    .table-responsive { overflow: visible !important; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #1f2937; padding: 6px 5px; vertical-align: middle; }
    th { background: #f3f4f6; font-weight: 700; }
    a { color: #1d4ed8; text-decoration: underline; }
    .inventory-actions-col, .inventory-actions-spacer { display: none !important; }
    .inventory-description-clamp { overflow: visible !important; display: block !important; max-height: none !important; }
    .inventory-description-hover { display: none !important; }
    .inventory-footer { margin-top: 16px; font-size: 11px; white-space: nowrap; }
    .inventory-print-footer { position: fixed; left: 10mm; right: 10mm; bottom: 6mm; margin-top: 0; }
    .inventory-page-number::after { content: counter(page); }
    @media print {
      body { margin: 10mm 10mm 18mm; }
      @page { size: A4 portrait; margin: 10mm; }
    }
  </style>
</head>
<body>
  ${tableHtml}
  <div class="inventory-print-footer">${footerHtml}</div>
  ${printScript}
</body>
</html>`;
  }

  private buildInventoryFooterHtml(pageText?: string): string {
    const footerLine = this.buildInventoryFooterLine();
    const suffix = pageText || 'Page <span class="inventory-page-number"></span>';
    return `<div class="inventory-footer">${footerLine} / ${suffix}</div>`;
  }

  private buildInventoryFooterLine(): string {
    const subject = String(this.coveringLetter.subject || this.computedWorkName || '-').trim();
    const reference = this.formatInventoryFooterReference(this.coveringLetter.reference || '-');
    const fileNo = String(this.fileNo || '-').trim();

    return [subject, reference, fileNo].filter(Boolean).join(' / ');
  }

  private formatInventoryFooterReference(reference: string): string {
    const raw = String(reference || '').trim();
    if (!raw) {
      return '-';
    }

    const compact = raw.replace(/\s*\.\s*Dt\s*:\s*/i, '/');
    return compact.replace(/\s+/g, ' ').trim();
  }

  printDrmApproval(): void {
    const printable = this.buildDrmApprovalPrintableHtml();
    if (!printable) {
      alert('No DRM approval content is available to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      alert('Unable to open print preview. Please allow pop-ups for this site.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printable);
    printWindow.document.close();
  }

  downloadDrmApproval(): void {
    const printable = this.buildDrmApprovalPrintableHtml(false);
    if (!printable) {
      alert('No DRM approval content is available to download.');
      return;
    }

    const safeFileNo = (this.fileNo || 'drm_approval')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '_');
    const fileName = `${safeFileNo}_drm_approval.html`;
    const blob = new Blob([printable], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private buildDrmApprovalPrintableHtml(autoPrint = true): string | null {
    const drmNode = this.drmApprovalPrintSection?.nativeElement;
    if (!drmNode) return null;

    const drmHtml = drmNode.innerHTML;
    const generatedAt = new Date().toLocaleString('en-IN');
    const title = this.estimation?.workName || this.computedWorkName;
    const printScript = autoPrint
      ? '<script>window.onload = function() { window.print(); };</script>'
      : '';

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DRM Approval - ${this.fileNo || 'Estimate'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
    h2 { margin: 0 0 6px; font-size: 18px; }
    .meta { margin: 0 0 14px; font-size: 12px; color: #4b5563; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #1f2937; padding: 8px 10px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    p { margin-bottom: 1rem; }
    @media print {
      body { margin: 10mm; }
      @page { size: A4 portrait; margin: 10mm; }
    }
  </style>
</head>
<body>
  <h2>DRM Approval Note</h2>
  <p class="meta">File No: ${this.fileNo || '-'} | Generated: ${generatedAt}</p>
  <p class="meta">${title}</p>
  ${drmHtml}
  ${printScript}
</body>
</html>`;
  }

  get safeLetterPdfUrl(): SafeResourceUrl | null {
    if (!this.letterPdfUrl) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.letterPdfUrl);
  }

  get isLetterPdfDisplayed(): boolean {
    return !!this.letterPdfUrl && !this.letterPdfLoading;
  }

  get safeInventoryPdfUrl(): SafeResourceUrl | null {
    if (!this.inventoryPdfViewUrl) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.inventoryPdfViewUrl);
  }

  handlePdfModalChange(event: any) {
    this.isPdfModalVisible = event;
    if (!event) {
      this.pdfLoadToken++;
      this.pdfPageRenderToken++;
      this.inventoryPdfViewUrl = null;
      this.isPdfLoading = false;
      this.selectedReferenceItem = null;
      this.pdfPageReason = '';
      this.pdfHighlightStatus = '';
      this.pdfHighlightFound = false;
      this.pdfMatchedSnippet = '';
      this.pdfScheduleStatus = '';
      this.pdfScheduleBidRateText = '';
      this.totalPdfPages = 0;
      this.currentPdfPage = 1;
      if (this.pdfDocRef) {
        this.pdfDocRef.destroy().catch(() => {});
        this.pdfDocRef = null;
      }
    }
  }

  closePdfModal() {
    this.isPdfModalVisible = false;
    this.pdfLoadToken++;
    this.pdfPageRenderToken++;
    this.inventoryPdfViewUrl = null;
    this.isPdfLoading = false;
    this.selectedReferenceItem = null;
    this.referenceSearchTerm = '';
    this.selectedDocumentType = '';
    this.pdfPageReason = '';
    this.pdfHighlightStatus = '';
    this.pdfHighlightFound = false;
    this.pdfMatchedSnippet = '';
    this.pdfScheduleStatus = '';
    this.pdfScheduleBidRateText = '';
    this.totalPdfPages = 0;
    this.currentPdfPage = 1;
    if (this.pdfDocRef) {
      this.pdfDocRef.destroy().catch(() => {});
      this.pdfDocRef = null;
    }
  }

  private normalizeInventoryItem(item: InventoryItem): InventoryItem {
    return {
      ...item,
      unit: this.normalizeUnit(item.unit)
    };
  }

  private normalizeUnit(unit: string): string {
    // Preserve the original unit text from source JSON.
    return String(unit ?? '').trim();
  }

  private normalizeForMatch(value: string): string {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeItemNoForMatch(value: string): string {
    const raw = String(value || '').toLowerCase().trim();
    const exact = raw.match(/(\d+)\s*(?:\(([a-z])\)|([a-z]))?/i);
    if (!exact) {
      return raw.replace(/[^a-z0-9]/g, '');
    }

    const base = exact[1] || '';
    const suffix = (exact[2] || exact[3] || '').toLowerCase();
    return suffix ? `${base}(${suffix})` : base;
  }

  private getLatestSorItemSnapshot(item: InventoryItem): InventoryItem {
    if (!this.isSorReferenceItem(item)) {
      return item;
    }

    const currentItemNo = this.normalizeItemNoForMatch(this.getDisplayItemNo(item));
    const currentDesc = this.normalizeForMatch(String(item?.description || ''));

    const fromMaster = this.inventoryItems.find((candidate) => {
      if (!this.isSorFileType(candidate?.fileType)) return false;

      const candidateItemNo = this.normalizeItemNoForMatch(this.getDisplayItemNo(candidate));
      if (currentItemNo && candidateItemNo && currentItemNo === candidateItemNo) {
        return true;
      }

      const candidateDesc = this.normalizeForMatch(String(candidate?.description || ''));
      return !!currentDesc && !!candidateDesc && currentDesc === candidateDesc;
    });

    if (!fromMaster) {
      return item;
    }

    return {
      ...item,
      page_no: fromMaster.page_no ?? item.page_no,
      chapter: fromMaster.chapter ?? item.chapter,
      referenceId: fromMaster.referenceId || item.referenceId,
      Matched_items_no: fromMaster.Matched_items_no || item.Matched_items_no,
      description: fromMaster.description || item.description
    };
  }

  private getInventoryReferenceDisplay(item: InventoryItem): string {
    const latestItem = this.getLatestSorItemSnapshot(item);
    const itemNo = this.getDisplayItemNo(latestItem);
    const referenceId = String(latestItem.referenceId || '').trim();

    if (referenceId && itemNo) {
      return `${referenceId} - ${itemNo}`;
    }

    if (referenceId) {
      return referenceId;
    }

    if (itemNo && this.isSorReferenceItem(latestItem)) {
      return itemNo;
    }

    return String(latestItem.reference || '').trim() || '-';
  }

  private prepareInventoryPrintClone(): HTMLElement | null {
    const inventoryNode = this.inventoryPrintSection?.nativeElement;
    if (!inventoryNode) return null;

    const tableClone = inventoryNode.cloneNode(true) as HTMLElement;

    tableClone.querySelectorAll('.inventory-col-actions').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    tableClone.querySelectorAll('.inventory-actions-col, .inventory-actions-spacer').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    tableClone.querySelectorAll('.inventory-description-hover').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    tableClone.querySelectorAll('.inventory-description-clamp').forEach(el => {
      (el as HTMLElement).style.cssText = 'display:block;overflow:visible;max-height:none;';
    });
    tableClone.querySelectorAll('table').forEach(t => {
      (t as HTMLElement).style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;';
    });
    tableClone.querySelectorAll('th, td').forEach(cell => {
      (cell as HTMLElement).style.cssText += ';border:1px solid #1f2937;padding:5px 4px;font-size:10px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;';
    });
    tableClone.querySelectorAll('thead th').forEach(cell => {
      (cell as HTMLElement).style.verticalAlign = 'middle';
      (cell as HTMLElement).style.textAlign = 'center';
    });
    tableClone.querySelectorAll('tbody td:nth-child(1), tbody td:nth-child(3), tbody td:nth-child(4)').forEach(cell => {
      (cell as HTMLElement).style.verticalAlign = 'middle';
      (cell as HTMLElement).style.textAlign = 'center';
    });
    tableClone.querySelectorAll('tbody td:nth-child(5), tbody td:nth-child(6)').forEach(cell => {
      (cell as HTMLElement).style.textAlign = 'right';
      (cell as HTMLElement).style.verticalAlign = 'middle';
    });

    const referenceCells = tableClone.querySelectorAll('tbody tr td.inventory-reference-col');
    referenceCells.forEach((cell, index) => {
      const entry = this.addedInventoryItems[index];
      const displayValue = entry ? this.getInventoryReferenceDisplay(entry.item) : '-';
      (cell as HTMLElement).innerHTML = '';
      (cell as HTMLElement).textContent = displayValue;
      (cell as HTMLElement).style.textAlign = 'left';
      (cell as HTMLElement).style.whiteSpace = 'normal';
      (cell as HTMLElement).style.wordBreak = 'break-word';
    });

    tableClone.querySelectorAll('.inventory-total-spacer').forEach(cell => {
      (cell as HTMLElement).style.display = 'table-cell';
    });

    return tableClone;
  }

  private getScheduleFromReference(ref: string): string {
    const match = (ref || '').match(/schedule\s*([a-z])/i);
    return match?.[1]?.toUpperCase() || '';
  }

  private async loadPdfPageMap(): Promise<PdfPageMap> {
    if (this.pdfPageMapCache) return this.pdfPageMapCache;
    try {
      this.pdfPageMapCache = await firstValueFrom(this.http.get<PdfPageMap>('assets/pdf-page-map.json'));
      return this.pdfPageMapCache;
    } catch {
      this.pdfPageMapCache = {};
      return this.pdfPageMapCache;
    }
  }

  private resolvePdfPage(docType: string, item: InventoryItem, pageMap: PdfPageMap): PdfPageResolution {
    if (item.page_no && item.page_no > 0) {
      return {
        page: item.page_no,
        source: 'page_no',
        reason: 'Opened the exact page stored in extracted inventory data.'
      };
    }

    const config = pageMap[docType];
    if (!config) {
      return {
        page: 1,
        source: 'default',
        reason: 'No page map was available for this reference document.'
      };
    }

    const normalizedDescription = this.normalizeForMatch(item.description || '');
    const hints = config.descriptionHints || [];

    for (const hint of hints) {
      const needle = this.normalizeForMatch(hint.contains || '');
      if (needle && normalizedDescription.includes(needle)) {
        return {
          page: hint.page,
          source: 'description_hint',
          reason: 'Opened the page mapped from a known description hint.'
        };
      }
    }

    const schedule = (item.schedule || this.getScheduleFromReference(item.reference || '')).toUpperCase();
    if (schedule && config.schedulePages?.[schedule]) {
      return {
        page: config.schedulePages[schedule],
        source: 'schedule',
        reason: `Opened the mapped page for Schedule ${schedule}.`
      };
    }

    return {
      page: config.defaultPage || 1,
      source: 'default',
      reason: 'Opened the default reference page for this document.'
    };
  }

  private resolveDocTypeAndFile(ref: string): { docType: string; pdfFileName: string } {
    if (ref.includes('00850890090468')) return { docType: 'LOA_ABSS', pdfFileName: 'LOA ABSS.pdf' };
    if (ref.includes('01052610112449')) return { docType: 'STTC', pdfFileName: 'STTC.pdf' };
    if (ref.includes('01052610118677')) return { docType: 'ZONAL_2024', pdfFileName: 'zonal2024_loa.pdf' };
    return { docType: 'SOR_2024', pdfFileName: 'SOR 2024.pdf' };
  }

  private openPdfModal(item: InventoryItem, docType: string, pdfFileName: string, page: number, reason: string): void {
    this.selectedDocumentType = docType;
    this.selectedReferenceItem = item;
    this.referenceSearchTerm = (item.description || '').trim();
    this.pdfPageReason = reason;
    this.pdfHighlightFound = false;
    this.pdfHighlightStatus = 'Searching the selected PDF page for this description...';
    this.pendingPdfAssetUrl = `/assets/pdf/${pdfFileName}`;
    this.pendingPdfPage = page;
    this.pendingPdfSearch = item.description || '';
    this.pendingPdfHighlightMode = 'description';
    this.isPdfLoading = true;
    this.isPdfModalVisible = true;
    this.startPdfRender();
  }

  private startPdfRender(): void {
    const token = ++this.pdfLoadToken;
    setTimeout(() => {
      void this.renderPdfWithHighlight(token);
    }, 0);
  }

  private async waitForPdfCanvasReady(timeoutMs = 2500): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.pdfCanvas?.nativeElement && this.pdfScrollContainer?.nativeElement) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    return false;
  }

  /** Reference 1 — opens the document at page 1 (LOA cover / first page). */
  async viewReferencePdf(item: InventoryItem): Promise<void> {
    const { docType, pdfFileName } = this.resolveDocTypeAndFile(item.reference || '');
    this.openPdfModal(item, docType, pdfFileName, 1, 'Opened the first page of the reference document.');
  }

  /** Reference 2 — opens the document at the schedule page and highlights the schedule header. */
  async viewReferencePdfSchedule(item: InventoryItem): Promise<void> {
    const { docType, pdfFileName } = this.resolveDocTypeAndFile(item.reference || '');

    // For SOR, "Chap Pg." should open chapter index and highlight the exact chapter row.
    if (this.isSorReferenceItem(item)) {
      const latestItem = this.getLatestSorItemSnapshot(item);
      const chapterNo = Math.max(1, this.parseNumericValue(latestItem.chapter));
      const chapterIndexPage = chapterNo >= 35 ? 5 : 4;

      this.selectedDocumentType = docType;
      this.selectedReferenceItem = latestItem;
      this.referenceSearchTerm = `CHAPTER - ${chapterNo}`;
      this.pdfPageReason = 'Opened chapter index page for exact chapter-row highlight.';
      this.pdfHighlightFound = false;
      this.pdfHighlightStatus = `Searching chapter list for CHAPTER - ${chapterNo}...`;
      this.pendingPdfAssetUrl = `/assets/pdf/${pdfFileName}`;
      this.pendingPdfPage = chapterIndexPage;
      this.pendingPdfSearch = `CHAPTER - ${chapterNo}`;
      this.pendingPdfHighlightMode = 'chapter';
      this.isPdfLoading = true;
      this.isPdfModalVisible = true;
      this.startPdfRender();
      return;
    }

    const pageMap = await this.loadPdfPageMap();
    const config = pageMap[docType];
    const overridePage = this.scheduleBidRatePageOverrides[docType];
    const page = config?.calculationPage || overridePage || config?.defaultPage || 1;
    const reason = config?.calculationPage
      ? 'Opened the mapped schedule page.'
      : overridePage
        ? 'Opened the configured schedule page override.'
        : 'Opened the default page (no schedule page mapping found).';
    const schedule = (item.schedule || this.getScheduleFromReference(item.reference || '')).toUpperCase();
    this.selectedDocumentType = docType;
    this.selectedReferenceItem = item;
    this.referenceSearchTerm = `Schedule ${schedule}`;
    this.pdfPageReason = reason;
    this.pdfHighlightFound = false;
    this.pdfHighlightStatus = 'Searching the selected PDF page for this schedule header...';
    this.pendingPdfAssetUrl = `/assets/pdf/${pdfFileName}`;
    this.pendingPdfPage = page;
    this.pendingPdfSearch = `Schedule ${schedule}`;
    this.pendingPdfHighlightMode = 'schedule';
    this.isPdfLoading = true;
    this.isPdfModalVisible = true;
    this.startPdfRender();
  }

  /** Reference 3 — opens the document at the exact item page (page_no → hint → schedule → default). */
  async viewReferencePdfItem(item: InventoryItem): Promise<void> {
    const latestItem = this.getLatestSorItemSnapshot(item);
    const { docType, pdfFileName } = this.resolveDocTypeAndFile(item.reference || '');
    const pageMap = await this.loadPdfPageMap();
    const resolution = this.resolvePdfPage(docType, latestItem, pageMap);
    const itemNo = (latestItem.Matched_items_no || '').toString().trim();
    const slNo = latestItem.slNo?.toString().trim() || '';
    const searchNeedle = itemNo || slNo || (latestItem.description || '');
    this.selectedDocumentType = docType;
    this.selectedReferenceItem = latestItem;
    this.referenceSearchTerm = (latestItem.description || '').trim();
    this.pdfPageReason = resolution.reason;
    this.pdfHighlightFound = false;
    this.pdfHighlightStatus = 'Searching the selected PDF page for this exact item row...';
    this.pendingPdfAssetUrl = `/assets/pdf/${pdfFileName}`;
    this.pendingPdfPage = resolution.page;
    this.pendingPdfSearch = searchNeedle;
    this.pendingPdfHighlightMode = itemNo ? 'item-no' : (slNo ? 'item-slno' : 'description');
    this.isPdfLoading = true;
    this.isPdfModalVisible = true;
    this.startPdfRender();
  }

  async navigatePdfPage(delta: number): Promise<void> {
    const newPage = this.currentPdfPage + delta;
    if (newPage < 1 || newPage > this.totalPdfPages || !this.pdfDocRef) return;
    this.currentPdfPage = newPage;
    this.isPdfLoading = true;
    const renderToken = ++this.pdfPageRenderToken;
    try {
      await this.renderPage(newPage, renderToken);
    } finally {
      this.ngZone.run(() => {
        this.isPdfLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  private async renderPdfWithHighlight(loadToken: number): Promise<void> {
    if (!this.pendingPdfAssetUrl) return;
    this.isPdfLoading = true;

    // Safety: always stop spinner after 2 seconds
    const loaderTimer = setTimeout(() => this.ngZone.run(() => {
      this.isPdfLoading = false;
      this.cdr.detectChanges();
    }), 2000);

    try {
      const isCanvasReady = await this.waitForPdfCanvasReady();
      if (!isCanvasReady || loadToken !== this.pdfLoadToken || !this.isPdfModalVisible) {
        return;
      }

      if (this.pdfDocRef) {
        try { await this.pdfDocRef.destroy(); } catch { /* ignore */ }
        this.pdfDocRef = null;
      }

      const pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';
      }

      const pdf = await pdfjs.getDocument(this.pendingPdfAssetUrl).promise;
      if (loadToken !== this.pdfLoadToken || !this.isPdfModalVisible) {
        try { await pdf.destroy(); } catch { /* ignore */ }
        return;
      }

      this.pdfDocRef = pdf;
      this.totalPdfPages = pdf.numPages;
      const preferredPage = Math.min(Math.max(this.pendingPdfPage, 1), pdf.numPages);
      this.currentPdfPage = preferredPage;
      const renderToken = ++this.pdfPageRenderToken;
      await this.renderPage(this.currentPdfPage, renderToken);
    } catch (e) {
      console.error('PDF render error', e);
    } finally {
      clearTimeout(loaderTimer);
      if (loadToken === this.pdfLoadToken) {
        this.ngZone.run(() => {
          this.isPdfLoading = false;
          this.cdr.detectChanges();
        });
      }
    }
  }

  private async renderPage(pageNum: number, renderToken: number): Promise<void> {
    if (!this.pdfDocRef || !this.pdfCanvas?.nativeElement) return;

    const page = await this.pdfDocRef.getPage(pageNum);
    const canvas = this.pdfCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const containerWidth = Math.max((canvas.parentElement?.clientWidth ?? 860) - 32, 400);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = containerWidth / baseVp.width;
    const viewport = page.getViewport({ scale });

    const renderedCanvas = document.createElement('canvas');
    const renderedCtx = renderedCanvas.getContext('2d')!;
    renderedCanvas.width = viewport.width;
    renderedCanvas.height = viewport.height;
    renderedCtx.clearRect(0, 0, renderedCanvas.width, renderedCanvas.height);

    const scrollContainer = this.pdfScrollContainer?.nativeElement;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }

    await page.render({ canvasContext: renderedCtx, viewport }).promise;
    if (renderToken !== this.pdfPageRenderToken) {
      page.cleanup();
      return;
    }

    let match: PdfHighlightResult | null = null;

    if (this.pendingPdfSearch) {
      const textContent = await page.getTextContent();
      if (this.pendingPdfHighlightMode === 'item-slno') {
        match = this.findItemSerialFieldHighlight(textContent, viewport, this.pendingPdfSearch);
      } else if (this.pendingPdfHighlightMode === 'item-no') {
        match = this.findItemNumberFieldHighlight(textContent, viewport, this.pendingPdfSearch);
      } else if (this.pendingPdfHighlightMode === 'schedule') {
        match = this.findScheduleFieldHighlight(textContent, viewport, this.pendingPdfSearch);
      } else if (this.pendingPdfHighlightMode === 'chapter') {
        match = this.findChapterFieldHighlight(textContent, viewport, this.pendingPdfSearch);
      } else {
        match = this.findDescriptionHighlight(textContent, viewport, this.pendingPdfSearch);
      }

      if (renderToken === this.pdfPageRenderToken) {
        this.ngZone.run(() => {
          this.pdfHighlightFound = !!match;
          this.pdfHighlightStatus = match
            ? `Matched the required field on page ${pageNum} with ${Math.round(match.score * 100)}% confidence.`
            : this.pendingPdfHighlightMode === 'item-slno'
              ? `No exact serial row match for S.No ${this.pendingPdfSearch} on page ${pageNum}.`
              : this.pendingPdfHighlightMode === 'item-no'
                ? `No exact item-row match for ${this.pendingPdfSearch} on page ${pageNum}.`
                : this.pendingPdfHighlightMode === 'chapter'
                  ? `No exact chapter-row match for ${this.pendingPdfSearch} on page ${pageNum}.`
              : `No clear text match was detected on page ${pageNum}.`;
          this.pdfMatchedSnippet = match?.snippet || '';
          this.cdr.detectChanges();
        });
      }
    }

    if (renderToken !== this.pdfPageRenderToken) {
      page.cleanup();
      return;
    }

    // Always render the full page
    canvas.width = renderedCanvas.width;
    canvas.height = renderedCanvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(renderedCanvas, 0, 0);

    // Overlay highlight on top of full page if match found
    if (match) {
      this.renderHighlightOnFullPage(canvas, ctx, match, this.pendingPdfHighlightMode);
    }

    page.cleanup();
  }

  private async renderFirstPagePreview(): Promise<void> {
    if (!this.pdfDocRef || !this.pdfFirstPageCanvas?.nativeElement || this.totalPdfPages < 1) return;

    const page = await this.pdfDocRef.getPage(1);
    const canvas = this.pdfFirstPageCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const containerWidth = Math.max((canvas.parentElement?.clientWidth ?? 860) - 32, 400);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = containerWidth / baseVp.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
  }

  private async renderSchedulePreview(): Promise<void> {
    if (!this.pdfDocRef || !this.pdfScheduleCanvas?.nativeElement || this.totalPdfPages < 1) return;

    const docType = this.selectedDocumentType || this.getDocTypeFromReference(this.selectedReferenceItem?.reference || '');
    const schedule = (this.selectedReferenceItem?.schedule || this.getScheduleFromReference(this.selectedReferenceItem?.reference || '')).toUpperCase();
    this.pdfScheduleBidRateText = this.getSelectedScheduleBidRateText(schedule);
    if (!schedule) {
      this.pdfScheduleStatus = 'Schedule not available for this item.';
      return;
    }

    const overridePage = this.scheduleBidRatePageOverrides[docType];
    if (overridePage) {
      const clampedPage = Math.min(Math.max(overridePage, 1), this.totalPdfPages);
      if (clampedPage !== overridePage) {
        this.pdfScheduleStatus = `Configured page ${overridePage} is out of range; using page ${clampedPage}.`;
      }

      const done = await this.tryRenderScheduleFromPage(clampedPage, schedule);
      if (!done) {
        await this.renderSchedulePageFull(clampedPage, schedule);
        this.pdfScheduleStatus = `Could not auto-detect Schedule ${schedule} bid-rate row on page ${clampedPage}; showing full page ${clampedPage}.`;
      }
      return;
    }

    const centerPage = Math.min(Math.max(this.currentPdfPage, 1), this.totalPdfPages);
    const nearby: number[] = [centerPage];
    for (let d = 1; d <= 8; d++) {
      nearby.push(centerPage - d, centerPage + d);
    }
    const nearbyPages = Array.from(new Set(nearby)).filter(p => p >= 1 && p <= this.totalPdfPages);

    const allPages: number[] = [];
    for (let p = 1; p <= this.totalPdfPages; p++) {
      if (!nearbyPages.includes(p)) allPages.push(p);
    }
    const pages = [...nearbyPages, ...allPages];

    let rendered = false;
    for (const pageNum of pages) {
      const done = await this.tryRenderScheduleFromPage(pageNum, schedule);
      if (done) {
        rendered = true;
        break;
      }
    }

    if (!rendered) {
      this.pdfScheduleStatus = `Could not locate a visible Schedule ${schedule} bid rate block in this PDF.`;
      const canvas = this.pdfScheduleCanvas.nativeElement;
      const ctx = canvas.getContext('2d')!;
      canvas.width = 10;
      canvas.height = 10;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private getSelectedScheduleBidRateText(schedule: string): string {
    if (!this.selectedReferenceItem || !schedule) return '';

    const docType = this.getDocTypeFromReference(this.selectedReferenceItem.reference || '');
    const info = this.loaSchedules[docType]?.[schedule];
    if (!info) return '';

    if ((info.type || '').toLowerCase().includes('at par')) {
      return 'At Par';
    }
    return `${info.rate.toFixed(2)}% ${info.type}`;
  }

  private async renderSchedulePageFull(pageNum: number, schedule: string): Promise<void> {
    if (!this.pdfDocRef || !this.pdfScheduleCanvas?.nativeElement) return;

    const page = await this.pdfDocRef.getPage(pageNum);
    try {
      const canvas = this.pdfScheduleCanvas.nativeElement;
      const ctx = canvas.getContext('2d')!;

      const containerWidth = Math.max((canvas.parentElement?.clientWidth ?? 860) - 32, 400);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseVp.width;
      const viewport = page.getViewport({ scale });

      const textContent = await page.getTextContent();
      const scheduleRowBand = this.findScheduleHeaderBand(textContent, viewport, schedule);

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (scheduleRowBand) {
        const padX = 4;
        const rowH = Math.max(scheduleRowBand.yBottom - scheduleRowBand.yTop, 10);
        ctx.save();
        ctx.fillStyle = 'rgba(13, 110, 253, 0.14)';
        ctx.strokeStyle = '#0d6efd';
        ctx.lineWidth = 2;
        ctx.fillRect(padX, scheduleRowBand.yTop, canvas.width - padX * 2, rowH);
        ctx.strokeRect(padX, scheduleRowBand.yTop, canvas.width - padX * 2, rowH);
        ctx.restore();
      }
    } finally {
      page.cleanup();
    }
  }

  private async tryRenderScheduleFromPage(pageNum: number, schedule: string): Promise<boolean> {
    if (!this.pdfDocRef || !this.pdfScheduleCanvas?.nativeElement) return false;

    const page = await this.pdfDocRef.getPage(pageNum);
    try {
      const canvas = this.pdfScheduleCanvas.nativeElement;
      const ctx = canvas.getContext('2d')!;

      const containerWidth = Math.max((canvas.parentElement?.clientWidth ?? 860) - 32, 400);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseVp.width;
      const viewport = page.getViewport({ scale });

      const textContent = await page.getTextContent();
      const band = this.findScheduleBand(textContent, viewport, schedule);
      if (!band) return false;
      const scheduleRowBand = this.findScheduleHeaderBand(textContent, viewport, schedule);

      const fullCanvas = document.createElement('canvas');
      const fullCtx = fullCanvas.getContext('2d')!;
      fullCanvas.width = viewport.width;
      fullCanvas.height = viewport.height;
      fullCtx.clearRect(0, 0, fullCanvas.width, fullCanvas.height);
      await page.render({ canvasContext: fullCtx, viewport }).promise;

      const padY = 10;
      const cropTop = Math.max(Math.floor(band.yTop) - padY, 0);
      const cropBottom = Math.min(Math.ceil(band.yBottom) + padY, fullCanvas.height);
      const cropHeight = Math.max(cropBottom - cropTop, 20);

      canvas.width = fullCanvas.width;
      canvas.height = cropHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(fullCanvas, 0, cropTop, fullCanvas.width, cropHeight, 0, 0, canvas.width, canvas.height);

      const highlightTopSource = scheduleRowBand?.yTop ?? band.yTop;
      const highlightBottomSource = scheduleRowBand?.yBottom ?? band.yBottom;
      const localTop = Math.max(highlightTopSource - cropTop, 0);
      const localHeight = Math.max(highlightBottomSource - highlightTopSource, 10);
      const padX = 4;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 123, 255, 0.14)';
      ctx.strokeStyle = '#0d6efd';
      ctx.lineWidth = 2;
      ctx.fillRect(padX, localTop, canvas.width - padX * 2, localHeight);
      ctx.strokeRect(padX, localTop, canvas.width - padX * 2, localHeight);
      ctx.restore();

      this.pdfScheduleStatus = `Showing Schedule ${schedule} bid rate section from page ${pageNum} (full row).`;
      return true;
    } finally {
      page.cleanup();
    }
  }

  private findScheduleBand(textContent: any, viewport: any, schedule: string): { yTop: number; yBottom: number } | null {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const scheduleToken = `schedule ${schedule.toLowerCase()}`;
    const scheduleTokenCompact = `schedule${schedule.toLowerCase()}`;
    const vt: number[] = viewport.transform;

    interface RItem {
      text: string;
      normText: string;
      yTop: number;
      yBottom: number;
    }

    const textItems: RItem[] = [];
    for (const it of (textContent.items ?? [])) {
      if (!it.str?.trim()) continue;
      const t: number[] = it.transform;
      const cy = vt[1] * t[4] + vt[3] * t[5] + vt[5];
      const h = Math.abs(vt[3] * (t[3] || 12));
      textItems.push({
        text: it.str,
        normText: norm(it.str),
        yTop: cy - h,
        yBottom: cy
      });
    }
    if (!textItems.length) return null;

    const avgH = textItems.reduce((s, it) => s + (it.yBottom - it.yTop), 0) / textItems.length;
    const rowTolerance = avgH * 0.6;

    interface Row {
      text: string;
      normText: string;
      yTop: number;
      yBottom: number;
    }

    const rows: Row[] = [];
    const sorted = [...textItems].sort((a, b) => a.yTop - b.yTop);
    for (const it of sorted) {
      const existing = rows.find(r => Math.abs(r.yTop - it.yTop) <= rowTolerance);
      if (existing) {
        existing.text += ` ${it.text}`;
        existing.normText += ` ${it.normText}`;
        existing.yTop = Math.min(existing.yTop, it.yTop);
        existing.yBottom = Math.max(existing.yBottom, it.yBottom);
      } else {
        rows.push({ text: it.text, normText: it.normText, yTop: it.yTop, yBottom: it.yBottom });
      }
    }

    const hasAny = (text: string, needles: string[]) => needles.some(n => text.includes(n));
    const hasAnyCompact = (text: string, needles: string[]) => {
      const c = compact(text);
      return needles.some(n => c.includes(compact(n)));
    };

    const bidHeaderTokens = ['bid rate', 'bid amount', 'escl', 'advt.value', 'advt value', 'unit rate'];
    const bidValueTokens = ['at par', 'above', 'below', '%'];
    const strongTokens = ['view details', 'schedule totals'];
    const detailedTableTokens = ['s no', 'item no', 'description of item', 'description', 'qty', 'unit'];

    let bestBand: { yTop: number; yBottom: number } | null = null;
    let bestScore = -1;

    for (let i = 0; i < rows.length; i++) {
      const rowNorm = rows[i].normText;
      const isScheduleRow = rowNorm.includes(scheduleToken) || rowNorm.includes(scheduleTokenCompact);
      if (!isScheduleRow) continue;

      const maxLookahead = Math.min(i + 12, rows.length - 1);
      let score = 0;
      let headerIdx = -1;
      let valueIdx = -1;
      let detailsIdx = -1;
      let totalsIdx = -1;
      let tableHeaderIdx = -1;

      for (let j = i; j <= maxLookahead; j++) {
        const n = rows[j].normText;

        if (hasAny(n, bidHeaderTokens) || hasAnyCompact(n, bidHeaderTokens)) {
          score += 3;
          if (headerIdx === -1) headerIdx = j;
        }
        if (hasAny(n, bidValueTokens) || hasAnyCompact(n, bidValueTokens)) {
          score += 3;
          valueIdx = j;
        }
        if (n.includes('view details') || hasAnyCompact(n, ['view details'])) {
          score += 5;
          detailsIdx = j;
        }
        if (n.includes('schedule totals') || hasAnyCompact(n, ['schedule totals'])) {
          score += 5;
          totalsIdx = j;
        }
        if (hasAny(n, strongTokens) || hasAnyCompact(n, strongTokens)) {
          score += 2;
        }
        if (hasAny(n, detailedTableTokens) || hasAnyCompact(n, detailedTableTokens)) {
          if (tableHeaderIdx === -1) tableHeaderIdx = j;
        }
      }

      // Penalize schedule rows that lead into detailed item tables (too many S.No/Item rows).
      const noisyItemRows = rows
        .slice(i + 1, Math.min(i + 16, rows.length))
        .filter(r => /\bs\s*no\b|\bitem\s*no\b|\bdescription\b/.test(r.normText) && !r.normText.includes('bid rate'))
        .length;
      score -= noisyItemRows * 0.75;

      if (score <= bestScore) continue;

      let endIdx = i;

      // Prefer compact bid-rate summary: schedule row -> details/value row -> totals row
      // and avoid spilling into long detailed item tables.
      if (detailsIdx >= i) {
        endIdx = Math.min(detailsIdx + 1, rows.length - 1);
        if (totalsIdx >= detailsIdx && (totalsIdx - detailsIdx) <= 3) {
          endIdx = totalsIdx;
        }
      } else if (valueIdx >= i) {
        endIdx = Math.min(valueIdx + 1, rows.length - 1);
        if (totalsIdx >= valueIdx && (totalsIdx - valueIdx) <= 3) {
          endIdx = totalsIdx;
        }
      } else if (headerIdx >= i) {
        endIdx = Math.min(headerIdx + 1, rows.length - 1);
      } else {
        endIdx = Math.min(i + 2, rows.length - 1);
      }

      // Hard stop before detailed item table headers if they appear after summary rows.
      if (tableHeaderIdx > i) {
        endIdx = Math.min(endIdx, tableHeaderIdx - 1);
      }

      if (endIdx < i) {
        endIdx = i;
      }

      const yTop = rows[i].yTop;
      const effectiveEndIdx = Math.min(endIdx, rows.length - 1);

      // Summary rows often wrap across multiple visual fragments; extend a bit
      // downward, but never enter the detailed item table header row.
      let yBottom = rows[effectiveEndIdx].yBottom + avgH * 1.8;
      if (tableHeaderIdx > i) {
        const stopBeforeHeader = rows[tableHeaderIdx].yTop - 2;
        yBottom = Math.min(yBottom, stopBeforeHeader);
      }
      yBottom = Math.max(yBottom, rows[effectiveEndIdx].yBottom);

      bestBand = { yTop, yBottom };
      bestScore = score;
    }

    if (bestBand) return bestBand;

    // Fallback: show a short schedule summary slice only, never the detailed item table.
    for (let i = 0; i < rows.length; i++) {
      const rowNorm = rows[i].normText;
      const isScheduleRow = rowNorm.includes(scheduleToken) || rowNorm.includes(scheduleTokenCompact);
      if (!isScheduleRow) continue;

      let endIdx = Math.min(i + 3, rows.length - 1);
      for (let j = i + 1; j <= Math.min(i + 10, rows.length - 1); j++) {
        const n = rows[j].normText;
        endIdx = Math.min(j, i + 3);
        if (hasAny(n, detailedTableTokens) || hasAnyCompact(n, detailedTableTokens)) {
          endIdx = Math.max(i, j - 1);
          break;
        }
        if (n.includes('schedule totals') || n.includes('view details') || hasAnyCompact(n, ['schedule totals', 'view details'])) {
          break;
        }
      }

      let yBottom = rows[endIdx].yBottom + avgH * 1.5;
      if (endIdx + 1 < rows.length) {
        yBottom = Math.min(yBottom, rows[endIdx + 1].yTop - 2);
      }
      yBottom = Math.max(yBottom, rows[endIdx].yBottom);

      return {
        yTop: rows[i].yTop,
        yBottom
      };
    }

    return null;
  }

  private findScheduleHeaderBand(textContent: any, viewport: any, schedule: string): { yTop: number; yBottom: number } | null {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const scheduleToken = `schedule ${schedule.toLowerCase()}`;
    const scheduleTokenCompact = `schedule${schedule.toLowerCase()}`;
    const vt: number[] = viewport.transform;

    interface RItem {
      normText: string;
      yTop: number;
      yBottom: number;
    }

    const items: RItem[] = [];
    for (const it of (textContent.items ?? [])) {
      if (!it.str?.trim()) continue;
      const t: number[] = it.transform;
      const cy = vt[1] * t[4] + vt[3] * t[5] + vt[5];
      const h = Math.abs(vt[3] * (t[3] || 12));
      items.push({ normText: norm(it.str), yTop: cy - h, yBottom: cy });
    }
    if (!items.length) return null;

    const avgH = items.reduce((s, it) => s + (it.yBottom - it.yTop), 0) / items.length;
    const rowTolerance = avgH * 0.6;

    interface Row {
      normText: string;
      yTop: number;
      yBottom: number;
    }

    const rows: Row[] = [];
    const sorted = [...items].sort((a, b) => a.yTop - b.yTop);
    for (const it of sorted) {
      const existing = rows.find(r => Math.abs(r.yTop - it.yTop) <= rowTolerance);
      if (existing) {
        existing.normText += ` ${it.normText}`;
        existing.yTop = Math.min(existing.yTop, it.yTop);
        existing.yBottom = Math.max(existing.yBottom, it.yBottom);
      } else {
        rows.push({ normText: it.normText, yTop: it.yTop, yBottom: it.yBottom });
      }
    }

    for (const row of rows) {
      const rowNorm = row.normText;
      const compactNorm = compact(rowNorm);
      if (rowNorm.includes(scheduleToken) || compactNorm.includes(scheduleTokenCompact)) {
        return { yTop: row.yTop, yBottom: row.yBottom };
      }
    }

    return null;
  }

  private renderHighlightOnFullPage(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    match: PdfHighlightResult,
    highlightMode?: string
  ): void {
    // Draw highlight overlay directly on full page canvas
    const isItemMode = highlightMode === 'item-slno';
    const boxPadY = isItemMode ? 14 : 6;
    const boxPadX = 8;
    const minHeight = isItemMode ? 32 : 18;
    const whiteStrokeWidth = isItemMode ? 3 : 5;
    const redStrokeWidth = isItemMode ? 1.5 : 2.5;

    const highlightTop = Math.max(match.yTop - boxPadY, 0);
    const highlightBottom = Math.min(match.yBottom + boxPadY, canvas.height);
    const highlightHeight = Math.max(highlightBottom - highlightTop, minHeight);
    const boxLeft = Math.max(boxPadX, 0);
    const boxTop = Math.max(highlightTop, 0);
    const boxWidth = Math.max(canvas.width - boxLeft * 2, 8);
    const boxHeight = Math.max(Math.min(highlightHeight, canvas.height - boxTop), 8);

    ctx.save();
    // Semi-transparent red background
    ctx.fillStyle = 'rgba(230, 57, 70, 0.12)';
    ctx.fillRect(boxLeft, boxTop, boxWidth, boxHeight);

    // White stroke to mask existing borders
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.lineWidth = whiteStrokeWidth;
    ctx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);

    // Red stroke for clear highlight border
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = redStrokeWidth;
    ctx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
    ctx.restore();

    // Auto-scroll to highlight if in a scroll container
    const scrollContainer = this.pdfScrollContainer?.nativeElement;
    if (scrollContainer && boxTop > 0) {
      const scrollTop = Math.max(0, boxTop - 100);
      scrollContainer.scrollTop = scrollTop;
    }
  }

  private renderFocusedMatch(
    targetCanvas: HTMLCanvasElement,
    targetCtx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    match: PdfHighlightResult,
    highlightMode?: string
  ): void {
    const padY = 50;
    const cropTop = Math.max(Math.floor(match.yTop) - padY, 0);
    const cropBottom = Math.min(Math.ceil(match.yBottom) + padY, sourceCanvas.height);
    const cropHeight = Math.max(cropBottom - cropTop, 40);

    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = cropHeight;
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.drawImage(
      sourceCanvas,
      0,
      cropTop,
      sourceCanvas.width,
      cropHeight,
      0,
      0,
      targetCanvas.width,
      targetCanvas.height
    );

    // Reference 3 (item-slno): more length, thinner borders
    // Reference 2 (schedule): small box with thin borders
    const isItemMode = highlightMode === 'item-slno';
    const boxPadY = isItemMode ? 14 : 6;
    const minHeight = isItemMode ? 32 : 18;
    const whiteStrokeWidth = isItemMode ? 3 : 5;
    const redStrokeWidth = isItemMode ? 1.5 : 2.5;

    const highlightTop = Math.max(match.yTop - cropTop - boxPadY, 0);
    const highlightBottom = Math.min(match.yBottom - cropTop + boxPadY, targetCanvas.height);
    const highlightHeight = Math.max(highlightBottom - highlightTop, minHeight);
    const padX = 8;
    const boxLeft = Math.max(padX, 0);
    const boxTop = Math.max(highlightTop, 0);
    const boxWidth = Math.max(targetCanvas.width - boxLeft * 2, 8);
    const boxHeight = Math.max(Math.min(highlightHeight, targetCanvas.height - boxTop), 8);

    targetCtx.save();
    targetCtx.fillStyle = 'rgba(230, 57, 70, 0.12)';
    targetCtx.fillRect(boxLeft, boxTop, boxWidth, boxHeight);

    // Base white stroke masks existing black table borders under the highlight.
    targetCtx.lineJoin = 'round';
    targetCtx.lineCap = 'round';
    targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
    targetCtx.lineWidth = whiteStrokeWidth;
    targetCtx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);

    // Red stroke on top to keep a clear, strong highlight border.
    targetCtx.strokeStyle = '#e63946';
    targetCtx.lineWidth = redStrokeWidth;
    targetCtx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
    targetCtx.restore();
  }

  private async findBestNearbyMatchPage(startPage: number, radius: number): Promise<{ page: number; score: number } | null> {
    if (!this.pdfDocRef || !this.pendingPdfSearch?.trim()) return null;

    const candidates: number[] = [startPage];
    for (let delta = 1; delta <= radius; delta++) {
      candidates.push(startPage - delta, startPage + delta);
    }

    const validPages = Array.from(new Set(candidates)).filter(page => page >= 1 && page <= this.totalPdfPages);
    let best: { page: number; score: number } | null = null;

    for (const pageNum of validPages) {
      const match = await this.getPdfMatchForPage(pageNum, this.pendingPdfSearch);
      if (!match) continue;

      if (!best || match.score > best.score) {
        best = { page: pageNum, score: match.score };
      }
    }

    return best;
  }

  private async getPdfMatchForPage(pageNum: number, searchText: string): Promise<PdfHighlightResult | null> {
    if (!this.pdfDocRef) return null;

    const page = await this.pdfDocRef.getPage(pageNum);
    try {
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      return this.findDescriptionHighlight(textContent, viewport, searchText);
    } finally {
      page.cleanup();
    }
  }

  private findDescriptionHighlight(
    textContent: any,
    viewport: any,
    searchText: string
  ): PdfHighlightResult | null {
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const normDesc = norm(searchText);
    if (!normDesc) return null;

    // ── 1. Collect all text items with their canvas Y positions ──────────────
    const vt: number[] = viewport.transform;

    interface TItem {
      text: string;
      normText: string;
      canvasY: number;  // top of item
      h: number;        // item height in canvas px
    }

    const items: TItem[] = [];
    for (const it of (textContent.items ?? [])) {
      if (!it.str?.trim()) continue;
      const t: number[] = it.transform;
      const cy = vt[1] * t[4] + vt[3] * t[5] + vt[5];
      const h  = Math.abs(vt[3] * (t[3] || 12));
      items.push({ text: it.str, normText: norm(it.str), canvasY: cy - h, h });
    }
    if (!items.length) return null;

    // ── 2. Group items into logical rows by proximity (same Y ± 2 px) ────────
    const lineH = items.reduce((s, i) => s + i.h, 0) / items.length;
    const rowTolerance = lineH * 0.6;

    interface Row {
      normText: string;
      rawText: string;
      yTop: number;
      yBottom: number;
    }
    const rows: Row[] = [];
    const sorted = [...items].sort((a, b) => a.canvasY - b.canvasY);
    for (const it of sorted) {
      const existing = rows.find(r => Math.abs(r.yTop - it.canvasY) <= rowTolerance);
      if (existing) {
        existing.normText += ' ' + it.normText;
        existing.rawText += ` ${it.text}`;
        existing.yTop    = Math.min(existing.yTop,    it.canvasY);
        existing.yBottom = Math.max(existing.yBottom, it.canvasY + it.h);
      } else {
        rows.push({ normText: it.normText, rawText: it.text, yTop: it.canvasY, yBottom: it.canvasY + it.h });
      }
    }

    // Prefer precise row-level matches and penalize large windows.
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'or', 'of', 'to', 'in', 'on', 'as',
      'at', 'is', 'be', 'by', 'a', 'an', 'from', 'this', 'that', 'similar'
    ]);
    const descWords = normDesc
      .split(' ')
      .filter(Boolean)
      .filter(w => !stopWords.has(w))
      .filter(w => w.length > 2 || /^\d+(\.\d+)?$/.test(w));
    if (!descWords.length) return null;

    // Tokens mixing digits+letters (e.g., 3mtrs, 2x32) are strong anchors to
    // avoid selecting near-similar neighboring rows with different sizes.
    const strictTokens = descWords.filter(w => /\d/.test(w) && /[a-z]/.test(w));

    const scoreWindow = (haystack: string, windowRows: number) => {
      const hayWords = haystack
        .split(' ')
        .filter(Boolean)
        .filter(w => !stopWords.has(w));

      if (!hayWords.length) {
        return { score: 0, found: 0, recall: 0, strictRecall: 1 };
      }

      const haySet = new Set(hayWords);
      let found = 0;
      for (const w of descWords) {
        if (haySet.has(w)) found++;
      }

      let strictFound = 0;
      for (const w of strictTokens) {
        if (haySet.has(w)) {
          strictFound++;
          continue;
        }

        const parts = w.match(/\d+|[a-z]+/g) || [];
        if (parts.length > 1 && parts.every(part => haySet.has(part))) {
          strictFound++;
        }
      }

      const recall = found / descWords.length;
      const precision = found / hayWords.length;
      const strictRecall = strictTokens.length ? (strictFound / strictTokens.length) : 1;
      const f1 = (recall + precision) > 0 ? (2 * recall * precision) / (recall + precision) : 0;
      const lengthPenalty = 1 / (1 + (windowRows - 1) * 0.2);
      const phraseBoost = haystack.includes(normDesc) ? 1.12 : 1;
      const strictWeight = 0.35 + (0.65 * strictRecall);
      const score = (f1 * 0.85 + recall * 0.15) * lengthPenalty * strictWeight * phraseBoost;

      return { score, found, recall, strictRecall };
    };

    let bestScore = 0;
    let bestFound = 0;
    let bestRecall = 0;
    let bestStrictRecall = 0;
    let bestWindow: Row[] = [];

    // Pass 1: try exact single-row focus first.
    for (const row of rows) {
      const metrics = scoreWindow(row.normText, 1);
      if (
        metrics.score > bestScore ||
        (metrics.score === bestScore && metrics.found > bestFound)
      ) {
        bestScore = metrics.score;
        bestFound = metrics.found;
        bestRecall = metrics.recall;
        bestStrictRecall = metrics.strictRecall;
        bestWindow = [row];
      }
    }

    // Pass 2: allow short multi-row windows only when they improve quality.
    for (let start = 0; start < rows.length; start++) {
      let combined = '';
      for (let end = start; end < Math.min(start + 5, rows.length); end++) {
        combined += ' ' + rows[end].normText;
        const windowRows = end - start + 1;
        const metrics = scoreWindow(combined, windowRows);

        const isBetter = metrics.score > bestScore;
        const tieWithFewerRows = metrics.score === bestScore && windowRows < bestWindow.length;
        const tieWithMoreHits = metrics.score === bestScore && metrics.found > bestFound;

        if (isBetter || tieWithFewerRows || tieWithMoreHits) {
          bestScore = metrics.score;
          bestFound = metrics.found;
          bestRecall = metrics.recall;
          bestStrictRecall = metrics.strictRecall;
          bestWindow = rows.slice(start, end + 1);
        }
      }
    }

    // Require a meaningful overlap before drawing any highlight.
    if (bestRecall < 0.45 || bestFound < 4 || !bestWindow.length) return null;
    if (strictTokens.length > 0 && bestStrictRecall < 1) return null;

    const avgRowHeight = rows.reduce((sum, row) => sum + (row.yBottom - row.yTop), 0) / rows.length;
    const yTop    = Math.min(...bestWindow.map(r => r.yTop)) - Math.max(16, avgRowHeight * 1.2);
    const yBottom = Math.max(...bestWindow.map(r => r.yBottom)) + Math.max(16, avgRowHeight * 1.2);
    const snippet = bestWindow
      .map(r => r.rawText)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 360);

    return {
      score: bestScore,
      yTop,
      yBottom,
      snippet
    };
  }

  private findScheduleFieldHighlight(
    textContent: any,
    viewport: any,
    searchText: string
  ): PdfHighlightResult | null {
    const scheduleMatch = (searchText || '').match(/schedule\s*([a-z])/i);
    if (!scheduleMatch) {
      return this.findDescriptionHighlight(textContent, viewport, searchText);
    }

    const schedule = scheduleMatch[1].toUpperCase();
    const headerBand = this.findScheduleHeaderBand(textContent, viewport, schedule);
    if (!headerBand) {
      return this.findDescriptionHighlight(textContent, viewport, searchText);
    }

    const pad = 12;
    return {
      score: 1,
      yTop: Math.max(headerBand.yTop - pad, 0),
      yBottom: headerBand.yBottom + pad,
      snippet: `Schedule ${schedule}`
    };
  }

  private findItemSerialFieldHighlight(
    textContent: any,
    viewport: any,
    slNoText: string
  ): PdfHighlightResult | null {
    const target = (slNoText || '').trim();
    if (!/^\d+$/.test(target)) return null;

    const vt: number[] = viewport.transform;

    interface CellItem {
      text: string;
      normText: string;
      x: number;
      yTop: number;
      yBottom: number;
    }

    interface Row {
      cells: CellItem[];
      yTop: number;
      yBottom: number;
      rawText: string;
    }

    const norm = (s: string) =>
      (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const cells: CellItem[] = [];
    for (const it of (textContent.items ?? [])) {
      if (!it.str?.trim()) continue;
      const t: number[] = it.transform;
      const x = vt[0] * t[4] + vt[2] * t[5] + vt[4];
      const cy = vt[1] * t[4] + vt[3] * t[5] + vt[5];
      const h = Math.abs(vt[3] * (t[3] || 12));
      cells.push({
        text: it.str,
        normText: norm(it.str),
        x,
        yTop: cy - h,
        yBottom: cy
      });
    }

    if (!cells.length) return null;

    const avgH = cells.reduce((s, c) => s + (c.yBottom - c.yTop), 0) / cells.length;
    const rowTolerance = avgH * 0.6;

    const rows: Row[] = [];
    const sorted = [...cells].sort((a, b) => a.yTop - b.yTop);
    for (const cell of sorted) {
      const existing = rows.find(r => Math.abs(r.yTop - cell.yTop) <= rowTolerance);
      if (existing) {
        existing.cells.push(cell);
        existing.yTop = Math.min(existing.yTop, cell.yTop);
        existing.yBottom = Math.max(existing.yBottom, cell.yBottom);
      } else {
        rows.push({ cells: [cell], yTop: cell.yTop, yBottom: cell.yBottom, rawText: '' });
      }
    }

    rows.forEach(row => {
      row.cells.sort((a, b) => a.x - b.x);
      row.rawText = row.cells.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
    });

    const leftLimit = viewport.width * 0.35;
    const hasLeftSerialCell = (row: Row) =>
      row.cells.some(c => c.x <= leftLimit && /^\d+$/.test(c.normText));

    let bestIndex = -1;
    let bestScore = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lowerRaw = row.rawText.toLowerCase();
      if (lowerRaw.includes('schedule ') || lowerRaw.includes('totals')) continue;

      const exactLeft = row.cells.filter(c => c.x <= leftLimit && c.normText === target).length;
      const exactAny = row.cells.filter(c => c.normText === target).length;
      if (!exactAny) continue;

      const score = exactLeft * 10 + exactAny * 2;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return null;

    let yTop = rows[bestIndex].yTop;
    let yBottom = rows[bestIndex].yBottom;
    let snippet = rows[bestIndex].rawText;

    if (bestIndex + 1 < rows.length) {
      const next = rows[bestIndex + 1];
      const closeEnough = (next.yTop - yBottom) <= (avgH * 1.4);
      if (closeEnough && !hasLeftSerialCell(next)) {
        yBottom = next.yBottom;
        snippet = `${snippet} ${next.rawText}`.trim();
      }
    }

    const pad = Math.max(10, avgH * 0.9);
    return {
      score: 1,
      yTop: Math.max(yTop - pad, 0),
      yBottom: yBottom + pad,
      snippet: snippet.slice(0, 360)
    };
  }

  private findChapterFieldHighlight(
    textContent: any,
    viewport: any,
    searchText: string
  ): PdfHighlightResult | null {
    const chapterMatch = (searchText || '').match(/chapter\s*[-:]?\s*(\d+)/i);
    if (!chapterMatch) {
      return this.findDescriptionHighlight(textContent, viewport, searchText);
    }

    const chapterNo = chapterMatch[1];
    const vt: number[] = viewport.transform;

    interface RowItem {
      text: string;
      norm: string;
      yTop: number;
      yBottom: number;
    }

    const norm = (s: string) =>
      (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    const rows: RowItem[] = [];
    for (const it of (textContent.items ?? [])) {
      if (!it.str?.trim()) continue;
      const t: number[] = it.transform;
      const cy = vt[1] * t[4] + vt[3] * t[5] + vt[5];
      const h = Math.abs(vt[3] * (t[3] || 12));
      rows.push({
        text: it.str,
        norm: norm(it.str),
        yTop: cy - h,
        yBottom: cy
      });
    }
    if (!rows.length) return null;

    const avgH = rows.reduce((sum, r) => sum + (r.yBottom - r.yTop), 0) / rows.length;
    const tol = avgH * 0.65;

    interface MergedRow {
      raw: string;
      norm: string;
      yTop: number;
      yBottom: number;
    }
    const merged: MergedRow[] = [];
    const sorted = [...rows].sort((a, b) => a.yTop - b.yTop);
    for (const r of sorted) {
      const hit = merged.find(m => Math.abs(m.yTop - r.yTop) <= tol);
      if (hit) {
        hit.raw += ` ${r.text}`;
        hit.norm += ` ${r.norm}`;
        hit.yTop = Math.min(hit.yTop, r.yTop);
        hit.yBottom = Math.max(hit.yBottom, r.yBottom);
      } else {
        merged.push({ raw: r.text, norm: r.norm, yTop: r.yTop, yBottom: r.yBottom });
      }
    }

    const chapterPattern = new RegExp(`\\bchapter\\s*(?:no\\.?\\s*)?[-:]?\\s*${chapterNo}\\b`, 'i');
    for (const r of merged) {
      const normalizedRow = this.normalizeForMatch(r.raw);
      const hasChapterWord = /\bchapter\b/i.test(r.raw) || /\bchapter\b/.test(normalizedRow);
      const hasChapterNumber = new RegExp(`\\b${chapterNo}\\b`).test(r.raw) || new RegExp(`\\b${chapterNo}\\b`).test(normalizedRow);

      if (chapterPattern.test(r.raw) || chapterPattern.test(r.norm) || (hasChapterWord && hasChapterNumber)) {
        const pad = Math.max(10, avgH);
        return {
          score: 1,
          yTop: Math.max(r.yTop - pad, 0),
          yBottom: r.yBottom + pad,
          snippet: r.raw.replace(/\s+/g, ' ').trim().slice(0, 260)
        };
      }
    }

    return null;
  }

  private findItemNumberFieldHighlight(
    textContent: any,
    viewport: any,
    itemNoText: string
  ): PdfHighlightResult | null {
    const target = (itemNoText || '').trim().toLowerCase();
    const m = target.match(/^(\d+)\s*(?:\(([a-z])\))?$/i);
    if (!m) {
      return this.findItemSerialFieldHighlight(textContent, viewport, itemNoText);
    }

    const baseNo = m[1];
    const subNo = (m[2] || '').toLowerCase();
    const vt: number[] = viewport.transform;

    interface Cell {
      text: string;
      norm: string;
      x: number;
      yTop: number;
      yBottom: number;
    }

    const norm = (s: string) =>
      (s || '').toLowerCase().replace(/[^a-z0-9\s()]/g, ' ').replace(/\s+/g, ' ').trim();

    const cells: Cell[] = [];
    for (const it of (textContent.items ?? [])) {
      if (!it.str?.trim()) continue;
      const t: number[] = it.transform;
      const x = vt[0] * t[4] + vt[2] * t[5] + vt[4];
      const cy = vt[1] * t[4] + vt[3] * t[5] + vt[5];
      const h = Math.abs(vt[3] * (t[3] || 12));
      cells.push({ text: it.str, norm: norm(it.str), x, yTop: cy - h, yBottom: cy });
    }
    if (!cells.length) return null;

    const avgH = cells.reduce((s, c) => s + (c.yBottom - c.yTop), 0) / cells.length;
    const rowTolerance = avgH * 0.65;

    interface Row {
      cells: Cell[];
      yTop: number;
      yBottom: number;
      raw: string;
      norm: string;
    }

    const rows: Row[] = [];
    const sorted = [...cells].sort((a, b) => a.yTop - b.yTop);
    for (const c of sorted) {
      const hit = rows.find(r => Math.abs(r.yTop - c.yTop) <= rowTolerance);
      if (hit) {
        hit.cells.push(c);
        hit.yTop = Math.min(hit.yTop, c.yTop);
        hit.yBottom = Math.max(hit.yBottom, c.yBottom);
      } else {
        rows.push({ cells: [c], yTop: c.yTop, yBottom: c.yBottom, raw: '', norm: '' });
      }
    }

    rows.forEach(r => {
      r.cells.sort((a, b) => a.x - b.x);
      r.raw = r.cells.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
      r.norm = norm(r.raw);
    });

    const leftLimit = viewport.width * 0.40;
    const hardLeftLimit = viewport.width * 0.28;
    const descNorm = (this.selectedReferenceItem?.description || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const descTokens = descNorm.split(' ').filter(t => t.length > 3).slice(0, 4);

    const rowHasBase = (row: Row): boolean =>
      row.cells.some(c => c.x <= leftLimit && new RegExp(`\\b${baseNo}\\b`).test(c.norm));

    const rowHasSub = (row: Row): boolean => {
      if (!subNo) return false;
      const subPattern = new RegExp(`\\(${subNo}\\)|\\b${subNo}\\b`, 'i');
      return row.cells.some(c => c.x <= hardLeftLimit && subPattern.test(c.text)) ||
        subPattern.test(row.raw) ||
        subPattern.test(row.norm);
    };

    let bestIndex = -1;
    let bestAnchorIndex = -1;
    let bestScore = -1;

    // Strict path: for items like 702(e), find base row 702 then exact sub-row (e).
    if (subNo) {
      for (let i = 0; i < rows.length; i++) {
        const anchor = rows[i];
        if (!rowHasBase(anchor)) continue;

        for (let j = i; j < Math.min(i + 14, rows.length); j++) {
          if (j > i && rowHasBase(rows[j])) {
            break;
          }

          if (!rowHasSub(rows[j])) {
            continue;
          }

          let tokenHits = 0;
          for (const t of descTokens) {
            if (rows[j].norm.includes(t)) tokenHits++;
          }

          const score = 20 + tokenHits;
          if (score > bestScore) {
            bestScore = score;
            bestIndex = j;
            bestAnchorIndex = i;
          }
        }
      }

      if (bestIndex === -1) {
        // Never downgrade 702(e) to 702 when a specific suffix is requested.
        return null;
      }
    }

    if (!subNo) {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.norm) continue;

        let score = 0;

        const hasBaseLeft = r.cells.some(c => c.x <= leftLimit && new RegExp(`\\b${baseNo}\\b`).test(c.norm));
        const hasBaseAny = new RegExp(`\\b${baseNo}\\b`).test(r.norm);
        if (hasBaseLeft) score += 8;
        else if (hasBaseAny) score += 5;

        if (new RegExp(`item\\s*no[^a-z0-9]{0,10}${baseNo}`, 'i').test(r.raw)) {
          score += 3;
        }

        let tokenHits = 0;
        for (const t of descTokens) {
          if (r.norm.includes(t)) tokenHits++;
        }
        score += Math.min(tokenHits, 3);

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    }

    if (bestIndex === -1 || bestScore < 6) {
      return this.findItemSerialFieldHighlight(textContent, viewport, baseNo);
    }

    let yTop = bestAnchorIndex >= 0 ? rows[bestAnchorIndex].yTop : rows[bestIndex].yTop;
    let yBottom = rows[bestIndex].yBottom;
    let snippet = bestAnchorIndex >= 0 && bestAnchorIndex !== bestIndex
      ? `${rows[bestAnchorIndex].raw} ${rows[bestIndex].raw}`.trim()
      : rows[bestIndex].raw;

    // Extend to wrapped line if next row does not start with another serial/item number.
    if (bestIndex + 1 < rows.length) {
      const next = rows[bestIndex + 1];
      const startsWithSerial = /^\s*\d+\b/.test(next.raw) || /^\s*\([a-z]\)/i.test(next.raw);
      const closeEnough = (next.yTop - yBottom) <= (avgH * 1.5);
      if (closeEnough && !startsWithSerial) {
        yBottom = next.yBottom;
        snippet = `${snippet} ${next.raw}`.trim();
      }
    }

    const pad = Math.max(10, avgH);
    return {
      score: Math.min(1, bestScore / 12),
      yTop: Math.max(yTop - pad, 0),
      yBottom: yBottom + pad,
      snippet: snippet.slice(0, 360)
    };
  }

  goBack(): void {
    this.router.navigate(['/estimations']);
  }

}
