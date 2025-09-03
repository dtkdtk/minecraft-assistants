import type Brain from "../brain.js";

export function sendBasicPrompt() {
  process.stdout.write("> ");
}
export function sendWelcomeMessage(brain: Brain) {
  console.log(`Welcome to '${brain.bot.player.displayName}' assistant control panel`);
  console.log(`Type 'help' to get full command list & info`);
  console.log(`Type 'mon' to open live status monitor`);
  console.log(`Type 'quit' or 'exit' to stop the bot and close this window`);
}



export function alignLeft(text: string, width: number, fillSpace: string = " "): string {
  const padding = Math.max(0, (width - text.length));
  return text + fillSpace.repeat(padding);
}

export function alignCenter(text: string, width: number, fillSpace: string = " "): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return fillSpace.repeat(padding) + text + fillSpace.repeat(width - padding - text.length);
}

export function progressBar(filled: number, total: number): string {
  filled = filled > total ? total : filled;
  total = total || 1;

  const progressBar = 
    '[' + 
    '▓'.repeat(filled) + 
    '░'.repeat(total - filled) + 
    '] ' + 
    `${Math.round((filled / total * 100))}%`;
  
  return progressBar;
}

export function framedTable(maxWidth: number, columns: string[], columnPercents: number[] = []): string {
  const columnLines = columns.map((col) => col.split("\n"));

  const wrapText = (text: string, width: number) => {
    if (text.length <= width) return [text];
    const result = [];
    let currentLine = "";
    for (const word of text.split(/\s+/)) {
      if (currentLine.length + word.length < width) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = word;
        while (currentLine.length > width) {
          result.push(currentLine.substring(0, width));
          currentLine = currentLine.substring(width);
        }
      }
    }
    if (currentLine) result.push(currentLine);
    return result;
  };

  const totalPadding = columns.length * 3 + 1;
  const contentWidth = maxWidth - totalPadding;

  const columnWidths =
    columnPercents.length === columns.length
      ? columnPercents.map((p) =>
          Math.max(3, Math.floor((contentWidth * p) / 100))
        )
      : columnLines.map((col) => Math.max(3, ...col.map((line) => line.length)));

  const processedColumns = columnLines.map((col, i) =>
    col.flatMap((line) => wrapText(line, columnWidths[i]))
  );

  const maxLines = Math.max(...processedColumns.map((col) => col.length));
  const finalWidths = columnWidths.slice();

  const horizontalBorder =
    "┌" + finalWidths.map((w) => "─".repeat(w + 2)).join("┬") + "┐";
  const bottomBorder =
    "└" + finalWidths.map((w) => "─".repeat(w + 2)).join("┴") + "┘";

  const rows = [];
  for (let i = 0; i < maxLines; i++) {
    let row = "│";
    for (let j = 0; j < processedColumns.length; j++) {
      const cell = (processedColumns[j][i] || "").padEnd(finalWidths[j], " ");
      row += ` ${cell} │`;
    }
    rows.push(row);
  }

  return [horizontalBorder, ...rows, bottomBorder].join("\n");
}