import { Component, Input, OnInit, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  RowComponent,
  TableDirective,
  FormControlDirective,
  InputGroupComponent,
  InputGroupTextDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-reference-viewer',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    TableDirective,
    FormControlDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective
  ],
  templateUrl: './reference-viewer.component.html',
  styleUrls: ['./reference-viewer.component.scss']
})
export class ReferenceViewerComponent implements OnInit, OnChanges {
  @Input() documentType: string = ''; // LOA_ABSS, STTC, etc.
  @Input() searchTerm: string = '';
  
  tables: any[][] = []; // Array of tables, each table is an array of rows
  isLoading = false;
  localSearch = '';
  highlightedRowIndex: { tableIdx: number, rowIdx: number } | null = null;
  scheduleIndices: { [key: string]: { tableIdx: number, rowIdx: number } } = {};

  // LOA Cover Page Metadata
  private loaMetadata: { [key: string]: any } = {
    'LOA_ABSS': {
      division: 'HYDERABAD DIVISION-S AND T',
      address: ['2nd Floor, S and T Department,', 'Hyderabad Bhavan, Secunderabad.', 'Secunderabad - 500017', 'Telangana, India'],
      letterNo: 'HYDERABAD DIVISION-S AND T / Y-SG-36-2023-24-09 / 00850890090468',
      date: '06/11/2023',
      recipient: {
        name: 'M/s ARECA EMBEDDED SYSTEMS PVT LTD-HYDERABAD.',
        address: ['Plot No.5B, Sy. No.184-185', 'Phase-V, IDA Cherlapally', 'Hyderabad.- 500051', 'Telangana, India']
      },
      subject: 'Letter Of Acceptance (LOA)',
      references: [
        'Tender No. Y-SG-36-2023-24-09 closing date 24-08-2023 11:30 for Hyderabad Division- ABSS Stations.',
        'Your bid ID 15627600 dated 24/08/2023 09:51',
        'Negotiation bid IDs [ 15884340 dated 20/10/2023 11:20 ]'
      ],
      totalAmount: '12,73,30,837.28',
      amountInWords: 'Twelve Crore Seventy-Three Lakh Thirty Thousand Eight Hundred And Thirty-Seven Rupees And Twenty-Eight Paise Only',
      earnestMoney: '7,31,700',
      moneyRefId: 'PE825819680347'
    },
    'STTC': {
      division: 'S AND T DEPARTMENT / TRAINING CENTRE',
      address: ['Moula Ali, Hyderabad Bhavan,', 'Secunderabad, Telangana - 500017', 'India'],
      letterNo: 'S&T/T/CR/2024/01052610112449',
      date: '20/01/2024',
      recipient: {
        name: '[Insert STTC Contractor Name]',
        address: ['Address Line 1', 'Address Line 2', 'City, State, ZIP']
      },
      subject: 'Letter Of Acceptance (LOA) for Training Centre Works',
      references: [
        'Tender No. STTC-SIG-01-2024',
        'Bid ID: 16223400 dated 15/01/2024'
      ],
      totalAmount: '3,05,29,885.42',
      amountInWords: 'Three Crore Five Lakh Twenty-Nine Thousand Eight Hundred And Eighty-Five Rupees And Forty-Two Paise Only',
      earnestMoney: '[Insert Amount]',
      moneyRefId: '[Insert Ref ID]'
    },
    'ZONAL_2024': {
      division: 'ENGINEERING / ZONAL CONTRACTS',
      address: ['Railway Development Wing,', 'Secunderabad Bhavan, Telangana - 500017', 'India'],
      letterNo: 'ZONAL/ENGG/2024/01052610118677',
      date: '15/02/2024',
      recipient: {
        name: '[Insert Zonal Contractor Name]',
        address: ['Address Line 1', 'Address Line 2', 'City, State, ZIP']
      },
      subject: 'Letter Of Acceptance (LOA) for Zonal Maintenance',
      references: [
        'Zonal Tender No. HYB-Z-05-2024',
        'Bid ID: 17112340 dated 10/02/2024'
      ],
      totalAmount: '2,04,85,085.79',
      amountInWords: 'Two Crore Four Lakh Eighty-Five Thousand Eighty-Five Rupees And Seventy-Nine Paise Only',
      earnestMoney: '[Insert Amount]',
      moneyRefId: '[Insert Ref ID]'
    }
  };

