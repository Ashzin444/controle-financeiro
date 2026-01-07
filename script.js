// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyDFDfIyUYtQkH_OvcuOjbwesTph2K1zzpM",
  authDomain: "controle-financeiro-casa-c5fac.firebaseapp.com",
  projectId: "controle-financeiro-casa-c5fac",
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

// ✅ estado global da bíblia (versículo atual compartilhado)
const bibliaEstadoRef = db.collection("biblia_estado").doc("global");

// ✅ CARTINHAS 💌
const cartinhasRef = db.collection("cartinhas");

// ✅ CINEMA 🎬
const cinemaRef = db.collection("cinema_items");

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

// ================= BÍBLIA (LISTENERS) =================
let unsubscribeBibliaDia = null;
let unsubscribeBibliaEstado = null;

// ✅ controle do versículo atual (global)
let bibliaCurrentIndex = 1;
let bibliaCurrentDocId = "v1";

// ================= CARTINHAS (LISTENERS) =================
let unsubscribeLoveInbox = null;
let unsubscribeLoveSent = null;
let loveInbox = [];
let loveSent = [];

// ================= CINEMA (LISTENER/STATE) =================
let unsubscribeCinema = null;
let cinemaItems = [];
let cinemaTab = "todo"; // todo | watched | fav
let cinemaRandomPickId = null;

// ✅ UI state local (expansões de checklist)
let cinemaSeriesUI = {
  expanded: {},        // { [id]: true/false }
};

// ================= NAVEGAÇÃO =================
function irPara(tela) {
  const mapIds = {
    home: "telaHome",
    financeiro: "telaFinanceiro",
    biblia: "telaBiblia",
    cartinhas: "telaCartinhas",
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
      cartinhas: "Para você 💌",
      jogos: "Jogos",
      cinema: "Cinema"
    };
    titulo.textContent = nomes[tela] || "Nosso Espaço";
  }

  if (tela === "financeiro") aplicarMesNoInput();
  if (tela === "jogos") tttRender();
  if (tela === "biblia") carregarBibliaAtual();
  if (tela === "cartinhas") cartinhasInitTela();
  if (tela === "cinema") cinemaInitTela();
}

// ================= MÊS/ANO =================
function mesRefAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

let mesSelecionado = localStorage.getItem("mesRef") || mesRefAtual();

function aplicarMesNoInput() {
  const el = document.getElementById("mesRef");
  if (!el) return;

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
  tttSairDaSalaSilencioso();
  pararBibliaListener();
  pararBibliaEstadoListener();
  cartinhasPararListeners();
  cinemaPararListener();
  auth.signOut();
}

// ================= NOTIFICAÇÕES =================
function ativarNotificacoes() {
  if (!("Notification" in window)) {
    alert("Seu navegador não suporta notificações.");
    return;
  }

  Notification.requestPermission().then(p => {
    if (p === "granted") {
      localStorage.setItem("notif_ativadas", "1");
      new Notification("✅ Notificações ativadas!", { body: "Agora o app pode te avisar quando tiver mudanças." });
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

// ================= AUTH =================
auth.onAuthStateChanged(user => {
  if (user) {
    mostrarApp();
    limparNotificadosAntigos();

    irPara("home");

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

    tttAutoRetomar();

    bibliaInitEstadoGlobal().catch(() => {});
    bibliaAtivarEstadoListener();

    // cartinhas: prepara defaults (sem abrir tela)
    cartinhasPrepararDefaults();

    // cinema: prepara label (sem abrir tela)
    cinemaPrepararDefaults();
    cinemaOnTypeChange(); // ✅ garante que os campos de série sejam mostrados/ocultados corretamente
  } else {
    pararListeners();
    pararBibliaListener();
    pararBibliaEstadoListener();
    cartinhasPararListeners();
    cinemaPararListener();

    if (vencimentosInterval) clearInterval(vencimentosInterval);
    vencimentosInterval = null;

    tttSairDaSalaSilencioso();
    mostrarLogin();
  }
});

// ================= SERVICE WORKER REGISTER =================
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").catch(err => console.log("Erro SW:", err));
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

function marcarPago(id, pagoAtual) { vencimentosRef.doc(id).update({ pago: !pagoAtual }); }
function excluirVencimento(id) { vencimentosRef.doc(id).delete(); }

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
   BÍBLIA (CONCEITO 1)
   (SEU CÓDIGO DA BÍBLIA CONTINUA IGUAL — MANTIDO)
========================================================= */

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

function pararBibliaEstadoListener() {
  if (unsubscribeBibliaEstado) unsubscribeBibliaEstado();
  unsubscribeBibliaEstado = null;
}

function obterPapelBiblia() {
  let papel = localStorage.getItem("biblia_papel"); // "eu" | "ela"
  if (papel === "eu" || papel === "ela") return papel;

  const souEu = confirm("Este aparelho é o SEU?\nOK = Eu\nCancelar = Ela");
  papel = souEu ? "eu" : "ela";
  localStorage.setItem("biblia_papel", papel);
  return papel;
}

function bibliaExtrairLivroCapitulo(refTexto) {
  if (!refTexto) return "—";
  const m = String(refTexto).match(/^(.+?)\s+(\d+)(?::\d+)?$/);
  if (m) return `${m[1].trim()} ${m[2].trim()}`;
  return String(refTexto);
}

function bibliaAnimarVirada() {
  const paper = document.getElementById("biblePaper");
  if (!paper) return;
  paper.classList.remove("turning");
  void paper.offsetWidth;
  paper.classList.add("turning");
  setTimeout(() => paper.classList.remove("turning"), 420);
}

/* =========================
   ✅ SOM DE VIRAR PÁGINA
========================= */
const BIBLIA_SOM_KEY = "biblia_som"; // "1" ligado | "0" desligado
let _audioCtx = null;

function bibliaSomAtivo() {
  return localStorage.getItem(BIBLIA_SOM_KEY) !== "0";
}

function atualizarBotaoSomBiblia() {
  const btn = document.getElementById("bibSoundBtn");
  if (!btn) return;
  btn.textContent = bibliaSomAtivo() ? "🔊 Som: ON" : "🔇 Som: OFF";
}

function ensureAudioContext() {
  if (_audioCtx && _audioCtx.state !== "closed") return _audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  _audioCtx = new Ctx();
  return _audioCtx;
}

function tocarSomVirarPagina() {
  if (!bibliaSomAtivo()) return;

  const ctx = ensureAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  const duration = 0.14;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = Math.pow(1 - t, 2.2);
    data[i] = (Math.random() * 2 - 1) * env * 0.55;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1800, now);
  bandpass.Q.setValueAtTime(0.9, now);

  const hi = ctx.createBiquadFilter();
  hi.type = "highpass";
  hi.frequency.setValueAtTime(650, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(bandpass);
  bandpass.connect(hi);
  hi.connect(gain);
  gain.connect(ctx.destination);

  src.start(now);
  src.stop(now + duration + 0.02);
}

function toggleSomBiblia() {
  const novo = bibliaSomAtivo() ? "0" : "1";
  localStorage.setItem(BIBLIA_SOM_KEY, novo);
  atualizarBotaoSomBiblia();
  if (novo === "1") tocarSomVirarPagina();
}

async function bibliaInitEstadoGlobal() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snap = await bibliaEstadoRef.get();
    if (!snap.exists) {
      await bibliaEstadoRef.set({
        currentIndex: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      bibliaCurrentIndex = 1;
      bibliaCurrentDocId = "v1";
      return;
    }

    const data = snap.data() || {};
    const idx = Number(data.currentIndex) || 1;
    bibliaCurrentIndex = Math.max(1, idx);
    bibliaCurrentDocId = "v" + bibliaCurrentIndex;
  } catch (e) {
    bibliaCurrentIndex = 1;
    bibliaCurrentDocId = "v1";
  }
}

function bibliaAtivarEstadoListener() {
  const user = auth.currentUser;
  if (!user) return;
  if (unsubscribeBibliaEstado) return;

  unsubscribeBibliaEstado = bibliaEstadoRef.onSnapshot(snap => {
    const data = snap.exists ? (snap.data() || {}) : {};
    const idx = Math.max(1, Number(data.currentIndex) || 1);

    if (idx !== bibliaCurrentIndex) {
      bibliaCurrentIndex = idx;
      bibliaCurrentDocId = "v" + idx;
      carregarBibliaAtual(true).catch(() => {});
    }
  });
}

async function carregarBibliaAtual(viaListener = false) {
  const user = auth.currentUser;
  if (!user) return;

  obterPapelBiblia();
  await bibliaInitEstadoGlobal();
  bibliaAtivarEstadoListener();
  atualizarBotaoSomBiblia();

  const currentIndex = bibliaCurrentIndex;

  let refTexto = null;
  let labelTexto = `Dia ${currentIndex}`;

  try {
    const docPlan = await bibliaPlanRef.doc(String(currentIndex)).get();
    if (docPlan.exists) {
      const data = docPlan.data() || {};
      if (data.ref) refTexto = String(data.ref);
      if (data.label) labelTexto = String(data.label);
    }
  } catch (e) {}

  if (!refTexto) {
    const fb = fallbackPlan[(currentIndex - 1) % fallbackPlan.length];
    refTexto = fb.ref;
    labelTexto = fb.label ? fb.label : `Dia ${currentIndex}`;
  }

  const elDia = document.getElementById("bibDiaLabel");
  const elRef = document.getElementById("bibRef");
  const elBookTitle = document.getElementById("bibBookTitle");
  const elFooterDia = document.getElementById("bibFooterDia");

  if (elDia) elDia.textContent = labelTexto;
  if (elRef) elRef.textContent = refTexto;
  if (elBookTitle) elBookTitle.textContent = bibliaExtrairLivroCapitulo(refTexto);
  if (elFooterDia) elFooterDia.textContent = `Dia ${currentIndex}`;

  bibliaAnimarVirada();

  pararBibliaListener();
  const docId = "v" + currentIndex;
  bibliaCurrentDocId = docId;

  unsubscribeBibliaDia = bibliaLeiturasRef.doc(docId).onSnapshot(async (snap) => {
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

    const seal = document.getElementById("bibGoldSeal");
    if (seal) seal.style.display = (euLido && elaLido) ? "inline-flex" : "none";
  });

  try {
    await bibliaLeiturasRef.doc(docId).set(
      { ref: refTexto, label: labelTexto, dayIndex: currentIndex },
      { merge: true }
    );
  } catch (e) {}
}

async function bibliaProximo() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  try {
    const novoIndex = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bibliaEstadoRef);
      let idx = 1;
      if (snap.exists) idx = Number((snap.data() || {}).currentIndex) || 1;

      idx = Math.max(1, idx) + 1;

      tx.set(bibliaEstadoRef, {
        currentIndex: idx,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email || ""
      }, { merge: true });

      return idx;
    });

    bibliaCurrentIndex = novoIndex;
    bibliaCurrentDocId = "v" + novoIndex;
    await carregarBibliaAtual();
  } catch (e) {
    alert("Erro ao avançar versículo: " + (e.message || e));
  }
}

