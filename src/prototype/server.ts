/**
 * Static file server for viewing a throwaway prototype locally.
 *
 * The Prototype Module prefers serving /prototype/ on a localhost port over
 * file:// (which breaks module/routing in richer prototypes). This is a tiny,
 * read-only, loopback-only static server — NO backend, NO API routes, NO
 * network egress. It only ever reads files under a single root directory and
 * refuses any path that escapes it.
 *
 * It is deliberately framework-free and dependency-injection-friendly so it can
 * be unit-tested with real HTTP requests.
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";

export interface StaticServer {
  /** Base URL, e.g. "http://127.0.0.1:54321". */
  readonly url: string;
  /** The bound port. */
  readonly port: number;
  /** Stop the server and release the port (destroys lingering sockets). */
  dispose(): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Resolves a request pathname to an absolute file path under `root`, or null if
 * the request escapes the root (path traversal). The returned path is NOT
 * guaranteed to exist — the caller checks.
 */
export function resolveSafePath(root: string, urlPathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPathname);
  } catch {
    return null; // malformed percent-encoding
  }

  // Drop query/hash if any slipped through, normalise, and strip leading slashes.
  const cleaned = decoded.split("?")[0].split("#")[0];
  const rel = cleaned === "/" || cleaned === "" ? "index.html" : cleaned.replace(/^\/+/, "");

  const rootResolved = path.resolve(root);
  const candidate = path.resolve(rootResolved, rel);

  // Must stay within root (guards against ../ traversal and absolute paths).
  if (candidate !== rootResolved && !candidate.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return candidate;
}

/**
 * Starts a loopback static server rooted at `rootDir` on an ephemeral port.
 * Resolves once the server is listening.
 */
export function startStaticServer(
  rootDir: string,
  host = "127.0.0.1"
): Promise<StaticServer> {
  const root = path.resolve(rootDir);
  const sockets = new Set<import("node:net").Socket>();

  const server = http.createServer((req, res) => {
    // Read-only: only GET/HEAD are served.
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    const safePath = resolveSafePath(root, req.url ?? "/");
    if (safePath === null) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(safePath);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    if (stat.isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const headers = {
      "Content-Type": contentTypeFor(safePath),
      "Content-Length": stat.size,
      // Loopback-only; never cache throwaway scratch.
      "Cache-Control": "no-store",
    };
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(safePath);
    // The file can become unreadable between statSync and the read (deleted,
    // permissions, I/O error). Without this handler the stream's 'error' event
    // is unhandled and crashes the extension host. Headers are already sent, so
    // we can only abort the response.
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });

  // Track sockets so dispose() can force-close keep-alive connections promptly.
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return new Promise<StaticServer>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.removeListener("error", reject);
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      resolve({
        url: `http://${host}:${port}`,
        port,
        dispose: () =>
          new Promise<void>((res) => {
            for (const socket of sockets) socket.destroy();
            sockets.clear();
            server.close(() => res());
          }),
      });
    });
  });
}
