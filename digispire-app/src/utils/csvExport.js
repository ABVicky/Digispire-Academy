/**
 * Utility to download data as a UTF-8 encoded, Excel-compatible CSV file.
 * Automatically handles escaping, commas, quotes, and includes BOM.
 *
 * @param {string[]} headers Column headers for the CSV
 * @param {Array<string[]>} rows Double array of cell strings
 * @param {string} filename Name of the exported file
 */
export function downloadCSV(headers, rows, filename) {
  const escapeField = (field) => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [];
  // Add headers
  csvRows.push(headers.map(escapeField).join(','));
  
  // Add rows
  rows.forEach(row => {
    csvRows.push(row.map(escapeField).join(','));
  });

  // \uFEFF is the UTF-8 Byte Order Mark (BOM) which helps Excel open the file with UTF-8 encoding.
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
