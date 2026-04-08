import { afterEach, describe, expect, mock, test } from "bun:test";
import { BrowserDtStackClient, DtStackClient } from "../src/client";
import { createClient } from "../src/index";

describe("DtStackClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("post sends correct headers and body", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 1, data: "ok" }))),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new DtStackClient({
      baseUrl: "http://172.16.122.52",
      cookie: "SESSION=abc; JSESSIONID=xyz",
    });

    const result = await client.post<string>("/api/test", { key: "value" });

    expect(result.code).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://172.16.122.52/api/test");
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>)["content-type"]).toBe(
      "application/json;charset=UTF-8",
    );
    expect((options.headers as Record<string, string>).cookie).toBe("SESSION=abc; JSESSIONID=xyz");
    expect(JSON.parse(options.body as string)).toEqual({ key: "value" });
  });

  test("throws on non-ok response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    ) as unknown as typeof fetch;

    const client = new DtStackClient({
      baseUrl: "http://localhost",
      cookie: "SESSION=abc",
    });

    expect(client.post("/api/fail")).rejects.toThrow();
  });

  test("postWithProjectId sends X-Project-Id header", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 1, data: null }))),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new DtStackClient({
      baseUrl: "http://localhost",
      cookie: "SESSION=abc",
    });

    await client.postWithProjectId("/api/batch", { sql: "test" }, 42);

    const [, options] = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-Project-Id"]).toBe("42");
  });

  test("BrowserDtStackClient posts through page.evaluate with credentials", async () => {
    const evaluate = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: JSON.stringify({ code: 1, data: "ok" }),
      }),
    );
    const page = { evaluate } as unknown as import("@playwright/test").Page;

    const client = new BrowserDtStackClient(page, {
      baseUrl: "http://localhost",
      cookie: "SESSION=abc",
    });

    const result = await client.post("/api/test", { key: "value" }, { "X-Test": "1" });

    expect(result.data).toBe("ok");
    expect(evaluate).toHaveBeenCalledTimes(1);

    const [, payload] = (evaluate as ReturnType<typeof mock>).mock.calls[0] as [
      unknown,
      { requestUrl: string; requestBody: unknown; requestHeaders: Record<string, string> },
    ];
    expect(payload.requestUrl).toBe("http://localhost/api/test");
    expect(payload.requestBody).toEqual({ key: "value" });
    expect(payload.requestHeaders["X-Test"]).toBe("1");
  });

  test("createClient bootstraps page origin and returns browser-backed client", async () => {
    const goto = mock(() => Promise.resolve(null));
    const evaluate = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: JSON.stringify({ code: 1, data: null }),
      }),
    );
    const cookies = mock(() => Promise.resolve([{ name: "SESSION", value: "abc" }]));
    const page = {
      url: () => "about:blank",
      goto,
      evaluate,
      context: () => ({ cookies }),
    } as unknown as import("@playwright/test").Page;

    const client = await createClient(page, "http://172.16.124.78");
    await client.post("/api/test", {});

    expect(goto).toHaveBeenCalledTimes(1);
    const [bootstrapUrl] = (goto as ReturnType<typeof mock>).mock.calls[0] as [string];
    expect(bootstrapUrl).toBe("http://172.16.124.78/dataAssets/#/dataStandard");
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});
