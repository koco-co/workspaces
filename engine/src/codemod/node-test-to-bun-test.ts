/**
 * Convert node:test + node:assert/strict to bun:test + expect().
 * Mechanical replacement only — does not optimize assertion strength.
 *
 * Limitations:
 * - assert.equal(a, b, "msg") drops the third (message) argument
 * - assert.ok(x) -> expect(x).toBeTruthy() (intentional, P7 E1-WEAK lint scopes to workspace/)
 */
export function transformNodeTestToBunTest(source: string): string {
  let out = source;

  // 1) Imports
  out = out.replace(
    /^import\s+assert\s+from\s+"node:assert\/strict";?\s*\n/gm,
    "",
  );
  out = out.replace(
    /^import\s*\{\s*([^}]+)\s*\}\s+from\s+"node:test";?/gm,
    (_match, names: string) => {
      const set = new Set(
        names.split(",").map((n) => n.trim()).filter(Boolean),
      );
      set.add("expect");
      return `import { ${[...set].join(", ")} } from "bun:test";`;
    },
  );

  // 2) Asserts (order matters: longer / more specific first)
  out = out.replace(
    /assert\.deepEqual\((.+?),\s*(.+?)(?:,\s*"[^"]*")?\)/gs,
    "expect($1).toEqual($2)",
  );
  out = out.replace(
    /assert\.notEqual\((.+?),\s*(.+?)(?:,\s*"[^"]*")?\)/gs,
    "expect($1).not.toBe($2)",
  );
  out = out.replace(
    /assert\.equal\((.+?),\s*(.+?)(?:,\s*"[^"]*")?\)/gs,
    "expect($1).toBe($2)",
  );

  return out;
}
