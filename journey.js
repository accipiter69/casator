/* ============================================================
   JOURNEY STICKY SEQUENCE — same pinned-scroll model as the eye
   section, applied to the milestone timeline. `.journey_sticky`
   is a tall block; Webflow already pins the stage
   (`.journey_contain`) and every `.journey_text` card with CSS
   `position:sticky; top:0`, so they stack centered. This script
   drives the scroll choreography:

     • each `.journey_text` card snaps in only once it has docked
       (dock = scroll progress k/(n-1)). The hand-off is SEQUENTIAL,
       not a crossfade: the previous card (its `.journey_text-inner`
       gliding up and out) fully clears first, then the next card
       arrives in the final stretch — so two cards are never on
       screen together and the new one lands right at its place;
     • DIFFERENCE vs eye: the horizontal timeline track
       `.journey_line` (clipped inside `.journey_mask`) slides
       LEFT linearly across the whole scroll, so milestone dot k
       (`.journey_div`) reaches the mask focal point exactly when
       card k is docked.

   The year badge is a CLOCK/odometer roll. `.journey_year` is a
   one-line clip window; `.journey_year-clock` is an absolutely
   stacked column of `.year-text` items (one 2-digit year per card,
   in authored order — gaps like 22→24 are baked into the markup).
   The clock translates UP by exactly one item height (≈1em) per
   card, keyed at each dock so it rolls in sync with the scroll and
   lands on card k's year right when card k docks (same scrubbed,
   reversible pattern as `.journey_line`). No clock authored → no-op.

   Webflow structure (already authored — no markup changes):
       section.journey > .journey_sticky
         > .journey_contain (sticky stage)
             > .journey_mask (overflow:clip)
                 > .journey_line  (flex track of .journey_div dots)
         > .journey_text(.is--1) × n  (sticky cards)
             > .journey_text-inner > h3 + p

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       journeySticky('.journey_sticky');
       journeySticky('.journey_sticky', { scrub:0.6, focalFrac:0.5 });
   ============================================================ */
