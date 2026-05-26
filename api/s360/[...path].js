const S360_ENVIRONMENTS = {
  producao: "https://api.s360web.com",
  teste: "https://integration.s360web.com",
};

const HOP_BY_HOP = new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization",
  "te","trailers","transfer-encoding","upgrade",
  "host","origin","referer","content-length",
]);

module.exports = async function handler(req, res) {

  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "false");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const parts = req.query.path || [];

    // ✅ ambiente (teste ou produção)
    const env = S360_ENVIRONMENTS[parts[0]] ? parts[0] : "producao";

    // ✅ remove o primeiro item (env)
    let restParts = S360_ENVIRONMENTS[parts[0]] ? parts.slice(1) : parts;

    // ✅🔥 CORREÇÃO DEFINITIVA: remove "api" duplicado automaticamente
    if (restParts.length > 0 && restParts[0].toLowerCase() === "api") {
      restParts = restParts.slice(1);
    }

    // ✅ monta caminho final
    const rest = restParts.length > 0 ? "/" + restParts.join("/") : "";

    const baseUrl = S360_ENVIRONMENTS[env];

    const query = req.url.includes("?")
      ? "?" + req.url.split("?")[1]
      : "";

    const targetUrl = baseUrl + rest + query;

    // ✅ DEBUG (aparece no log do Vercel)
    console.log("====== S360 DEBUG ======");
    console.log("ENV:", env);
    console.log("PARTS:", parts);
    console.log("REST:", restParts);
    console.log("URL FINAL:", targetUrl);

    // ✅ headers
    const forwardHeaders = {};

    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    }

    if (!forwardHeaders["accept"]) {
      forwardHeaders["accept"] = "application/json, text/plain, */*";
    }

    // remove cookies
    delete forwardHeaders["cookie"];

    // ✅ body
    const body = ["GET", "HEAD", "OPTIONS"].includes(req.method)
      ? undefined
      : await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", chunk => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
          req.on("error", reject);
        });

    // ✅ chamada API S360
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body && body.length > 0 ? body : undefined,
    });

    // ✅ repassa headers
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower.startsWith("access-control-")) return;
      res.setHeader(key, value);
    });

    // ✅ resposta final
    const responseBody = Buffer.from(await upstream.arrayBuffer());

    res.status(upstream.status).send(responseBody);

  } catch (err) {
    console.error("ERRO:", err);

    res.status(502).json({
      erro: "Falha ao conectar na API S360",
      detalhe: err.message,
    });
  }
};
``
