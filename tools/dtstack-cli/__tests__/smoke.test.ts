import { describe, expect, test } from "bun:test";
import { VERSION } from "../src/index";

describe("dtstack-cli smoke", () => {
  test("version constant is exported", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
