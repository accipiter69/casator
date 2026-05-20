/* ============================================================
   EYE STICKY SEQUENCE — nfinitepaper.com/#impact-style pinned
   scroll. `.eye-sticky-wrap` is a tall block; Webflow already
   pins the eye stage (`.principles_contain`) and every
   `.eye-card` with CSS `position:sticky; top:0`, so they stack
   centered. This script just drives the scroll choreography:

     • the eye ring (`.principles_circle`) rotates across the
       whole scroll length (the "alive eye");
     • each `.eye-card` snaps in only once it has docked centered
       in the ring (dock = scroll progress k/(n-1)); the previous
       card glides up and out as it goes.

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       eyeSticky('.eye-sticky-wrap');
       eyeSticky('.eye-sticky-wrap', { rotate:540, scrub:0.6 });
   ============================================================ */
function eyeSticky(selector, opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("eyeSticky: gsap missing");
    return;
  }

  var SELECTOR = selector || ".eye-sticky-wrap";
  var CARD_SEL = opts.cardSelector || ".eye-card";
  // The rotating eye ring inside the pinned stage.
  var EYE_SEL = opts.eyeSelector || ".principles_circle";
  // Per-card text block that rises in (optional polish).
  var INNER_SEL = opts.innerSelector || ".principles_circle-inner";

  // ScrollTrigger window: pin travel = wrap height − one viewport.
  var START = opts.start || "top top";
  var END = opts.end || "bottom bottom";
  // true = locked to scroll; a number = smoothing seconds (nicer
  // with Lenis). false = play once on enter (timed, not scrubbed).
  var SCRUB = opts.scrub != null ? opts.scrub : 0.5;

  // Eye ring rotation (deg) across the FULL scroll — no scaling,
  // just a steady spin tied to scroll position.
  var ROTATE = opts.rotate != null ? opts.rotate : 360;

  // Every `.eye-card` is sticky top:0, so a card's text only reaches
  // the eye's dead-center once that card has fully DOCKED — which
  // (measured) happens at scroll progress k/(n-1) for card k. So the
  // hand-off into card k completes exactly at its dock point: card k
  // appears centered in the ring and card k-1 is removed right then.
  // SNAP = length of that quick swap, in timeline units (1 per card).
  var SNAP = opts.snap != null ? opts.snap : 0.22;
  // The outgoing card's text drifts UP by EXIT px as it fades, so it
  // reads as "leaving" rather than blinking out in place.
  var EXIT = opts.exitY != null ? opts.exitY : 44;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.ScrollTrigger && window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  var _bound = [];

  document.querySelectorAll(SELECTOR).forEach(function (wrap) {
    if (wrap.dataset.eyeBound === "1") return;

    var cards = [].slice.call(wrap.querySelectorAll(CARD_SEL));
    if (cards.length < 1) return; // nothing to sequence
    wrap.dataset.eyeBound = "1";

    var eye = wrap.querySelector(EYE_SEL);
    var n = cards.length;
    _bound.push(wrap);

    // Own the visible state inline so it doesn't fight Webflow CSS:
    // only the first card shows; the rest are faded out and parked.
    cards.forEach(function (c, i) {
      window.gsap.set(c, { autoAlpha: i === 0 ? 1 : 0 });
    });

    // Reduced motion: first card + a still eye, no scroll anim.
    if (reduce) {
      if (eye) window.gsap.set(eye, { rotate: 0 });
      return;
    }

    // One scrubbed timeline of total length n (1 unit per card).
    // Rebuilt on resize so the layout-derived dock points below stay
    // correct across breakpoints.
    var tl = null;
    function buildTimeline() {
      if (tl) {
        if (tl.scrollTrigger) tl.scrollTrigger.kill();
        tl.kill();
      }
      // Baseline: only the first card shows; reset every card's text
      // back to its resting position (rebuild-safe).
      cards.forEach(function (c, ci) {
        window.gsap.set(c, { autoAlpha: ci === 0 ? 1 : 0 });
        window.gsap.set(c.querySelector(INNER_SEL) || c, { y: 0 });
      });

      tl = window.gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          start: START,
          end: END,
          scrub: SCRUB === true ? true : SCRUB,
        },
      });

      // Eye ring spins linearly across the WHOLE scroll (duration n) —
      // keeps rotating through the last-card hold too.
      if (eye) {
        window.gsap.set(eye, { rotate: 0 });
        tl.fromTo(
          eye,
          { rotate: 0 },
          { rotate: ROTATE, ease: "none", duration: n, force3D: true },
          0,
        );
      }

      // Layout-derived dock points: every `.eye-card` is sticky top:0,
      // so card k physically docks (centered in the ring) at scroll
      // fraction (offset_k / travel). Swapping it in exactly there
      // means the leftover scroll after the LAST card's dock is a
      // natural hold — card 3 stays centered for the final screen
      // instead of unsticking the instant it appears. Auto-adapts to
      // any spacer added as the last child INSIDE .eye-sticky-wrap.
      var travel = wrap.offsetHeight - window.innerHeight;
      var baseTop = cards[0].offsetTop;
      for (var i = 1; i < n; i++) {
        var prev = cards[i - 1];
        var cur = cards[i];
        var prevInner = prev.querySelector(INNER_SEL) || prev;
        var dockFrac =
          travel > 0
            ? (cards[i].offsetTop - baseTop) / travel
            : i / (n - 1); // even-spacing fallback if unmeasurable
        if (dockFrac < 0) dockFrac = 0;
        else if (dockFrac > 1) dockFrac = 1;
        var dockPos = dockFrac * n; // timeline units
        var swapAt = Math.max(0, dockPos - SNAP);
        window.gsap.set(cur, { autoAlpha: 0 });
        tl.to(prev, { autoAlpha: 0, ease: "none", duration: SNAP }, swapAt);
        // Outgoing text glides up and out as it fades (fromTo keeps it
        // reversible when the user scrubs back up).
        tl.fromTo(
          prevInner,
          { y: 0 },
          { y: -EXIT, ease: "power1.in", duration: SNAP, force3D: true },
          swapAt,
        );
        tl.to(cur, { autoAlpha: 1, ease: "none", duration: SNAP }, swapAt);
      }
      tl.to({}, { duration: 0 }, n); // hold to full length n (= the tail)
    }
    buildTimeline();
    wrap._eyeRebuild = buildTimeline;
  });

  /* ---- Resize: keep ScrollTrigger positions in sync ---- */
  var rT;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      _bound.forEach(function (w) {
        if (w._eyeRebuild) w._eyeRebuild();
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });
}

function initEye() {
  eyeSticky(".eye-sticky-wrap");
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — so they don't exist yet at
   parse time. Wait for them (poll a few frames) before initialising,
   instead of bailing. Lets this script live in a per-page footer
   without touching the shared global footer. */
function bootEye() {
  if (window.gsap && window.ScrollTrigger) return initEye();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initEye();
    } else if (++n > 200) {
      clearInterval(iv);
      initEye(); // ~10s: give up waiting, let eyeSticky()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEye, { once: true });
} else {
  bootEye(); // DOM already parsed (script loaded late / async)
}
