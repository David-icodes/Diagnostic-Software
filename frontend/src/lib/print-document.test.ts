import { it } from "node:test";
import assert from "node:assert/strict";
import { printDocument } from "./print-document.ts";

it("printing waits for every report logo and refuses missing documents or broken assets", async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let printed = 0;
  const events: string[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { fonts: { ready: Promise.resolve() } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { print: () => { printed++; events.push("print"); } } });
  try {
    await assert.rejects(printDocument(null), /Generate/);
    const images = [1, 2, 3].map((number) => ({ naturalWidth: 1254, decode: async () => { events.push(`decode-${number}`); } }));
    await printDocument({ querySelectorAll: () => images } as unknown as HTMLElement);
    assert.deepEqual(events, ["decode-1", "decode-2", "decode-3", "print"]);
    assert.equal(printed, 1);
    await assert.rejects(printDocument({ querySelectorAll: () => [{ naturalWidth: 0, decode: async () => {} }] } as unknown as HTMLElement), /logo/);
    await assert.rejects(printDocument({ querySelectorAll: () => [{ decode: async () => { throw new Error("decode failed"); } }] } as unknown as HTMLElement), /decode failed/);
    assert.equal(printed, 1);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
  }
});
