import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Papa from "papaparse";

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportValue>;

export const downloadCSV = (data: ExportRow[], fileName: string) => {
  if (!data || data.length === 0) return;
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute("download", `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadExcel = (data: ExportRow[], fileName: string) => {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const downloadPDF = (
  data: ExportRow[],
  columns: { header: string; dataKey: string }[],
  fileName: string,
  title: string
) => {
  if (!data || data.length === 0) return;
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  // Generation Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  autoTable(doc, {
    startY: 36,
    columns: columns,
    body: data,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`${fileName}.pdf`);
};

export const downloadPDFWithCharts = (
  data: ExportRow[],
  columns: { header: string; dataKey: string }[],
  fileName: string,
  title: string,
  chartImageDataUrl: string | null
) => {
  if (!data || data.length === 0) return;
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  // Generation Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  let tableStartY = 36;

  // Embed chart image if provided
  if (chartImageDataUrl) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 28; // 14px margin on each side
    const imgHeight = imgWidth * 0.45; // ~16:9-ish aspect ratio
    doc.addImage(chartImageDataUrl, "PNG", 14, 36, imgWidth, imgHeight);
    tableStartY = 36 + imgHeight + 8;
  }

  autoTable(doc, {
    startY: tableStartY,
    columns: columns,
    body: data,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`${fileName}.pdf`);
};

export interface SummarySection {
  label: string;
  rows: Record<string, string | number>[];
}

export const downloadExcelWithSummary = (
  data: ExportRow[],
  fileName: string,
  summaryData: SummarySection[]
) => {
  if (!data || data.length === 0) return;
  const workbook = XLSX.utils.book_new();

  // Main report sheet
  const reportSheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, reportSheet, "Report");

  // Summary sheet with aggregated data
  if (summaryData.length > 0) {
    const summaryRows: (string | number)[][] = [];
    for (const section of summaryData) {
      // Section header
      summaryRows.push([section.label]);
      if (section.rows.length > 0) {
        // Column headers from first row's keys
        const headers = Object.keys(section.rows[0]);
        summaryRows.push(headers);
        // Data rows
        for (const row of section.rows) {
          summaryRows.push(headers.map(h => row[h]));
        }
      }
      summaryRows.push([]); // blank row between sections
    }
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