async function bibliaAnterior() {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  try {
    const novoIndex = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bibliaEstadoRef);
      let idx = 1;
      if (snap.exists) idx = Number((snap.data() || {}).currentIndex) || 1;

      idx = Math.max(1, idx) - 1;
      idx = Math.max(1, idx);

      tx.set(bibliaEstadoRef, {
        currentIndex: idx,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email || ""
      }, { merge: true });

      return idx;
    });

    bibliaCurrentIndex = novoIndex;
    bibliaCurrentDocId = "v" + novoIndex;
    await carregarBibliaAtual();
  } catch (e) {
    alert("Erro ao voltar versículo: " + (e.message || e));
  }
}

function proximoVersiculoBiblia() {
  tocarSomVirarPagina();
  return bibliaProximo();
}
function anteriorVersiculoBiblia() {
  tocarSomVirarPagina();
  return bibliaAnterior();
}

async function marcarLeituraBiblia(lido) {
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const papel = obterPapelBiblia();

  if (!bibliaCurrentDocId) {
    await bibliaInitEstadoGlobal();
    bibliaCurrentDocId = "v" + bibliaCurrentIndex;
  }

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
    await bibliaLeiturasRef.doc(bibliaCurrentDocId).set(payload, { merge: true });
  } catch (e) {
    alert("Erro ao salvar leitura: " + (e.message || e));
  }
}

/* =========================================================
   💌 CARTINHAS (Para você)
========================================================= */

function loveNome(role){
  return role === "ash" ? "Ash" : "Deh";
}

// Regra: biblia_papel "eu" = Ash, "ela" = Deh
function loveMeuRole(){
  const papel = localStorage.getItem("biblia_papel");
  if (papel === "ela") return "deh";
  return "ash";
}
function loveOutroRole(){
  return loveMeuRole() === "ash" ? "deh" : "ash";
}

function cartinhasPrepararDefaults(){
  const me = loveMeuRole();
  const other = loveOutroRole();

  const selTo = document.getElementById("loveTo");
  const meLabel = document.getElementById("loveMeLabel");

  if (meLabel) meLabel.textContent = `Você: ${loveNome(me)}`;
  if (selTo) selTo.value = other;

  const whenSel = document.getElementById("loveWhen");
  if (whenSel && !whenSel.value) whenSel.value = "now";

  cartinhasTrocarModoData();
}

function cartinhasInitTela(){
  const user = auth.currentUser;
  if (!user) return;

  cartinhasPrepararDefaults();
  cartinhasAtivarListeners();
  cartinhasRenderListas(); // render inicial (pode estar vazio)
}

function cartinhasTrocarModoData(){
  const whenSel = document.getElementById("loveWhen");
  const wrap = document.getElementById("loveDateWrap");
  if (!whenSel || !wrap) return;
  wrap.style.display = (whenSel.value === "date") ? "block" : "none";
}

function cartinhasPararListeners(){
  if (unsubscribeLoveInbox) unsubscribeLoveInbox();
  if (unsubscribeLoveSent) unsubscribeLoveSent();
  unsubscribeLoveInbox = null;
  unsubscribeLoveSent = null;
  loveInbox = [];
  loveSent = [];
}

function cartinhasAtivarListeners(){
  const user = auth.currentUser;
  if (!user) return;
  if (unsubscribeLoveInbox || unsubscribeLoveSent) return;

  const me = loveMeuRole();

  unsubscribeLoveInbox = cartinhasRef
    .where("to", "==", me)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      loveInbox = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cartinhasRenderListas();
    });

  unsubscribeLoveSent = cartinhasRef
    .where("from", "==", me)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      loveSent = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cartinhasRenderListas();
    });
}

