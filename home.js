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
        start: "top 70%",
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

/* .cta-img — mouse-driven parallax + tilt. Same transform math as the
   hero phoenix (mxLerp / myLerp → translate + rotateX/Y/Z), but no
   ASCII letters / particle trail / scroll-fade. Pure float-toward-cursor. */
function initCtaImgMotion() {
  var img = document.querySelector(".cta-img");
  if (!img) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  img.style.willChange = "transform";

  var mx = 0,
    my = 0,
    mxLerp = 0,
    myLerp = 0;

  function readMouse(e) {
    var rect = img.getBoundingClientRect();
    mx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    my = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    mx = Math.max(-1, Math.min(1, mx));
    my = Math.max(-1, Math.min(1, my));
  }
  window.addEventListener("mousemove", readMouse, { passive: true });
  window.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) {
      mx = 0;
      my = 0;
    }
  });

  var inView = true,
    running = false;
  function schedule() {
    if (inView) {
      running = true;
      requestAnimationFrame(render);
    } else {
      running = false;
    }
  }
  function render() {
    mxLerp += (mx - mxLerp) * 0.08;
    myLerp += (my - myLerp) * 0.08;
    var transX = mxLerp * 12;
    var transY = myLerp * 8;
    var rotY = mxLerp * 12;
    var rotX = -myLerp * 8;
    var rotZ = mxLerp * 2.5;
    img.style.transform =
      "translate3d(" +
      transX +
      "px," +
      transY +
      "px,0) rotateY(" +
      rotY +
      "deg) rotateX(" +
      rotX +
      "deg) rotateZ(" +
      rotZ +
      "deg)";
    schedule();
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(
      function (entries) {
        inView = entries[0].isIntersecting;
        if (inView && !running) schedule();
      },
      { rootMargin: "0px" },
    ).observe(img);
  }
  schedule();
}

function initHome() {
  initSpanBoxReveal();
  initIcon112Reveal();
  initCtaImgMotion();
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
