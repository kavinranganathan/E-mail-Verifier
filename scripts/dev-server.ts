import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import handler from "../api/verify.js";

// Local dev server — no Vercel account needed. Wraps the same Web-standard
// api/verify.ts handler and serves the widget + a demo page so you can see it run.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 3000);

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  // API: rebuild a Web Request and hand it to the real handler.
  if (url === "/api/verify") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    const webReq = new Request(`http://localhost:${PORT}${url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === "POST" ? body : undefined,
    });
    const webRes = await handler(webReq);
    res.statusCode = webRes.status;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await webRes.text());
    return;
  }

  // Static: widget + demo page.
  try {
    if (url === "/" || url === "/index.html") {
      res.setHeader("content-type", "text/html");
      res.end(await readFile(join(root, "public", "index.html")));
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
