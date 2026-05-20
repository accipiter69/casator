/* ============================================================
   HORIZONTAL CARDS SCROLL — pins a container and slides its inner
   track sideways as you scroll the page (scrubbed). Same technique
   as the mindly/therapist.js "join section", minus all the progress
   bits (no item-number / line-fill / counters) — just the scroll.

   Webflow structure (defaults):
       .platform_contain        ← pinned viewport ("gallery")
         └ .platform_scroll      ← wide flex track ("line"), slid in X
             └ .platform_item …  ← the cards

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       cardsScroll();
       cardsScroll({ container:'.platform_contain', track:'.platform_scroll' });
   ============================================================ */
function cardsScroll(opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("cardsScroll: gsap missing");
    return;
  }

  var CONTAINER = opts.container || ".platform_contain";
  var TRACK = opts.track || ".platform_scroll";
  // Horizontal scroll only makes sense with room — desktop/tablet up.
  // Below this the cards keep their natural (stacked/native) layout.
  var MIN_WIDTH = opts.minWidth != null ? opts.minWidth : 992;
  var START = opts.start || "top 3.61rem";
  var SCRUB = opts.scrub != null ? opts.scrub : true;
  var MARKERS = opts.markers != null ? opts.markers : true;

  if (window.ScrollTrigger && window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(CONTAINER).forEach(function (gallery) {
    if (gallery.dataset.cardsScrollBound === "1") return;
    var line = gallery.querySelector(TRACK);
    if (!line) return;
    gallery.dataset.cardsScrollBound = "1";

    // Reduced motion: leave the natural layout, no pin/scroll hijack.
    if (reduce) return;

    // gsap.matchMedia so the pinned horizontal scroll is built only
    // ≥ MIN_WIDTH and cleanly torn down (pin-spacer removed, x reset)
    // when crossing the breakpoint.
    var mm = window.gsap.matchMedia();
    mm.add("(min-width: " + MIN_WIDTH + "px)", function () {
      // Nothing to scroll if the track already fits.
      if (line.scrollWidth <= gallery.offsetWidth) return;

      // Distance the track must travel left (negative). Function form
      // + invalidateOnRefresh → recomputed on resize/breakpoint.
      function scrollAmount() {
        return -(line.scrollWidth - gallery.offsetWidth);
      }

      // Clip the bleed so the overflowing track doesn't add a page
      // scrollbar before/after the pin.
      var prevOverflow = gallery.style.overflowX;
      gallery.style.overflowX = "clip";

      var tween = window.gsap.fromTo(
        line,
        { x: 0 },
        {
          x: scrollAmount,
          ease: "none",
          scrollTrigger: {
            trigger: gallery,
            pin: true,
            start: START,
            end: function () {
              return "+=" + scrollAmount() * -1;
            },
            scrub: SCRUB === true ? true : SCRUB,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            markers: MARKERS,
          },
        },
      );

      return function () {
        // matchMedia teardown: kill the tween + its ScrollTrigger
        // (removes the pin-spacer) and restore the track.
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
        window.gsap.set(line, { x: 0 });
        gallery.style.overflowX = prevOverflow;
      };
    });
  });
}

function initCardsScroll() {
  cardsScroll();
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — so they don't exist yet at
   parse time. Wait for them (poll a few frames) before initialising,
   instead of bailing. Lets this script live in a per-page footer
   without touching the shared global footer. */
function bootCardsScroll() {
  if (window.gsap && window.ScrollTrigger) return initCardsScroll();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initCardsScroll();
    } else if (++n > 200) {
      clearInterval(iv);
      initCardsScroll(); // ~10s: give up, let cardsScroll()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootCardsScroll, {
    once: true,
  });
} else {
  bootCardsScroll(); // DOM already parsed (script loaded late / async)
}
