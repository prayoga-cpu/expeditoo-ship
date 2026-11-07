/**
 * A CSV a French spreadsheet opens correctly: `;` between cells, CRLF between
 * rows, a BOM so accents survive, and a leading `'` on any cell a spreadsheet
 * would read as a formula (`=`, `+`, `-`, `@`) — the contents come from clients.
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header, ...rows].map((row) => row.map(cell).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
