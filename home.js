/* ============================================================
   HOME — page-level animations specific to the home page.

   .span-box reveal: a left-to-right wipe using inset() clip-path.
   Starts fully clipped from the right (inset right = 100%) and
   animates to fully revealed (inset right = 0). Triggered when
   each box's top hits 80% of the viewport.
   ============================================================ */
function initSpanBoxReveal() {
  if (!window.gsap || !window.ScrollTrigger) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".span-box").forEach(function (el) {
    if (el.dataset.spanBoxBound === "1") return;
    el.dataset.spanBoxBound = "1";
    if (reduce) {
      el.style.clipPath = "inset(0 0 0 0)";
      return;
    }
    window.gsap.set(el, { clipPath: "inset(0 100% 0 0)" });
    window.gsap.to(el, {
      clipPath: "inset(0 0% 0 0)",
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });
  });
}

/* .icon-112 reveals: by index — 1st wipes right→left, 2nd wipes left→right.
   Both triggered at top 80% (same as .span-box). */
function initIcon112Reveal() {
  if (!window.gsap || !window.ScrollTrigger) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var icons = document.querySelectorAll(".icon-112");
  icons.forEach(function (el, i) {
    if (el.dataset.icon112Bound === "1") return;
    el.dataset.icon112Bound = "1";
    if (reduce) {
      el.style.clipPath = "inset(0 0 0 0)";
      return;
    }
    // 1st (i=0): right→left — start clipped from LEFT.
    // 2nd (i=1): left→right — start clipped from RIGHT.
    // 3rd+: alternate.
    var rightToLeft = i % 2 === 0;
    var from = rightToLeft ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    window.gsap.set(el, { clipPath: from });
    window.gsap.to(el, {
      clipPath: "inset(0 0% 0 0%)",
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });
  });
}

function initHome() {
  initSpanBoxReveal();
  initIcon112Reveal();
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — poll for them. */
function bootHome() {
  if (window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    return initHome();
  }
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      window.gsap.registerPlugin(window.ScrollTrigger);
      initHome();
    } else if (++n > 200) {
      clearInterval(iv);
      console.warn("home: gsap/ScrollTrigger not available after ~10s");
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHome, { once: true });
} else {
  bootHome();
}
