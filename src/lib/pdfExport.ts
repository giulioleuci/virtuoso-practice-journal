import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";

/** Renders a DOM node into a multi-page A4 PDF with a text header and downloads it. */
export async function exportElementToPdf(node: HTMLElement, opts: { fileName: string; title: string; lines: string[] }) {
  const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true, filter: (n) => !(n instanceof HTMLElement && n.dataset.pdfIgnore === "true") });
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 12;
  pdf.setFontSize(16); pdf.text(opts.title, m, m + 4);
  pdf.setFontSize(9);
  let y = m + 11;
  for (const l of opts.lines) { pdf.text(l, m, y); y += 5; }
  y += 2;
  const w = pw - 2 * m;
  const pxPerMm = img.width / w;
  let srcY = 0;
  while (srcY < img.height) {
    const availMm = ph - m - y;
    const sliceH = Math.min(img.height - srcY, availMm * pxPerMm);
    const c = document.createElement("canvas");
    c.width = img.width; c.height = sliceH;
    c.getContext("2d")!.drawImage(img, 0, srcY, img.width, sliceH, 0, 0, img.width, sliceH);
    pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", m, y, w, sliceH / pxPerMm);
    srcY += sliceH;
    if (srcY < img.height) { pdf.addPage(); y = m; }
  }
  pdf.save(opts.fileName);
}
