(function () {
  const config = window.SUPABASE_CONFIG || {};
  const enabled = config.url && config.anonKey && !config.url.includes("COLE_A_URL");
  const managedKeys = new Set([
    "admin_trains",
    "admin_colaboradores",
    "admin_checklist_items",
    "admin_checklist_items_version",
    "checklist_trens_preview",
    "checklist_trens_history",
    "journey_preview",
    "embarques_viagens_simples",
    "trens_access_users",
    "trens_access_requests",
    "admin_password"
  ]);

  if (!enabled) {
    window.SupabaseSync = {
      enabled: false,
      ready: Promise.resolve(false),
      status: "Configuracao do Supabase pendente"
    };
    return;
  }

  const client = null;
  const restUrl = `${config.url.replace(/\/$/, "")}/rest/v1/app_kv`;
  const restHeaders = {
    apikey: config.anonKey,
    "Content-Type": "application/json"
  };
  const proxyUrl = "/api/kv";
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  let hydrating = false;

  async function requestWithTimeout(url, options = {}, timeoutMs = 9000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function pushKey(key, value) {
    if (!managedKeys.has(key) || hydrating) return;
    const payload = {
      app: "controle_embarque_trens",
      key,
      value,
      updated_at: new Date().toISOString()
    };
    if (location.protocol === "https:") {
      const proxyResponse = await requestWithTimeout(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value })
      });
      if (proxyResponse.ok) return;
      console.warn(`Netlify KV save failed: ${proxyResponse.status}. Tentando Supabase direto.`);
    }
    if (client) {
      const { error } = await client.from("app_kv").upsert(payload, { onConflict: "app,key" });
      if (error) throw error;
      return;
    }
    const response = await requestWithTimeout(`${restUrl}?on_conflict=app,key`, {
      method: "POST",
      headers: { ...restHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Supabase REST save failed: ${response.status}`);
  }

  async function removeKey(key) {
    if (!managedKeys.has(key) || hydrating) return;
    if (location.protocol === "https:") {
      const proxyResponse = await requestWithTimeout(`${proxyUrl}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (proxyResponse.ok) return;
      console.warn(`Netlify KV delete failed: ${proxyResponse.status}. Tentando Supabase direto.`);
    }
    if (client) {
      const { error } = await client.from("app_kv").delete().eq("app", "controle_embarque_trens").eq("key", key);
      if (error) throw error;
      return;
    }
    const response = await requestWithTimeout(`${restUrl}?app=eq.controle_embarque_trens&key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: restHeaders
    });
    if (!response.ok) throw new Error(`Supabase REST delete failed: ${response.status}`);
  }

  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    pushKey(key, value).catch((error) => console.error("Falha ao salvar no Supabase", error));
  };

  localStorage.removeItem = function (key) {
    originalRemoveItem(key);
    removeKey(key).catch((error) => console.error("Falha ao remover no Supabase", error));
  };

  async function saveKey(key, value) {
    if (!managedKeys.has(key)) return false;
    await pushKey(key, value);
    originalSetItem(key, value);
    return true;
  }

  async function refreshKeys(keys) {
    const requestedKeys = (keys || []).filter((key) => managedKeys.has(key));
    let data;
    if (location.protocol === "https:") {
      const url = requestedKeys.length === 1 ? `${proxyUrl}?key=${encodeURIComponent(requestedKeys[0])}` : proxyUrl;
      const proxyResponse = await requestWithTimeout(url);
      if (proxyResponse.ok) {
        data = await proxyResponse.json();
      } else {
        console.warn(`Netlify KV load failed: ${proxyResponse.status}. Tentando Supabase direto.`);
      }
    }
    if (!data && client) {
      let query = client
        .from("app_kv")
        .select("key,value")
        .eq("app", "controle_embarque_trens");
      if (requestedKeys.length) query = query.in("key", requestedKeys);
      const result = await query;
      if (result.error) throw result.error;
      data = result.data;
    } else if (!data) {
      const keyFilter = requestedKeys.length ? `&key=in.(${requestedKeys.map(encodeURIComponent).join(",")})` : "";
      const response = await requestWithTimeout(`${restUrl}?select=key,value&app=eq.controle_embarque_trens${keyFilter}`, { headers: restHeaders });
      if (!response.ok) throw new Error(`Supabase REST load failed: ${response.status}`);
      data = await response.json();
    }

    hydrating = true;
    let changed = false;
    (data || []).forEach((row) => {
      if (managedKeys.has(row.key) && originalGetItem(row.key) !== row.value) {
        originalSetItem(row.key, row.value);
        changed = true;
      }
    });
    hydrating = false;
    return changed;
  }

  async function hydrate() {
    const changed = await refreshKeys();
    if (changed && !sessionStorage.getItem("supabase_hydrated_once")) {
      sessionStorage.setItem("supabase_hydrated_once", "true");
      location.reload();
    }
    return true;
  }

  window.SupabaseSync = {
    enabled: true,
    client,
    refreshKeys,
    saveKey,
    ready: hydrate().catch((error) => {
      console.error("Falha ao carregar dados do Supabase", error);
      return false;
    }),
    status: client ? "Supabase conectado" : "Supabase conectado via REST"
  };
})();
