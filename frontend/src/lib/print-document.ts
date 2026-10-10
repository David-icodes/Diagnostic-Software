/** Wait for real document assets before opening browser print, including off-screen pages. */
export async function printDocument(root: HTMLElement | null): Promise<void> {
  if (!root) throw new Error("Generate the report before printing.");
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll("img"), async (image) => {
    await image.decode();
    if (!image.naturalWidth) throw new Error("The report logo could not be loaded. Please retry printing.");
  }));
  window.print();
}