  get loaData() {
    return this.loaMetadata[this.documentType] || this.loaMetadata['LOA_ABSS'];
  }

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (this.documentType) {
      this.loadDocument();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['documentType'] && !changes['documentType'].firstChange) {
      this.loadDocument();
    }
    if (changes['searchTerm'] && this.tables.length > 0) {
      this.localSearch = this.searchTerm;
      if (this.isLoaDocument()) {
        setTimeout(() => this.scrollToTop(), 100);
      } else {
        this.applySearchAndScroll();
      }
    }
  }

  loadDocument(): void {
    this.isLoading = true;
    this.http.get<any[][]>(`assets/converted/${this.documentType}.json`).subscribe({
      next: (data) => {
        this.tables = this.preprocessTables(data);
        this.isLoading = false;
        if (this.searchTerm) {
          this.localSearch = this.searchTerm;
          if (this.isLoaDocument()) {
            // Show the LOA cover page first; search is pre-filled for manual use
            setTimeout(() => this.scrollToTop(), 100);
          } else {
            setTimeout(() => this.applySearchAndScroll(), 100);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load document data', err);
        this.isLoading = false;
      }
    });
  }

  onSearchChange(): void {
    this.applySearchAndScroll();
  }

  applySearchAndScroll(): void {
    this.highlightedRowIndex = null;
    if (!this.localSearch.trim()) {
      return;
    }

    const query = this.localSearch.toLowerCase().trim();
    let found = false;

    for (let tIdx = 0; tIdx < this.tables.length; tIdx++) {
      for (let rIdx = 0; rIdx < this.tables[tIdx].length; rIdx++) {
        const row = this.tables[tIdx][rIdx];
        const rowText = row.map((cell: any) => cell?.text !== undefined ? cell.text : cell).join(' ').toLowerCase();
        
        if (rowText.includes(query)) {
          this.highlightedRowIndex = { tableIdx: tIdx, rowIdx: rIdx };
          this.scrollToRow(tIdx, rIdx);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  scrollToRow(tableIdx: number, rowIdx: number): void {
    setTimeout(() => {
      const elementId = `row-${tableIdx}-${rowIdx}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-flash');
        setTimeout(() => element.classList.remove('highlight-flash'), 3000);
      }
    }, 150);
  }

  scrollToSchedule(scheduleKey: string): void {
    const loc = this.scheduleIndices[scheduleKey];
    if (loc) {
      this.highlightedRowIndex = loc;
      this.scrollToRow(loc.tableIdx, loc.rowIdx);
    }
  }

  scrollToTop(): void {
    const element = document.getElementById('loa-top');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  isLoaDocument(): boolean {
    if (!this.documentType) return false;
    const type = this.documentType.toUpperCase();
    return type === 'LOA_ABSS' || type.includes('LOA');
  }

  preprocessTables(data: any[][]): any[][] {
    let currentSchedule = '';
    let currentBidRate = '';
    this.scheduleIndices = {};
    const scheduleBidRates: { [key: string]: string } = {};

    const snoRegex = /^(s\s*no|item\s*no|item\s*sno|sr\s*no|sl\s*no|sl\.no|sr\.no|s\.no|sno|srno|slno|no\.)$/i;
    const descriptionRegex = /description|desc|item\s*desc/i;
    const totalsRegex = /total|subtotal|sum|value|net bid/i;
    const amountRegex = /amount|total|value|advt\.value|bid amount/i;
    const bidRateRegex = /bid rate|escl|above|below/i;

    return data.map((table, tIdx) => {
      if (!table || table.length === 0) return table;

      const snoIndices = new Set<number>();
      const bidRateIndices = new Set<number>();
      let rawDescriptionIdx = -1;
      let rawAmountIdx = -1;

      // Find special columns from the first few rows
      for (let r = 0; r < Math.min(5, table.length); r++) {
        const row = table[r];
        for (let i = 0; i < row.length; i++) {
          const cellStr = (row[i] || '').toString().toLowerCase().trim();
          if (!cellStr) continue;
          if (snoRegex.test(cellStr)) snoIndices.add(i);
          if (bidRateRegex.test(cellStr)) bidRateIndices.add(i);
          if (descriptionRegex.test(cellStr) && rawDescriptionIdx === -1) rawDescriptionIdx = i;
          if (amountRegex.test(cellStr)) rawAmountIdx = i;
        }
      }

      // If no S.No header was found, but the first column is mostly small IDs, mark it
      if (snoIndices.size === 0 && table.length > 2) {
        let numericCount = 0;
        const checkRows = Math.min(10, table.length);
        for (let r = 0; r < checkRows; r++) {
          const val = (table[r][0] || '').toString().trim();
          if (val && val.length < 8 && !val.toLowerCase().includes('item')) numericCount++;
        }
        if (numericCount > checkRows / 2) {
          snoIndices.add(0);
        }
      }

      // First Pass: Classify rows and extract schedule data
      const intermediateRows = table.map((row, rIdx) => {
        const rowText = row.join(' ').trim();
        const rowTextLower = rowText.toLowerCase();

        // Update current schedule
        const schedMatch = rowText.match(/Schedule\s+([A-Z])/i);
        if (schedMatch) {
          currentSchedule = `Schedule ${schedMatch[1].toUpperCase()}`;
          if (!this.scheduleIndices[currentSchedule]) {
            this.scheduleIndices[currentSchedule] = { tableIdx: tIdx, rowIdx: rIdx };
          }
          
          // Try to extract Bid Rate from this row with high strictness
          // Check explicitly for '%' or words like 'above/below'
          const brMatch = rowText.match(/(\d+\.?\d*)\s*%\s*(above|below|at par)/i) || 
                          rowText.match(/(above|below|at par)\s*(\d+\.?\d*)\s*%/i);
          
          if (brMatch) {
            scheduleBidRates[currentSchedule] = brMatch[1] || brMatch[2] || '';
          } else {
            // Fallback: Check identified bid rate columns in the summary row
            for (const idx of Array.from(bidRateIndices)) {
              const val = (row[idx] || '').toString().trim();
              if (/\d+/.test(val) && val.length < 8) {
                scheduleBidRates[currentSchedule] = val;
                break;
              }
            }
          }
        }

        let isHeaderRow = false;
        let hasSN = false;
        for (const idx of Array.from(snoIndices)) {
          const val = (row[idx] || '').toString().trim();
          if (val) {
            const valLower = val.toLowerCase();
            if (valLower === 'no' || valLower === 's.no' || valLower === 'sl.no' || valLower === 'item no') {
              isHeaderRow = true;
            } else if (val.length < 12) {
              hasSN = true;
            }
          }
        }

        const isFooterRow = !isHeaderRow && totalsRegex.test(rowTextLower);
        const isScheduleSeparator = /Schedule\s+[A-Z]/i.test(rowText);

        const processedCells: any[] = [];
        let newDescriptionIdx = -1;
        let newAmountIdx = -1;
        let extractedBidRate = '';

        for (let i = 0; i < row.length; i++) {
          // Remove both SN and Original Bid Rate columns to avoid duplication/mixing
          if (snoIndices.has(i)) continue;
          if (bidRateIndices.has(i)) {
            if (hasSN || isFooterRow) extractedBidRate = (row[i] || '').toString();
            continue;
          }

          if (i === rawDescriptionIdx) newDescriptionIdx = processedCells.length;
          if (i === rawAmountIdx) newAmountIdx = processedCells.length;
          
          let text = (row[i] || '').toString();
          if (i === rawDescriptionIdx || (rawDescriptionIdx === -1 && text.trim().length > 50)) {
            text = text.replace(/^(item\s*)?\d+(\.\d+)*[\.\)\-\s]+(?=[a-zA-Z\(])/i, '').trim();
          }
          
          processedCells.push({ text: text });
        }

        return {
          cells: processedCells,
          hasSN,
          isHeaderRow,
          isFooterRow,
          isScheduleSeparator,
          descriptionIdx: newDescriptionIdx,
          amountIdx: newAmountIdx,
          bidRate: extractedBidRate
        };
      });

      // Second Pass: Merge rows and inject Schedule column
      const finalRows: any[][] = [];
      let lastItemRow: any[] | null = null;

      intermediateRows.forEach((rowObj) => {
        const schedule = currentSchedule;

        if (rowObj.isHeaderRow) {
          const row = [...rowObj.cells];
          row.push({ text: 'Schedule', isSchedule: false });
          finalRows.push(row);
          lastItemRow = null; 
          return;
        }

        if (rowObj.hasSN) {
          const row = [...rowObj.cells];
          row.push({ text: schedule, isSchedule: !!schedule, scheduleKey: schedule });
          finalRows.push(row);
          lastItemRow = row;
          return;
        }

        if (lastItemRow && !rowObj.isFooterRow && !rowObj.isScheduleSeparator) {
          rowObj.cells.forEach((cell, i) => {
            if (cell.text && lastItemRow![i] && lastItemRow![i].text !== cell.text) {
              lastItemRow![i].text += ' ' + cell.text;
            }
          });
          return;
        }

        const row = [...rowObj.cells];
        const hasContent = row.some(c => c.text.length > 5);
        if (hasContent && !rowObj.isFooterRow && !rowObj.isScheduleSeparator) {
          row.push({ text: schedule, isSchedule: !!schedule, scheduleKey: schedule });
        } else {
          row.push({ text: '', isSchedule: false });
        }
        finalRows.push(row);
        lastItemRow = null; 
      });

      return finalRows;
    });
  }
}
