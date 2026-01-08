// =========================================================
// TEMA BÍBLIA — ativa/desativa automaticamente na navegação
// - NÃO mexe no seu script.js
// - Só adiciona/remova a classe "themeBiblia" no <body>
// =========================================================

(function () {
  const BODY_CLASS = "themeBiblia";

  function isTelaBibliaVisivel() {
    const el = document.getElementById("telaBiblia");
    if (!el) return false;
    // visível se display != none e tem layout
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
    return el.offsetParent !== null || el.getClientRects().length > 0;
  }

  function aplicarTema() {
    const on = isTelaBibliaVisivel();
    document.body.classList.toggle(BODY_CLASS, on);
  }

  // 1) Tenta “engatar” no irPara (se existir)
  function hookIrPara() {
    if (typeof window.irPara !== "function") return false;

    const original = window.irPara;
    if (original.__hookedBibliaTheme) return true;

    function wrapped(tela) {
      const r = original.apply(this, arguments);
      // aplica depois do layout trocar
      setTimeout(aplicarTema, 0);
      return r;
    }
    wrapped.__hookedBibliaTheme = true;

    // mantém referência caso algo precise
    wrapped.__original = original;

    window.irPara = wrapped;
    return true;
  }

  // 2) Fallback: observer no DOM (se alguém trocar display direto)
  function observerFallback() {
    const target = document.getElementById("app") || document.body;
    if (!target) return;

    const obs = new MutationObserver(() => aplicarTema());
    obs.observe(target, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
  }

  // Tenta hookar cedo e depois de carregar
  hookIrPara();
  window.addEventListener("load", () => {
    hookIrPara();
    observerFallback();
    aplicarTema();
  });

  // Também aplica quando volta pro app após foco
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) aplicarTema();
  });
})();
