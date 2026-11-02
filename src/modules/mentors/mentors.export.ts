import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Service } from '../lookups/lookups.service.js';
import type { Mentor } from './mentors.service.js';

interface Column {
  header: string;
  excelWidth: number;
  pdfWidth: number;
  read: (mentor: Mentor) => string | number;
}

const priceFor = (mentor: Mentor, serviceId: number) =>
  mentor.plans.find((plan) => plan.serviceId === serviceId)?.price ?? '-';

// Single source of truth for both formats. One price column per service row in the database.
const columnsFor = (services: Service[]): Column[] => [
  { header: 'Name', excelWidth: 26, pdfWidth: 150, read: (m) => m.fullName },
  { header: 'Country', excelWidth: 16, pdfWidth: 100, read: (m) => m.country.name },
  { header: 'University', excelWidth: 36, pdfWidth: 200, read: (m) => m.university.name },
  { header: 'Program', excelWidth: 14, pdfWidth: 80, read: (m) => m.program.name },
  { header: 'Rating', excelWidth: 8, pdfWidth: 50, read: (m) => m.rating },
  ...services.map((service) => ({
    header: `${service.name} (USD)`,
    excelWidth: 18,
    pdfWidth: 90,
    read: (m: Mentor) => priceFor(m, service.id),
  })),
];

export const buildExcel = async (mentors: Mentor[], services: Service[]): Promise<Buffer> => {
  const columns = columnsFor(services);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mentors');
  sheet.columns = columns.map(({ header, excelWidth }, index) => ({ header, key: String(index), width: excelWidth }));
  // Plain string cells are stored as text by ExcelJS, so "=SUM(...)" in user data is never evaluated.
  sheet.addRows(mentors.map((mentor) => columns.map(({ read }) => read(mentor))));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

const ROW_HEIGHT = 18;

// Note: built-in PDF fonts cover Latin text only; embed a Unicode font to export non-Latin names.
export const buildPdf = (mentors: Mentor[], services: Service[]): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const columns = columnsFor(services);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Scale column widths so the table always fits the page, whatever the number of services.
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const scale = usable / columns.reduce((sum, column) => sum + column.pdfWidth, 0);

    const drawRow = (cells: (string | number)[], bold = false) => {
      const y = doc.y;
      let x = doc.page.margins.left;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      cells.forEach((text, index) => {
        const width = columns[index].pdfWidth * scale;
        doc.text(String(text), x, y, { width: width - 6, height: 12, ellipsis: true, lineBreak: false });
        x += width;
      });
      doc.y = y + ROW_HEIGHT;
    };

    const header = columns.map((column) => column.header);
    doc.on('pageAdded', () => drawRow(header, true)); // repeat header on every new page

    doc.font('Helvetica-Bold').fontSize(16).text('AbroadMates - Mentor list', { align: 'center' });
    doc.moveDown();
    drawRow(header, true);

    for (const mentor of mentors) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - ROW_HEIGHT) doc.addPage();
      drawRow(columns.map(({ read }) => read(mentor)));
    }
    doc.end();
  });
