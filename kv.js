const SUPABASE_URL = "https://umhtpwkvvifxpdhwmvbf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zrp6c6QdqDt2vySlcWp1Rg_ElWOa43i";
const APP_ID = "controle_embarque_trens";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "content-type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    if (event.httpMethod === "GET") {
      const key = event.queryStringParameters?.key || "";
      const keyFilter = key ? `&key=eq.${encodeURIComponent(key)}` : "";
      const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?select=key,value&app=eq.${APP_ID}${keyFilter}`, {
        headers: { apikey: SUPABASE_KEY }
      });
      const text = await response.text();
      return { statusCode: response.status, headers, body: text };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!body.key || typeof body.value !== "string") {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "key e value sao obrigatorios" }) };
      }
      const payload = {
        app: APP_ID,
        key: body.key,
        value: body.value,
        updated_at: new Date().toISOString()
      };
      const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=app,key`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      return { statusCode: response.status, headers, body: text || "{}" };
    }

    if (event.httpMethod === "DELETE") {
      const key = event.queryStringParameters?.key || "";
      if (!key) return { statusCode: 400, headers, body: JSON.stringify({ error: "key obrigatoria" }) };
      const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?app=eq.${APP_ID}&key=eq.${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY }
      });
      const text = await response.text();
      return { statusCode: response.status, headers, body: text || "{}" };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "metodo nao permitido" }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(error?.message || error) }) };
  }
};
