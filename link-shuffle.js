/* ============================================================
   LINK SHUFFLE — per-letter glitch hover, wave from cursor.
   Usage (Webflow Footer Code, after gsap is loaded):
       linkShuffle('.nav_link');
   Pass any selector(s); each matching element gets the effect.
   GSAP-driven timing. Skips elements with child markup (icons).
   ============================================================ */
function linkShuffle(selector, opts) {
  if (!window.gsap) {
    console.warn("linkShuffle: gsap not found");
    return;
  }
  if (!window.SplitText) {
    console.warn("linkShuffle: SplitText plugin not found");
    return;
  }
  if (!window.ScrambleTextPlugin) {
    console.warn("linkShuffle: ScrambleTextPlugin not found");
    return;
  }
  window.gsap.registerPlugin(window.SplitText, window.ScrambleTextPlugin);
  opts = opts || {};
  var POOL = (opts.pool || ".:-=+*#%@8BWQROEN").split("");
  var STEP = opts.step != null ? opts.step : 0.035; // s between substitutions
  var STEPS = opts.steps != null ? opts.steps : 3; // random chars before settle
  var STAGGER = opts.stagger != null ? opts.stagger : 0.022; // s per letter of distance
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(selector).forEach(function (el) {
    if (el.dataset.shuffleBound === "1") return;
    // Skip elements with element children (icons/images would break).
    for (var c = 0; c < el.childNodes.length; c++) {
      if (el.childNodes[c].nodeType === 1) return;
    }
    var original = (el.textContent || "").trim();
    if (!original) return;
    el.dataset.shuffleBound = "1";
    el.classList.add("link-shuffle");

    // SplitText handles per-char wrapping + accessibility:
    // aria:"auto" sets aria-label on `el` and aria-hidden on the pieces,
    // so the previous manual .shuffle-sr screen-reader span is gone.
    var split = new window.SplitText(el, {
      type: "chars",
      charsClass: "shuffle-char",
      aria: "auto",
    });
    var spans = split.chars;
    spans.forEach(function (s) {
      s.dataset.original = s.textContent;
    });
    var idx = 0;

    // Events bind on `eventTarget` (e.g. a wrapper) when given — needed
    // when an overlay element sits on top of the text and would otherwise
    // swallow pointer events. Splitting/animation still targets `el`.
    var evtEl = (opts.eventTarget && el.closest(opts.eventTarget)) || el;

    function setIdx(e) {
      var rect = el.getBoundingClientRect();
      var x = (e.clientX - rect.left) / Math.max(1, rect.width);
      idx = Math.max(
        0,
        Math.min(spans.length - 1, Math.floor(x * spans.length)),
      );
    }
    function settle(span) {
      span.textContent = span.dataset.original;
    }
    var POOL_STR = POOL.join("");
    function shuffleAll() {
      if (reduce) return;
      window.gsap.killTweensOf(spans);
      // One staggered tween; `from: idx` makes the wave start at the
      // char nearest the cursor and ripple outward in both directions.
      window.gsap.to(spans, {
        duration: STEPS * STEP,
        ease: "none",
        scrambleText: function (i, target) {
          return {
            text: target.dataset.original,
            chars: POOL_STR,
            speed: 0.6,
            revealDelay: 0,
          };
        },
        stagger: { each: STAGGER, from: idx },
      });
    }
    function reset() {
      window.gsap.killTweensOf(spans);
      spans.forEach(settle);
    }

    evtEl.addEventListener("pointerenter", function (e) {
      setIdx(e);
      shuffleAll();
    });
    evtEl.addEventListener("pointermove", setIdx);
    evtEl.addEventListener("pointerleave", reset);
    evtEl.addEventListener("focus", function () {
      idx = 0;
      shuffleAll();
    });
    evtEl.addEventListener("blur", reset);
  });
}

function initLinkShuffle() {
  linkShuffle(".button_main_text", { eventTarget: ".button_main_wrap" });
}
/* GSAP + plugins load from the SITE-WIDE footer, which Webflow emits
   AFTER this page-level script — so they don't exist yet at parse time.
   Wait for them (poll a few frames) before initialising. */
function bootLinkShuffle() {
  if (window.gsap && window.SplitText && window.ScrambleTextPlugin) {
    return initLinkShuffle();
  }
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.SplitText && window.ScrambleTextPlugin) {
      clearInterval(iv);
      initLinkShuffle();
    } else if (++n > 200) {
      clearInterval(iv);
      initLinkShuffle(); // ~10s: give up, let linkShuffle()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootLinkShuffle, {
    once: true,
  });
} else {
  bootLinkShuffle();
}
