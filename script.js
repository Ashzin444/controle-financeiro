// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyDFDfIyUYtQkH_OvcuOjbwesTph2K1zzpM",
  authDomain: "controle-financeiro-casa-c5fac.firebaseapp.com",
  projectId: "controle-financeiro-casa-c5fac", // ✅ correto
  storageBucket: "controle-financeiro-casa-c5fac.appspot.com",
  messagingSenderId: "47902080482",
  appId: "1:47902080482:web:ebcbe048d64aa9bfc2cdbb"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const entradasRef = db.collection("entradas");
const saidasRef = db.collection("saidas");
const vencimentosRef = db.collection("vencimentos");

// ✅ Jogo da velha
const tttRoomsRef = db.collection("tttRooms");

// ✅ Bíblia
const bibliaPlanRef = db.collection("biblia_plan");
const bibliaLeiturasRef = db.collection("biblia_leituras");

// ================= ESTADO (FINANCEIRO) =================
let entradas = [];
let saidas = [];
let vencimentos = [];

let unsubscribeEntradas = null;
let unsubscribeSaidas = null;
let unsubscribeVencimentos = null;

let primeiraCargaEntradas = true;
let primeiraCargaSaidas = true;
let primeiraCargaVencimentos = true;

let vencimentosInterval = null;

// ================= BÍBLIA (LISTENER) =================
let unsubscribeBibliaDia = null;

// ================= NAVEGAÇÃO (HOME / TELAS) =================
function irPara(tela) {
  const mapIds = {
    home: "telaHome",
    financeiro: "telaFinanceiro",
    biblia: "telaBiblia",
    jogos: "telaJogos",
    cinema: "telaCinema"
  };

  Object.keys(mapIds).forEach(k => {
    const el = document.getElementById(mapIds[k]);
    if (el) el.style.display = (k === tela ? "block" : "none");
  });

  const titulo = document.getElementById("tituloTopBar");
  if (titulo) {
    const nomes = {
      home: "Nosso Espaço",
      financeiro: "Nosso Controle Financeiro",
      biblia: "Bíblia (Checklist)",
      jogos: "Jogos",
      cinema: "Cinema"
    };
    titulo.textContent = nomes[tela] || "Nosso Espaço";
  }

  // Quando entrar no financeiro, garante que o mês está aplicado
  if (tela === "financeiro") aplicarMesNoInput();

  // Quando entrar em jogos, tenta “hidratar” UI do jogo (se existir no HTML)
  if (tela === "jogos") tttRender();

  // Quando entrar na Bíblia, carrega o dia
  if (tela === "biblia") carregarBibliaDoDia();
}

// ================= MÊS/ANO (SEPARAÇÃO) =================
function mesRefAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

let mesSelecionado = localStorage.getItem("mesRef") || mesRefAtual();

function aplicarMesNoInput() {
  const el = document.getElementById("mesRef");
  if (!el) return;

  // evita duplicar listener
  if (el.dataset.listenerMes === "1") {
    el.value = mesSelecionado;
    return;
  }

  el.value = mesSelecionado;

  el.addEventListener("change", () => {
    mesSelecionado = el.value || mesRefAtual();
    localStorage.setItem("mesRef", mesSelecionado);

    primeiraCargaEntradas = true;
    primeiraCargaSaidas = true;
    primeiraCargaVencimentos = true;

    limparTelaMes();
    iniciarListeners();
  });

  el.dataset.listenerMes = "1";
}

function limparTelaMes() {
  entradas = [];
  saidas = [];
  vencimentos = [];
  atualizarEntradas();
  atualizarSaidas();
  atualizarVencimentos();
  atualizarSaldo();
}

// ================= UI HELPERS =================
function setStatus(msg) {
  const el = document.getElementById("statusMsg");
  if (!el) return;
  el.textContent = msg || "";
}

function mostrarApp() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("app").style.display = "block";
}

function mostrarLogin() {
  document.getElementById("loginBox").style.display = "block";
  document.getElementById("app").style.display = "none";
}

// ================= LOGIN =================
function login() {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  if (!email || !senha) {
    alert("Preencha email e senha.");
    return;
  }

  setStatus("Entrando...");
  auth.signInWithEmailAndPassword(email, senha)
    .then(() => setStatus(""))
    .catch(err => {
      setStatus("");
      alert("Erro: " + err.message);
    });
}

