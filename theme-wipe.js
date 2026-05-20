/* ============================================================
   THEME WIPE — lithosquare.com-style theme transition. A grid of
   small monospace cells fills in UPWARD in a plus-minus-random
   order as you scroll — one direction, up to FULL, and stays
   full (no collapse-back). A second front trails behind, fading
   each filled cell's letter into the block (random, lower rows
   first) so the settled area becomes solid and letter-free.

   The overlay fills EXACTLY the .theme-change div (absolute,
   inset:0 → its Webflow width × height). The animation lives only
   inside that block — NO full-screen cover, no viewport tracking,
   no fixed/pin/layout shift. Size & position the strip in Webflow;
   it's where the page should visually swap themes. The fill starts
   when the strip's bottom hits the viewport bottom and reaches FULL
   when the strip's top hits the viewport top.

   Webflow structure: two empty placeholder divs already exist —
       .theme-change.to-light   ← inside section.triangle, dark→light
       .theme-change.to-dark    ← inside section.platform, light→dark
   Both are pointer-events:none, no children; this script builds the
   cell grid into them. Page baseline dark = rgb(17,17,17)/white
   text; the light sections are rgb(255,255,255)/rgb(17,17,17).

   For to-light the cells are white with black letters; for
   to-dark the cells are black with white letters (the cover is
   the destination theme, so the seam underneath is masked).

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       themeWipe('.theme-change.to-light', { mode:'light' });
       themeWipe('.theme-change.to-dark',  { mode:'dark'  });
   ============================================================ */
