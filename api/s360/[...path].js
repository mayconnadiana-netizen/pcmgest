const S360_ENVIRONMENTS = {
  producao: "https://api.s360web.com",
  teste: "https://integration.s360web.com",
};

const HOP_BY_HOP = new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization",
  "te","trailers","transfer-encoding","upgrade","host","origin","referer","content-length",
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
    const parts = (req.query.path || []);

    // ✅ define ambiente
    const env = S360_ENVIRONMENTS[parts[0]] ? parts[0] : "producao";
    let restParts = S360_ENVIRONMENTS[parts[0]] ? parts.slice(1) : parts;

    // ✅🔥 CORREÇÃO IMPORTANTE: remove "api" duplicado
    if (restParts.length > 0 && restParts[0] === "api") {
      restParts = restParts.slice(1);
    }

    // ✅ monta caminho final
    const rest = restParts.length > 0 ? "/" + restParts.join("/") : "/";
    const baseUrl = S360_ENVIRONMENTS[env];

    const query = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";

    const targetUrl = baseUrl + rest + query;

    console.log("==== DEBUG S360 ====");
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
    const body =
      ["GET","HEAD","OPTIONS"].includes(req.method)
        ? undefined
        : await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", c => chunks.push(c));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          });

    // ✅ chamada para S360
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body && body.length > 0 ? body : undefined,
    });

    // ✅ retorna headers
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower.startsWith("access-control-")) return;
      res.setHeader(key, value);
    });

    // ✅ retorna resposta
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(responseBody);

  } catch (err) {
    console.error("ERRO:", err);

    res.status(502).json({
      erro: "Falha ao conectar à API S360",
      detalhe: err.message,
    });
  }
};
``