function journeySticky(selector, opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("journeySticky: gsap missing");
    return;
  }

  var SELECTOR = selector || ".journey_sticky";
  var CARD_SEL = opts.cardSelector || ".journey_text";
  var INNER_SEL = opts.innerSelector || ".journey_text-inner";
  // The horizontal timeline track + its clip window + the dots.
  var LINE_SEL = opts.lineSelector || ".journey_line";
  var MASK_SEL = opts.maskSelector || ".journey_mask";
  var DOT_SEL = opts.dotSelector || ".journey_div";

  // ScrollTrigger window: pin travel = wrap height − one viewport.
  var START = opts.start || "top top";
  var END = opts.end || "bottom bottom";
  // true = locked to scroll; a number = smoothing seconds (nicer
  // with Lenis). false = play once on enter (timed, not scrubbed).
  var SCRUB = opts.scrub != null ? opts.scrub : 0.5;

  // Quick swap length, in timeline units (1 per card) — same as eye.
  var SNAP = opts.snap != null ? opts.snap : 0.22;
  // Outgoing card text drifts UP by EXIT px as it fades.
  var EXIT = opts.exitY != null ? opts.exitY : 44;
  // The dot for the docked card lands on this element (the year
  // badge) — so the square's arrival coincides with the text/year
  // change. If absent, fall back to a fraction of the mask width.
  var FOCUS_SEL = opts.focusSelector || ".journey_year";
  var FOCAL = opts.focalFrac != null ? opts.focalFrac : 0.5;
  // Year clock: the absolutely-stacked column that rolls, and its
  // per-card item rows. Card k → item k (1:1; authored order carries
  // any year gaps, e.g. 22→24). Clamped if fewer items than cards.
  var CLOCK_SEL = opts.clockSelector || ".journey_year-clock";
  var CLOCK_ITEM_SEL = opts.clockItemSelector || ".year-text";

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.ScrollTrigger && window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    // Ignore mobile viewport-HEIGHT changes (URL bar show/hide on scroll).
    // Without this, every address-bar toggle fires ScrollTrigger's internal
    // resize → re-measure of every trigger → scroll-up jank on phones.
    if (window.ScrollTrigger.config) {
      window.ScrollTrigger.config({ ignoreMobileResize: true });
    }
  }

  var _bound = [];

  document.querySelectorAll(SELECTOR).forEach(function (wrap) {
    if (wrap.dataset.journeyBound === "1") return;

    var cards = [].slice.call(wrap.querySelectorAll(CARD_SEL));
    if (cards.length < 1) return; // nothing to sequence
    wrap.dataset.journeyBound = "1";

    var line = wrap.querySelector(LINE_SEL);
    var mask = wrap.querySelector(MASK_SEL);
    var n = cards.length;
    _bound.push(wrap);

    // Own the visible state inline so it doesn't fight Webflow CSS:
    // only the first card shows; the rest are faded out and parked.
    cards.forEach(function (c, i) {
      window.gsap.set(c, { autoAlpha: i === 0 ? 1 : 0 });
    });

    // translateX that puts the dot mapped to card k at the mask focal
    // point. Measured (rebuild-safe). One dot per card (clamped if
    // fewer dots than cards — placeholder timelines), so the count
    // mismatch can't desync the middle. Empty if unmeasurable.
    var focus = wrap.querySelector(FOCUS_SEL);
    function lineTargetForCard(k) {
      if (!line || !mask) return null;
      var dots = [].slice.call(line.querySelectorAll(DOT_SEL));
      if (!dots.length) return null;
      var d = dots[Math.min(k, dots.length - 1)];
      var dotC = d.offsetLeft + (d.offsetWidth || 0) / 2;
      // Focal point = the year badge's center, measured against the
      // mask (both sit in the pinned stage, so the offset is scroll-
      // stable). Fallback: a fraction of the mask width.
      var focalX;
      if (focus) {
        var mr = mask.getBoundingClientRect();
        var fr = focus.getBoundingClientRect();
        focalX = fr.left + fr.width / 2 - mr.left;
      } else {
        focalX = mask.clientWidth * FOCAL;
      }
      return focalX - dotC;
    }

    // Clock roll target (translateY) for card k: line item k up into
    // the one-line clip window. Measured from the item's own offsetTop
    // (rebuild-safe; handles any per-breakpoint line height). One item
    // per card, clamped. Null if the clock isn't authored → no-op.
    var clock = wrap.querySelector(CLOCK_SEL);
    function clockTargetForCard(k) {
      if (!clock) return null;
      var items = [].slice.call(clock.querySelectorAll(CLOCK_ITEM_SEL));
      if (!items.length) return null;
      var it = items[Math.min(k, items.length - 1)];
      return -it.offsetTop; // roll so item k sits where item 0 was
    }

    // Reduced motion: first card + line/clock parked at index 0.
    if (reduce) {
      if (line) {
        var x0 = lineTargetForCard(0);
        if (x0 != null) window.gsap.set(line, { x: x0 });
      }
      var cy0 = clockTargetForCard(0);
      if (cy0 != null) window.gsap.set(clock, { y: cy0 });
      return;
    }

    // One scrubbed timeline of total length n (1 unit per card).
    // Rebuilt on resize so the layout-derived dock points and line
    // travel below stay correct across breakpoints.
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

      // Layout-derived dock points: every card is sticky top:0, so
      // card k physically docks at scroll fraction (offset_k / travel).
      // Swapping it in exactly there leaves the post-last-dock scroll
      // as a natural hold (last card stays for the final screen).
      var travel = wrap.offsetHeight - window.innerHeight;
      var baseTop = cards[0].offsetTop;
      var dockPos = []; // timeline units, one per card (dockPos[0] = 0)
      for (var d = 0; d < n; d++) {
        var df =
          travel > 0
            ? (cards[d].offsetTop - baseTop) / travel
            : d / (n - 1); // even-spacing fallback if unmeasurable
        if (df < 0) df = 0;
        else if (df > 1) df = 1;
        dockPos[d] = df * n;
      }

      // The timeline track slides LEFT, keyed at each dock so the dot
      // mapped to card k sits at the mask focal point exactly when
      // card k docks (same role as the eye ring's spin, but synced to
      // the dots — robust to a dot/card count mismatch). Reversible.
      if (line && lineTargetForCard(0) != null) {
        window.gsap.set(line, { x: lineTargetForCard(0), force3D: true });
        for (var li = 1; li < n; li++) {
          tl.to(
            line,
            {
              x: lineTargetForCard(li),
              ease: "none",
              duration: dockPos[li] - dockPos[li - 1],
              force3D: true,
            },
            dockPos[li - 1],
          );
        }
      }

      // Year clock: rolls UP one item per dock, in lock-step with the
      // line — same scrubbed keyframing, so the year reads exactly
      // when card k docks and is fully reversible on scrub-back.
      if (clock && clockTargetForCard(0) != null) {
        window.gsap.set(clock, { y: clockTargetForCard(0), force3D: true });
        for (var ki = 1; ki < n; ki++) {
          tl.to(
            clock,
            {
              y: clockTargetForCard(ki),
              ease: "none",
              duration: dockPos[ki] - dockPos[ki - 1],
              force3D: true,
            },
            dockPos[ki - 1],
          );
        }
      }

      // Sequential hand-off (NOT a crossfade): the outgoing card fully
      // clears over the FIRST half of the swap window, then the incoming
      // card arrives over the SECOND half — back-to-back at the midpoint,
      // so two cards are never on screen at once and the new card lands
      // right at its dock (appears late, near its place).
      for (var i = 1; i < n; i++) {
        var prev = cards[i - 1];
        var cur = cards[i];
        var prevInner = prev.querySelector(INNER_SEL) || prev;
        var half = SNAP / 2;
        var outAt = Math.max(0, dockPos[i] - SNAP); // prev starts leaving
        var inAt = Math.max(0, dockPos[i] - half); // cur arrives after it
        window.gsap.set(cur, { autoAlpha: 0 });
        tl.to(prev, { autoAlpha: 0, ease: "none", duration: half }, outAt);
        // Outgoing text glides up and out as it fades (fromTo keeps it
        // reversible when the user scrubs back up).
        tl.fromTo(
          prevInner,
          { y: 0 },
          { y: -EXIT, ease: "power1.in", duration: half, force3D: true },
          outAt,
        );
        tl.to(cur, { autoAlpha: 1, ease: "none", duration: half }, inAt);
      }
      tl.to({}, { duration: 0 }, n); // hold to full length n (= the tail)
    }
    buildTimeline();
    wrap._journeyRebuild = buildTimeline;
  });

  /* ---- Resize: keep ScrollTrigger positions in sync ---- */
  var rT,
    lastW = window.innerWidth;
  window.addEventListener("resize", function () {
    // Height-only resizes are the mobile URL bar appearing/hiding on scroll.
    // Rebuilding + ScrollTrigger.refresh() on every toggle is what janks
    // scroll-up on phones — so only real WIDTH changes rebuild.
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rT);
    rT = setTimeout(function () {
      _bound.forEach(function (w) {
        if (w._journeyRebuild) w._journeyRebuild();
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });
}

function initJourney() {
  journeySticky(".journey_sticky");
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — so they don't exist yet at
   parse time. Wait for them (poll a few frames) before initialising,
   instead of bailing. Lets this script live in a per-page footer
   without touching the shared global footer. */
function bootJourney() {
  if (window.gsap && window.ScrollTrigger) return initJourney();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initJourney();
    } else if (++n > 200) {
      clearInterval(iv);
      initJourney(); // ~10s: give up, let journeySticky()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootJourney, { once: true });
} else {
  bootJourney(); // DOM already parsed (script loaded late / async)
}
