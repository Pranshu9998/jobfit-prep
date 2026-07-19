export type PdfTextFragment = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL?: boolean;
};

type PdfLine = { y: number; fragments: PdfTextFragment[] };

/** Reconstruct readable lines from PDF.js fragments using their page coordinates. */
export function reconstructPdfText(input: PdfTextFragment[]) {
  const fragments = input.filter(fragment => fragment.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  if (!fragments.length) return "";

  const medianHeight = median(fragments.map(fragment => Math.max(fragment.height, 1)));
  const yTolerance = Math.max(2, medianHeight * 0.38);
  const lines: PdfLine[] = [];

  for (const fragment of fragments) {
    const line = lines.find(candidate => Math.abs(candidate.y - fragment.y) <= yTolerance);
    if (line) {
      line.fragments.push(fragment);
      line.y = (line.y * (line.fragments.length - 1) + fragment.y) / line.fragments.length;
    } else {
      lines.push({ y: fragment.y, fragments: [fragment] });
    }
  }

  lines.sort((a, b) => b.y - a.y);
  const output: string[] = [];
  let previousY: number | null = null;

  for (const line of lines) {
    if (previousY !== null && previousY - line.y > medianHeight * 1.65 && output.at(-1) !== "") output.push("");
    const segments = createLineSegments(line.fragments.sort((a, b) => a.x - b.x));
    output.push(...segments);
    previousY = line.y;
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function createLineSegments(fragments: PdfTextFragment[]) {
  const segments: string[] = [];
  let text = "";
  let previous: PdfTextFragment | null = null;

  for (const fragment of fragments) {
    const value = fragment.text.trim();
    if (!value) continue;
    if (!previous) {
      text = value;
      previous = fragment;
      continue;
    }

    const gap = fragment.x - (previous.x + previous.width);
    const averageCharacterWidth = Math.max(previous.width / Math.max(previous.text.trim().length, 1), 2.5);

    // Large horizontal gaps usually represent right-aligned metadata or a second column.
    // Preserve them as separate logical lines instead of flattening unrelated fields.
    if (gap > Math.max(88, averageCharacterWidth * 12)) {
      segments.push(text.trim());
      text = value;
    } else {
      const separator = gap > averageCharacterWidth * 2.2 ? "   " : " ";
      text += `${separator}${value}`;
    }
    previous = fragment;
  }

  if (text.trim()) segments.push(text.trim());
  return segments;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