function logout() {
  // ao sair, desconecta sala do jogo e listener bíblia
  tttSairDaSalaSilencioso();
  pararBibliaListener();
  auth.signOut();
}

// ================= NOTIFICAÇÕES =================
function pedirPermissaoNotificacao() {
  if ("Notification" in window) {
    Notification.requestPermission();
  }
}

function ativarNotificacoes() {
  if (!("Notification" in window)) {
    alert("Seu navegador não suporta notificações.");
    return;
  }

  Notification.requestPermission().then(p => {
    if (p === "granted") {
      localStorage.setItem("notif_ativadas", "1");
      new Notification("✅ Notificações ativadas!", {
        body: "Agora o app pode te avisar quando tiver mudanças."
      });
    } else {
      alert("Permissão não concedida.");
    }
  });
}

function notificacoesAtivadas() {
  return (
    ("Notification" in window) &&
    Notification.permission === "granted" &&
    localStorage.getItem("notif_ativadas") === "1"
  );
}

function jaNotificado(chave) {
  const k = "notificado_" + chave;
  return localStorage.getItem(k) === "1";
}
function marcarNotificado(chave) {
  const k = "notificado_" + chave;
  localStorage.setItem(k, "1");
}

function keyDiaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function limparNotificadosAntigos() {
  const hojeKey = keyDiaAtual();
  const ultima = localStorage.getItem("notificados_ultima_limpeza");
  if (ultima === hojeKey) return;

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("notificado_")) localStorage.removeItem(k);
  }

  localStorage.setItem("notificados_ultima_limpeza", hojeKey);
}

function testarNotificacao() {
  if (!("Notification" in window)) {
    alert("Seu navegador não suporta notificações.");
    return;
  }

  if (Notification.permission === "granted") {
    localStorage.setItem("notif_ativadas", "1");
    new Notification("✅ Teste de notificação", { body: "Se você viu isso, está funcionando!" });
    return;
  }

  if (Notification.permission !== "denied") {
    Notification.requestPermission().then(p => {
      if (p === "granted") {
        localStorage.setItem("notif_ativadas", "1");
        new Notification("✅ Teste de notificação", { body: "Permissão concedida!" });
      } else {
        alert("Permissão negada.");
      }
    });
    return;
  }

  alert("Notificações bloqueadas. Permita nas configurações do navegador.");
}

function notificarUmaVez(chave, titulo, body) {
  if (!notificacoesAtivadas()) return;
  if (jaNotificado(chave)) return;

  new Notification(titulo, { body });
  marcarNotificado(chave);
}

// ================= AUTH =================
auth.onAuthStateChanged(user => {
  if (user) {
    mostrarApp();
    limparNotificadosAntigos();

    // Vai para a HOME quando logar
    irPara("home");

    // Financeiro
    aplicarMesNoInput();
    limparTelaMes();

    primeiraCargaEntradas = true;
    primeiraCargaSaidas = true;
    primeiraCargaVencimentos = true;

    iniciarListeners();

    verificarVencimentos(true);
    if (vencimentosInterval) clearInterval(vencimentosInterval);
    vencimentosInterval = setInterval(() => verificarVencimentos(false), 60000);

    registrarServiceWorker();

    // Jogo da Velha: se tiver uma sala salva, tenta retomar
    tttAutoRetomar();
  } else {
    pararListeners();
    pararBibliaListener();

    if (vencimentosInterval) clearInterval(vencimentosInterval);
    vencimentosInterval = null;

    // desconecta listeners do jogo
    tttSairDaSalaSilencioso();

    mostrarLogin();
  }
});

// ================= SERVICE WORKER REGISTER =================
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js")
    .catch(err => console.log("Erro SW:", err));
}

// ================= LISTENERS FIRESTORE (FINANCEIRO) =================
function iniciarListeners() {
  const user = auth.currentUser;
  if (!user) return;

  pararListeners();

  unsubscribeEntradas = entradasRef
    .where("mesRef", "==", mesSelecionado)
    .orderBy("criadoEm")
    .onSnapshot(snapshot => {
      entradas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      atualizarEntradas();
      atualizarSaldo();
      primeiraCargaEntradas = false;
    });

  unsubscribeSaidas = saidasRef
    .where("mesRef", "==", mesSelecionado)
    .orderBy("criadoEm")
    .onSnapshot(snapshot => {
      saidas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      atualizarSaidas();
      atualizarSaldo();
      primeiraCargaSaidas = false;
    });

  unsubscribeVencimentos = vencimentosRef
    .where("mesRef", "==", mesSelecionado)
    .orderBy("dia")
    .onSnapshot(snapshot => {
      vencimentos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      atualizarVencimentos();
      primeiraCargaVencimentos = false;
      verificarVencimentos(false);
    });
}