function tsToDate(ts){
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

function fmtDateTime(d){
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function fmtDateOnly(d){
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function cartinhaPodeAbrir(item){
  const openAt = tsToDate(item.openAt);
  if (!openAt) return true;
  return Date.now() >= openAt.getTime();
}

function cartinhaPreview(texto){
  const t = String(texto || "").trim();
  if (!t) return "—";
  return t.length > 120 ? (t.slice(0, 120) + "…") : t;
}

function cartinhasRenderListas(){
  const inboxEl = document.getElementById("loveInbox");
  const sentEl = document.getElementById("loveSent");
  if (!inboxEl || !sentEl) return;

  // RECEBIDAS
  if (!Array.isArray(loveInbox) || loveInbox.length === 0){
    inboxEl.innerHTML = `<p style="margin:0; opacity:.75;">Nenhuma cartinha recebida ainda 💜</p>`;
  } else {
    inboxEl.innerHTML = loveInbox.map(item => cartinhasCardHTML(item, true)).join("");
  }

  // ENVIADAS
  if (!Array.isArray(loveSent) || loveSent.length === 0){
    sentEl.innerHTML = `<p style="margin:0; opacity:.75;">Nenhuma cartinha enviada ainda 💌</p>`;
  } else {
    sentEl.innerHTML = loveSent.map(item => cartinhasCardHTML(item, false)).join("");
  }
}

function cartinhasCardHTML(item, isInbox){
  const from = item.from || "—";
  const to = item.to || "—";
  const fromName = loveNome(from);
  const toName = loveNome(to);

  const createdAt = fmtDateTime(tsToDate(item.createdAt));
  const openAtDate = tsToDate(item.openAt);
  const locked = !cartinhaPodeAbrir(item);

  const read = !!item.isRead;
  const fav = !!item.isFav;

  const badge = `De <strong>${fromName}</strong> para <strong>${toName}</strong>`;

  const lockLine = locked
    ? `🔒 Trancada — abre em <strong>${fmtDateOnly(openAtDate)}</strong>`
    : `✅ Pode abrir`;

  const dotClass = read ? "loveReadDot read" : "loveReadDot";

  const mainBtn = isInbox
    ? (locked
      ? `<button class="loveBtnGhost" disabled title="Ainda não pode abrir">🔒 Trancada</button>`
      : `<button onclick="cartinhasAbrir('${item.id}')" title="Abrir">💌 Abrir</button>`)
    : (locked
      ? `<button class="loveBtnGhost" disabled title="A outra pessoa ainda não pode abrir">🔒 Trancada</button>`
      : `<button class="loveBtnGhost" disabled title="Já pode abrir do lado dela/dele">✅ Liberada</button>`);

  const starBtn = `<button class="${fav ? "loveStar" : "loveBtnGhost"}" onclick="cartinhasToggleFav('${item.id}', ${isInbox ? "true" : "false"})" title="Favoritar">⭐</button>`;

  return `
    <div class="loveCard">
      <div class="loveTop">
        <div class="loveMeta">
          <span class="${dotClass}" title="${read ? "Lida" : "Não lida"}"></span>
          <span class="loveBadge">${badge}</span>
          <span class="loveBadge loveLock">${lockLine}</span>
        </div>
        <div class="loveMeta">
          ${starBtn}
        </div>
      </div>

      <div class="loveSub">
        <div style="opacity:.9;">${locked && isInbox ? "Conteúdo oculto até liberar 💜" : cartinhaPreview(item.texto)}</div>
        <div style="margin-top:6px; opacity:.7;">Enviada em ${createdAt}</div>
      </div>

      <div class="loveActions">
        ${mainBtn}
      </div>
    </div>
  `;
}

function cartinhasGetItemById(id){
  let item = loveInbox.find(x => x.id === id);
  if (item) return item;
  item = loveSent.find(x => x.id === id);
  return item || null;
}

async function cartinhasAbrir(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cartinhasGetItemById(id);
  if (!item) return alert("Cartinha não encontrada.");

  if (!cartinhaPodeAbrir(item)){
    const openAt = tsToDate(item.openAt);
    alert(`Essa cartinha ainda está trancada.\nAbre em: ${fmtDateOnly(openAt)}`);
    return;
  }

  // marca como lida (somente se for recebida)
  const me = loveMeuRole();
  if (item.to === me) {
    try {
      await cartinhasRef.doc(id).set({
        isRead: true,
        openedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }

  cartinhasAbrirModal(item);
}

function cartinhasAbrirModal(item){
  const modal = document.getElementById("loveModal");
  const title = document.getElementById("loveModalTitle");
  const meta = document.getElementById("loveModalMeta");
  const body = document.getElementById("loveModalBody");
  if (!modal || !title || !meta || !body) return;

  const fromName = loveNome(item.from || "");
  const toName = loveNome(item.to || "");
  const createdAt = fmtDateTime(tsToDate(item.createdAt));
  const openedAt = tsToDate(item.openedAt);

  title.textContent = "💌 Cartinha";
  meta.textContent = `De ${fromName} → ${toName} • enviada em ${createdAt}` + (openedAt ? ` • aberta em ${fmtDateTime(openedAt)}` : "");
  body.textContent = String(item.texto || "—");

  modal.style.display = "grid";
}

function cartinhasFecharModal(){
  const modal = document.getElementById("loveModal");
  if (modal) modal.style.display = "none";
}

async function cartinhasToggleFav(id, isInbox){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cartinhasGetItemById(id);
  if (!item) return;

  try {
    await cartinhasRef.doc(id).set({ isFav: !item.isFav }, { merge: true });
  } catch (e) {
    alert("Não consegui favoritar agora.");
  }
}

function cartinhasOpenAtFromUI(){
  const whenSel = document.getElementById("loveWhen");
  const dateInp = document.getElementById("loveDate");
  const mode = whenSel ? whenSel.value : "now";

  const now = new Date();

  if (mode === "now") {
    return firebase.firestore.Timestamp.fromDate(now);
  }

  if (mode === "tomorrow") {
    // amanhã às 08:00
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return firebase.firestore.Timestamp.fromDate(d);
  }

  // date
  const v = (dateInp ? dateInp.value : "").trim();
  if (!v) return null;
  const d = new Date(v + "T08:00:00"); // libera 08:00 do dia escolhido
  if (Number.isNaN(d.getTime())) return null;
  return firebase.firestore.Timestamp.fromDate(d);
}

async function cartinhasEnviar(){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  cartinhasPrepararDefaults();

  const me = loveMeuRole();
  const toSel = document.getElementById("loveTo");
  const textEl = document.getElementById("loveText");

  const to = (toSel ? String(toSel.value) : loveOutroRole()).trim();
  const texto = (textEl ? String(textEl.value) : "").trim();

  if (!texto) return alert("Escreve uma mensagem primeiro 💜");
  if (to !== "ash" && to !== "deh") return alert("Destinatário inválido.");

  if (to === me) return alert("Escolhe o outro (não dá pra mandar pra você mesmo 😄)");

  const openAt = cartinhasOpenAtFromUI();
  if (!openAt) return alert("Escolha uma data válida pra abrir.");

  try {
    await cartinhasRef.add({
      from: me,
      to,
      texto,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      openAt,
      openedAt: null,
      isRead: false,
      isFav: false,
      fromEmail: user.email || ""
    });

    if (textEl) textEl.value = "";
    alert("💌 Cartinha enviada!");
  } catch (e) {
    alert("Erro ao enviar cartinha: " + (e.message || e));
  }
}

/* =========================================================
   🎬 CINEMA (Filmes + Séries + Nota + Favoritos + Sorteio)
========================================================= */

function cinemaNome(role){
  return role === "ash" ? "Ash" : "Deh";
}

function cinemaMeuRole(){
  // mesma regra: biblia_papel "eu" = Ash, "ela" = Deh
  const papel = localStorage.getItem("biblia_papel");
  if (papel === "ela") return "deh";
  return "ash";
}

function cinemaPrepararDefaults(){
  const me = cinemaMeuRole();
  const label = document.getElementById("cinemaMeLabel");
  if (label) label.textContent = `Você: ${cinemaNome(me)}`;
}

/* ✅ NOVO: injeta CSS do banner automaticamente (não precisa mexer no style.css) */
function cinemaEnsureBannerCSS(){
  const id = "cinemaBannerAutoCss";
  if (document.getElementById(id)) return;

  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    .cinemaBanner{
      position: relative;
      width: 100%;
      overflow: hidden;
      border-radius: 16px;
      height: 160px;
      background: rgba(255,255,255,0.08);
      isolation: isolate;
    }
    @media (min-width: 700px){
      .cinemaBanner{ height: 210px; }
    }

    .cinemaBannerBg{
      position:absolute;
      inset:0;
      background-size: cover;
      background-position: center;
      filter: blur(18px);
      transform: scale(1.12);
      opacity: 0.55;
      z-index: 0;
    }

    .cinemaBannerImg{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit: contain;     /* ✅ mostra 100% da imagem */
      object-position: center;
      z-index: 1;
    }

    .cinemaBannerOverlay{
      position:absolute;
      inset:0;
      background: linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.60));
      z-index: 2;
      pointer-events:none;
    }

    .cinemaBannerTitle{
      position:absolute;
      left:12px;
      right:12px;
      bottom:10px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      z-index: 3;
      color: #fff;
      font-weight: 700;
      text-shadow: 0 2px 12px rgba(0,0,0,0.55);
    }

    .cinemaBannerTitle span:first-child{
      overflow:hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cinemaBannerMini{
      opacity: .9;
      flex: 0 0 auto;
    }
  `;
  document.head.appendChild(st);
}

/* ✅ FIX: função existia no HTML (onchange) mas não existia no JS.
   Agora ela mostra/oculta os campos de série corretamente. */
function cinemaOnTypeChange(){
  const typeEl = document.getElementById("cinemaType");
  const wrapSeasons = document.getElementById("cinemaSeriesSeasonsWrap");
  const wrapEps = document.getElementById("cinemaSeriesEpsWrap");
  if (!typeEl) return;

  const isSeries = String(typeEl.value || "movie") === "series";
  if (wrapSeasons) wrapSeasons.style.display = isSeries ? "block" : "none";
  if (wrapEps) wrapEps.style.display = isSeries ? "block" : "none";
}

function cinemaInitTela(){
  const user = auth.currentUser;
  if (!user) return;

  cinemaEnsureBannerCSS(); // ✅ garante banner perfeito em qualquer device

  cinemaPrepararDefaults();
  cinemaOnTypeChange(); // ✅ garante UI correta ao entrar
  cinemaAtivarListener();
  cinemaSetTab(cinemaTab || "todo");
  cinemaRender();
}

function cinemaPararListener(){
  if (unsubscribeCinema) unsubscribeCinema();
  unsubscribeCinema = null;
  cinemaItems = [];
  cinemaRandomPickId = null;
  cinemaSeriesUI.expanded = {};
}

function cinemaAtivarListener(){
  const user = auth.currentUser;
  if (!user) return;
  if (unsubscribeCinema) return;

  unsubscribeCinema = cinemaRef
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      cinemaItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cinemaRender();
    }, (err) => {
      // ✅ ajuda a não "quebrar silencioso" se existir doc antigo sem createdAt
      console.log("Erro listener cinema:", err);
    });
}

function cinemaPlatformLabel(v){
  const map = {
    netflix: "Netflix",
    prime: "Prime Video",
    disney: "Disney+",
    max: "Max",
    globoplay: "Globoplay",
    youtube: "YouTube",
    cinema: "Cinema",
    outro: "Outro"
  };
  return map[v] || "—";
}

function cinemaTypeLabel(v){
  return v === "series" ? "Série" : "Filme";
}

function cinemaSetTab(tab){
  cinemaTab = tab;

  const t1 = document.getElementById("cinemaTabTodo");
  const t2 = document.getElementById("cinemaTabWatched");
  const t3 = document.getElementById("cinemaTabFav");

  if (t1) t1.classList.toggle("active", tab === "todo");
  if (t2) t2.classList.toggle("active", tab === "watched");
  if (t3) t3.classList.toggle("active", tab === "fav");

  cinemaRender();
}

function cinemaCounts(){
  const todo = cinemaItems.filter(x => (x.status || "todo") === "todo").length;
  const watched = cinemaItems.filter(x => (x.status || "todo") === "watched").length;
  const fav = cinemaItems.filter(x => !!x.isFav).length;

  const cTodo = document.getElementById("cinemaCountTodo");
  const cWatched = document.getElementById("cinemaCountWatched");
  const cFav = document.getElementById("cinemaCountFav");

  if (cTodo) cTodo.textContent = String(todo);
  if (cWatched) cWatched.textContent = String(watched);
  if (cFav) cFav.textContent = String(fav);

  // último visto
  const watchedSorted = cinemaItems
    .filter(x => (x.status || "todo") === "watched")
    .slice()
    .sort((a,b) => {
      const da = tsToDate(a.watchedAt) ? tsToDate(a.watchedAt).getTime() : 0;
      const dbb = tsToDate(b.watchedAt) ? tsToDate(b.watchedAt).getTime() : 0;
      return dbb - da;
    });

  const last = watchedSorted[0] || null;
  const line = document.getElementById("cinemaLastLine");
  if (line) {
    if (!last) line.textContent = "Último visto: —";
    else {
      const dt = tsToDate(last.watchedAt);
      const nota = (typeof last.rating === "number") ? ` • nota ${last.rating.toFixed(1)}` : "";
      line.textContent = `Último visto: ${last.title || "—"}${dt ? " • " + fmtDateTime(dt) : ""}${nota}`;
    }
  }
}

function cinemaGetFiltered(){
  const norm = (x) => ({
    ...x,
    status: x.status || "todo",
    type: x.type || "movie"
  });

  const all = cinemaItems.map(norm);

  if (cinemaTab === "watched") {
    return all.filter(x => x.status === "watched");
  }
  if (cinemaTab === "fav") {
    return all.filter(x => !!x.isFav);
  }
  // todo
  return all.filter(x => x.status === "todo");
}

function cinemaRender(){
  cinemaCounts();

  const listEl = document.getElementById("cinemaList");
  if (!listEl) return;

  const items = cinemaGetFiltered();

  if (!items.length){
    const msg =
      cinemaTab === "watched" ? "Nenhum item visto ainda ✅" :
      cinemaTab === "fav" ? "Nenhum favorito ainda ⭐" :
      "Sua lista está vazia. Adiciona um filme ou série 💜";

    listEl.innerHTML = `<p style="margin:0; opacity:.75;">${msg}</p>`;
  } else {
    listEl.innerHTML = items.map(cinemaCardHTML).join("");
  }

  cinemaRenderRandomResult();
}

/* =========================
   ✅ NOVO: Helpers de séries
========================= */

function cinemaIsSeries(item){
  return (item?.type || "movie") === "series";
}

function cinemaToInt(v, def = 0){
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : def;
}

function cinemaClampInt(n, min, max){
  const x = cinemaToInt(n, min);
  return Math.max(min, Math.min(max, x));
}

function cinemaUniqueSortedInts(arr){
  const set = new Set();
  (Array.isArray(arr) ? arr : []).forEach(v => {
    const n = cinemaToInt(v, 0);
    if (n > 0) set.add(n);
  });
  return Array.from(set).sort((a,b)=>a-b);
}

function cinemaSeriesParseEpisodesInput(seasonsCount, input){
  const sc = cinemaClampInt(seasonsCount, 1, 100);
  const raw = String(input ?? "").trim();
  if (!raw) return Array(sc).fill(0);

  const parts = raw.split(",").map(s => cinemaToInt(s.trim(), 0)).filter(n => n > 0);

  if (parts.length === 0) return Array(sc).fill(0);

  if (parts.length === 1) {
    return Array(sc).fill(parts[0]);
  }

  const out = [];
  for (let i=0; i<sc; i++){
    out.push(parts[i] || parts[parts.length - 1] || 0);
  }
  return out;
}

function cinemaSeriesBuildSeasons(seasonsCount, totalsArr){
  const sc = cinemaClampInt(seasonsCount, 1, 100);
  const seasons = [];
  for (let i=0; i<sc; i++){
    const total = cinemaClampInt(totalsArr[i] || 0, 0, 5000);
    seasons.push({
      n: i + 1,
      totalEpisodes: total,
      watched: []
    });
  }
  return seasons;
}

function cinemaSeriesNormalize(item){
  const series = item?.series || null;
  const seasons = series && Array.isArray(series.seasons) ? series.seasons : null;
  if (!seasons) return null;

  const cleaned = seasons
    .map(s => {
      const n = cinemaClampInt(s?.n ?? s?.season ?? 0, 1, 1000);
      const totalEpisodes = cinemaClampInt(s?.totalEpisodes ?? s?.episodes ?? 0, 0, 5000);
      const watched = cinemaUniqueSortedInts(s?.watched || []);
      const watchedClamped = watched.filter(ep => ep >= 1 && (totalEpisodes ? ep <= totalEpisodes : true));
      return { n, totalEpisodes, watched: watchedClamped };
    })
    .sort((a,b)=>a.n-b.n);

  return { seasons: cleaned };
}

function cinemaSeriesStats(item){
  const norm = cinemaSeriesNormalize(item);
  if (!norm) {
    return {
      hasConfig: false,
      totalEpisodes: 0,
      watchedEpisodes: 0,
      percent: 0,
      nextSeason: 1,
      nextEpisode: 1,
      finished: false,
      label: "Série sem checklist configurado"
    };
  }

  const seasons = norm.seasons;
  let total = 0;
  let watched = 0;

  let nextSeason = seasons[0]?.n || 1;
  let nextEpisode = 1;
  let foundNext = false;

  seasons.forEach(s => {
    total += (Number(s.totalEpisodes) || 0);
    watched += (Array.isArray(s.watched) ? s.watched.length : 0);

    if (!foundNext) {
      const t = Number(s.totalEpisodes) || 0;
      const w = cinemaUniqueSortedInts(s.watched || []);
      if (t > 0 && w.length < t) {
        nextSeason = s.n;
        // acha o menor ep não visto
        for (let ep = 1; ep <= t; ep++){
          if (!w.includes(ep)){
            nextEpisode = ep;
            break;
          }
        }
        foundNext = true;
      }
    }
  });

  const finished = total > 0 && watched >= total;
  const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

  const label = finished
    ? `Finalizada ✅ (${watched}/${total})`
    : (total > 0 ? `Progresso: ${watched}/${total} (${percent}%) • Próximo: T${nextSeason}E${nextEpisode}` : "Defina episódios/temporadas");

  return {
    hasConfig: true,
    totalEpisodes: total,
    watchedEpisodes: watched,
    percent,
    nextSeason,
    nextEpisode,
    finished,
    label,
    seasons: norm.seasons
  };
}

function cinemaSeriesGetById(id){
  return cinemaItems.find(x => x.id === id) || null;
}

async function cinemaSeriesSave(id, seasons, extra = {}){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const cleaned = (Array.isArray(seasons) ? seasons : [])
    .map(s => ({
      n: cinemaClampInt(s?.n, 1, 1000),
      totalEpisodes: cinemaClampInt(s?.totalEpisodes, 0, 5000),
      watched: cinemaUniqueSortedInts(s?.watched || []).filter(ep => ep >= 1 && (s?.totalEpisodes ? ep <= s.totalEpisodes : true))
    }))
    .sort((a,b)=>a.n-b.n);

  const payload = {
    series: { seasons: cleaned },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...extra
  };

  try {
    await cinemaRef.doc(id).set(payload, { merge: true });
  } catch (e) {
    alert("Não consegui salvar a série agora.");
  }
}

async function cinemaSeriesApplyCompletion(id){
  const item = cinemaSeriesGetById(id);
  if (!item) return;

  const st = cinemaSeriesStats(item);

  // se não tem config, não faz nada
  if (!st.hasConfig || !Array.isArray(st.seasons) || st.totalEpisodes <= 0) return;

  // Finalizou? -> move pra watched (se ainda não estiver)
  if (st.finished && (item.status || "todo") !== "watched") {
    await cinemaRef.doc(id).set({
      status: "watched",
      watchedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // pergunta nota opcional
    const r = cinemaAskRating(typeof item.rating === "number" ? item.rating : "");
    if (!r.cancelled && r.value !== "invalid") {
      await cinemaRef.doc(id).set({
        rating: (typeof r.value === "number") ? r.value : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  // Se desfez (não está completo) e estava em watched -> volta pra todo
  if (!st.finished && (item.status || "todo") === "watched") {
    await cinemaRef.doc(id).set({
      status: "todo",
      watchedAt: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

function cinemaSeriesToggleChecklist(id){
  cinemaSeriesUI.expanded[id] = !cinemaSeriesUI.expanded[id];
  cinemaRender();
}

async function cinemaSeriesConfigure(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaSeriesGetById(id);
  if (!item) return alert("Série não encontrada.");

  const ok = confirm("Configurar checklist (temporadas/episódios) e banner?\nSe já existir progresso, você pode escolher redefinir.");
  if (!ok) return;

  const seasonsCount = cinemaClampInt(prompt("Quantas temporadas essa série tem? (ex: 3)"), 1, 100);

  const epsInput = prompt(
    "Quantos episódios por temporada?\n\n" +
    "• Se for igual em todas: digite um número (ex: 10)\n" +
    "• Se for diferente: digite uma lista (ex: 10,12,8)\n\n" +
    "Obs: se tiver 5 temporadas e você digitar 10,12,8 -> as últimas repetem o último valor."
  );

  const totals = cinemaSeriesParseEpisodesInput(seasonsCount, epsInput);
  const seasons = cinemaSeriesBuildSeasons(seasonsCount, totals);

  const bannerUrl = String(prompt("Cole o link do banner (imagem) da série.\n(Deixe vazio para não usar)", (item.bannerUrl || "")) ?? "").trim();

  let resetProgress = false;
  const existing = cinemaSeriesNormalize(item);
  if (existing && existing.seasons.some(s => (s.watched || []).length > 0)) {
    resetProgress = confirm("Você já tem episódios marcados nessa série.\nQuer REDEFINIR e começar do zero?");
  }

  const payloadExtra = {};
  if (bannerUrl) payloadExtra.bannerUrl = bannerUrl;
  else payloadExtra.bannerUrl = null;

  if (!resetProgress && existing) {
    // tenta preservar progresso onde dá (por temporada)
    const prev = existing.seasons;
    seasons.forEach(s => {
      const p = prev.find(x => x.n === s.n);
      if (!p) return;
      const w = cinemaUniqueSortedInts(p.watched || []).filter(ep => ep >= 1 && (s.totalEpisodes ? ep <= s.totalEpisodes : true));
      s.watched = w;
    });
  }

  await cinemaSeriesSave(id, seasons, payloadExtra);
  await cinemaSeriesApplyCompletion(id);
}

async function cinemaSeriesToggleEpisode(id, seasonN, epN){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaSeriesGetById(id);
  if (!item) return;

  const norm = cinemaSeriesNormalize(item);
  if (!norm) return alert("Essa série ainda não está configurada. Clique em ⚙️ Configurar.");

  const seasons = norm.seasons.map(s => ({ ...s, watched: [...(s.watched || [])] }));
  const s = seasons.find(x => x.n === Number(seasonN));
  if (!s) return;

  const total = Number(s.totalEpisodes) || 0;
  const ep = cinemaClampInt(epN, 1, total > 0 ? total : 999999);

  const w = cinemaUniqueSortedInts(s.watched || []);
  const idx = w.indexOf(ep);
  if (idx >= 0) w.splice(idx, 1);
  else w.push(ep);
  s.watched = cinemaUniqueSortedInts(w);

  await cinemaSeriesSave(id, seasons);
  await cinemaSeriesApplyCompletion(id);
}

async function cinemaSeriesMarkSeasonAll(id, seasonN, markAll){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaSeriesGetById(id);
  if (!item) return;

  const norm = cinemaSeriesNormalize(item);
  if (!norm) return alert("Essa série ainda não está configurada. Clique em ⚙️ Configurar.");

  const seasons = norm.seasons.map(s => ({ ...s, watched: [...(s.watched || [])] }));
  const s = seasons.find(x => x.n === Number(seasonN));
  if (!s) return;

  const total = Number(s.totalEpisodes) || 0;
  if (total <= 0) return alert("Defina quantos episódios essa temporada tem (⚙️ Configurar).");

  if (markAll) {
    s.watched = Array.from({ length: total }, (_, i) => i + 1);
  } else {
    s.watched = [];
  }

  await cinemaSeriesSave(id, seasons);
  await cinemaSeriesApplyCompletion(id);
}

async function cinemaSeriesMarkNext(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaSeriesGetById(id);
  if (!item) return;

  const st = cinemaSeriesStats(item);
  if (!st.hasConfig || !Array.isArray(st.seasons) || st.totalEpisodes <= 0) {
    return alert("Essa série ainda não está configurada. Clique em ⚙️ Configurar.");
  }

  if (st.finished) {
    alert("Essa série já está finalizada ✅");
    return;
  }

  await cinemaSeriesToggleEpisode(id, st.nextSeason, st.nextEpisode);
}

async function cinemaSeriesUndoLast(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaSeriesGetById(id);
  if (!item) return;

  const norm = cinemaSeriesNormalize(item);
  if (!norm) return alert("Essa série ainda não está configurada. Clique em ⚙️ Configurar.");

  // acha o último visto (maior temporada e maior ep)
  const seasons = norm.seasons.map(s => ({ ...s, watched: cinemaUniqueSortedInts(s.watched || []) }));
  let lastS = null;
  let lastEp = null;

  seasons.forEach(s => {
    if (!s.watched.length) return;
    const ep = s.watched[s.watched.length - 1];
    if (lastS === null) {
      lastS = s.n; lastEp = ep; return;
    }
    if (s.n > lastS) { lastS = s.n; lastEp = ep; return; }
    if (s.n === lastS && ep > lastEp) { lastEp = ep; }
  });

  if (lastS === null) {
    alert("Nenhum episódio marcado ainda 🙂");
    return;
  }

  await cinemaSeriesToggleEpisode(id, lastS, lastEp);
}

/* =========================
   ✅ BANNER PERFEITO (FILMES E SÉRIES)
   - altura fixa
   - mostra 100% da imagem (contain)
   - fundo blur para preencher
========================= */

function cinemaEscapeAttr(s){
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function cinemaEscapeCssUrl(s){
  // evita quebrar o CSS inline do background-image
  try { return encodeURI(String(s ?? "").trim()); } catch (e) { return ""; }
}

function cinemaBannerHTML(item){
  const title = String(item.title || "—");

  // ✅ aceita bannerUrl (seu padrão), mas também tenta compat com dados antigos se existir
  const rawUrl = String(item.bannerUrl || item.coverUrl || item.posterUrl || "").trim();
  if (!rawUrl) return ""; // mantém seu layout (sem banner se não tiver link)

  const safeAttr = cinemaEscapeAttr(rawUrl);
  const safeCss = cinemaEscapeCssUrl(rawUrl);

  return `
    <div class="cinemaBanner">
      <div class="cinemaBannerBg" style="background-image:url('${safeCss}')"></div>
      <img class="cinemaBannerImg" src="${safeAttr}" alt="capa" loading="lazy"
        onerror="this.style.display='none'; this.closest('.cinemaBanner')?.classList.add('noimg');">
      <div class="cinemaBannerOverlay"></div>
      <div class="cinemaBannerTitle">
        <span>${cinemaEscapeAttr(title)}</span>
        <span class="cinemaBannerMini">🎬</span>
      </div>
    </div>
  `;
}

function cinemaSeriesChecklistHTML(item){
  const st = cinemaSeriesStats(item);
  const expanded = !!cinemaSeriesUI.expanded[item.id];

  const btnChecklist = `<button class="cinemaGhostBtn" onclick="cinemaSeriesToggleChecklist('${item.id}')" title="Checklist">${expanded ? "📋 Fechar" : "📋 Checklist"}</button>`;
  const btnConfig = `<button class="cinemaGhostBtn" onclick="cinemaSeriesConfigure('${item.id}')" title="Configurar">⚙️ Configurar</button>`;
  const btnNext = `<button onclick="cinemaSeriesMarkNext('${item.id}')" title="Marcar próximo episódio">✅ Próximo ep</button>`;
  const btnUndo = `<button class="cinemaGhostBtn" onclick="cinemaSeriesUndoLast('${item.id}')" title="Desmarcar último episódio">↩️ Desmarcar último</button>`;

  const line = `<div class="cinemaSeriesProgress">${st.label}</div>`;

  if (!expanded) {
    return `
      <div class="cinemaSeriesBox">
        <div class="cinemaSeriesLine">
          ${line}
          <div class="cinemaSeriesSmallBtns">
            ${btnNext}
            ${btnUndo}
            ${btnChecklist}
            ${btnConfig}
          </div>
        </div>
      </div>
    `;
  }

  // checklist expandido
  if (!st.hasConfig || !Array.isArray(st.seasons) || st.seasons.length === 0) {
    return `
      <div class="cinemaSeriesBox">
        <div class="cinemaSeriesLine">
          ${line}
          <div class="cinemaSeriesSmallBtns">
            ${btnChecklist}
            ${btnConfig}
          </div>
        </div>
        <div class="cinemaSeriesChecklist">
          <div style="opacity:.8;">Sem temporadas/episódios configurados ainda.</div>
          <div class="cinemaSeriesSmallBtns" style="justify-content:flex-start;">
            ${btnConfig}
          </div>
        </div>
      </div>
    `;
  }

  const seasonsHtml = st.seasons.map(s => {
    const total = Number(s.totalEpisodes) || 0;
    const watched = cinemaUniqueSortedInts(s.watched || []);
    const done = total > 0 ? watched.length : 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const actions =
      total > 0
        ? `
          <div class="cinemaSeasonActions">
            <button class="cinemaGhostBtn" onclick="cinemaSeriesMarkSeasonAll('${item.id}', ${s.n}, true)">✅ Marcar temp. toda</button>
            <button class="cinemaGhostBtn" onclick="cinemaSeriesMarkSeasonAll('${item.id}', ${s.n}, false)">🧹 Limpar temp.</button>
          </div>
        `
        : `
          <div class="cinemaSeasonActions">
            <button class="cinemaGhostBtn" onclick="cinemaSeriesConfigure('${item.id}')">⚙️ Definir episódios</button>
          </div>
        `;

    let epsGrid = "";
    if (total > 0) {
      epsGrid = `
        <div class="cinemaEpisodeGrid">
          ${Array.from({ length: total }, (_, i) => {
            const ep = i + 1;
            const seen = watched.includes(ep);
            return `<button class="cinemaEp ${seen ? "seen" : ""}" onclick="cinemaSeriesToggleEpisode('${item.id}', ${s.n}, ${ep})">${ep}</button>`;
          }).join("")}
        </div>
      `;
    }

    return `
      <div class="cinemaSeasonCard">
        <div class="cinemaSeasonTop">
          <div>
            <div class="cinemaSeasonTitle">Temporada ${s.n}</div>
            <div class="cinemaSeasonMeta">${total > 0 ? `${done}/${total} (${pct}%)` : "Defina quantos episódios"}</div>
          </div>
          <div class="cinemaSeasonMeta">${total > 0 && done === total ? "✅ Completa" : ""}</div>
        </div>
        ${actions}
        ${epsGrid}
      </div>
    `;
  }).join("");

  return `
    <div class="cinemaSeriesBox">
      <div class="cinemaSeriesLine">
        ${line}
        <div class="cinemaSeriesSmallBtns">
          ${btnNext}
          ${btnUndo}
          ${btnChecklist}
          ${btnConfig}
        </div>
      </div>

      <div class="cinemaSeriesChecklist">
        ${seasonsHtml}
      </div>
    </div>
  `;
}

function cinemaCardHTML(item){
  const title = String(item.title || "—");
  const type = cinemaTypeLabel(item.type || "movie");
  const platform = cinemaPlatformLabel(item.platform || "outro");
  const by = cinemaNome(item.suggestedBy || "ash");
  const status = item.status || "todo";
  const fav = !!item.isFav;
  const rating = (typeof item.rating === "number") ? item.rating : null;

  const isSeries = cinemaIsSeries(item);

  // ✅ banner agora aparece se tiver URL (filme OU série) e SEMPRE ajustado
  const banner = cinemaBannerHTML(item);

  const badge1 = `<span class="cinemaBadge">${type}</span>`;
  const badge2 = `<span class="cinemaBadge cinemaBadgeSoft">📺 ${platform}</span>`;
  const badge3 = `<span class="cinemaBadge cinemaBadgeSoft">👤 ${by}</span>`;
  const badgeRating = (status === "watched" && rating !== null)
    ? `<span class="cinemaBadge cinemaBadgeGold">⭐ Nota ${rating.toFixed(1)}</span>`
    : "";

  const favBtn = `<button class="${fav ? "cinemaStar" : "cinemaGhostBtn"}" onclick="cinemaToggleFav('${item.id}')" title="Favoritar">⭐</button>`;
  const delBtn = `<button class="cinemaDangerBtn" onclick="cinemaDelete('${item.id}')" title="Remover">❌</button>`;

  let mainBtn = "";
  let extraBtn = "";

  if (!isSeries) {
    // FILMES
    if (status === "todo") {
      mainBtn = `<button onclick="cinemaMarkWatched('${item.id}')" title="Marcar como visto">✅ Marcar visto</button>`;
    } else {
      mainBtn = `<button class="cinemaGhostBtn" onclick="cinemaUndoWatched('${item.id}')" title="Voltar pra Quero ver">↩️ Voltar</button>`;
      extraBtn = `<button class="cinemaGhostBtn" onclick="cinemaEditRating('${item.id}')" title="Editar nota">✏️ Nota</button>`;
    }
  } else {
    // SÉRIES
    if (status === "watched") {
      mainBtn = `<button class="cinemaGhostBtn" onclick="cinemaUndoWatched('${item.id}')" title="Voltar pra Quero ver">↩️ Reabrir série</button>`;
      extraBtn = `<button class="cinemaGhostBtn" onclick="cinemaEditRating('${item.id}')" title="Editar nota">✏️ Nota</button>`;
    } else {
      mainBtn = "";
      extraBtn = "";
    }
  }

  const seriesBox = isSeries ? cinemaSeriesChecklistHTML(item) : "";

  return `
    <div class="cinemaCard">
      ${banner}

      <div class="cinemaTop">
        <div class="cinemaTitle">${title}</div>
        <div class="cinemaTopActions">
          ${favBtn}
          ${delBtn}
        </div>
      </div>

      <div class="cinemaBadges">
        ${badge1}
        ${badge2}
        ${badge3}
        ${badgeRating}
      </div>

      ${seriesBox}

      <div class="cinemaActions">
        ${mainBtn}
        ${extraBtn}
      </div>
    </div>
  `;
}

async function cinemaAdd(){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  cinemaPrepararDefaults();

  const titleEl = document.getElementById("cinemaTitle");
  const typeEl = document.getElementById("cinemaType");
  const platEl = document.getElementById("cinemaPlatform");
  const bannerEl = document.getElementById("cinemaBannerUrl");

  const title = (titleEl ? String(titleEl.value) : "").trim();
  const type = (typeEl ? String(typeEl.value) : "movie").trim();
  const platform = (platEl ? String(platEl.value) : "outro").trim();

  // ✅ FIX: pega a capa do input (funciona em filmes e séries)
  let bannerUrl = (bannerEl ? String(bannerEl.value) : "").trim();
  if (!bannerUrl) bannerUrl = null;

  if (!title) return alert("Digite um título 😊");
  if (type !== "movie" && type !== "series") return alert("Tipo inválido.");
  if (!platform) return alert("Escolha onde assistir.");

  const suggestedBy = cinemaMeuRole();

  // ✅ FIX: séries agora podem usar os campos da tela (sem prompt obrigatório)
  let series = null;
  if (type === "series") {
    const seasonsCountEl = document.getElementById("cinemaSeasonsCount");
    const epsEl = document.getElementById("cinemaEpisodesPerSeason");

    const seasonsCountRaw = (seasonsCountEl ? seasonsCountEl.value : "").trim();
    const epsRaw = (epsEl ? epsEl.value : "").trim();

    // Se preencher, já cria o checklist inicial
    if (seasonsCountRaw) {
      const seasonsCount = cinemaClampInt(seasonsCountRaw, 1, 100);

      // se eps vazio: cria temporadas com 0 episódios (e você configura depois no ⚙️)
      const totals = epsRaw
        ? cinemaSeriesParseEpisodesInput(seasonsCount, epsRaw)
        : Array(seasonsCount).fill(0);

      const seasons = cinemaSeriesBuildSeasons(seasonsCount, totals);
      series = { seasons };
    }
  }

  try {
    await cinemaRef.add({
      title,
      type,
      platform,
      suggestedBy,
      status: "todo",
      rating: null,
      isFav: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      watchedAt: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByEmail: user.email || "",
      bannerUrl: bannerUrl,
      series: series
    });

    if (titleEl) titleEl.value = "";
    if (bannerEl) bannerEl.value = ""; // limpa a URL depois de adicionar

    // limpa campos de série
    const seasonsCountEl = document.getElementById("cinemaSeasonsCount");
    const epsEl = document.getElementById("cinemaEpisodesPerSeason");
    if (seasonsCountEl) seasonsCountEl.value = "";
    if (epsEl) epsEl.value = "";

    alert("🎬 Adicionado na lista!");
  } catch (e) {
    alert("Erro ao adicionar: " + (e.message || e));
  }
}

function cinemaAskRating(defaultValue){
  const raw = prompt("Nota (0 a 10). Pode usar decimal (ex: 8.5).", (defaultValue ?? "").toString());
  if (raw === null) return { cancelled: true, value: null };

  const t = String(raw).trim();
  if (!t) return { cancelled: false, value: null };

  const num = Number.parseFloat(t.replace(",", "."));
  if (Number.isNaN(num)) return { cancelled: false, value: "invalid" };

  const clamped = Math.max(0, Math.min(10, num));
  // uma casa decimal pra ficar bonito
  const fixed = Math.round(clamped * 10) / 10;
  return { cancelled: false, value: fixed };
}

async function cinemaMarkWatched(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaItems.find(x => x.id === id);
  if (!item) return alert("Item não encontrado.");

  // ✅ se for série, a ação correta é "próximo episódio"
  if (cinemaIsSeries(item)) {
    return cinemaSeriesMarkNext(id);
  }

  const r = cinemaAskRating("");
  if (r.cancelled) return;
  if (r.value === "invalid") return alert("Nota inválida.");

  try {
    await cinemaRef.doc(id).set({
      status: "watched",
      watchedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rating: (typeof r.value === "number") ? r.value : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    alert("Não consegui marcar como visto agora.");
  }
}

async function cinemaUndoWatched(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const ok = confirm("Voltar esse item para “Quero ver”?");
  if (!ok) return;

  try {
    await cinemaRef.doc(id).set({
      status: "todo",
      watchedAt: null,
      rating: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    alert("Não consegui voltar agora.");
  }
}

async function cinemaEditRating(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaItems.find(x => x.id === id);
  if (!item) return;

  const current = (typeof item.rating === "number") ? item.rating : "";
  const r = cinemaAskRating(current);
  if (r.cancelled) return;
  if (r.value === "invalid") return alert("Nota inválida.");

  try {
    await cinemaRef.doc(id).set({
      rating: (typeof r.value === "number") ? r.value : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    alert("Não consegui atualizar a nota agora.");
  }
}

async function cinemaToggleFav(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaItems.find(x => x.id === id);
  if (!item) return;

  try {
    await cinemaRef.doc(id).set({
      isFav: !item.isFav,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    alert("Não consegui favoritar agora.");
  }
}

async function cinemaDelete(id){
  const user = auth.currentUser;
  if (!user) return alert("Faça login.");

  const item = cinemaItems.find(x => x.id === id);
  const title = item ? (item.title || "este item") : "este item";

  const ok = confirm(`Remover “${title}”?`);
  if (!ok) return;

  try {
    await cinemaRef.doc(id).delete();
    if (cinemaRandomPickId === id) cinemaRandomPickId = null;
  } catch (e) {
    alert("Não consegui remover agora.");
  }
}

function cinemaPickFromTodo(){
  const todo = cinemaItems
    .map(x => ({ ...x, status: x.status || "todo" }))
    .filter(x => x.status === "todo");

  if (!todo.length) return null;

  const idx = Math.floor(Math.random() * todo.length);
  return todo[idx] || null;
}

function cinemaPickRandom(){
  const item = cinemaPickFromTodo();
  const box = document.getElementById("cinemaRandomResult");

  if (!item){
    cinemaRandomPickId = null;
    if (box) box.innerHTML = `<p style="margin:0; opacity:.75;">Nada pra sortear. Sua lista “Quero ver” está vazia 💜</p>`;
    return;
  }

  cinemaRandomPickId = item.id;
  cinemaRenderRandomResult();
}

function cinemaClearRandom(){
  cinemaRandomPickId = null;
  cinemaRenderRandomResult();
}

function cinemaRenderRandomResult(){
  const box = document.getElementById("cinemaRandomResult");
  if (!box) return;

  if (!cinemaRandomPickId){
    box.innerHTML = `<p style="margin:0; opacity:.75;">Clique em “Sortear” pra escolher um filme/série da lista 💜</p>`;
    return;
  }

  const item = cinemaItems.find(x => x.id === cinemaRandomPickId);
  if (!item){
    cinemaRandomPickId = null;
    box.innerHTML = `<p style="margin:0; opacity:.75;">Clique em “Sortear” pra escolher um filme/série da lista 💜</p>`;
    return;
  }

  const title = String(item.title || "—");
  const type = cinemaTypeLabel(item.type || "movie");
  const platform = cinemaPlatformLabel(item.platform || "outro");
  const by = cinemaNome(item.suggestedBy || "ash");
  const fav = !!item.isFav;

  const isSeries = cinemaIsSeries(item);

  const mainAction = isSeries
    ? `<button onclick="cinemaSeriesMarkNext('${item.id}')">✅ Próximo ep</button>`
    : `<button onclick="cinemaMarkWatched('${item.id}')">✅ Marcar visto</button>`;

  const extraSeries = isSeries
    ? `<button class="cinemaGhostBtn" onclick="cinemaSeriesToggleChecklist('${item.id}')">📋 Checklist</button>`
    : "";

  box.innerHTML = `
    <div class="cinemaPickCard">
      <div class="cinemaPickTop">
        <strong class="cinemaPickTitle">🎯 ${title}</strong>
        <div class="cinemaPickBadges">
          <span class="cinemaBadge">${type}</span>
          <span class="cinemaBadge cinemaBadgeSoft">📺 ${platform}</span>
          <span class="cinemaBadge cinemaBadgeSoft">👤 ${by}</span>
        </div>
      </div>

      <div class="cinemaPickActions">
        ${mainAction}
        <button class="${fav ? "cinemaStar" : "cinemaGhostBtn"}" onclick="cinemaToggleFav('${item.id}')">⭐ Favoritar</button>
        ${extraSeries}
        <button class="cinemaGhostBtn" onclick="cinemaPickRandom()">🎲 Sortear de novo</button>
      </div>
    </div>
  `;
}

/* =========================================================
   JOGO DA VELHA (Tempo real com Firestore) - mantido
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
    players: { X: user.email, O: null },
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

  if (tttUnsub) { tttUnsub(); tttUnsub = null; }

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
    if (!s.exists) { tttState = null; tttRender(); return; }
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
  if (tttUnsub) { tttUnsub(); tttUnsub = null; }
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
window.proximoVersiculoBiblia = proximoVersiculoBiblia;
window.anteriorVersiculoBiblia = anteriorVersiculoBiblia;
window.toggleSomBiblia = toggleSomBiblia;

// Cartinhas 💌
window.cartinhasTrocarModoData = cartinhasTrocarModoData;
window.cartinhasEnviar = cartinhasEnviar;
window.cartinhasAbrir = cartinhasAbrir;
window.cartinhasFecharModal = cartinhasFecharModal;
window.cartinhasToggleFav = cartinhasToggleFav;

// Cinema 🎬
window.cinemaInitTela = cinemaInitTela;
window.cinemaSetTab = cinemaSetTab;
window.cinemaAdd = cinemaAdd;
window.cinemaMarkWatched = cinemaMarkWatched;
window.cinemaUndoWatched = cinemaUndoWatched;
window.cinemaEditRating = cinemaEditRating;
window.cinemaToggleFav = cinemaToggleFav;
window.cinemaDelete = cinemaDelete;
window.cinemaPickRandom = cinemaPickRandom;
window.cinemaClearRandom = cinemaClearRandom;
window.cinemaOnTypeChange = cinemaOnTypeChange; // ✅ FIX: existia no HTML

// ✅ séries (checklist)
window.cinemaSeriesToggleChecklist = cinemaSeriesToggleChecklist;
window.cinemaSeriesConfigure = cinemaSeriesConfigure;
window.cinemaSeriesToggleEpisode = cinemaSeriesToggleEpisode;
window.cinemaSeriesMarkSeasonAll = cinemaSeriesMarkSeasonAll;
window.cinemaSeriesMarkNext = cinemaSeriesMarkNext;
window.cinemaSeriesUndoLast = cinemaSeriesUndoLast;

// Jogo da velha
window.tttCriarSala = tttCriarSala;
window.tttEntrarSalaPeloInput = tttEntrarSalaPeloInput;
window.tttSairDaSala = tttSairDaSala;
window.tttReiniciar = tttReiniciar;
window.tttJogar = tttJogar;
