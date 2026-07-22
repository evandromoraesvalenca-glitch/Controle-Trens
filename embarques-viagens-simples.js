(function () {
  const STORAGE_KEY = "embarques_viagens_simples";
  let state = null;

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowTime() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function currentUserName() {
    return window.AccessControl?.currentUser?.()?.name || document.querySelector(".user strong")?.textContent?.trim() || "Supervisor";
  }

  function canEdit() {
    return window.AccessControl?.canEditTrips ? window.AccessControl.canEditTrips() : true;
  }

  function disabledAttr() {
    return canEdit() ? "" : "disabled";
  }

  function requireEdit() {
    if (canEdit()) return true;
    alert("Seu perfil permite apenas visualizar Embarques e Viagens.");
    return false;
  }

  function defaultRows() {
    return Array.from({ length: 12 }, (_, index) => ({
      horario: index === 0 ? "10:00" : "",
      viagem: "",
      tipo: "Comercial",
      via: "",
      trem: "",
      pdz: "",
      confPdz: "",
      jop: "",
      confJop: "",
      obs: ""
    }));
  }

  function blankState() {
    return {
      data: todayIso(),
      local: "SMA",
      responsavel: currentUserName(),
      atualizado: "",
      rows: defaultRows(),
      observacoes: ""
    };
  }

  function load() {
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || blankState();
    } catch {
      state = blankState();
    }
  }

  function save() {
    if (!requireEdit()) return;
    state.atualizado = `${todayIso()} ${nowTime()}`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    alert("Controle salvo.");
  }

  function clearControl() {
    if (!requireEdit()) return;
    if (!confirm("Limpar este controle e começar novamente?")) return;
    state = blankState();
    render();
  }

  function setHeader(field, value) {
    if (!requireEdit()) return;
    state[field] = value;
    if (field === "data") render();
  }

  function setRow(index, field, value) {
    if (!requireEdit()) return;
    const row = state.rows[index];
    const previous = row[field];
    row[field] = value;
    if (!confirmJourneyLimit(index)) {
      row[field] = previous;
      render();
    }
  }

  function addRow() {
    if (!requireEdit()) return;
    state.rows.push({
      horario: "",
      viagem: "",
      tipo: "Comercial",
      via: "",
      trem: "",
      pdz: "",
      confPdz: "",
      jop: "",
      confJop: "",
      obs: ""
    });
    render();
  }

  function removeRow(index) {
    if (!requireEdit()) return;
    if (!confirm("Tem certeza que deseja excluir esta viagem?")) return;
    state.rows.splice(index, 1);
    render();
  }

  function confirmSide(index, side) {
    if (!requireEdit()) return;
    const field = side === "pdz" ? "confPdz" : "confJop";
    state.rows[index][field] = `${nowTime()} - ${currentUserName()}`;
    render();
  }

  function rowClass(row) {
    if (row.confPdz && row.confJop) return "traffic-row-ok";
    if (!row.horario || !row.via || !row.trem || !row.pdz || !row.jop || row.pdz === row.jop) return "traffic-row-danger";
    return "";
  }

  function renderTypeOptions(value) {
    return ["Inserção", "Comercial", "Manobra", "Recolhe"]
      .map((item) => `<option ${value === item ? "selected" : ""}>${item}</option>`)
      .join("");
  }

  function collaboratorOptions(value) {
    const names = typeof colaboradoresAAE !== "undefined" ? colaboradoresAAE : [];
    const options = value && !names.includes(value) ? [value, ...names] : names;
    return `<option value="">Selecione</option>` + options
      .map((name) => `<option ${value === name ? "selected" : ""}>${name}</option>`)
      .join("");
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  }

  function minutesToTime(value) {
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getJourneyRecord(name) {
    try {
      const records = JSON.parse(localStorage.getItem("journey_preview") || "[]");
      return records.find((record) => {
        return normalizeName(record.name) === normalizeName(name) && record.date === state.data;
      });
    } catch {
      return null;
    }
  }

  function limitForEntry(entry) {
    const start = timeToMinutes(entry);
    if (start === null) return null;
    return start + (9 * 60) + 48;
  }

  function confirmJourneyLimit(index) {
    const row = state.rows[index];
    if (!row.horario) return true;
    const tripTime = timeToMinutes(row.horario);
    if (tripTime === null) return true;
    const names = [
      ["PDZ", row.pdz],
      ["JOP", row.jop]
    ].filter(([, name]) => name);

    for (const [side, name] of names) {
      const journey = getJourneyRecord(name);
      if (!journey || !journey.entry) continue;
      const limit = limitForEntry(journey.entry);
      if (limit === null || tripTime <= limit) continue;
      const excess = tripTime - limit;
      const message = `${name} (${side}) registrou entrada às ${journey.entry} no Registro de Jornada.\n\nPela regra de 44h semanais, o limite de atuação é ${minutesToTime(limit)}.\nA viagem está marcada para ${row.horario}, excedendo ${excess} minuto(s).\n\nDeseja prosseguir mesmo assim?`;
      if (!confirm(message)) return false;
    }
    return true;
  }

  function renderAlerts() {
    const alerts = [];
    state.rows.forEach((row, index) => {
      const label = `Linha ${index + 1}`;
      if (!row.horario && (row.viagem || row.pdz || row.jop)) alerts.push(`${label}: sem horário.`);
      if (!row.via && (row.viagem || row.pdz || row.jop)) alerts.push(`${label}: sem via.`);
      if (!row.trem && (row.viagem || row.pdz || row.jop)) alerts.push(`${label}: sem trem.`);
      if (!row.pdz && (row.viagem || row.jop)) alerts.push(`${label}: sem colaborador em PDZ.`);
      if (!row.jop && (row.viagem || row.pdz)) alerts.push(`${label}: sem colaborador em JOP.`);
      if (row.pdz && row.jop && row.pdz === row.jop) alerts.push(`${label}: mesmo colaborador em PDZ e JOP.`);
    });
    if (!alerts.length) return '<span class="traffic-pill green">Sem alertas</span>';
    return alerts.map((alert) => `<div class="traffic-alert">${alert}</div>`).join("");
  }

  function render() {
    if (!state) load();
    const root = document.getElementById("trafficModule");
    if (!root) return;
    root.innerHTML = `
      <div class="panel">
        <div class="traffic-print-head"><h2>CONTROLE DE VIAGENS - TRAFEGO</h2></div>
        ${canEdit() ? "" : '<div class="traffic-alert no-print">Perfil Operador: visualização liberada, edição bloqueada em Embarques e Viagens.</div>'}
        <div class="formgrid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
          <label><span>Data</span><input type="date" value="${state.data}" onchange="SimpleTripsUI.setHeader('data', this.value)" ${disabledAttr()}></label>
          <label><span>Local</span><select onchange="SimpleTripsUI.setHeader('local', this.value)" ${disabledAttr()}>${["SMA", "PMG", "JOP", "PDZ"].map((item) => `<option ${state.local === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          <label><span>Responsável</span><input value="${state.responsavel || ""}" onchange="SimpleTripsUI.setHeader('responsavel', this.value)" ${disabledAttr()}></label>
        </div>
        <div class="traffic-actions" style="margin-top:14px">
          ${canEdit() ? '<button class="primary" onclick="SimpleTripsUI.save()">Salvar</button><button class="ghost" onclick="SimpleTripsUI.addRow()">Adicionar linha</button>' : ""}
          <button class="ghost" onclick="window.print()">Imprimir / PDF</button>
          ${canEdit() ? '<button class="ghost" onclick="SimpleTripsUI.clearControl()">Limpar</button>' : ""}
          <span class="traffic-pill blue">Último salvamento: ${state.atualizado || "não salvo"}</span>
        </div>
      </div>

      <div class="panel traffic-alerts">${renderAlerts()}</div>

      <div class="panel">
        <h3 style="color:var(--blue);margin-top:0">Viagens</h3>
        <div class="traffic-table-wrap">
          <table class="traffic-table">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Viagem</th>
                <th>Tipo</th>
                <th>Via</th>
                <th>Trem</th>
                <th>Colaborador - PDZ</th>
                <th>Conf. PDZ</th>
                <th>Colaborador - JOP</th>
                <th>Conf. JOP</th>
                <th>Observações</th>
                <th class="no-print">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${state.rows.map((row, index) => `
                <tr class="${rowClass(row)}">
                  <td><input type="time" value="${row.horario || ""}" onchange="SimpleTripsUI.setRow(${index}, 'horario', this.value)" ${disabledAttr()}></td>
                  <td><input value="${row.viagem || ""}" onchange="SimpleTripsUI.setRow(${index}, 'viagem', this.value)" ${disabledAttr()}></td>
                  <td><select onchange="SimpleTripsUI.setRow(${index}, 'tipo', this.value)" ${disabledAttr()}>${renderTypeOptions(row.tipo || "Comercial")}</select></td>
                  <td><input value="${row.via || ""}" onchange="SimpleTripsUI.setRow(${index}, 'via', this.value)" ${disabledAttr()}></td>
                  <td><input value="${row.trem || ""}" onchange="SimpleTripsUI.setRow(${index}, 'trem', this.value)" ${disabledAttr()}></td>
                  <td><select onchange="SimpleTripsUI.setRow(${index}, 'pdz', this.value)" ${disabledAttr()}>${collaboratorOptions(row.pdz || "")}</select></td>
                  <td>${canEdit() ? `<button class="ghost no-print" onclick="SimpleTripsUI.confirmSide(${index}, 'pdz')">OK</button>` : ""}<small>${row.confPdz || ""}</small></td>
                  <td><select onchange="SimpleTripsUI.setRow(${index}, 'jop', this.value)" ${disabledAttr()}>${collaboratorOptions(row.jop || "")}</select></td>
                  <td>${canEdit() ? `<button class="ghost no-print" onclick="SimpleTripsUI.confirmSide(${index}, 'jop')">OK</button>` : ""}<small>${row.confJop || ""}</small></td>
                  <td><textarea onchange="SimpleTripsUI.setRow(${index}, 'obs', this.value)" ${disabledAttr()}>${row.obs || ""}</textarea></td>
                  <td class="no-print">${canEdit() ? `<button class="ghost" onclick="SimpleTripsUI.removeRow(${index})">Excluir</button>` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3 style="color:var(--blue);margin-top:0">Observações gerais</h3>
        <textarea style="min-height:110px" onchange="SimpleTripsUI.setHeader('observacoes', this.value)" ${disabledAttr()}>${state.observacoes || ""}</textarea>
      </div>
    `;
  }

  window.SimpleTripsUI = {
    render,
    save,
    clearControl,
    setHeader,
    setRow,
    addRow,
    removeRow,
    confirmSide
  };

  document.addEventListener("DOMContentLoaded", render);
})();
