import test from "node:test";
import assert from "node:assert/strict";
import { canManageTeam, canModerate, normalizeEmail, ownerEmails, resolveAccess } from "../lib/staffRoles";

const owners = ownerEmails({ ADMIN_EMAILS: " Owner@Example.com , second@example.com ," });

test("owners come from ADMIN_EMAILS, trimmed and lower-cased", () => {
  assert.deepEqual(owners, ["owner@example.com", "second@example.com"]);
  assert.deepEqual(ownerEmails({}), []);
});

test("owners are always admins, whatever is stored for them", () => {
  const access = resolveAccess("OWNER@example.com", owners, "moderator");
  assert.deepEqual(access, { email: "owner@example.com", role: "admin", isOwner: true });
  assert.ok(canManageTeam(access));
});

test("moderators can review stories but not manage the team", () => {
  const access = resolveAccess("Mod@Example.com", owners, "moderator");
  assert.equal(access?.role, "moderator");
  assert.ok(canModerate(access));
  assert.ok(!canManageTeam(access));
});

test("UI-added admins can do both", () => {
  const access = resolveAccess("helper@example.com", owners, "admin");
  assert.ok(canModerate(access) && canManageTeam(access));
  assert.equal(access?.isOwner, false);
});

test("everyone else has no staff access", () => {
  const access = resolveAccess("reader@example.com", owners, null);
  assert.equal(access, null);
  assert.ok(!canModerate(access) && !canManageTeam(access));
});

test("email matching ignores case and surrounding spaces", () => {
  assert.equal(normalizeEmail("  Venu.MN@Gmail.com "), "venu.mn@gmail.com");
});
