/**
 * Vercel Serverless Proxy para API S360
 * Substitui o servidor.py local.
 *
 * Rota:  /api/s360/producao/<caminho>
 *        /api/s360/teste/<caminho>
 *
 * Encaminha para:
 *   producao -> https://api.s360web.com/<caminho>
 *   teste    -> https://integration.s360web.com/<caminho>
 */

const S360_ENVIRONMENTS = {
  producao: "https://api.s360web.com",
  teste: "https://integration.s360web.com",
};

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "origin",
  "referer",
  "content-length",
]);

export const config = {
  api: {
    bodyParser: false, // lemos o raw body manualmente
    externalResolver: true,
  },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Parse do path: /api/s360/<env>/<resto>
  const parts = (req.query.path || []);
  const env = S360_ENVIRONMENTS[parts[0]] ? parts[0] : "producao";
  const restParts = S360_ENVIRONMENTS[parts[0]] ? parts.slice(1) : parts;
  const rest = restParts.length > 0 ? "/" + restParts.join("/") : "/";

  const baseUrl = S360_ENVIRONMENTS[env];
  const query = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
  const targetUrl = baseUrl + rest + query;

  // Headers encaminhados (sem hop-by-hop)
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  }
  if (!forwardHeaders["accept"]) {
    forwardHeaders["accept"] = "application/json, text/plain, */*";
  }

  const body = ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : await readBody(req);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body && body.length > 0 ? body : undefined,
    });

    // Repassa headers da resposta (sem hop-by-hop e sem CORS duplicado)
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower.startsWith("access-control-")) return;
      res.setHeader(key, value);
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(responseBody);

    console.log(`✓ [${env}] ${req.method} ${rest} -> ${upstream.status}`);
  } catch (err) {
    console.error(`✕ [${env}] ${req.method} ${rest}:`, err);
    res.status(502).json({
      erro: "Falha ao conectar à API S360",
      detalhe: err.message,
      destino: targetUrl,
    });
  }
}
