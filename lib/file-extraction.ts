const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt"] as const;

export async function extractResumeFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw new Error("Choose a PDF, DOCX, or TXT resume.");
  }
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Resume files must be 5 MB or smaller.");

  let text = "";
  if (extension === "txt") text = await file.text();
  if (extension === "docx") text = await extractDocx(file);
  if (extension === "pdf") text = await extractPdf(file);

  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (text.length < 20) {
    throw new Error(extension === "pdf" ? "No readable text was found. Image-only or encrypted PDFs are not supported yet." : "No readable resume text was found in that file.");
  }
  return text;
}

async function extractDocx(file: File) {
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function extractPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const fragments: PdfTextFragment[] = content.items.flatMap(item => {
      if (!("str" in item) || !item.str.trim()) return [];
      return [{
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        hasEOL: item.hasEOL,
      }];
    });
    pages.push(reconstructPdfText(fragments));
  }
  return pages.join("\n");
}
import { reconstructPdfText, type PdfTextFragment } from "./pdf-layout";
