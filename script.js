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
let primeiraCarga = true;

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
    carregarDados();

    setTimeout(() => primeiraCarga = false, 2000);
  } else {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

// ================= DADOS =================
function carregarDados() {
  entradasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    entradas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarEntradas();
    atualizarSaldo();
  });

  saidasRef.orderBy("criadoEm").onSnapshot(snapshot => {
    saidas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarSaidas();
    atualizarSaldo();
  });

  vencimentosRef.orderBy("dia").onSnapshot(snapshot => {
    vencimentos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    atualizarVencimentos();
  });
}

// ================= ADICIONAR =================
function adicionarEntrada() {
  const titulo = prompt("Nome da entrada:");
  const valor = parseFloat(prompt("Valor:"));

  if (!titulo || isNaN(valor)) return;

  entradasRef.add({
    titulo,
    valor,
    usuario: auth.currentUser.email,
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
    usuario: auth.currentUser.email,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function adicionarVencimento() {
  const titulo = prompt("Conta:");
  const valor = parseFloat(prompt("Valor:"));
  const dia = parseInt(prompt("Dia do vencimento (1-31):"));

  if (!titulo || isNaN(valor) || isNaN(dia)) return;

  vencimentosRef.add({
    titulo,
    valor,
    dia,
    pago: false,
    usuario: auth.currentUser.email
  });
}

// ================= LISTAS =================
function atualizarEntradas() {
  const lista = document.getElementById("listaEntradas");
  const total = document.getElementById("totalEntradas");
  lista.innerHTML = "";

  let soma = 0;

  entradas.forEach(e => {
    soma += e.valor;
    lista.innerHTML += `
      <li>
        ${e.titulo} – R$ ${e.valor.toFixed(2)}
        <span>
          <button onclick="editarEntrada('${e.id}')">✏️</button>
          <button onclick="excluirEntrada('${e.id}')">❌</button>
        </span>
      </li>
    `;
  });

  total.textContent = soma.toFixed(2);
}

function atualizarSaidas() {
  const lista = document.getElementById("listaSaidas");
  const total = document.getElementById("totalSaidas");
  lista.innerHTML = "";

  let soma = 0;

  saidas.forEach(s => {
    soma += s.valor;
    lista.innerHTML += `
      <li>
        ${s.titulo} – R$ ${s.valor.toFixed(2)}
        <span>
          <button onclick="editarSaida('${s.id}')">✏️</button>
          <button onclick="excluirSaida('${s.id}')">❌</button>
        </span>
      </li>
    `;
  });

  total.textContent = soma.toFixed(2);
}

function atualizarSaldo() {
  const totalEntradas = entradas.reduce((a, b) => a + b.valor, 0);
  const totalSaidas = saidas.reduce((a, b) => a + b.valor, 0);
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

  vencimentos.forEach(v => {
    let status = "⏳ A vencer";
    let estilo = "";

    if (v.pago) {
      status = "✅ Pago";
      estilo = "text-decoration: line-through; opacity:0.6;";
    } else if (v.dia < hoje) {
      status = "❌ Vencido";
    }

    lista.innerHTML += `
      <li style="${estilo}">
        ${v.titulo} – R$ ${v.valor.toFixed(2)} (dia ${v.dia}) ${status}
        <span>
          <button onclick="marcarPago('${v.id}', ${v.pago})">✔️</button>
          <button onclick="excluirVencimento('${v.id}')">❌</button>
        </span>
      </li>
    `;
  });
}

function marcarPago(id, pagoAtual) {
  vencimentosRef.doc(id).update({ pago: !pagoAtual });
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

// ENTRADAS
entradasRef.onSnapshot(snapshot => {
  if (primeiraCarga) return;

  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      const d = change.doc.data();
      if (d.usuario !== auth.currentUser.email &&
          Notification.permission === "granted") {
        new Notification("💰 Nova entrada", {
          body: `${d.titulo} - R$ ${d.valor.toFixed(2)}`
        });
      }
    }
  });
});

// SAÍDAS
saidasRef.onSnapshot(snapshot => {
  if (primeiraCarga) return;

  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      const d = change.doc.data();
      if (d.usuario !== auth.currentUser.email &&
          Notification.permission === "granted") {
        new Notification("💸 Nova saída", {
          body: `${d.titulo} - R$ ${d.valor.toFixed(2)}`
        });
      }
    }
  });
});
