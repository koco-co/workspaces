import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTenantFromCookie } from "../run-tests-notify.ts";

describe("extractTenantFromCookie", () => {
  it("parses dt_tenant_name from a real DTStack cookie", () => {
    const cookie =
      "dt_user_id=1; dt_tenant_id=10481; dt_tenant_name=pw_test; dt_token=abc";
    assert.equal(extractTenantFromCookie(cookie), "pw_test");
  });

  it("decodes URL-encoded tenant name", () => {
    const cookie = "dt_tenant_name=%E5%B2%9A%E5%9B%BE; foo=bar";
    assert.equal(extractTenantFromCookie(cookie), "岚图");
  });

  it("returns undefined when cookie is missing the key", () => {
    assert.equal(
      extractTenantFromCookie("foo=bar; baz=qux"),
      undefined,
    );
  });

  it("returns undefined for empty/undefined input", () => {
    assert.equal(extractTenantFromCookie(undefined), undefined);
    assert.equal(extractTenantFromCookie(""), undefined);
  });

  it("matches only full key (not suffix of another key)", () => {
    // `foo_dt_tenant_name=xxx` must NOT match
    const cookie = "foo_dt_tenant_name=other; dt_tenant_name=real";
    assert.equal(extractTenantFromCookie(cookie), "real");
  });
});