function pararListeners() {
  if (unsubscribeEntradas) unsubscribeEntradas();
  if (unsubscribeSaidas) unsubscribeSaidas();
  if (unsubscribeVencimentos) unsubscribeVencimentos();
  unsubscribeEntradas = null;
  unsubscribeSaidas = null;
  unsubscribeVencimentos = null;
}

// ================= ADICIONAR (FINANCEIRO) =================
function adicionarEntrada() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const titulo = prompt("Nome da entrada:");
  const valor = Number.parseFloat(prompt("Valor:"));
  if (!titulo || Number.isNaN(valor)) return alert("Dados inválidos");

  entradasRef.add({
    titulo,
    valor,
    usuario: user.email,
    mesRef: mesSelecionado,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function adicionarSaida() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const titulo = prompt("Nome da saída:");
  const valor = Number.parseFloat(prompt("Valor:"));
  if (!titulo || Number.isNaN(valor)) return alert("Dados inválidos");

  saidasRef.add({
    titulo,
    valor,
    usuario: user.email,
    mesRef: mesSelecionado,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function adicionarVencimento() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const titulo = prompt("Conta:");
  const valor = Number.parseFloat(prompt("Valor:"));
  const dia = Number.parseInt(prompt("Dia do vencimento (1-31):"), 10);

  if (!titulo || Number.isNaN(valor) || Number.isNaN(dia) || dia < 1 || dia > 31) {
    return alert("Dados inválidos");
  }

  vencimentosRef.add({
    titulo,
    valor,
    dia,
    pago: false,
    usuario: user.email,
    mesRef: mesSelecionado
  });
}

// ================= LISTAS (FINANCEIRO) =================
function atualizarEntradas() {
  const lista = document.getElementById("listaEntradas");
  const total = document.getElementById("totalEntradas");
  if (!lista || !total) return;

  lista.innerHTML = "";
  let soma = 0;

  entradas.forEach(e => {
    soma += Number(e.valor) || 0;

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="itemTexto">${e.titulo} – R$ ${Number(e.valor).toFixed(2)}</span>
      <span class="itemAcoes">
        <button onclick="editarEntrada('${e.id}')">✏️</button>
        <button onclick="excluirEntrada('${e.id}')">❌</button>
      </span>
    `;
    lista.appendChild(li);
  });

  total.textContent = soma.toFixed(2);
}

function atualizarSaidas() {
  const lista = document.getElementById("listaSaidas");
  const total = document.getElementById("totalSaidas");
  if (!lista || !total) return;

  lista.innerHTML = "";
  let soma = 0;

  saidas.forEach(s => {
    soma += Number(s.valor) || 0;

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="itemTexto">${s.titulo} – R$ ${Number(s.valor).toFixed(2)}</span>
      <span class="itemAcoes">
        <button onclick="editarSaida('${s.id}')">✏️</button>
        <button onclick="excluirSaida('${s.id}')">❌</button>
      </span>
    `;
    lista.appendChild(li);
  });

  total.textContent = soma.toFixed(2);
}

function atualizarSaldo() {
  const elSaldo = document.getElementById("saldoFinal");
  const elEntradas = document.getElementById("totalEntradas");
  const elSaidas = document.getElementById("totalSaidas");
  if (!elSaldo || !elEntradas || !elSaidas) return;

  const totalEntradas = entradas.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
  const totalSaidas = saidas.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);

  elSaldo.textContent = (totalEntradas - totalSaidas).toFixed(2);
}

// ================= EDITAR / EXCLUIR (FINANCEIRO) =================
function excluirEntrada(id) { entradasRef.doc(id).delete(); }
function excluirSaida(id) { saidasRef.doc(id).delete(); }

function editarEntrada(id) {
  const e = entradas.find(x => x.id === id);
  if (!e) return;

  const titulo = prompt("Editar nome:", e.titulo);
  const valor = Number.parseFloat(prompt("Editar valor:", e.valor));
  if (!titulo || Number.isNaN(valor)) return;

  entradasRef.doc(id).update({ titulo, valor });
}

function editarSaida(id) {
  const s = saidas.find(x => x.id === id);
  if (!s) return;

  const titulo = prompt("Editar nome:", s.titulo);
  const valor = Number.parseFloat(prompt("Editar valor:", s.valor));
  if (!titulo || Number.isNaN(valor)) return;

  saidasRef.doc(id).update({ titulo, valor });
}

// ================= VENCIMENTOS (FINANCEIRO) =================
function atualizarVencimentos() {
  const lista = document.getElementById("listaVencimentos");
  if (!lista) return;

  lista.innerHTML = "";
  const hoje = new Date().getDate();

  vencimentos.forEach(v => {
    let status = "⏳ A vencer";
    let estilo = "";

    if (v.pago) {
      status = "✅ Pago";
      estilo = "text-decoration: line-through; opacity:0.65;";
    } else if (v.dia < hoje) {
      status = "❌ Vencido";
    } else if (v.dia - hoje <= 3) {
      status = "⚠️ Vence em breve";
    }

    const li = document.createElement("li");
    li.setAttribute("style", estilo);
    li.innerHTML = `
      <span class="itemTexto">
        ${v.titulo} – R$ ${Number(v.valor).toFixed(2)} (dia ${v.dia}) ${status}
      </span>
      <span class="itemAcoes">
        <button onclick="marcarPago('${v.id}', ${!!v.pago})">✔️</button>
        <button onclick="excluirVencimento('${v.id}')">❌</button>
      </span>
    `;
    lista.appendChild(li);
  });
}

function marcarPago(id, pagoAtual) {
  vencimentosRef.doc(id).update({ pago: !pagoAtual });
}

function excluirVencimento(id) {
  vencimentosRef.doc(id).delete();
}

function verificarVencimentos(forcar) {
  if (!notificacoesAtivadas()) return;
  if (!Array.isArray(vencimentos) || vencimentos.length === 0) return;

  const hoje = new Date().getDate();
  const diaKey = keyDiaAtual();

  vencimentos.forEach(v => {
    if (v.pago) return;

    const diff = Number(v.dia) - hoje;
    if (diff === 1 || diff === 0) {
      const chave = `venc_alert_${v.id}_${diaKey}_${diff}`;
      if (!forcar && jaNotificado(chave)) return;

      const titulo = diff === 0 ? "📅 Vence HOJE" : "📅 Vence amanhã";
      const body = `${v.titulo} - R$ ${Number(v.valor).toFixed(2)} (dia ${v.dia})`;

      new Notification(titulo, { body });
      marcarNotificado(chave);
    }
  });
}

/* =========================================================
   BÍBLIA (CHECKLIST)
   - 1 referência por dia
   - status separado (Eu / Ela)
========================================================= */

// ✅ Data base do plano (Dia 1)
const BIBLIA_START_DATE = "2026-01-01";

// fallback pequeno (se ainda não criou biblia_plan)
const fallbackPlan = [
  { ref: "Gênesis 1:1", label: "Dia 1" },
  { ref: "Gênesis 1:2", label: "Dia 2" },
  { ref: "Gênesis 1:3", label: "Dia 3" },
  { ref: "Gênesis 1:4", label: "Dia 4" },
  { ref: "Gênesis 1:5", label: "Dia 5" },
  { ref: "Gênesis 1:6", label: "Dia 6" },
  { ref: "Gênesis 1:7", label: "Dia 7" }
];

function pararBibliaListener() {
  if (unsubscribeBibliaDia) unsubscribeBibliaDia();
  unsubscribeBibliaDia = null;
}

function obterPapelBiblia() {
  let papel = localStorage.getItem("biblia_papel"); // "eu" | "ela"
  if (papel === "eu" || papel === "ela") return papel;

  const souEu = confirm("Este aparelho é o SEU?\nOK = Eu\nCancelar = Ela");
  papel = souEu ? "eu" : "ela";
  localStorage.setItem("biblia_papel", papel);
  return papel;
}

function formatarDataYMD(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bibliaDiaIndexHoje() {
  const start = new Date(BIBLIA_START_DATE + "T00:00:00");
  const hoje = new Date();
  const ms = hoje.getTime() - start.getTime();
  const dias = Math.floor(ms / 86400000) + 1;
  return Math.max(1, dias);
}

async function carregarBibliaDoDia() {
  const user = auth.currentUser;
  if (!user) return;

  obterPapelBiblia(); // garante que já está definido

  const ymd = formatarDataYMD(new Date());
  const dayIndex = bibliaDiaIndexHoje();

  // 1) Puxa referência do plano (Firestore) ou fallback
  let refTexto = null;
  let labelTexto = `Dia ${dayIndex}`;

  try {
    const docPlan = await bibliaPlanRef.doc(String(dayIndex)).get();
    if (docPlan.exists) {
      const data = docPlan.data() || {};
      if (data.ref) refTexto = String(data.ref);
      if (data.label) labelTexto = String(data.label);
    }
  } catch (e) {
    // silencioso
  }

  if (!refTexto) {
    const fb = fallbackPlan[(dayIndex - 1) % fallbackPlan.length];
    refTexto = fb.ref;
    labelTexto = fb.label ? fb.label : `Dia ${dayIndex}`;
  }

  // 2) Atualiza UI (se existir)
  const elDia = document.getElementById("bibDiaLabel");
  const elRef = document.getElementById("bibRef");
  if (elDia) elDia.textContent = labelTexto;
  if (elRef) elRef.textContent = refTexto;

  // 3) Listener do status do dia (Eu/Ela)
  pararBibliaListener();

  unsubscribeBibliaDia = bibliaLeiturasRef.doc(ymd).onSnapshot(snap => {
    const data = snap.exists ? (snap.data() || {}) : {};

    const euLido = !!data.euLido;
    const elaLido = !!data.elaLido;

    const euEmail = data.euEmail ? String(data.euEmail) : "";
    const elaEmail = data.elaEmail ? String(data.elaEmail) : "";

    const euTxt = euLido ? "✅ Lido" : "⏳ Pendente";
    const elaTxt = elaLido ? "✅ Lido" : "⏳ Pendente";

    const elEu = document.getElementById("bibStatusEu");
    const elEla = document.getElementById("bibStatusEla");

    if (elEu) elEu.textContent = euEmail ? `${euTxt} (${euEmail})` : euTxt;
    if (elEla) elEla.textContent = elaEmail ? `${elaTxt} (${elaEmail})` : elaTxt;
  });

  // 4) Salva ref/label no doc do dia (merge)
  try {
    await bibliaLeiturasRef.doc(ymd).set(
      { ref: refTexto, label: labelTexto, dayIndex },
      { merge: true }
    );
  } catch (e) {
    // silencioso
  }
}

async function marcarLeituraBiblia(lido) {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const papel = obterPapelBiblia();
  const ymd = formatarDataYMD(new Date());

  const payload = {};
  if (papel === "eu") {
    payload.euLido = !!lido;
    payload.euEmail = user.email || "";
    payload.euEm = firebase.firestore.FieldValue.serverTimestamp();
  } else {
    payload.elaLido = !!lido;
    payload.elaEmail = user.email || "";
    payload.elaEm = firebase.firestore.FieldValue.serverTimestamp();
  }

  try {
    await bibliaLeiturasRef.doc(ymd).set(payload, { merge: true });
  } catch (e) {
    alert("Erro ao salvar leitura: " + (e.message || e));
  }
}

/* =========================================================
   JOGO DA VELHA (Tempo real com Firestore)
========================================================= */

let tttRoomId = localStorage.getItem("ttt_roomId") || "";
let tttPlayer = localStorage.getItem("ttt_player") || ""; // "X" / "O"
let tttUnsub = null;
let tttState = null;

function tttAutoRetomar() {
  if (!tttRoomId) return;
  tttEntrarSala(tttRoomId, true).catch(() => {
    localStorage.removeItem("ttt_roomId");
    localStorage.removeItem("ttt_player");
    tttRoomId = "";
    tttPlayer = "";
  });
}

function tttGetEl(id) {
  return document.getElementById(id);
}

function tttSetText(id, txt) {
  const el = tttGetEl(id);
  if (el) el.textContent = txt;
}

function tttRender() {
  const inp = tttGetEl("tttRoomId");
  if (inp && tttRoomId) inp.value = tttRoomId;

  if (!tttState) {
    tttSetText("tttStatus", "Entre ou crie uma sala para começar 💜");
    tttSetText("tttMe", tttPlayer ? `Você: ${tttPlayer}` : "Você: —");
    tttSetText("tttTurn", "Vez: —");
    tttSetText("tttRoomBadge", tttRoomId ? `Sala: ${tttRoomId}` : "Sala: —");
    for (let i = 0; i < 9; i++) {
      tttSetText(`tttCell${i}`, "");
      const btn = tttGetEl(`tttBtn${i}`);
      if (btn) btn.disabled = true;
    }
    return;
  }

  tttSetText("tttRoomBadge", `Sala: ${tttRoomId || tttState.roomId || "—"}`);
  tttSetText("tttMe", tttPlayer ? `Você: ${tttPlayer}` : "Você: —");

  const status = tttState.status || "waiting";
  const turn = tttState.turn || "X";
  const winner = tttState.winner || "";

  if (status === "waiting") {
    tttSetText("tttStatus", "Aguardando o(a) outro(a) entrar na sala…");
  } else if (status === "playing") {
    tttSetText("tttStatus", winner ? `Fim de jogo! Vencedor: ${winner}` : "Partida em andamento 🔥");
  } else if (status === "finished") {
    tttSetText("tttStatus", winner ? `🎉 Vitória do ${winner}!` : "🤝 Empate!");
  } else {
    tttSetText("tttStatus", "—");
  }

  tttSetText("tttTurn", winner ? "Vez: —" : `Vez: ${turn}`);

  const b = Array.isArray(tttState.board) ? tttState.board : Array(9).fill("");
  for (let i = 0; i < 9; i++) tttSetText(`tttCell${i}`, b[i] || "");

  const podeJogarAgora =
    status === "playing" &&
    !winner &&
    tttPlayer &&
    turn === tttPlayer;

  for (let i = 0; i < 9; i++) {
    const btn = tttGetEl(`tttBtn${i}`);
    if (!btn) continue;
    const ocupado = (b[i] || "") !== "";
    btn.disabled = !podeJogarAgora || ocupado;
  }
}

function tttGerarIdCurto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function tttCriarSala() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const roomId = tttGerarIdCurto();
  const docRef = tttRoomsRef.doc(roomId);

  await docRef.set({
    roomId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    players: {
      X: user.email,
      O: null
    },
    board: Array(9).fill(""),
    turn: "X",
    status: "waiting",
    winner: "",
    moves: 0,
    lastMoveAt: null
  });

  await tttEntrarSala(roomId, false);
}

async function tttEntrarSalaPeloInput() {
  const inp = tttGetEl("tttRoomId");
  const roomId = (inp?.value || "").trim().toUpperCase();
  if (!roomId) return alert("Digite o ID da sala.");
  await tttEntrarSala(roomId, false);
}

async function tttEntrarSala(roomId, silencioso) {
  const user = auth.currentUser;
  if (!user) {
    if (!silencioso) alert("Faça login.");
    return;
  }

  if (tttUnsub) {
    tttUnsub();
    tttUnsub = null;
  }

  const docRef = tttRoomsRef.doc(roomId);
  const snap = await docRef.get();
  if (!snap.exists) {
    if (!silencioso) alert("Sala não existe. Confira o ID.");
    throw new Error("Sala não existe");
  }

  const data = snap.data() || {};
  const players = data.players || {};

  let meuSimbolo = "";
  if (players.X === user.email) meuSimbolo = "X";
  else if (players.O === user.email) meuSimbolo = "O";
  else if (!players.X) meuSimbolo = "X";
  else if (!players.O) meuSimbolo = "O";
  else {
    if (!silencioso) alert("Sala cheia (já tem 2 jogadores).");
    throw new Error("Sala cheia");
  }

  const updates = {};
  if (meuSimbolo === "X" && players.X !== user.email) updates["players.X"] = user.email;
  if (meuSimbolo === "O" && players.O !== user.email) updates["players.O"] = user.email;

  const novoPlayers = {
    X: (updates["players.X"] || players.X || null),
    O: (updates["players.O"] || players.O || null)
  };

  if (novoPlayers.X && novoPlayers.O && data.status === "waiting") {
    updates.status = "playing";
    updates.turn = "X";
  }

  if (Object.keys(updates).length) await docRef.update(updates);

  tttRoomId = roomId;
  tttPlayer = meuSimbolo;
  localStorage.setItem("ttt_roomId", tttRoomId);
  localStorage.setItem("ttt_player", tttPlayer);

  tttUnsub = docRef.onSnapshot(s => {
    if (!s.exists) {
      tttState = null;
      tttRender();
      return;
    }
    tttState = s.data() || null;
    tttRender();
  });

  if (!silencioso) irPara("jogos");
}

function tttSairDaSala() {
  tttSairDaSalaSilencioso();
  alert("Você saiu da sala.");
}

function tttSairDaSalaSilencioso() {
  if (tttUnsub) {
    tttUnsub();
    tttUnsub = null;
  }
  tttState = null;
  tttRoomId = "";
  tttPlayer = "";
  localStorage.removeItem("ttt_roomId");
  localStorage.removeItem("ttt_player");
  tttRender();
}

function tttLinhasVitoria() {
  return [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
}

function tttChecarResultado(board) {
  for (const [a,b,c] of tttLinhasVitoria()) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], finished: true };
    }
  }
  const cheio = board.every(x => x);
  if (cheio) return { winner: "", finished: true };
  return { winner: "", finished: false };
}

