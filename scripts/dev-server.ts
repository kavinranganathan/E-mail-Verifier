import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import handler from "../api/verify.js";

// Local dev server — no Vercel account needed. Mimics the Vercel Node runtime:
// parses the JSON body into req.body and adds res.status()/.json() so the same
// handler signature works here and on Vercel.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 3000);

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function decorate(res: ServerResponse): ServerResponse & {
  status: (c: number) => ServerResponse;
  json: (b: unknown) => void;
  send: (b: string) => void;
} {
  const r = res as ServerResponse & { status: (c: number) => ServerResponse; json: (b: unknown) => void; send: (b: string) => void };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => { r.setHeader("content-type", "application/json"); r.end(JSON.stringify(body)); };
  r.send = (body) => r.end(body);
  return r;
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (url === "/api/verify") {
    const reqLike = req as IncomingMessage & { body?: unknown };
    reqLike.body = await readBody(req);
    // The handler uses VercelRequest/VercelResponse; our shimmed Node objects
    // satisfy the parts it actually touches.
    await handler(reqLike as never, decorate(res) as never);
    return;
  }

  try {
    if (url === "/" || url === "/index.html") {
      res.setHeader("content-type", "text/html");
      res.end(await readFile(join(root, "index.html")));
      return;
    }
    if (url === "/widget/email-verify-widget.js") {
      res.setHeader("content-type", "text/javascript");
      res.end(await readFile(join(root, "widget", "email-verify-widget.js")));
      return;
    }
  } catch {
    /* fall through to 404 */
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`email-verifier dev server: http://localhost:${PORT}`);
});
