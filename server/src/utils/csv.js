/**
 * Convert an array of objects to a CSV formatted string.
 * Escapes quotes and wraps fields containing commas, quotes, or newlines.
 * @param {Array<object>} data
 * @param {Array<{ key: string, label: string }>} columns
 * @returns {string}
 */
export function formatCsv(data, columns) {
  const headerRow = columns.map((col) => escapeCsvField(col.label)).join(',');

  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const val = item[col.key];
        return escapeCsvField(val);
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

function escapeCsvField(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