async function tttJogar(pos) {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");
  if (!tttRoomId) return alert("Entre em uma sala.");

  const docRef = tttRoomsRef.doc(tttRoomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("Sala não existe");

    const data = snap.data() || {};
    const status = data.status || "waiting";
    const turn = data.turn || "X";
    const players = data.players || {};
    const board = Array.isArray(data.board) ? [...data.board] : Array(9).fill("");
    const winner = data.winner || "";

    if (status !== "playing") throw new Error("Partida não está em andamento");
    if (winner) throw new Error("Partida já terminou");
    if (!tttPlayer) throw new Error("Sem símbolo");

    if (tttPlayer === "X" && players.X !== user.email) throw new Error("Você não é o X desta sala");
    if (tttPlayer === "O" && players.O !== user.email) throw new Error("Você não é o O desta sala");

    if (turn !== tttPlayer) throw new Error("Não é sua vez");

    if (pos < 0 || pos > 8) throw new Error("Posição inválida");
    if (board[pos]) throw new Error("Casa ocupada");

    board[pos] = tttPlayer;

    const res = tttChecarResultado(board);
    const updates = {
      board,
      moves: (Number(data.moves) || 0) + 1,
      lastMoveAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (res.finished) {
      updates.status = "finished";
      updates.winner = res.winner || "";
    } else {
      updates.turn = (tttPlayer === "X" ? "O" : "X");
    }

    tx.update(docRef, updates);
  }).catch(err => {
    alert(err.message || "Não foi possível jogar agora.");
  });
}

