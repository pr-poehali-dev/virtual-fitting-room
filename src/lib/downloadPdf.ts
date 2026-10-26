const loadHtml2Canvas = async () => (await import("html2canvas")).default;
const loadJsPDF = async () => (await import("jspdf")).jsPDF;

export async function downloadElementAsPdf(element: HTMLElement, fileName: string) {
  const [html2canvas, JsPDF] = await Promise.all([loadHtml2Canvas(), loadJsPDF()]);
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    ignoreElements: (el) => el.hasAttribute("data-pdf-ignore"),
  });

  const pdf = new JsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const pxPerMm = canvas.width / contentW;
  const pageHeightPx = Math.floor(contentH * pxPerMm);

  let offset = 0;
  let first = true;
  while (offset < canvas.height) {
    const sliceH = Math.min(pageHeightPx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentW, sliceH / pxPerMm, undefined, "FAST");
    first = false;
    offset += sliceH;
  }

  pdf.save(fileName);
}
