/* ============================================================
   VISION LINE DRAW — scroll-scrubbed SVG line draw. In
   section.vision the `.vision_visual` block stacks two SVGs that
   share the same path:

     • `.static-<bp>`   — faint WHITE gradient line, the static
                          guide; left untouched.
     • `.absolute-<bp>` — the ORANGE (#FA4C14) line, absolutely
                          overlaid on the guide; THIS is the one
                          that draws in (stroke-dashoffset L → 0)
                          as you scroll through the section.

   There is one such pair per breakpoint (…-pc / …-tablet /
   …-mobile etc.); Webflow shows only the active one. We don't
   hardcode the suffix — we drive EVERY `[class*="absolute-"]`
   path inside `.vision_visual` and only animate the ones that
   are actually displayed, recomputing on resize so a breakpoint
   switch just works. Each path's own getTotalLength() is used
   (different viewBox/d per breakpoint is fine). Scrubbed &
   reversible, like the rest of the project.

   Webflow structure (already authored — no markup changes):
       section.vision > .vision_visual > .vision_visual-<bp>
         > .static-<bp>   (svg > path, white guide)
         > .absolute-<bp> (svg > path, orange line to draw)

   Usage (Webflow Footer Code, after gsap + ScrollTrigger):
       visionLine();
       visionLine('.vision_visual', { start:"top 70%", end:"bottom 30%" });
   ============================================================ */
function visionLine(selector, opts) {
  opts = opts || {};
  if (!window.gsap) {
    console.warn("visionLine: gsap missing");
    return;
  }
  // Meaningless without scrubbed scroll — bail loudly (like themeWipe).
  if (!window.ScrollTrigger) {
    console.warn("visionLine: ScrollTrigger missing");
    return;
  }
  if (window.gsap.registerPlugin) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  var SELECTOR = selector || ".vision_visual";
  // Only the orange overlay draws; the static white SVG is the guide.
  var DRAW_SEL = opts.drawSelector || '[class*="absolute-"]';
  // Scroll window the draw is scrubbed across (section in normal flow,
  // not pinned). Default: starts as the block enters, full as it leaves.
  var START = opts.start || "top 75%";
  var END = opts.end || "bottom 75%";
  var SCRUB = opts.scrub != null ? opts.scrub : true;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var _bound = [];

  document.querySelectorAll(SELECTOR).forEach(function (host) {
    if (host.dataset.visionLineBound === "1") return;
    host.dataset.visionLineBound = "1";
    _bound.push(host);

    // Every breakpoint's orange path. Length is per-path (each set may
    // have its own viewBox/d). Prime dash so it's hidden from frame 1.
    var paths = [];
    host.querySelectorAll(DRAW_SEL).forEach(function (box) {
      var p = box.querySelector("path");
      if (!p) return;
      var len = 0;
      try {
        len = p.getTotalLength();
      } catch (e) {
        len = 0;
      }
      if (!len) return;
      p.style.strokeDasharray = len;
      // Reduced motion: show the line fully drawn, no scroll anim.
      p.style.strokeDashoffset = reduce ? 0 : len;
      paths.push({ box: box, el: p, len: len });
    });
    if (!paths.length || reduce) return;

    // Apply progress to the visible breakpoint(s) only; keep hidden
    // variants reset to fully-undrawn so a breakpoint switch is clean.
    function applyProgress(prog) {
      for (var i = 0; i < paths.length; i++) {
        var rec = paths[i];
        var shown =
          rec.box.offsetParent !== null ||
          getComputedStyle(rec.box).display !== "none";
        rec.el.style.strokeDashoffset = shown ? rec.len * (1 - prog) : rec.len;
      }
    }

    var st = window.ScrollTrigger.create({
      trigger: host,
      start: START,
      end: END,
      scrub: SCRUB === true ? true : SCRUB,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        applyProgress(self.progress);
      },
    });
    host._visionLineST = st;
    host._visionLineApply = applyProgress;

    // Correct state on a mid-zone load / ScrollTrigger.refresh().
    applyProgress(st.progress);
  });

  /* ---- Resize: re-sync on breakpoint switch + keep ST in sync ---- */
  var rT;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      _bound.forEach(function (h) {
        if (h._visionLineApply && h._visionLineST) {
          h._visionLineApply(h._visionLineST.progress);
        }
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });
}

function initVisionLine() {
  visionLine(".vision_visual");
}
/* GSAP + ScrollTrigger load from the SITE-WIDE footer, which Webflow
   emits AFTER this page-level script — so they don't exist yet at
   parse time. Wait for them (poll a few frames) before initialising,
   instead of bailing. Lets this script live in a per-page footer
   without touching the shared global footer. */
function bootVisionLine() {
  if (window.gsap && window.ScrollTrigger) return initVisionLine();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger) {
      clearInterval(iv);
      initVisionLine();
    } else if (++n > 200) {
      clearInterval(iv);
      initVisionLine(); // ~10s: give up, let visionLine()'s guard warn
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootVisionLine, { once: true });
} else {
  bootVisionLine(); // DOM already parsed (script loaded late / async)
}
