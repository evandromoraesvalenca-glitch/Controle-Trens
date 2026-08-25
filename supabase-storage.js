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

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const restUrl = `${config.url.replace(/\/$/, "")}/rest/v1/app_kv`;
  const client = window.supabase ? window.supabase.createClient(config.url, config.anonKey) : null;
  let hydrating = false;

  function describeError(prefix, error) {
    if (!error) return prefix;
    if (error.message) return `${prefix}: ${error.message}`;
    if (error.code || error.details) return `${prefix}: ${error.code || ""} ${error.details || ""}`.trim();
    return `${prefix}: ${String(error)}`;
  }

  async function requestWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function saveRemote(key, value) {
    if (!managedKeys.has(key) || hydrating) return;

    if (client) {
      const { error } = await client.from("app_kv").upsert({
        app: "controle_embarque_trens",
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: "app,key" });
      if (error) throw new Error(describeError("Supabase save failed", error));
      return;
    }

    const response = await requestWithTimeout(`${restUrl}?on_conflict=app,key`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        app: "controle_embarque_trens",
        key,
        value,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Supabase REST save failed: ${response.status} ${text}`.trim());
    }
  }

  async function loadRemote(keys) {
    const requestedKeys = (keys || []).filter((key) => managedKeys.has(key));

    if (client) {
      let query = client
        .from("app_kv")
        .select("key,value")
        .eq("app", "controle_embarque_trens");
      if (requestedKeys.length) query = query.in("key", requestedKeys);
      const { data, error } = await query;
      if (error) throw new Error(describeError("Supabase load failed", error));
      return data || [];
    }

    const keyFilter = requestedKeys.length ? `&key=in.(${requestedKeys.map(encodeURIComponent).join(",")})` : "";
    const response = await requestWithTimeout(`${restUrl}?select=key,value&app=eq.controle_embarque_trens${keyFilter}`, {
      headers: { apikey: config.anonKey }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Supabase REST load failed: ${response.status} ${text}`.trim());
    }
    return await response.json();
  }

  async function deleteRemote(key) {
    if (!managedKeys.has(key) || hydrating) return;

    if (client) {
      const { error } = await client.from("app_kv").delete().eq("app", "controle_embarque_trens").eq("key", key);
      if (error) throw new Error(describeError("Supabase delete failed", error));
      return;
    }

    const response = await requestWithTimeout(`${restUrl}?app=eq.controle_embarque_trens&key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: { apikey: config.anonKey }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Supabase REST delete failed: ${response.status} ${text}`.trim());
    }
  }

  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    saveRemote(key, value).catch((error) => console.error("Falha ao salvar no Supabase", error));
  };

  localStorage.removeItem = function (key) {
    originalRemoveItem(key);
    deleteRemote(key).catch((error) => console.error("Falha ao remover no Supabase", error));
  };

  async function saveKey(key, value) {
    if (!managedKeys.has(key)) return false;
    await saveRemote(key, value);
    originalSetItem(key, value);
    return true;
  }

  async function refreshKeys(keys) {
    const data = await loadRemote(keys);
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
