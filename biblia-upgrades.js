/* =========================================================
   BÍBLIA UPGRADES — ITENS: 1, 2, 3, 4, 8, 10
   - NÃO mexe no resto do app
   - Depende do seu script.js já carregado (firebase/auth/db refs e funções da bíblia)
========================================================= */

(function () {
  "use strict";

  // ---------- Helpers DOM ----------
  const $ = (id) => document.getElementById(id);

  function safeText(el, txt) {
    if (!el) return;
    el.textContent = txt ?? "";
  }

  function clamp(n, a, b) {
    const x = Number(n);
    if (!Number.isFinite(x)) return a;
    return Math.max(a, Math.min(b, x));
  }

  // ---------- Storage ----------
  const THEME_KEY = "biblia_theme_mode"; // "parchment" | "night"
  const PAPER_KEY = "biblia_papel";      // seu app usa "eu" | "ela"

  function getTheme() {
    const v = localStorage.getItem(THEME_KEY);
    return (v === "night" || v === "parchment") ? v : "parchment";
  }
  function setTheme(v) {
    localStorage.setItem(THEME_KEY, v);
  }

  // Regra do seu app:
  // biblia_papel "eu" = Ash, "ela" = Deh
  function papelToPessoa(papel) {
    return (papel === "ela") ? "Deh" : "Ash";
  }
  function pessoaToPapel(pessoa) {
    return (pessoa === "deh") ? "ela" : "eu";
  }

  // ---------- CSS Tema Bíblico (somente na tela da Bíblia) ----------
  function injectBibleExclusiveCSS() {
    const id = "bibliaUpgradesCss";
    if (document.getElementById(id)) return;

    const st = document.createElement("style");
    st.id = id;

    st.textContent = `
/* ===== Tema exclusivo da Bíblia (apenas #telaBiblia) ===== */
#telaBiblia.bibThemeParchment .bibleBookStage{
  position: relative;
  padding-bottom: 18px;
  background:
    radial-gradient(1200px 700px at 25% 10%, rgba(255,240,200,0.35), transparent 55%),
    radial-gradient(900px 600px at 80% 0%, rgba(255,230,170,0.24), transparent 60%),
    linear-gradient(180deg, rgba(255,247,226,0.14), rgba(0,0,0,0));
}

#telaBiblia.bibThemeNight .bibleBookStage{
  position: relative;
  padding-bottom: 18px;
  background:
    radial-gradient(1200px 700px at 20% 10%, rgba(120,90,255,0.22), transparent 55%),
    radial-gradient(900px 600px at 80% 0%, rgba(255,160,90,0.10), transparent 60%),
    linear-gradient(180deg, rgba(10,10,18,0.20), rgba(0,0,0,0));
}

#telaBiblia.bibThemeParchment .biblePaper{
  border: 1px solid rgba(120, 90, 40, 0.22);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.50)),
    radial-gradient(900px 500px at 20% 0%, rgba(255,230,170,0.42), transparent 65%),
    radial-gradient(900px 500px at 80% 0%, rgba(255,210,140,0.25), transparent 65%);
  box-shadow:
    0 20px 80px rgba(0,0,0,0.30),
    inset 0 0 0 1px rgba(255,255,255,0.10);
}

#telaBiblia.bibThemeNight .biblePaper{
  border: 1px solid rgba(255,255,255,0.10);
  background:
    linear-gradient(180deg, rgba(30,32,46,0.72), rgba(18,18,28,0.66)),
    radial-gradient(900px 500px at 20% 0%, rgba(255,180,90,0.12), transparent 65%),
    radial-gradient(900px 500px at 80% 0%, rgba(120,90,255,0.14), transparent 65%);
  box-shadow:
    0 20px 90px rgba(0,0,0,0.48),
    inset 0 0 0 1px rgba(255,255,255,0.06);
}

#telaBiblia.bibThemeParchment .bibleBookTitle,
#telaBiblia.bibThemeParchment .bibleRefValue{
  color: rgba(40, 28, 8, 0.98);
  text-shadow: 0 1px 0 rgba(255,255,255,0.45);
}

#telaBiblia.bibThemeNight .bibleBookTitle,
#telaBiblia.bibThemeNight .bibleRefValue{
  color: rgba(255,255,255,0.94);
  text-shadow: 0 2px 18px rgba(0,0,0,0.55);
}

#telaBiblia.bibThemeParchment .bibleRefLabel,
#telaBiblia.bibThemeParchment .bibleDisclaimer{
  color: rgba(52, 38, 16, 0.78);
}

#telaBiblia.bibThemeNight .bibleRefLabel,
#telaBiblia.bibThemeNight .bibleDisclaimer{
  color: rgba(255,255,255,0.76);
}

#telaBiblia.bibThemeParchment .bibleDayPill{
  background: rgba(255, 235, 190, 0.45) !important;
  border: 1px solid rgba(140, 100, 40, 0.22) !important;
  color: rgba(44, 28, 10, 0.92) !important;
}

#telaBiblia.bibThemeNight .bibleDayPill{
  background: rgba(0,0,0,0.22) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: rgba(255,255,255,0.92) !important;
}

/* Modal de papel (Ash/Deh) */
#bibRoleModal{
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
  place-items: center;
}
#bibRoleBackdrop{
  position:absolute;
  inset:0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
}
#bibRoleCard{
  position: relative;
  width: min(520px, calc(100vw - 26px));
  border-radius: 16px;
  padding: 14px;
  background: rgba(255,255,255,0.90);
  box-shadow: 0 20px 90px rgba(0,0,0,0.55);
  border: 1px solid rgba(0,0,0,0.08);
}
#telaBiblia.bibThemeNight #bibRoleCard{
  background: rgba(22,22,30,0.92);
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.92);
}
#telaBiblia.bibThemeNight #bibRoleCard p{
  color: rgba(255,255,255,0.78) !important;
}

/* Histórico (calendar view) */
.bibHistoryWrap{
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.bibDayBtn{
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 10px 6px;
  min-height: 62px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.92);
  cursor: pointer;
  transition: transform .12s ease, opacity .12s ease;
}
#telaBiblia.bibThemeParchment .bibDayBtn{
  background: rgba(255,255,255,0.55);
  color: rgba(32,22,8,0.92);
  border: 1px solid rgba(120,90,40,0.22);
}
.bibDayBtn:hover{ transform: translateY(-1px); }
.bibDayNum{ font-weight: 800; font-size: 14px; }
.bibDayMeta{ margin-top: 4px; font-size: 11px; opacity: .86; line-height: 1.1; }
.bibDayState{ margin-top: 5px; font-size: 12px; font-weight: 700; opacity: .95; }

.bibDayBtn.today{
  outline: 2px solid rgba(255, 214, 120, 0.85);
  outline-offset: 2px;
}
.bibDayBtn.selected{
  outline: 2px solid rgba(120, 200, 255, 0.95);
  outline-offset: 2px;
}

.bibStateBoth{ color: rgba(90, 255, 170, 0.95); }
#telaBiblia.bibThemeParchment .bibStateBoth{ color: rgba(20, 120, 70, 0.95); }

.bibStateOne{ color: rgba(255, 210, 120, 0.95); }
#telaBiblia.bibThemeParchment .bibStateOne{ color: rgba(160, 95, 18, 0.95); }

.bibStateNone{ color: rgba(255, 140, 140, 0.92); }
#telaBiblia.bibThemeParchment .bibStateNone{ color: rgba(150, 45, 45, 0.92); }
    `;

    document.head.appendChild(st);
  }

  function applyThemeToBibleScreen() {
    const tela = $("telaBiblia");
    if (!tela) return;

    tela.classList.remove("bibThemeParchment", "bibThemeNight");

    const mode = getTheme();
    tela.classList.add(mode === "night" ? "bibThemeNight" : "bibThemeParchment");
  }

  // ---------- Item 1: Abrir no app (YouVersion via bible.com search) ----------
  function normalizeRef(ref) {
    return String(ref || "").trim().replace(/\s+/g, " ");
  }

  function bibliaAbrirNoApp() {
    const ref = normalizeRef(($("bibRef")?.textContent || ""));
    if (!ref) return alert("Referência ainda não carregou 🙂");

    // Bible.com (YouVersion) - search
    const url = "https://www.bible.com/search/bible?q=" + encodeURIComponent(ref);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ---------- Item 4: Controle de papel com modal ----------
  function bibliaAbrirPapelModal() {
    const modal = $("bibRoleModal");
    if (!modal) return;
    modal.style.display = "grid";
  }

  function bibliaFecharPapelModal() {
    const modal = $("bibRoleModal");
    if (!modal) return;
    modal.style.display = "none";
  }

  function bibliaDefinirPapel(pessoa) {
    // pessoa: "ash" | "deh"
    const v = (pessoa === "deh") ? "ela" : "eu"; // regra do seu app
    localStorage.setItem(PAPER_KEY, v);

    bibliaFecharPapelModal();

    // Atualiza a tela sem mudar nada fora da Bíblia
    // Se existir carregarBibliaAtual, chama.
    if (typeof window.carregarBibliaAtual === "function") {
      window.carregarBibliaAtual(true).catch(() => {});
    }
  }

  function ensureBackdropModalClose() {
    const b = $("bibRoleBackdrop");
    if (!b) return;
    if (b.dataset.bound === "1") return;
    b.addEventListener("click", bibliaFecharPapelModal);
    b.dataset.bound = "1";
  }

  function ensureRoleSelectedOrAsk() {
    const papel = localStorage.getItem(PAPER_KEY);
    if (papel === "eu" || papel === "ela") return;
    // Se não tem, abre o modal (sem confirm)
    bibliaAbrirPapelModal();
  }

  // ---------- Item 2 + 3 + 10: Histórico, consistência, streak, meta 7 juntos e dicas ----------
  // Vamos trabalhar por "dayIndex" que no seu app é o currentIndex (docId v{n})
  // Analisamos a janela de 30 dias (últimos 30 índices)
  const WINDOW_DAYS = 30;
  const META_JUNTOS = 7;

  async function getCurrentIndexSafe() {
    // precisa do bibliaEstadoRef e db do seu script.js
    if (!window.bibliaEstadoRef) return 1;
    try {
      const snap = await window.bibliaEstadoRef.get();
      const data = snap.exists ? (snap.data() || {}) : {};
      const idx = clamp(Number(data.currentIndex) || 1, 1, 999999);
      return idx;
    } catch (e) {
      return 1;
    }
  }

  async function fetchWindowDocs(fromIdx, toIdx) {
    // retorna array [{ idx, data }]
    const out = [];
    if (!window.bibliaLeiturasRef) return out;

    const promises = [];
    for (let i = fromIdx; i <= toIdx; i++) {
      const ref = window.bibliaLeiturasRef.doc("v" + i);
      promises.push(ref.get().then(s => ({ idx: i, data: s.exists ? (s.data() || {}) : {} })).catch(() => ({ idx: i, data: {} })));
    }
    const arr = await Promise.all(promises);
    arr.sort((a, b) => a.idx - b.idx);
    return arr;
  }

  function getPapel() {
    const p = localStorage.getItem(PAPER_KEY);
    if (p === "ela" || p === "eu") return p;
    return "eu";
  }

  function otherPapel(p) {
    return p === "eu" ? "ela" : "eu";
  }

  function countStreak(docsDesc, predicate) {
    let s = 0;
    for (const it of docsDesc) {
      if (predicate(it)) s++;
      else break;
    }
    return s;
  }

  function fmtPct(a, b) {
    if (b <= 0) return "0%";
    const p = Math.round((a / b) * 100);
    return `${p}%`;
  }

  function buildHintLine(mePapel, todayData) {
    const euLido = !!todayData.euLido;
    const elaLido = !!todayData.elaLido;

    // Quem é "você" nesse aparelho?
    const meName = papelToPessoa(mePapel);
    const otherName = papelToPessoa(otherPapel(mePapel));

    const meLido = (mePapel === "eu") ? euLido : elaLido;
    const otherLido = (mePapel === "eu") ? elaLido : euLido;

    if (meLido && otherLido) return "✅ Os dois já assinaram hoje. Lindo demais 💜";
    if (meLido && !otherLido) return `💜 ${meName} já assinou hoje. Falta só ${otherName} pra completar.`;
    if (!meLido && otherLido) return `✨ ${otherName} já assinou hoje. Sua vez, ${meName} 🙂`;
    return "📌 Dica: assina a leitura quando terminar — e fecha o dia quando os dois assinarem 💜";
  }

  function renderStatsAndMeta({ mePct, otherPct, juntosPct, meStreak, juntosStreak }) {
    const statsEl = $("bibStatsLine");
    const medal = $("bibStreakMedal");

    // Linha de stats + meta
    const metaProgress = Math.min(META_JUNTOS, juntosStreak);
    const metaLine = `🎯 Meta ${META_JUNTOS} juntos: ${metaProgress}/${META_JUNTOS}`;

    const line =
      `Consistência (${WINDOW_DAYS}d): você ${mePct} • outro ${otherPct} • juntos ${juntosPct}  |  ` +
      `🔥 Streak você ${meStreak} • juntos ${juntosStreak}  |  ${metaLine}`;

    safeText(statsEl, line);

    if (medal) {
      medal.style.display = (juntosStreak >= META_JUNTOS) ? "inline-flex" : "none";
    }
  }

  function renderHints(mePapel, todayData) {
    safeText($("bibHintLine"), buildHintLine(mePapel, todayData));
  }

  function statusLabel(euLido, elaLido) {
    if (euLido && elaLido) return { txt: "✅ Os dois", cls: "bibStateBoth" };
    if (euLido || elaLido) return { txt: "🟡 1/2", cls: "bibStateOne" };
    return { txt: "⏳ Pendente", cls: "bibStateNone" };
  }

  async function bibliaIrParaDia(idx) {
    // Muda o "dia/versículo atual" compartilhado (mesma ideia do seu próximo/anterior)
    // Para garantir consistência pros dois.
    const user = window.auth?.currentUser;
    if (!user) return alert("Faça login.");

    if (!window.db || !window.bibliaEstadoRef) return;

    const target = clamp(idx, 1, 999999);

    try {
      await window.db.runTransaction(async (tx) => {
        const snap = await tx.get(window.bibliaEstadoRef);
        if (!snap.exists) {
          tx.set(window.bibliaEstadoRef, {
            currentIndex: target,
            createdAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
            updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
            updatedBy: user.email || ""
          }, { merge: true });
          return;
        }

        tx.set(window.bibliaEstadoRef, {
          currentIndex: target,
          updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
          updatedBy: user.email || ""
        }, { merge: true });
      });

      // carregarBibliaAtual já vai ser chamado pelo listener do estado global
      // mas chamamos também pra não depender do timing
      if (typeof window.carregarBibliaAtual === "function") {
        window.carregarBibliaAtual(true).catch(() => {});
      }
    } catch (e) {
      alert("Não consegui abrir esse dia agora.");
    }
  }

  async function bibliaVoltarParaHoje() {
    const idx = await getCurrentIndexSafe();
    await bibliaIrParaDia(idx);
  }

  async function renderHistoryGrid(currentIndex, windowDocs) {
    const grid = $("bibHistoryGrid");
    if (!grid) return;

    const fromIdx = currentIndex - (WINDOW_DAYS - 1);
    const start = Math.max(1, fromIdx);

    const wrap = document.createElement("div");
    wrap.className = "bibHistoryWrap";

    const meP = getPapel();

    // Preenche os "vazios" pra ficar 30 sempre (quando index < 30)
    const totalCells = WINDOW_DAYS;
    const missing = Math.max(0, totalCells - (currentIndex - start + 1));

    for (let i = 0; i < missing; i++) {
      const ph = document.createElement("div");
      ph.style.opacity = "0.35";
      ph.style.border = "1px dashed rgba(255,255,255,0.18)";
      ph.style.borderRadius = "12px";
      ph.style.minHeight = "62px";
      wrap.appendChild(ph);
    }

    // Cria botões do histórico
    const map = new Map(windowDocs.map(x => [x.idx, x.data]));

    for (let idx = start; idx <= currentIndex; idx++) {
      const data = map.get(idx) || {};
      const euLido = !!data.euLido;
      const elaLido = !!data.elaLido;

      const st = statusLabel(euLido, elaLido);
      const btn = document.createElement("button");
      btn.className = "bibDayBtn";
      btn.type = "button";

      // marca "selected" = o dia atual
      btn.classList.toggle("selected", idx === currentIndex);

      // "today": o dia atual (mesmo conceito)
      btn.classList.toggle("today", idx === currentIndex);

      btn.innerHTML = `
        <div class="bibDayNum">Dia ${idx}</div>
        <div class="bibDayMeta">${papelToPessoa(meP)} / ${papelToPessoa(otherPapel(meP))}</div>
        <div class="bibDayState ${st.cls}">${st.txt}</div>
      `;

      btn.addEventListener("click", () => {
        bibliaIrParaDia(idx);
      });

      wrap.appendChild(btn);
    }

    grid.innerHTML = "";
    grid.appendChild(wrap);
  }

  async function updateBibleExtras() {
    // Só roda se existir tela Bíblia
    if (!$("telaBiblia")) return;

    ensureRoleSelectedOrAsk();

    const currentIndex = await getCurrentIndexSafe();
    const fromIdx = Math.max(1, currentIndex - (WINDOW_DAYS - 1));
    const docs = await fetchWindowDocs(fromIdx, currentIndex);

    // Stats
    const mePapel = getPapel();
    const otherP = otherPapel(mePapel);

    let meDone = 0, otherDone = 0, juntosDone = 0;

    docs.forEach(it => {
      const d = it.data || {};
      const euLido = !!d.euLido;
      const elaLido = !!d.elaLido;

      const meLido = (mePapel === "eu") ? euLido : elaLido;
      const otherLido = (otherP === "eu") ? euLido : elaLido;

      if (meLido) meDone++;
      if (otherLido) otherDone++;
      if (euLido && elaLido) juntosDone++;
    });

    const total = docs.length || 0;

    // Streaks (descendente)
    const docsDesc = docs.slice().sort((a, b) => b.idx - a.idx);
    const meStreak = countStreak(docsDesc, (it) => {
      const d = it.data || {};
      return (mePapel === "eu") ? !!d.euLido : !!d.elaLido;
    });
    const juntosStreak = countStreak(docsDesc, (it) => {
      const d = it.data || {};
      return !!d.euLido && !!d.elaLido;
    });

    renderStatsAndMeta({
      mePct: fmtPct(meDone, total),
      otherPct: fmtPct(otherDone, total),
      juntosPct: fmtPct(juntosDone, total),
      meStreak,
      juntosStreak
    });

    // Hint (usa o doc "hoje" = currentIndex)
    const today = docsDesc.find(x => x.idx === currentIndex) || docsDesc[0] || { data: {} };
    renderHints(mePapel, today.data || {});

    // History calendar
    await renderHistoryGrid(currentIndex, docs);
  }

  // ---------- Item 8: Toggle Tema ----------
  function bibliaToggleTema() {
    const cur = getTheme();
    const next = (cur === "night") ? "parchment" : "night";
    setTheme(next);
    applyThemeToBibleScreen();
  }

  // ---------- Hooks: após carregar a Bíblia e após marcar leitura ----------
  function patchBibleFunctions() {
    // Patch carregarBibliaAtual para aplicar tema e atualizar extras
    if (typeof window.carregarBibliaAtual === "function" && !window.carregarBibliaAtual.__patched_upgrades__) {
      const original = window.carregarBibliaAtual;
      const patched = async function (...args) {
        const res = await original.apply(this, args);
        // sempre aplica tema e atualiza extras depois que a UI principal renderizar
        injectBibleExclusiveCSS();
        applyThemeToBibleScreen();
        ensureBackdropModalClose();
        await updateBibleExtras().catch(() => {});
        return res;
      };
      patched.__patched_upgrades__ = true;
      window.carregarBibliaAtual = patched;
    }

    // Patch marcarLeituraBiblia para atualizar extras depois de salvar
    if (typeof window.marcarLeituraBiblia === "function" && !window.marcarLeituraBiblia.__patched_upgrades__) {
      const original = window.marcarLeituraBiblia;
      const patched = async function (...args) {
        const res = await original.apply(this, args);
        // atualiza extras após salvar
        await updateBibleExtras().catch(() => {});
        return res;
      };
      patched.__patched_upgrades__ = true;
      window.marcarLeituraBiblia = patched;
    }
  }

  // ---------- Expor funções pro HTML ----------
  window.bibliaAbrirNoApp = bibliaAbrirNoApp;
  window.bibliaAbrirPapelModal = bibliaAbrirPapelModal;
  window.bibliaFecharPapelModal = bibliaFecharPapelModal;
  window.bibliaDefinirPapel = bibliaDefinirPapel;
  window.bibliaToggleTema = bibliaToggleTema;
  window.bibliaVoltarParaHoje = bibliaVoltarParaHoje;

  // ---------- Init ----------
  function init() {
    injectBibleExclusiveCSS();
    applyThemeToBibleScreen();
    ensureBackdropModalClose();
    patchBibleFunctions();

    // Se entrar na Bíblia e já estiver logado, tenta atualizar extras
    // (sem depender de você clicar em algo)
    setTimeout(() => {
      updateBibleExtras().catch(() => {});
    }, 400);
  }

  // Espera DOM + script.js
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
