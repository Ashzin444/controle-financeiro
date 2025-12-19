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

// ================= ESTADO =================
let entradas = [];
let saidas = [];
let vencimentos = JSON.parse(localStorage.getItem("vencimentos")) || [];
let primeiraCarga = true;

// ================= LOGIN =================
function login() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  auth.signInWithEmailAndPassword(email, senha)
    .catch(err => alert("Erro: " + err.message));
}

// ================= AUTH STATE =================
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("app").style.display = "block";

    pedirPermissaoNotificacao();
    carregarDados();
    atualizarVencimentos();

    setInterval(verificarVencimentos, 60000);

    setTimeout(() => primeiraCarga = false, 1500);
  } else {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

// ================= DADOS =================
function salvarVencimentos() {
  localStorage.setItem("vencimentos", JSON.stringify(vencimentos));
}

function carregarDados() {
  entradasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    entradas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    atualizarEntradas();
    atualizarSaldo();
  });

  saidasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    saidas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    atualizarSaidas();
    atualizarSaldo();
  });
}

// ================= ADICIONAR =================
function adicionarEntrada() {
  const titulo = prompt("Nome da entrada:");
  const valor = parseFloat(prompt("Valor:"));

  if (!titulo || isNaN(valor)) return alert("Dados inválidos");

  entradasRef.add({
    titulo,
    valor,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function adicionarSaida() {
  const titulo = prompt("Nome da saída:");
  const valor = parseFloat(prompt("Valor:"));

  if (!titulo || isNaN(valor)) return alert("Dados inválidos");

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

  if (!titulo || isNaN(valor) || isNaN(dia)) {
    alert("Dados inválidos");
    return;
  }

  vencimentos.push({
    titulo,
    valor,
    dia,
    pago: false
  });

  salvarVencimentos();
  atualizarVencimentos();
}

// ================= LISTAS =================
function atualizarEntradas() {
  const lista = document.getElementById("listaEntradas");
  const totalSpan = document.getElementById("totalEntradas");

  lista.innerHTML = "";
  let total = 0;

  entradas.forEach(e => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${e.titulo} – R$ ${e.valor.toFixed(2)}
      <button onclick="editarEntrada('${e.id}')">✏️</button>
      <button onclick="excluirEntrada('${e.id}')">❌</button>
    `;
    lista.appendChild(li);
    total += e.valor;
  });

  totalSpan.textContent = total.toFixed(2);
}

function atualizarSaidas() {
  const lista = document.getElementById("listaSaidas");
  const totalSpan = document.getElementById("totalSaidas");

  lista.innerHTML = "";
  let total = 0;

  saidas.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${s.titulo} – R$ ${s.valor.toFixed(2)}
      <button onclick="editarSaida('${s.id}')">✏️</button>
      <button onclick="excluirSaida('${s.id}')">❌</button>
    `;
    lista.appendChild(li);
    total += s.valor;
  });

  totalSpan.textContent = total.toFixed(2);
}

function atualizarSaldo() {
  const totalEntradas = entradas.reduce((s, e) => s + e.valor, 0);
  const totalSaidas = saidas.reduce((s, e) => s + e.valor, 0);
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

// ================= VENCIMENTOS =================
function atualizarVencimentos() {
  const lista = document.getElementById("listaVencimentos");
  lista.innerHTML = "";

  const hoje = new Date().getDate();

  vencimentos.forEach((v, index) => {
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

    const li = document.createElement("li");
    li.style.color = cor;
    li.style.cssText += estilo;

    li.innerHTML = `
      ${v.titulo} – R$ ${v.valor.toFixed(2)} (dia ${v.dia}) ${status}
      <button onclick="marcarPago(${index})">✔️</button>
      <button onclick="excluirVencimento(${index})">❌</button>
    `;

    lista.appendChild(li);
  });
}

function marcarPago(index) {
  vencimentos[index].pago = !vencimentos[index].pago;
  salvarVencimentos();
  atualizarVencimentos();
}

function excluirVencimento(index) {
  vencimentos.splice(index, 1);
  salvarVencimentos();
  atualizarVencimentos();
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

// ================= NOTIFICAÇÕES REALTIME =================
entradasRef.onSnapshot(snapshot => {
  if (primeiraCarga) return;

  snapshot.docChanges().forEach(change => {
    if (change.type === "added" && Notification.permission === "granted") {
      new Notification("💰 Nova entrada", {
        body: change.doc.data().titulo
      });
    }
  });
});

saidasRef.onSnapshot(snapshot => {
  if (primeiraCarga) return;

  snapshot.docChanges().forEach(change => {
    if (change.type === "added" && Notification.permission === "granted") {
      new Notification("💸 Nova saída", {
        body: change.doc.data().titulo
      });
    }
  });
});
