import type { Meeting } from '../types';

export function exportToPDF(meeting: Meeting): void {
  const htmlContent = generateHTMLContent(meeting);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${meeting.title} - Meeting Minutes</title>
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #1a1a1a;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        h2 {
          color: #2a2a2a;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        ul {
          margin: 8px 0;
          padding-left: 24px;
        }
        li {
          margin: 4px 0;
        }
        .header-info {
          background: #f9f9f9;
          padding: 16px;
          border-radius: 4px;
          margin: 16px 0;
        }
        .confidential {
          color: #666;
          font-size: 0.9em;
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #ddd;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <div class="no-print" style="margin-top: 32px; text-align: center;">
        <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; cursor: pointer;">
          Print / Save as PDF
        </button>
      </div>
    </body>
    </html>
  `);
  
  printWindow.document.close();
}

export function exportToDOCX(meeting: Meeting): void {
  // Generate a simple HTML file that Word can open
  const htmlContent = generateHTMLContent(meeting);
  
  const fullHTML = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${meeting.title}</title>
      <style>
        body { font-family: Calibri, sans-serif; }
        h1 { font-size: 18pt; color: #1a1a1a; }
        h2 { font-size: 14pt; color: #2a2a2a; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #999999; padding: 8px; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob([fullHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(meeting.title)}_Minutes.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(meeting: Meeting): Promise<void> {
  const text = generatePlainTextContent(meeting);
  return navigator.clipboard.writeText(text);
}

export function generateEmailLink(meeting: Meeting): string {
  const subject = encodeURIComponent(`Meeting Minutes: ${meeting.title}`);
  const body = encodeURIComponent(generatePlainTextContent(meeting));
  return `mailto:?subject=${subject}&body=${body}`;
}

function generateHTMLContent(meeting: Meeting): string {
  const minutesText = meeting.minutesText || 'No minutes generated yet.';
  
  // Convert markdown-style formatting to HTML
  let html = minutesText
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/<\/ul>\s*<ul>/g, '');

  // Convert tables
  const tableRegex = /\|(.+)\|\n\|[-:\|\s]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (_match, header, rows) => {
    const headers = header.split('|').map((h: string) => h.trim()).filter((h: string) => h);
    const dataRows = rows.trim().split('\n').map((row: string) => 
      row.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell)
    );
    
    let tableHtml = '<table><thead><tr>';
    headers.forEach((h: string) => {
      tableHtml += `<th>${h}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    
    dataRows.forEach((row: string[]) => {
      tableHtml += '<tr>';
      row.forEach((cell: string) => {
        tableHtml += `<td>${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    return tableHtml;
  });

  // Wrap plain text in paragraphs
  html = html.replace(/^(?!<[hlu]|<table|<li|<\/)(.*$)/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

function generatePlainTextContent(meeting: Meeting): string {
  return meeting.minutesText || 'No minutes generated yet.';
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
