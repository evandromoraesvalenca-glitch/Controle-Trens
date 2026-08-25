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

  if (!enabled || !window.supabase) {
    window.SupabaseSync = {
      enabled: false,
      ready: Promise.resolve(false),
      status: "Configuração do Supabase pendente"
    };
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  let hydrating = false;

  async function pushKey(key, value) {
    if (!managedKeys.has(key) || hydrating) return;
    await client.from("app_kv").upsert({
      app: "controle_embarque_trens",
      key,
      value,
      updated_at: new Date().toISOString()
    }, { onConflict: "app,key" });
  }

  async function removeKey(key) {
    if (!managedKeys.has(key) || hydrating) return;
    await client.from("app_kv").delete().eq("app", "controle_embarque_trens").eq("key", key);
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
    originalSetItem(key, value);
    await pushKey(key, value);
    return true;
  }

  async function hydrate() {
    const { data, error } = await client
      .from("app_kv")
      .select("key,value")
      .eq("app", "controle_embarque_trens");
    if (error) throw error;

    hydrating = true;
    let changed = false;
    (data || []).forEach((row) => {
      if (managedKeys.has(row.key) && originalGetItem(row.key) !== row.value) {
        originalSetItem(row.key, row.value);
        changed = true;
      }
    });
    hydrating = false;

    if (changed && !sessionStorage.getItem("supabase_hydrated_once")) {
      sessionStorage.setItem("supabase_hydrated_once", "true");
      location.reload();
    }
    return true;
  }

  async function refreshKeys(keys) {
    const requestedKeys = (keys || []).filter((key) => managedKeys.has(key));
    let query = client
      .from("app_kv")
      .select("key,value")
      .eq("app", "controle_embarque_trens");
    if (requestedKeys.length) query = query.in("key", requestedKeys);

    const { data, error } = await query;
    if (error) throw error;

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

  window.SupabaseSync = {
    enabled: true,
    client,
    refreshKeys,
    saveKey,
    ready: hydrate().catch((error) => {
      console.error("Falha ao carregar dados do Supabase", error);
      return false;
    }),
    status: "Supabase conectado"
  };
})();
