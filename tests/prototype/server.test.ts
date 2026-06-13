import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as http from "node:http";

/** GET a raw, un-normalised request path (fetch would collapse "../"). */
function rawGet(port: number, rawPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: rawPath, method: "GET" },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );
    req.on("error", reject);
    req.end();
  });
}
import {
  startStaticServer,
  resolveSafePath,
  type StaticServer,
} from "../../src/prototype/server.js";

// ---------------------------------------------------------------------------
// resolveSafePath — pure path-traversal guard
// ---------------------------------------------------------------------------

describe("resolveSafePath", () => {
  const root = "/srv/proto";

  it("maps '/' to index.html under root", () => {
    expect(resolveSafePath(root, "/")).toBe(join(root, "index.html"));
  });

  it("maps a nested file under root", () => {
    expect(resolveSafePath(root, "/assets/app.js")).toBe(
      join(root, "assets/app.js")
    );
  });

  it("refuses ../ traversal", () => {
    expect(resolveSafePath(root, "/../../etc/passwd")).toBeNull();
  });

  it("refuses encoded ../ traversal", () => {
    expect(resolveSafePath(root, "/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
  });

  it("refuses malformed percent-encoding", () => {
    expect(resolveSafePath(root, "/%E0%A4%A")).toBeNull();
  });

  it("strips query and hash", () => {
    expect(resolveSafePath(root, "/index.html?x=1#frag")).toBe(
      join(root, "index.html")
    );
  });
});

// ---------------------------------------------------------------------------
// startStaticServer — real HTTP requests against a temp dir
// ---------------------------------------------------------------------------

describe("startStaticServer", () => {
  let dir: string;
  let server: StaticServer;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "fm-proto-"));
    writeFileSync(
      join(dir, "index.html"),
      "<!DOCTYPE html><html><body>hello prototype</body></html>"
    );
    writeFileSync(join(dir, "manifest.json"), '{"ok":true}');
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "app.js"), "console.log('x');");
    server = await startStaticServer(dir);
  });

  afterAll(async () => {
    await server?.dispose();
    rmSync(dir, { recursive: true, force: true });
  });

  it("exposes a loopback url and port", () => {
    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://127.0.0.1:${server.port}`);
  });

  it("serves index.html at / with text/html content-type", async () => {
    const res = await fetch(`${server.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("hello prototype");
  });

  it("serves a json file with application/json content-type", async () => {
    const res = await fetch(`${server.url}/manifest.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("serves a nested js file with text/javascript content-type", async () => {
    const res = await fetch(`${server.url}/sub/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
  });

  it("returns 404 for a missing file", async () => {
    const res = await fetch(`${server.url}/nope.html`);
    expect(res.status).toBe(404);
  });

  it("refuses path traversal with 403", async () => {
    // Raw request path bypasses fetch's URL normalisation.
    const status = await rawGet(server.port, "/%2e%2e/%2e%2e/etc/passwd");
    expect(status).toBe(403);
  });

  it("rejects non-GET methods with 405", async () => {
    const res = await fetch(`${server.url}/`, { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("releases the port on dispose (connection refused afterwards)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "fm-proto-dispose-"));
    writeFileSync(join(tmp, "index.html"), "<html></html>");
    const s = await startStaticServer(tmp);
    const url = s.url;

    const ok = await fetch(`${url}/`);
    expect(ok.status).toBe(200);

    await s.dispose();

    await expect(fetch(`${url}/`)).rejects.toThrow();
    rmSync(tmp, { recursive: true, force: true });
  });
});
