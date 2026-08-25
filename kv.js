const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "content-type": "application/json"
};

async function getKvStore() {
  const { getStore } = require("@netlify/blobs");
  return getStore({ name: "controle-embarque-trens", consistency: "strong" });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    const store = await getKvStore();

    if (event.httpMethod === "GET") {
      const key = event.queryStringParameters?.key || "";
      if (key) {
        const value = await store.get(key, { type: "text", consistency: "strong" });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(value === null ? [] : [{ key, value }])
        };
      }

      const { blobs } = await store.list();
      const rows = [];
      for (const blob of blobs) {
        const value = await store.get(blob.key, { type: "text", consistency: "strong" });
        if (value !== null) rows.push({ key: blob.key, value });
      }
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!body.key || typeof body.value !== "string") {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "key e value sao obrigatorios" }) };
      }
      await store.set(body.key, body.value);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === "DELETE") {
      const key = event.queryStringParameters?.key || "";
      if (!key) return { statusCode: 400, headers, body: JSON.stringify({ error: "key obrigatoria" }) };
      await store.delete(key);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "metodo nao permitido" }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(error?.message || error) }) };
  }
};
