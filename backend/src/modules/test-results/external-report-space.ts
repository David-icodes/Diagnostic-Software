/** Inspect rendered ink, including scans, vectors and existing letterheads.
 * Unknown geometry/content fails closed: preserve the original page unchanged. */
export async function hasBlankHeaderSpace(original: Buffer, height = 120): Promise<boolean> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(original), isEvalSupported: false, useSystemFonts: true, stopAtErrors: true });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    if (viewport.rotation !== 0 || Math.abs(viewport.width - 595.28) > 2 || Math.abs(viewport.height - 841.89) > 2) return false;
    // Text geometry is an additional fail-closed guard when a server font cannot
    // be painted. Raster inspection below also covers scans, paths and images.
    for (const item of (await page.getTextContent()).items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const fontHeight = Math.max(item.height, Math.hypot(item.transform[2], item.transform[3]));
      if (y + fontHeight >= 0 && y - fontHeight <= height) return false;
    }
    const factory = document.canvasFactory as { create(width: number, height: number): { canvas: never; context: { getImageData(x:number,y:number,width:number,height:number): {data:Uint8ClampedArray} } }; destroy(target: unknown): void };
    const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    try {
      await page.render({ canvas: target.canvas, canvasContext: target.context as never, viewport, background: "rgb(255,255,255)" }).promise;
      const pixels = target.context.getImageData(0, 0, Math.ceil(viewport.width), height).data;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250) return false;
      return true;
    } finally { factory.destroy(target); }
  } catch { return false; }
  finally { await task.destroy(); }
}
