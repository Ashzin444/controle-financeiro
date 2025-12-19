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

// ================= ESTRUTURA DA CASA =================
const CASA_ID = "casa_principal";
const casaRef = db.collection("casas").doc(CASA_ID);

const entradasRef = casaRef.collection("entradas");
const saidasRef = casaRef.collection("saidas");
const vencimentosRef = casaRef.collection("vencimentos");

// ================= ESTADO =================
let entradas = [];
let saidas = [];
let vencimentos = [];

let entradasCarregadas = false;
let saidasCarregadas = false;
let vencimentosCarregados = false;

let ignorarPrimeiraCarga = true;

// ================= LOGIN =================
function login() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  auth.signInWithEmailAndPassword(email, senha)
    .catch(err => alert("Erro: " + err.message));
}

// ================= AUTH =================
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("app").style.display = "block";

    pedirPermissaoNotificacao();
    carregarTudo();

    setTimeout(() => ignorarPrimeiraCarga = false, 2000);
    setInterval(verificarVencimentos, 60000);
  } else {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

// ================= CARREGAR DADOS =================
function carregarTudo() {
  entradasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    entradas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    entradasCarregadas = true;
    atualizarEntradas();
    atualizarSaldoSeguro();
    notificarMudancas(snapshot, "💰 Entrada atualizada");
  });

  saidasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    saidas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    saidasCarregadas = true;
    atualizarSaidas();
    atualizarSaldoSeguro();
    notificarMudancas(snapshot, "💸 Saída atualizada");
  });

  vencimentosRef.orderBy("dia").onSnapshot(snapshot => {
    vencimentos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    vencimentosCarregados = true;
    atualizarVencimentos();
    notificarMudancas(snapshot, "📅 Vencimento alterado");
  });
}

function atualizarSaldoSeguro() {
  if (!entradasCarregadas || !saidasCarregadas) return;
  atualizarSaldo();
}

// ================= ADICIONAR =================
function adicionarEntrada() {
  const titulo = prompt("Nome da entrada:");
  const valor = parseFloat(prompt("Valor:"));
  if (!titulo || isNaN(valor)) return;

  entradasRef.add({
    titulo,
    valor,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function adicionarSaida() {
  const titulo = prompt("Nome da saída:");
  const valor = parseFloat(prompt("Valor:"));
  if (!titulo || isNaN(valor)) return;

  saidasRef.add({
    titulo,
    valor,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function adicionarVencimento() {
  const titulo = prompt("Nome da conta:");
  const valor = parseFloat(prompt("Valor:"));
  const dia = parseInt(prompt("Dia do vencimento (1-31):"));

  if (!titulo || isNaN(valor) || isNaN(dia)) return;

  vencimentosRef.add({
    titulo,
    valor,
    dia,
    pago: false
  });
}

// ================= LISTAS =================
function atualizarEntradas() {
  const lista = document.getElementById("listaEntradas");
  const totalSpan = document.getElementById("totalEntradas");
  lista.innerHTML = "";

  let total = 0;
  entradas.forEach(e => {
    total += e.valor;
    lista.innerHTML += `
      <li>${e.titulo} – R$ ${e.valor.toFixed(2)}
      <button onclick="editarEntrada('${e.id}')">✏️</button>
      <button onclick="excluirEntrada('${e.id}')">❌</button></li>
    `;
  });

  totalSpan.textContent = total.toFixed(2);
}

function atualizarSaidas() {
  const lista = document.getElementById("listaSaidas");
  const totalSpan = document.getElementById("totalSaidas");
  lista.innerHTML = "";

  let total = 0;
  saidas.forEach(s => {
    total += s.valor;
    lista.innerHTML += `
      <li>${s.titulo} – R$ ${s.valor.toFixed(2)}
      <button onclick="editarSaida('${s.id}')">✏️</button>
      <button onclick="excluirSaida('${s.id}')">❌</button></li>
    `;
  });

  totalSpan.textContent = total.toFixed(2);
}

function atualizarSaldo() {
  const entradasTotal = entradas.reduce((s, e) => s + e.valor, 0);
  const saidasTotal = saidas.reduce((s, e) => s + e.valor, 0);
  document.getElementById("saldoFinal").textContent =
    (entradasTotal - saidasTotal).toFixed(2);
}

// ================= EDITAR / EXCLUIR =================
function editarEntrada(id) {
  const e = entradas.find(x => x.id === id);
  const titulo = prompt("Editar nome:", e.titulo);
  const valor = parseFloat(prompt("Editar valor:", e.valor));
  if (!titulo || isNaN(valor)) return;
  entradasRef.doc(id).update({ titulo, valor });
}

function editarSaida(id) {
  const s = saidas.find(x => x.id === id);
  const titulo = prompt("Editar nome:", s.titulo);
  const valor = parseFloat(prompt("Editar valor:", s.valor));
  if (!titulo || isNaN(valor)) return;
  saidasRef.doc(id).update({ titulo, valor });
}

function excluirEntrada(id) { entradasRef.doc(id).delete(); }
function excluirSaida(id) { saidasRef.doc(id).delete(); }

// ================= VENCIMENTOS =================
function atualizarVencimentos() {
  const lista = document.getElementById("listaVencimentos");
  lista.innerHTML = "";
  const hoje = new Date().getDate();

  vencimentos.forEach(v => {
    let status = "⏳ A vencer";
    let cor = "#999";
    let estilo = "";

    if (v.pago) {
      status = "✅ Pago";
      cor = "#4CAF50";
      estilo = "text-decoration: line-through; opacity:0.7;";
    } else if (v.dia < hoje) {
      status = "❌ Vencido";
      cor = "#ff4d4d";
    } else if (v.dia - hoje <= 3) {
      status = "⚠️ Vence em breve";
      cor = "#ffcc00";
    }

    lista.innerHTML += `
      <li style="color:${cor};${estilo}">
        ${v.titulo} – R$ ${v.valor.toFixed(2)} (dia ${v.dia}) ${status}
        <button onclick="marcarPago('${v.id}', ${!v.pago})">✔️</button>
        <button onclick="excluirVencimento('${v.id}')">❌</button>
      </li>
    `;
  });
}

function marcarPago(id, estado) {
  vencimentosRef.doc(id).update({ pago: estado });
}

function excluirVencimento(id) {
  vencimentosRef.doc(id).delete();
}

// ================= NOTIFICAÇÕES =================
function pedirPermissaoNotificacao() {
  if ("Notification" in window) {
    Notification.requestPermission();
  }
}

function verificarVencimentos() {
  const hoje = new Date().getDate();

  vencimentos.forEach(v => {
    if (!v.pago && v.dia - hoje === 1 && Notification.permission === "granted") {
      new Notification("📅 Conta vence amanhã", {
        body: `${v.titulo} - R$ ${v.valor.toFixed(2)}`
      });
    }
  });
}

function notificarMudancas(snapshot, titulo) {
  if (ignorarPrimeiraCarga) return;

  snapshot.docChanges().forEach(change => {
    if (change.type !== "added") return;
    if (Notification.permission !== "granted") return;

    new Notification(titulo, {
      body: change.doc.data().titulo
    });
  });
}
