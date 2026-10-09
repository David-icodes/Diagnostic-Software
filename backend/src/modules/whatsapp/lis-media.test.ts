import { test } from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test_whatsapp_no_connection";
process.env.JWT_SECRET = "unit-test-only-not-a-deployment-secret";
const media = import("./lis-media.service.js");

test("media upload sends the supplied generated PDF bytes and uses its actual Meta media ID", async (t) => {
  const { uploadLisPdf } = await media;
  const pdf = Buffer.from("%PDF-1.4\nmock generated PDF bytes\n%%EOF");
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.match(url, /\/media$/);
    const form = options.body as FormData;
    assert.equal(form.get("messaging_product"), "whatsapp");
    const file = form.get("file") as File;
    assert.equal(file.name, "selected-bill.pdf");
    assert.equal(file.type, "application/pdf");
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
    return { ok: true, json: async () => ({ id: "actual-media-response" }) };
  });
  assert.equal(await uploadLisPdf(pdf, "selected-bill.pdf"), "actual-media-response");
});
test("invalid PDFs and Meta upload failures cannot become successful attachments", async (t) => {
  const { uploadLisPdf } = await media;
  await assert.rejects(uploadLisPdf(Buffer.from("not PDF"), "file.pdf"), /invalid/);
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, json: async () => ({ error: { message: "Media refused" } }) }));
  await assert.rejects(uploadLisPdf(Buffer.from("%PDF-1.4\n%%EOF"), "file.pdf"), /Media refused/);
});
