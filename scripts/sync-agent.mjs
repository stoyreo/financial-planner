import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = 4455;
const ROOT = path.resolve("./data");

const clients = new Set();

function broadcast(evt) {
  const msg = "data: " + JSON.stringify(evt) + "\n\n";
  for (const r of clients) r.write(msg);
}

async function writeChange(payload) {
  await fs.mkdir(ROOT, { recursive: true });
  const items = Array.isArray(payload.items) ? payload.items : [payload];
  const total = items.length;

  broadcast({ kind: "start", total });

  for (let i = 0; i < total; i++) {
    const it = items[i];
    const file = path.join(ROOT, `${it.type}_${it.id}.json`);
    await fs.writeFile(file, JSON.stringify(it, null, 2));

    const pct = Math.round(((i + 1) / total) * 100);
    broadcast({ kind: "progress", pct, file: path.basename(file) });

    await new Promise(r => setTimeout(r, 60));
  }

  broadcast({ kind: "done", count: total, at: new Date().toISOString() });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") return res.end();

  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.url === "/pull" && req.method === "POST") {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        await writeChange(payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        broadcast({ kind: "error", message: String(e) });
        res.writeHead(500);
        res.end(String(e));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => console.log("Sync agent on", PORT));
