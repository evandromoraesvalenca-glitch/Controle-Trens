(function () {
  const USERS_KEY = "trens_access_users";
  const SESSION_KEY = "trens_access_session";
  const REQUESTS_KEY = "trens_access_requests";
  const defaultAdmin = {
    id: "admin-evandro",
    name: "Evandro Valença",
    login: "Evandro Valença",
    password: "admin",
    role: "admin",
    approved: true,
    mustChangePassword: true
  };
  let accessRefreshInProgress = false;

  function normalizeAccessName(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function loadUsers() {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    if (!users.length) {
      localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
      return [defaultAdmin];
    }
    const existingAdmin = users.find((user) => user.id === defaultAdmin.id || user.login === "admin" || user.login === defaultAdmin.login);
    if (existingAdmin) {
      existingAdmin.name = defaultAdmin.name;
      existingAdmin.login = defaultAdmin.login;
      existingAdmin.role = "admin";
      existingAdmin.approved = true;
      if (existingAdmin.mustChangePassword !== false) {
        existingAdmin.password = "admin";
        existingAdmin.mustChangePassword = true;
      }
      saveUsers(users);
    } else {
      users.unshift(defaultAdmin);
      saveUsers(users);
    }
    return users;
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function loadRequests() {
    return JSON.parse(localStorage.getItem(REQUESTS_KEY) || "[]");
  }

  function saveRequests(requests) {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  }

  async function refreshAccessData() {
    if (!window.SupabaseSync?.refreshKeys || accessRefreshInProgress) return false;
    accessRefreshInProgress = true;
    try {
      await window.SupabaseSync.ready;
      return await window.SupabaseSync.refreshKeys([USERS_KEY, REQUESTS_KEY]);
    } catch (error) {
      console.error("Falha ao atualizar solicitações de acesso", error);
      return false;
    } finally {
      accessRefreshInProgress = false;
    }
  }

  function refreshAccessAdminPanel() {
    refreshAccessData().then((changed) => {
      if (changed && window.renderAdmin) window.renderAdmin();
    });
  }

  function session() {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  }

  function setSession(user) {
    const safe = { id: user.id, name: user.name, login: user.login, role: user.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  }

  function roleLabel(role) {
    return role === "admin" ? "Administrador" : role === "lideranca" ? "Liderança" : "Operador";
  }

  function canEditTrips() {
    const user = session();
    return user?.role === "admin" || user?.role === "lideranca";
  }

  function canAdmin() {
    return session()?.role === "admin";
  }

  function updateUserBox() {
    const userBox = document.querySelector(".user");
    const user = session();
    if (!userBox || !user) return;
    userBox.innerHTML = `<strong>${user.name}</strong>${roleLabel(user.role)} <button type="button" class="ghost" style="margin-left:8px;min-height:30px" onclick="AccessControl.logout()">Sair</button>`;
  }

  function applyPermissions() {
    const user = session();
    document.body.classList.toggle("access-operator", user?.role === "operador");
    const adminTab = document.getElementById("tabAdmin");
    if (adminTab) adminTab.classList.toggle("hidden", !canAdmin());
    updateUserBox();
    if (window.SimpleTripsUI) window.SimpleTripsUI.render();
  }

  function showLogin(mode = "login", message = "") {
    const box = document.getElementById("accessScreen");
    if (!box) return;
    box.classList.remove("hidden");
    document.querySelector("header").classList.add("hidden");
    document.querySelector("main").classList.add("hidden");
    const isRequest = mode === "request";
    box.innerHTML = `
      <form class="access-card" onsubmit="${isRequest ? "AccessControl.requestAccess(event)" : "AccessControl.login(event)"}">
        <span class="muted" style="text-transform:uppercase;font-weight:900">Controle de acesso</span>
        <h1>Embarque Trens</h1>
        <p class="muted">${isRequest ? "Solicite acesso para a administração aprovar." : "Entre para acessar a plataforma operacional."}</p>
        <div class="switch">
          <button type="button" class="${!isRequest ? "active" : ""}" onclick="AccessControl.showLogin('login')">Entrar</button>
          <button type="button" class="${isRequest ? "active" : ""}" onclick="AccessControl.showLogin('request')">Solicitar acesso</button>
        </div>
        ${message ? `<div class="traffic-alert">${message}</div>` : ""}
        <label><span>Nome</span><input name="name" required></label>
        <label><span>Senha</span><input name="password" type="password" required></label>
        <button class="primary" style="width:100%;margin-top:12px">${isRequest ? "Enviar solicitação" : "Entrar"}</button>
      </form>
    `;
  }

  function showPasswordChange(user, message = "") {
    const box = document.getElementById("accessScreen");
    box.classList.remove("hidden");
    document.querySelector("header").classList.add("hidden");
    document.querySelector("main").classList.add("hidden");
    box.innerHTML = `
      <form class="access-card" onsubmit="AccessControl.changeFirstPassword(event, '${user.id}')">
        <span class="muted" style="text-transform:uppercase;font-weight:900">Primeiro acesso</span>
        <h1>Alterar senha</h1>
        <p class="muted">Por segurança, altere a senha temporária antes de acessar a plataforma.</p>
        ${message ? `<div class="traffic-alert">${message}</div>` : ""}
        <label><span>Nova senha</span><input name="password" type="password" required></label>
        <label><span>Confirmar nova senha</span><input name="confirmPassword" type="password" required></label>
        <button class="primary" style="width:100%;margin-top:12px">Salvar nova senha</button>
      </form>
    `;
  }

  function showApp() {
    document.getElementById("accessScreen")?.classList.add("hidden");
    document.querySelector("header").classList.remove("hidden");
    document.querySelector("main").classList.remove("hidden");
    applyPermissions();
  }

  function login(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const loginValue = String(form.get("name") || "").trim();
    const password = String(form.get("password") || "");
    const user = loadUsers().find((item) => normalizeAccessName(item.login) === normalizeAccessName(loginValue) && item.password === password);
    if (!user) {
      const pending = loadRequests().find((item) => normalizeAccessName(item.login) === normalizeAccessName(loginValue) && item.password === password);
      if (pending) {
        showLogin("login", "Seu cadastro já foi enviado e está aguardando aprovação do administrador.");
        return;
      }
      showLogin("login", "Nome ou senha inválidos.");
      return;
    }
    if (!user.approved) {
      showLogin("login", "Seu acesso ainda está aguardando aprovação.");
      return;
    }
    if (user.mustChangePassword) {
      showPasswordChange(user);
      return;
    }
    setSession(user);
    showApp();
  }

  function changeFirstPassword(event, userId) {
    event.preventDefault();
    const form = new FormData(event.target);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (password.length < 4) {
      showPasswordChange({ id: userId }, "A nova senha deve ter pelo menos 4 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      showPasswordChange({ id: userId }, "As senhas não conferem.");
      return;
    }
    const users = loadUsers();
    const user = users.find((item) => item.id === userId);
    if (!user) {
      showLogin("login", "Usuário não encontrado.");
      return;
    }
    user.password = password;
    user.mustChangePassword = false;
    saveUsers(users);
    setSession(user);
    showApp();
  }

  function requestAccess(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const request = {
      id: `req-${Date.now()}`,
      name: String(form.get("name") || "").trim(),
      login: String(form.get("name") || "").trim(),
      password: String(form.get("password") || ""),
      role: "operador",
      date: new Date().toLocaleString("pt-BR")
    };
    const users = loadUsers();
    const requests = loadRequests();
    if (users.some((user) => user.login === request.login) || requests.some((item) => item.login === request.login)) {
      showLogin("request", "Já existe usuário ou solicitação com este nome.");
      return;
    }
    requests.push(request);
    saveRequests(requests);
    showLogin("login", "Solicitação enviada. Aguarde aprovação da administração.");
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin("login");
  }

  function approveRequest(id, role) {
    const requests = loadRequests();
    const request = requests.find((item) => item.id === id);
    if (!request) return;
    const users = loadUsers();
    users.push({
      id: `user-${Date.now()}`,
      name: request.name,
      login: request.login,
      password: request.password,
      role,
      approved: true
    });
    saveUsers(users);
    saveRequests(requests.filter((item) => item.id !== id));
    if (window.renderAdmin) window.renderAdmin();
  }

  function rejectRequest(id) {
    saveRequests(loadRequests().filter((item) => item.id !== id));
    if (window.renderAdmin) window.renderAdmin();
  }

  function renderAccessAdmin() {
    refreshAccessAdminPanel();
    const requests = loadRequests();
    const users = loadUsers();
    return `
      <div id="accessAdminPanel" class="panel" style="grid-column:1/-1">
        <h3 style="color:var(--blue);margin-top:0">Controle de acesso</h3>
        <p class="muted">Aprovação liberada para o login administrativo Evandro Valença. Aprove novos acessos como Liderança ou Operador. Operador pode preencher checklists e jornada, mas apenas visualiza Embarques e Viagens.</p>
        <h4 style="color:var(--blue)">Solicitações pendentes</h4>
        <p class="muted" style="font-size:12px">Atualizando solicitações do banco de dados automaticamente ao abrir este painel.</p>
        ${requests.length ? requests.map((item) => `
          <div class="check">
            <div class="check-top">
              <div><strong>${item.name}</strong><p class="muted">Solicitado em ${item.date}. O perfil será definido pelo administrador.</p></div>
              <div class="traffic-actions">
                <button class="primary" onclick="AccessControl.approveRequest('${item.id}', 'lideranca')">Aprovar liderança</button>
                <button class="secondary" onclick="AccessControl.approveRequest('${item.id}', 'operador')">Aprovar operador</button>
                <button class="ghost" onclick="AccessControl.rejectRequest('${item.id}')">Recusar</button>
              </div>
            </div>
          </div>
        `).join("") : '<p class="muted">Nenhuma solicitação pendente.</p>'}
        <h4 style="color:var(--blue)">Usuários aprovados</h4>
        <div class="grid">
          ${users.map((user) => `<div class="info"><span>${roleLabel(user.role)}</span><strong>${user.name}</strong><small>Nome de acesso: ${user.login}</small></div>`).join("")}
        </div>
      </div>
    `;
  }

  function init() {
    loadUsers();
    if (session()) showApp();
    else showLogin("login");
  }

  window.AccessControl = {
    init,
    login,
    changeFirstPassword,
    requestAccess,
    showLogin,
    logout,
    approveRequest,
    rejectRequest,
    renderAccessAdmin,
    canEditTrips,
    canAdmin,
    currentUser: session
  };

  document.addEventListener("DOMContentLoaded", init);
})();
