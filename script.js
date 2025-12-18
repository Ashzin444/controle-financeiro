let entradas = JSON.parse(localStorage.getItem("entradas")) || [];
let saidas = JSON.parse(localStorage.getItem("saidas")) || [];

atualizarTudo();

function adicionarEntrada() {
    const titulo = prompt("Digite o nome da entrada (ex: Salário):");
    const valor = prompt("Digite o valor:");

    if (!titulo || !valor) {
        alert("Preencha todos os campos");
        return;
    }

    entradas.push({
        titulo: titulo,
        valor: parseFloat(valor)
    });

    salvarDados();
    atualizarTudo();
}

function adicionarSaida() {
    const titulo = prompt("Digite o nome da saída (ex: Aluguel):");
    const valor = prompt("Digite o valor:");

    if (!titulo || !valor) {
        alert("Preencha todos os campos");
        return;
    }

    saidas.push({
        titulo: titulo,
        valor: parseFloat(valor)
    });

    salvarDados();
    atualizarTudo();
}

function salvarDados() {
    localStorage.setItem("entradas", JSON.stringify(entradas));
    localStorage.setItem("saidas", JSON.stringify(saidas));
}

function atualizarTudo() {
    atualizarEntradas();
    atualizarSaidas();
    atualizarSaldo();
}

function atualizarEntradas() {
    const lista = document.getElementById("listaEntradas");
    const totalSpan = document.getElementById("totalEntradas");

    lista.innerHTML = "";
    let total = 0;

    entradas.forEach((entrada, index) => {
        const li = document.createElement("li");

        li.innerHTML = `
    ${entrada.titulo} – R$ ${entrada.valor.toFixed(2)}
    <button onclick="editarEntrada(${index})">✏️</button>
    <button onclick="excluirEntrada(${index})">❌</button>
`;

        lista.appendChild(li);
        total += entrada.valor;
    });

    totalSpan.textContent = total.toFixed(2);
}

function atualizarSaidas() {
    const lista = document.getElementById("listaSaidas");
    const totalSpan = document.getElementById("totalSaidas");

    lista.innerHTML = "";
    let total = 0;

    saidas.forEach((saida, index) => {
        const li = document.createElement("li");

        li.innerHTML = `
    ${saida.titulo} – R$ ${saida.valor.toFixed(2)}
    <button onclick="editarSaida(${index})">✏️</button>
    <button onclick="excluirSaida(${index})">❌</button>
`;

        lista.appendChild(li);
        total += saida.valor;
    });

    totalSpan.textContent = total.toFixed(2);
}

function atualizarSaldo() {
    const totalEntradas = entradas.reduce((soma, e) => soma + e.valor, 0);
    const totalSaidas = saidas.reduce((soma, s) => soma + s.valor, 0);
    const saldo = totalEntradas - totalSaidas;

    document.getElementById("saldoFinal").textContent = saldo.toFixed(2);
}

function excluirEntrada(index) {
    const lista = document.getElementById("listaEntradas");
    const item = lista.children[index];

    item.style.animation = "fadeOut 0.3s ease forwards";

    setTimeout(() => {
        entradas.splice(index, 1);
        salvarDados();
        atualizarTudo();
    }, 300);
}

function excluirSaida(index) {
    const lista = document.getElementById("listaSaidas");
    const item = lista.children[index];

    item.style.animation = "fadeOut 0.3s ease forwards";

    setTimeout(() => {
        saidas.splice(index, 1);
        salvarDados();
        atualizarTudo();
    }, 300);
}

function editarEntrada(index) {
    const novoTitulo = prompt(
        "Editar nome da entrada:",
        entradas[index].titulo
    );

    if (novoTitulo === null) return;

    const novoValor = prompt(
        "Editar valor:",
        entradas[index].valor
    );

    if (novoValor === null || isNaN(novoValor)) {
        alert("Valor inválido");
        return;
    }

    entradas[index].titulo = novoTitulo;
    entradas[index].valor = parseFloat(novoValor);

    salvarDados();
    atualizarTudo();
}

function editarSaida(index) {
    const novoTitulo = prompt(
        "Editar nome da saída:",
        saidas[index].titulo
    );

    if (novoTitulo === null) return;

    const novoValor = prompt(
        "Editar valor:",
        saidas[index].valor
    );

    if (novoValor === null || isNaN(novoValor)) {
        alert("Valor inválido");
        return;
    }

    saidas[index].titulo = novoTitulo;
    saidas[index].valor = parseFloat(novoValor);

    salvarDados();
    atualizarTudo();
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("Service Worker registrado"))
        .catch(err => console.log("Erro SW:", err));
}