function themeWipe(selector, opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("themeWipe: gsap missing");
    return;
  }
  // Unlike eye/cards (which only soft-need it) this effect is
  // meaningless without scrubbed scroll — bail loudly.
  if (!window.ScrollTrigger) {
    console.warn("themeWipe: ScrollTrigger missing");
    return;
  }
  if (window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  var SELECTOR = selector || ".theme-change";

  var MODE = opts.mode === "dark" ? "dark" : "light";
  var CELL = opts.cell != null ? opts.cell : 28; // px, square side
  // Cover colors per direction. Defaults match the project baseline
  // (dark rgb(17,17,17) / light rgb(255,255,255)); all overridable.
  var LIGHT_BG = opts.lightBg || "#FFFFFF";
  var LIGHT_INK = opts.lightInk || "#111";
  var DARK_BG = opts.darkBg || "#111";
  var DARK_INK = opts.darkInk || "#FFFFFF";
  var BG = MODE === "dark" ? DARK_BG : LIGHT_BG;
  var INK = MODE === "dark" ? DARK_INK : LIGHT_INK;

  var CHARS = opts.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // Letter font size. null = auto (CELL * 0.5, original behaviour).
  // Edit this default to change ALL .theme-change instances. Accepts:
  // '0.875rem' | '14px' | unitless number (= px). Per-instance override
  // is also possible via opts.fontSize.
  var FONT_SIZE = opts.fontSize != null ? opts.fontSize : null;
  function resolveFontPx() {
    if (FONT_SIZE == null) return Math.round(CELL * 0.5);
    if (typeof FONT_SIZE === "number") return FONT_SIZE;
    var s = String(FONT_SIZE).trim();
    var n = parseFloat(s);
    if (!isFinite(n)) return Math.round(CELL * 0.5);
    if (/rem$/i.test(s)) {
      var root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return n * (root || 16);
    }
    return n;
  }
  // Just under a typical Webflow fixed navbar (≈9999/10000) so the
  // bar stays visible during the wipe; raise to cover the nav too.
  var ZINDEX = opts.zIndex != null ? opts.zIndex : 9998;
  // Raggedness of the advancing front, in ~rows of jitter.
  var BLEED = opts.bleed != null ? opts.bleed : 1.5;
  // Behind the fill front the letters fade out (color → cell bg) so
  // the trailing area becomes solid blocks. LAG = how far (fraction
  // of progress) that hide-front trails the fill-front. Everything
  // is letter-free by the end. Same ragged order ⇒ random + lower
  // rows first.
  var LETTER_LAG = opts.letterLag != null ? opts.letterLag : 0.3;
  // true = locked to scroll; a number = smoothing seconds (Lenis).
  var SCRUB = opts.scrub != null ? opts.scrub : true;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var _bound = [];

  document.querySelectorAll(SELECTOR).forEach(function (host) {
    if (host.dataset.themeWipeBound === "1") return;
    host.dataset.themeWipeBound = "1";
    _bound.push(host);

    // Reduced motion: no overlay at all. The .theme-change div stays
    // empty/transparent so the theme just changes with the normal
    // page scroll — page fully usable.
    if (reduce) return;

    /* ---- Overlay ----
       Fills EXACTLY the .theme-change host (inset:0 → its Webflow
       width × height). The animation lives only inside this block —
       no full-screen cover, no viewport tracking, no fixed/pin. */
    var grid = document.createElement("div");
    var s = grid.style;
    s.position = "absolute";
    s.top = "0";
    s.left = "0";
    s.right = "0";
    s.bottom = "0";
    s.pointerEvents = "none";
    s.zIndex = ZINDEX;
    s.display = "grid";
    s.overflow = "hidden";
    s.contain = "layout paint";
    s.opacity = "0";
    s.visibility = "hidden";
    s.willChange = "opacity";
    s.fontFamily = '"JetBrains Mono", monospace';
    s.fontWeight = "400";
    host.appendChild(grid);

    // Scrub state (per host). Two fronts walk the SAME `order`
    // (bottom→top + random jitter): the FILL front (block appears)
    // and, trailing it by LETTER_LAG, the HIDE front (letter color
    // → cell bg, so it vanishes and the cell is a solid block).
    var order = []; // cells, sorted bottom→top with random jitter
    var total = 0;
    var lastActive = 0; // fill front
    var lastHidden = 0; // letter-hide front

    function on(idx) {
      order[idx].style.opacity = "1";
    }
    function off(idx) {
      order[idx].style.opacity = "0";
    }
    function hideLetter(idx) {
      order[idx].style.color = BG; // same as block → invisible
    }
    function showLetter(idx) {
      order[idx].style.color = INK;
    }

    function clampN(t) {
      if (t < 0) return 0;
      if (t > total) return total;
      return t;
    }

    // One direction: fills 0 → total across the whole scroll and
    // stays full. The hide front uses progress remapped so it
    // STARTS after LETTER_LAG and still REACHES total at p=1 — i.e.
    // it trails the fill (a cell's letter only hides once its block
    // is already on) and everything is letter-free by the end.
    // Only the cells crossed since last frame are touched; reversing
    // restores both (un-fill / show letter again).
    function applyProgress(p) {
      var fill = clampN(Math.round(p * total));
      var hp = (p - LETTER_LAG) / (1 - LETTER_LAG);
      if (hp < 0) hp = 0;
      else if (hp > 1) hp = 1;
      var hide = clampN(Math.round(hp * total));
      var i;
      if (fill > lastActive) {
        for (i = lastActive; i < fill; i++) on(i);
      } else if (fill < lastActive) {
        for (i = lastActive - 1; i >= fill; i--) off(i);
      }
      lastActive = fill;
      if (hide > lastHidden) {
        for (i = lastHidden; i < hide; i++) hideLetter(i);
      } else if (hide < lastHidden) {
        for (i = lastHidden - 1; i >= hide; i--) showLetter(i);
      }
      lastHidden = hide;
    }

    // (Re)build the cell grid to fill the host box. Rebuild-safe.
    function buildGrid() {
      grid.innerHTML = "";
      // Size from the .theme-change box itself (its Webflow width ×
      // height) — the grid covers only this strip, nothing else.
      var boxW = host.clientWidth || host.offsetWidth;
      var boxH = host.clientHeight || host.offsetHeight;
      var cols = Math.ceil(boxW / CELL);
      var rows = Math.ceil(boxH / CELL);
      total = cols * rows;
      grid.style.gridTemplateColumns = "repeat(" + cols + ", " + CELL + "px)";
      grid.style.gridTemplateRows = "repeat(" + rows + ", " + CELL + "px)";

      var fontPx = resolveFontPx();
      var frag = document.createDocumentFragment();
      var cellData = [];
      for (var idx = 0; idx < total; idx++) {
        var r = Math.floor(idx / cols);
        var cell = document.createElement("div");
        var cs = cell.style;
        cs.background = BG;
        cs.color = INK;
        cs.display = "flex";
        cs.alignItems = "center";
        cs.justifyContent = "center";
        cs.fontSize = fontPx + "px";
        cs.lineHeight = "1";
        cs.opacity = "0";
        cs.willChange = "opacity";
        cs.userSelect = "none";
        // Letters generated ONCE here — never per scroll frame.
        cell.textContent = CHARS.charAt(
          Math.floor(Math.random() * CHARS.length),
        );
        // Sort key: bottom rows first (rowFromBottom small), ± jitter
        // of ~BLEED rows so the front is ragged, not a clean line.
        var rowFromBottom = rows - 1 - r;
        var key =
          rowFromBottom * cols + (Math.random() - 0.5) * 2 * BLEED * cols;
        cellData.push({ el: cell, key: key });
        frag.appendChild(cell);
      }
      grid.appendChild(frag);

      cellData.sort(function (a, b) {
        return a.key - b.key;
      });
      order = cellData.map(function (d) {
        return d.el;
      });

      lastActive = 0;
      lastHidden = 0;
      if (host._themeWipeST) applyProgress(host._themeWipeST.progress);
    }

    buildGrid();
    host._themeWipeRebuild = buildGrid;

    // The wipe is anchored to the .theme-change strip itself:
    // STARTS when the strip's bottom reaches the viewport bottom
    // ("bottom bottom") and ENDS when the strip's top reaches the
    // viewport top ("top top"). Override via opts.trigger / start /
    // end if ever needed.
    var trig =
      (opts.trigger &&
        (opts.trigger.nodeType
          ? opts.trigger
          : document.querySelector(opts.trigger))) ||
      host;
    var st = window.ScrollTrigger.create({
      trigger: trig,
      start: opts.start || "bottom bottom",
      end: opts.end || "top top",
      scrub: SCRUB === true ? true : SCRUB,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        applyProgress(self.progress);
        // Visible once filling has begun; STAYS visible (and full)
        // after the end — it just scrolls away with the section.
        var show = self.progress > 0;
        grid.style.visibility = show ? "visible" : "hidden";
        grid.style.opacity = show ? "1" : "0";
      },
    });
    host._themeWipeST = st;

    // Correct state on a mid-zone load / ScrollTrigger.refresh().
    var show0 = st.progress > 0;
    grid.style.visibility = show0 ? "visible" : "hidden";
    grid.style.opacity = show0 ? "1" : "0";
    applyProgress(st.progress);
  });

  /* ---- Resize: rebuild grids + keep ScrollTrigger in sync ---- */
  var rT;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      _bound.forEach(function (h) {
        if (h._themeWipeRebuild) h._themeWipeRebuild();
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });
}

function initThemeWipe() {
  themeWipe(".theme-change.to-light", { mode: "light" });
  themeWipe(".theme-change.to-dark", { mode: "dark" });
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — so they don't exist yet at
   parse time. Wait for them (poll a few frames) before initialising,
   instead of bailing. Lets this script live in a per-page footer
   without touching the shared global footer. */
function bootThemeWipe() {
  if (window.gsap && window.ScrollTrigger) return initThemeWipe();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initThemeWipe();
    } else if (++n > 200) {
      clearInterval(iv);
      initThemeWipe(); // ~10s: give up, let themeWipe()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootThemeWipe, { once: true });
} else {
  bootThemeWipe(); // DOM already parsed (script loaded late / async)
}