async function tttReiniciar() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");
  if (!tttRoomId) return alert("Entre em uma sala.");

  const docRef = tttRoomsRef.doc(tttRoomId);

  const snap = await docRef.get();
  if (!snap.exists) return alert("Sala não existe.");

  const data = snap.data() || {};
  const players = data.players || {};

  const meuEmail = user.email;
  if (players.X !== meuEmail && players.O !== meuEmail) {
    return alert("Você não faz parte desta sala.");
  }

  await docRef.update({
    board: Array(9).fill(""),
    turn: "X",
    status: (players.X && players.O) ? "playing" : "waiting",
    winner: "",
    moves: 0,
    lastMoveAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ================= EXPOR FUNÇÕES PRO HTML (onclick) =================
window.irPara = irPara;
window.login = login;
window.logout = logout;

window.ativarNotificacoes = ativarNotificacoes;
window.testarNotificacao = testarNotificacao;

window.adicionarEntrada = adicionarEntrada;
window.adicionarSaida = adicionarSaida;
window.adicionarVencimento = adicionarVencimento;
window.editarEntrada = editarEntrada;
window.editarSaida = editarSaida;
window.excluirEntrada = excluirEntrada;
window.excluirSaida = excluirSaida;
window.excluirVencimento = excluirVencimento;
window.marcarPago = marcarPago;

// Bíblia
window.marcarLeituraBiblia = marcarLeituraBiblia;

// Jogo da velha
window.tttCriarSala = tttCriarSala;
window.tttEntrarSalaPeloInput = tttEntrarSalaPeloInput;
window.tttSairDaSala = tttSairDaSala;
window.tttReiniciar = tttReiniciar;
window.tttJogar = tttJogar;
