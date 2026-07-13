/* ============================================================
   LINK SHUFFLE / GLITCH HOVER — port of the artefakt.mov-style
   effect from the Netlify reference (no GSAP / no plugins).
   Per-letter <span>s pulse through random glyphs from a small
   pool; the wave radiates from the cursor's position inside the
   word. All timers tracked per-span so a fast pointerleave /
   re-enter doesn't leave stuck random chars.

   Usage:
       linkShuffle('.nav_link');
       linkShuffle('.button_main_text', { eventTarget: '.button_main_wrap' });
   ============================================================ */
function linkShuffle(selector, opts) {
  opts = opts || {};

  // Same density-pool flavour as the ASCII halftone — ties the glitch
  // visually to the rest of the site.
  var POOL = (opts.pool || ".:-=+*#%@8BWQROEN").split("");
  var STEP_MS = opts.stepMs != null ? opts.stepMs : 35;
  var STEPS = opts.steps != null ? opts.steps : 3;
  var STAGGER = opts.stagger != null ? opts.stagger : 22;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function bindOne(el) {
    if (el.dataset.shuffleBound === "1") return;

    // Skip elements that have non-text children — wrapping their
    // contents in per-letter spans would break the inner markup
    // (icons, images, nested elements, etc.).
    for (var c = 0; c < el.childNodes.length; c++) {
      if (el.childNodes[c].nodeType === 1) return;
    }
    var original = (el.textContent || "").trim();
    if (!original) return;
    el.dataset.shuffleBound = "1";
    el.classList.add("link-shuffle");

    // Detect Firefox for special handling
    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

    // Animated layer: each char wrapped in a fixed-width inline-block
    // span so swapped glyphs don't jiggle the layout.
    var word = document.createElement("span");
    word.className = "shuffle-word";
    word.setAttribute("aria-hidden", "true");
    
    // Create temporary span to measure actual character widths if Firefox
    var measurer = null;
    if (isFirefox) {
      measurer = document.createElement("span");
      measurer.style.visibility = "hidden";
      measurer.style.position = "absolute";
      measurer.style.font = window.getComputedStyle(el).font;
      document.body.appendChild(measurer);
    }
    
    var chars = original.split("");
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var s = document.createElement("span");
      s.dataset.original = ch;
      s.textContent = ch === " " ? " " : ch;
      s.style.display = "inline-block";
      
      // Calculate actual character width for better Firefox compatibility
      if (isFirefox && measurer) {
        measurer.textContent = ch === " " ? "\u00A0" : ch; // Use non-breaking space for measurement
        var actualWidth = measurer.getBoundingClientRect().width;
        // Use exact measurement with minimal buffer
        s.style.width = Math.ceil(actualWidth) + "px"; // Round up to next pixel
        // Prevent individual character from wrapping
        s.style.whiteSpace = "nowrap";
      } else {
        s.style.width = "1ch";
      }
      
      s.style.textAlign = "center";
      word.appendChild(s);
    }
    
    // Clean up measurer
    if (measurer) {
      document.body.removeChild(measurer);
    }

    // Screen-reader fallback — visually hidden but readable.
    var sr = document.createElement("span");
    sr.className = "shuffle-sr";
    sr.textContent = original;
    sr.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;" +
      "overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

    el.textContent = "";
    el.appendChild(word);
    el.appendChild(sr);

    var spans = Array.prototype.slice.call(word.children);
    var timeouts = new Map();
    var currentIdx = 0;

    // Events bind on `eventTarget` (e.g. a wrapper) when given — needed
    // when an overlay sits on top of the text and would otherwise
    // swallow pointer events.
    var evtEl = (opts.eventTarget && el.closest(opts.eventTarget)) || el;

    function cancel(span) {
      var ids = timeouts.get(span);
      if (ids) for (var i = 0; i < ids.length; i++) clearTimeout(ids[i]);
      timeouts.delete(span);
    }
    function shuffleOne(span, delay) {
      cancel(span);
      var ids = [];
      for (var step = 0; step < STEPS; step++) {
        ids.push(
          setTimeout(
            (function (sp) {
              return function () {
                sp.textContent = POOL[(Math.random() * POOL.length) | 0];
              };
            })(span),
            delay + step * STEP_MS,
          ),
        );
      }
      ids.push(
        setTimeout(
          (function (sp) {
            return function () {
              var orig = sp.dataset.original;
              sp.textContent = orig === " " ? " " : orig;
            };
          })(span),
          delay + STEPS * STEP_MS,
        ),
      );
      timeouts.set(span, ids);
    }
    function shuffleAll() {
      if (reduce) return;
      for (var i = 0; i < spans.length; i++) {
        var dist = Math.abs(i - currentIdx);
        shuffleOne(spans[i], dist * STAGGER);
      }
    }
    function updateIndex(e) {
      var rect = word.getBoundingClientRect();
      var x = (e.clientX - rect.left) / Math.max(1, rect.width);
      currentIdx = Math.max(
        0,
        Math.min(spans.length - 1, Math.floor(x * spans.length)),
      );
    }
    function reset() {
      for (var i = 0; i < spans.length; i++) {
        cancel(spans[i]);
        var orig = spans[i].dataset.original;
        spans[i].textContent = orig === " " ? " " : orig;
      }
    }

    evtEl.addEventListener("pointerenter", function (e) {
      updateIndex(e);
      shuffleAll();
    });
    evtEl.addEventListener("pointermove", updateIndex);
    evtEl.addEventListener("pointerleave", reset);
    evtEl.addEventListener("focus", function () {
      currentIdx = 0;
      shuffleAll();
    });
    evtEl.addEventListener("blur", reset);
  }

  document.querySelectorAll(selector).forEach(bindOne);
}

function initLinkShuffle() {
  // The effect wraps each character in an inline-block span with width:1ch
  // so swapped glyphs don't jiggle layout. On touch devices that's
  // pointless (no hover to trigger it) and the 1ch boxes can wreck word
  // spacing — so only run where pointer-hover actually exists.
  if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) {
    return;
  }
  linkShuffle(".button_main_text", { eventTarget: ".button_main_wrap" });
  linkShuffle(".footer_link");
  linkShuffle(".nav_link");
  linkShuffle(".cta_card.h3", { eventTarget: ".cta_card" });
  linkShuffle(".article-item .text-11", { eventTarget: ".article-item" });
  linkShuffle(".nav_link");
  linkShuffle(".text-10", { eventTarget: ".news_filter-item" });
  linkShuffle(".text-10", { eventTarget: ".article-item" });
  linkShuffle(".team_item-card .text-11", { eventTarget: ".team_item-card" });
  linkShuffle(".text-13", { eventTarget: ".nav-dropdown_link" });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLinkShuffle, {
    once: true,
  });
} else {
  initLinkShuffle();
}