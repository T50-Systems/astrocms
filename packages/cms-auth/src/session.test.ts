import { describe, expect, it } from "vitest";
import { hashToken, issueSessionToken, safeEqualHex } from "./session.js";
import { permissionsForRoles, hasPermission } from "./rbac.js";

describe("session tokens", () => {
  it("emite token distinto del hash y verificable", () => {
    const { token, tokenHash } = issueSessionToken();
    expect(token).not.toEqual(tokenHash);
    expect(hashToken(token)).toEqual(tokenHash);
    expect(safeEqualHex(hashToken(token), tokenHash)).toBe(true);
  });
});

describe("rbac", () => {
  it("editor no tiene users.manage; admin sí", () => {
    const editor = permissionsForRoles(["editor"]);
    const admin = permissionsForRoles(["admin"]);
    expect(hasPermission(editor, "users.manage")).toBe(false);
    expect(hasPermission(editor, "pages.write")).toBe(true);
    expect(hasPermission(admin, "users.manage")).toBe(true);
  });
});
