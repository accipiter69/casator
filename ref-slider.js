/* ============================================================
   CYLINDER CAROUSEL — pure CSS-3D cylinder, GSAP autoplay.
   Adapted to the existing Webflow `.gallery_slider` markup
   (no Swiper). On scroll-into-view it starts ~viewport-wide
   and spinning fast, then contracts to its Webflow width and
   eases into a slow continuous autoplay. Starts already
   horizontal with a slight tilt (no vertical→horizontal intro).

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       cylinderCarousel();                       // defaults
       cylinderCarousel({ tiltX: -6, spinDuration: 50 });
   ============================================================ */
function cylinderCarousel(opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("cylinderCarousel: gsap missing");
    return;
  }

  var SELECTOR = opts.selector || ".swiper.gallery_slider";
  var TILT_X = opts.tiltX != null ? opts.tiltX : -16; // deg, permanent
  var SPIN_DUR = opts.spinDuration != null ? opts.spinDuration : 40; // s / 360°

  var host = document.querySelector(SELECTOR);
  if (!host) return;
  var spinner = host.querySelector(".swiper-wrapper.gallery_slider");
  var items = Array.prototype.slice.call(
    host.querySelectorAll(".swiper-slide.gallery_slider"),
  );
  if (!spinner || !items.length) return;

  // Prevent double-init (Webflow re-render / local live-reload would
  // otherwise stack two infinite spins → double speed).
  if (host.dataset.cylinderBound === "1") return;
  host.dataset.cylinderBound = "1";

  // The CMS has 6 slides; clone them up to 12 faces (30° apart) for a
  // smoother ring than the boxy 6×60° while staying close to the
  // original. Override via `minSlides` (e.g. 6 = no clones, 15 ≈ 24°).
  var MIN_SLIDES = opts.minSlides != null ? opts.minSlides : 12;
  if (items.length < MIN_SLIDES) {
    var originals = items.slice();
    var k = 0;
    while (items.length < MIN_SLIDES) {
      var clone = originals[k % originals.length].cloneNode(true);
      clone.removeAttribute("style");
      spinner.appendChild(clone);
      items.push(clone);
      k++;
    }
  }

  if (window.ScrollTrigger && window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  // Break the carousel out of its Webflow container to a full-viewport,
  // centered stage. Done by measurement (not vw/% which are thrown off by
  // the parent container, scrollbar, and Webflow width rules).
  function centerHost() {
    // The carousel is full-bleed — stretched to the viewport width and
    // shifted to the left edge. Webflow wraps it in containers with
    // overflow:clip; un-clip ONLY the containers between the host and
    // its section so the bleed isn't cut. The section itself (already
    // full-viewport width) is set to clip, so the spinning 3D slides —
    // and the whole carousel on narrow viewports — stay contained
    // instead of leaking into the page / neighbouring sections.
    var section = host.closest("section");
    var p = host.parentElement;
    while (p && p !== section && p !== document.documentElement) {
      if (getComputedStyle(p).overflow !== "visible") {
        p.style.overflow = "visible";
      }
      p = p.parentElement;
    }
    if (section) section.style.overflow = "clip";
    // Keep the page from gaining a horizontal scrollbar from the bleed.
    document.documentElement.style.overflowX = "clip";
    var vw = document.documentElement.clientWidth;
    host.style.flexShrink = "0";
    host.style.maxWidth = "none";
    host.style.width = vw + "px";
    host.style.marginLeft = "0px";
    host.style.marginLeft = -host.getBoundingClientRect().left + "px";
  }
  centerHost();

  // Use the slide width you already set in Webflow: measure it (before any
  // transform is applied) and feed it into the cylinder geometry, so the
  // radius matches your real slide size.
  var measuredW = Math.round(items[0].getBoundingClientRect().width);
  var ITEM_W = opts.itemWidth || measuredW + "px";
  host.style.setProperty("--3d-carousel-item-width", ITEM_W);
  host.style.setProperty("--3d-carousel-gap", opts.gap || "3.33rem");
  // Height is controlled by the parent .gallery_wap in Webflow Designer;
  // the slider just fills it. `opts.height` is an optional escape hatch.
  if (opts.height) host.style.height = opts.height;

  /* ---- Cylinder geometry (ported from the reference) ---- */
  var count = items.length;
  var rotateAmount = 360 / count;
  var zTranslate = 2 * Math.tan((rotateAmount / 2) * (Math.PI / 180));
  var posTranslate =
    "calc(var(--3d-carousel-item-width) / " +
    zTranslate +
    " + var(--3d-carousel-gap))";
  var negTranslate =
    "calc(var(--3d-carousel-item-width) / -" +
    zTranslate +
    " - var(--3d-carousel-gap))";

  host.style.setProperty("--3d-carousel-z", negTranslate);
  host.style.perspective = posTranslate;

  // Portrait card aspect (source images are ~462×636 ≈ 1.38).
  var ITEM_ASPECT = opts.itemAspect != null ? opts.itemAspect : 1.38;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    it.style.transform =
      "rotateY(" + rotateAmount * i + "deg) translateZ(" + posTranslate + ")";
    it.style.height =
      "calc(var(--3d-carousel-item-width) * " + ITEM_ASPECT + ")";
    // Show the rear faces so the cylinder reads as a solid ring (slides
    // don't blink out at the sides). Photos on the back are mirrored.
    it.style.backfaceVisibility = "visible";
    // Perf: promote each slide to its own GPU layer once, and isolate its
    // paint/layout so the spinning parent transform doesn't re-rasterize
    // every image each frame (this is the main jank source on a 15-face
    // backface-visible cylinder).
    it.style.willChange = "transform";
    it.style.contain = "layout paint";
    // Webflow's own img rules keep the image tiny — force it to fill the card.
    var im = it.querySelector("img");
    if (im) {
      im.style.width = "100%";
      im.style.height = "100%";
      im.style.objectFit = "cover";
      im.style.display = "block";
      // lazy-loading inside a 3D-transformed subtree thrashes decode —
      // these are always near the viewport when active, so load eagerly.
      im.loading = "eager";
      im.decoding = "async";
    }
  }
  // The wrapper is the only element actually animating every frame.
  spinner.style.willChange = "transform";

  // Initial orientation — already horizontal, slight tilt. Units required:
  // GSAP/CSS won't append deg to a bare number.
  host.style.setProperty("--3d-carousel-rotate-x", TILT_X + "deg");
  host.style.setProperty("--3d-carousel-rotate", "0deg");
  // Clear the FOUC opacity guard (`.swiper.gallery_slider{opacity:0}`).
  host.style.opacity = "1";

  /* ---- Reduced motion: static tilted cylinder, no spin/intro ---- */
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    host.style.setProperty("--3d-carousel-rotate", "0deg");
    return;
  }

  /* ---- Continuous autoplay spin (constant slow speed) ---- */
  var spin = window.gsap.fromTo(
    host,
    { "--3d-carousel-rotate": "0deg" },
    {
      "--3d-carousel-rotate": "-360deg",
      duration: SPIN_DUR,
      ease: "none",
      repeat: -1,
      paused: true,
    },
  );

  /* ---- Run only while in the viewport (pause rotation when off-screen
     so it doesn't burn CPU / GPU compositing while scrolled away). ---- */
  function setActive(on) {
    if (on) spin.play();
    else spin.pause();
  }
  if (window.ScrollTrigger) {
    window.ScrollTrigger.create({
      trigger: host,
      start: "top bottom",
      end: "bottom top",
      onToggle: function (self) {
        setActive(self.isActive);
      },
    });
  } else if (window.IntersectionObserver) {
    new IntersectionObserver(
      function (entries) {
        setActive(entries[0].isIntersecting);
      },
      { rootMargin: "0px" },
    ).observe(host);
  } else {
    spin.play();
  }

  /* ---- Resize: re-center + keep ScrollTrigger positions in sync ---- */
  var rT,
    lastW = window.innerWidth;
  window.addEventListener("resize", function () {
    // Skip height-only resizes (mobile URL bar) — only width changes rebuild.
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rT);
    rT = setTimeout(function () {
      centerHost();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });
}

function initSlider() {
  cylinderCarousel();
}
/* GSAP loads from the SITE-WIDE footer, which Webflow emits AFTER
   this page-level script — so it doesn't exist yet at parse time.
   Wait for it (poll a few frames) before initialising, instead of
   bailing. Lets this script live in a per-page footer without
   touching the shared global footer. */
function bootSlider() {
  if (window.gsap && window.ScrollTrigger) return initSlider();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initSlider();
    } else if (++n > 200) {
      clearInterval(iv);
      initSlider(); // ~10s: give up, let cylinderCarousel()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSlider, { once: true });
} else {
  bootSlider(); // DOM already parsed (script loaded late / async)
}
