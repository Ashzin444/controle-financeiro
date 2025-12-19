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

// ================= ESTADO =================
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
  auth.signOut();
}

// ================= NOTIFICAÇÕES =================
//
// IMPORTANTE (MOBILE / iPhone):
// Muitos navegadores bloqueiam notificação que não foi "desbloqueada" por clique do usuário.
// Então criamos um "switch" de ativação e usamos ele como trava.
//
function pedirPermissaoNotificacao() {
  if ("Notification" in window) {
    Notification.requestPermission();
  }
}

// o usuário precisa ativar (via clique) pelo menos 1x
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

// Anti-spam: salva chaves notificadas
function jaNotificado(chave) {
  const k = "notificado_" + chave;
  return localStorage.getItem(k) === "1";
}
function marcarNotificado(chave) {
  const k = "notificado_" + chave;
  localStorage.setItem(k, "1");
}

// Limpa por dia (pra vencimentos não repetirem eternamente)
function keyDiaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// limpeza diária para não acumular keys infinitas
function limparNotificadosAntigos() {
  const hojeKey = keyDiaAtual();
  const ultima = localStorage.getItem("notificados_ultima_limpeza");

  if (ultima === hojeKey) return;

  // remove só os "notificado_*" (mantém o resto)
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("notificado_")) {
      localStorage.removeItem(k);
    }
  }

  localStorage.setItem("notificados_ultima_limpeza", hojeKey);
}

// Teste manual
function testarNotificacao() {
  if (!("Notification" in window)) {
    alert("Seu navegador não suporta notificações.");
    return;
  }

  if (Notification.permission === "granted") {
    // já permite, mas talvez não esteja "ativado"
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

// função central (com trava)
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

    limparNotificadosAntigos(); // <- evita acumular chaves

    // NÃO pede permissão automaticamente (isso é bloqueado em alguns browsers)
    // pedirPermissaoNotificacao();

    // reset flags e listeners
    primeiraCargaEntradas = true;
    primeiraCargaSaidas = true;
    primeiraCargaVencimentos = true;

    iniciarListeners();

    // checar vencimentos ao entrar + a cada 60s enquanto app aberto
    verificarVencimentos(true);
    if (vencimentosInterval) clearInterval(vencimentosInterval);
    vencimentosInterval = setInterval(() => verificarVencimentos(false), 60000);

    // registrar SW
    registrarServiceWorker();
  } else {
    pararListeners();
    if (vencimentosInterval) clearInterval(vencimentosInterval);
    vencimentosInterval = null;

    mostrarLogin();
  }
});

// ================= SERVICE WORKER REGISTER =================
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./service-worker.js")
    .catch(err => console.log("Erro SW:", err));
}

// ================= LISTENERS FIRESTORE (sem duplicar) =================
function iniciarListeners() {
  const user = auth.currentUser;
  if (!user) return;

  pararListeners(); // garante que não duplica

  unsubscribeEntradas = entradasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    entradas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarEntradas();
    atualizarSaldo();

    if (!primeiraCargaEntradas) {
      snapshot.docChanges().forEach(change => {
        const d = change.doc.data();
        if (!d) return;

        const meuEmail = auth.currentUser?.email;
        if (!meuEmail) return;

        if (d.usuario && d.usuario !== meuEmail) {
          if (change.type === "added") {
            notificarUmaVez(
              `entrada_added_${change.doc.id}`,
              "💰 Nova entrada",
              `${d.titulo} - R$ ${Number(d.valor).toFixed(2)}`
            );
          } else if (change.type === "modified") {
            notificarUmaVez(
              `entrada_modified_${change.doc.id}_${keyDiaAtual()}`,
              "✏️ Entrada atualizada",
              `${d.titulo} - R$ ${Number(d.valor).toFixed(2)}`
            );
          } else if (change.type === "removed") {
            notificarUmaVez(
              `entrada_removed_${change.doc.id}_${keyDiaAtual()}`,
              "🗑️ Entrada removida",
              "Uma entrada foi excluída"
            );
          }
        }
      });
    }

    primeiraCargaEntradas = false;
  });

  unsubscribeSaidas = saidasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    saidas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarSaidas();
    atualizarSaldo();

    if (!primeiraCargaSaidas) {
      snapshot.docChanges().forEach(change => {
        const d = change.doc.data();
        if (!d) return;

        const meuEmail = auth.currentUser?.email;
        if (!meuEmail) return;

        if (d.usuario && d.usuario !== meuEmail) {
          if (change.type === "added") {
            notificarUmaVez(
              `saida_added_${change.doc.id}`,
              "💸 Nova saída",
              `${d.titulo} - R$ ${Number(d.valor).toFixed(2)}`
            );
          } else if (change.type === "modified") {
            notificarUmaVez(
              `saida_modified_${change.doc.id}_${keyDiaAtual()}`,
              "✏️ Saída atualizada",
              `${d.titulo} - R$ ${Number(d.valor).toFixed(2)}`
            );
          } else if (change.type === "removed") {
            notificarUmaVez(
              `saida_removed_${change.doc.id}_${keyDiaAtual()}`,
              "🗑️ Saída removida",
              "Uma saída foi excluída"
            );
          }
        }
      });
    }

    primeiraCargaSaidas = false;
  });

  unsubscribeVencimentos = vencimentosRef.orderBy("dia").onSnapshot(snapshot => {
    vencimentos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarVencimentos();

    if (!primeiraCargaVencimentos) {
      snapshot.docChanges().forEach(change => {
        const d = change.doc.data();
        if (!d) return;

        const meuEmail = auth.currentUser?.email;
        if (!meuEmail) return;

        if (d.usuario && d.usuario !== meuEmail) {
          if (change.type === "added") {
            notificarUmaVez(
              `venc_added_${change.doc.id}`,
              "📅 Novo vencimento",
              `${d.titulo} (dia ${d.dia}) - R$ ${Number(d.valor).toFixed(2)}`
            );
          } else if (change.type === "modified") {
            const status = d.pago ? "Pago ✅" : "Atualizado ✏️";
            notificarUmaVez(
              `venc_modified_${change.doc.id}_${keyDiaAtual()}`,
              `📅 Vencimento ${status}`,
              `${d.titulo} (dia ${d.dia})`
            );
          } else if (change.type === "removed") {
            notificarUmaVez(
              `venc_removed_${change.doc.id}_${keyDiaAtual()}`,
              "🗑️ Vencimento removido",
              "Um vencimento foi excluído"
            );
          }
        }
      });
    }

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

// ================= ADICIONAR =================
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
    usuario: user.email
  });
}

// ================= LISTAS =================
function atualizarEntradas() {
  const lista = document.getElementById("listaEntradas");
  const total = document.getElementById("totalEntradas");
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
  const totalEntradas = entradas.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
  const totalSaidas = saidas.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);

  document.getElementById("saldoFinal").textContent =
    (totalEntradas - totalSaidas).toFixed(2);
}

// ================= EDITAR / EXCLUIR =================
function excluirEntrada(id) {
  entradasRef.doc(id).delete();
}

function excluirSaida(id) {
  saidasRef.doc(id).delete();
}

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

// ================= VENCIMENTOS =================
function atualizarVencimentos() {
  const lista = document.getElementById("listaVencimentos");
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

// ================= NOTIFICAÇÃO DE VENCIMENTO (app aberto) =================
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
