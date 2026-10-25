import test from "node:test";
import assert from "node:assert/strict";
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email";

test("disabled email skips both notification paths without provider calls or errors", async (context) => {
  const original = process.env.EMAIL_ENABLED;
  process.env.EMAIL_ENABLED = "false";
  const fetchSpy = context.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected email request"); });
  const errorSpy = context.mock.method(console, "error", () => {});
  try {
    await sendApprovalEmail("author@example.com", "Test story", "story-1");
    await sendRejectionEmail("author@example.com", "Test story", "Test reason");
    assert.equal(fetchSpy.mock.callCount(), 0);
    assert.equal(errorSpy.mock.callCount(), 0);
  } finally {
    if (original === undefined) delete process.env.EMAIL_ENABLED;
    else process.env.EMAIL_ENABLED = original;
  }
});
