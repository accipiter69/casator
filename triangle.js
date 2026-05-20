/* ============================================================
   TRIANGLE CLIP REVEAL — `.triangle_img` starts fully hidden,
   then on scroll wipes in from the APEX (top) straight down to
   the base, clipped to a triangular shape via clip-path.

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       triangleReveal('.triangle_img');
       triangleReveal('.triangle_img', { start:"top 80%", end:"top 30%", scrub:true });
   ============================================================ */
function triangleReveal(selector, opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("triangleReveal: gsap missing");
    return;
  }

  var SELECTOR = selector || ".triangle_img";
  // Scroll window over which the reveal plays. Default: scrubbed to
  // scroll position so it grows as you move down the page.
  var START = opts.start || "top 85%";
  var END = opts.end || "top 35%";
  // true (default) = tied to scroll; a number = smoothing seconds;
  // false = play once on enter (timed, not scrubbed).
  var SCRUB = opts.scrub != null ? opts.scrub : true;
  var DUR = opts.duration != null ? opts.duration : 1.1; // only if SCRUB=false
  var EASE = opts.ease || "none";
  // Apex x position (50% = isosceles, centered).
  var APEX = opts.apexX != null ? opts.apexX : 50;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.ScrollTrigger && window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  // p: 0 → 100 = how far down the base edge has dropped. The visible
  // region is the triangle truncated at y = p%: apex at top, widening
  // down to a horizontal cut. p=0 → degenerate point (invisible);
  // p=100 → full triangle (apex, bottom-right, bottom-left).
  function clipAt(p) {
    var half = p / 2; // triangle edges spread 0.5% x per 1% y
    var lx = (APEX - half).toFixed(3);
    var rx = (APEX + half).toFixed(3);
    var y = p.toFixed(3);
    return (
      "polygon(" + APEX + "% 0%, " + rx + "% " + y + "%, " + lx + "% " + y + "%)"
    );
  }

  var _bound = [];

  document.querySelectorAll(SELECTOR).forEach(function (el) {
    if (el.dataset.triBound === "1") return;
    el.dataset.triBound = "1";

    // Own the visible state inline so it doesn't depend on Webflow CSS.
    el.style.clipPath = clipAt(0); // fully hidden from frame 1
    el.style.webkitClipPath = clipAt(0);
    window.gsap.set(el, { autoAlpha: 1 });
    _bound.push(el);

    // Reduced motion: show the full triangle, no scroll animation.
    if (reduce) {
      el.style.clipPath = clipAt(100);
      el.style.webkitClipPath = clipAt(100);
      return;
    }

    var proxy = { p: 0 };
    function apply() {
      var c = clipAt(proxy.p);
      el.style.clipPath = c;
      el.style.webkitClipPath = c;
    }

    function play() {
      window.gsap.to(proxy, {
        p: 100,
        duration: DUR,
        ease: EASE === "none" ? "power2.out" : EASE,
        onUpdate: apply,
      });
    }

    if (window.ScrollTrigger && SCRUB !== false) {
      window.gsap.to(proxy, {
        p: 100,
        ease: EASE,
        onUpdate: apply,
        scrollTrigger: {
          trigger: el,
          start: START,
          end: END,
          scrub: SCRUB === true ? true : SCRUB,
        },
      });
    } else if (window.ScrollTrigger) {
      window.ScrollTrigger.create({
        trigger: el,
        start: START,
        once: true,
        onEnter: play,
      });
    } else if (window.IntersectionObserver) {
      var io = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) {
            io.disconnect();
            play();
          }
        },
        { rootMargin: "0px" },
      );
      io.observe(el);
    } else {
      proxy.p = 100;
      apply();
    }
  });

  /* ---- Resize: keep ScrollTrigger positions in sync ---- */
  var rT;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });
}

function initTriangle() {
  triangleReveal(".triangle_img");
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — so they don't exist yet at
   parse time. Wait for them (poll a few frames) before initialising,
   instead of bailing. Lets this script live in a per-page footer
   without touching the shared global footer. */
function bootTriangle() {
  if (window.gsap && window.ScrollTrigger) return initTriangle();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initTriangle();
    } else if (++n > 200) {
      clearInterval(iv);
      initTriangle(); // ~10s: give up, let triangleReveal()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTriangle, { once: true });
} else {
  bootTriangle(); // DOM already parsed (script loaded late / async)
}
