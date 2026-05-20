/* ============================================================
   ASCII PARTICLES — paste-driven port of the ascii-arts.webflow.io
   scatter effect. Does NOT sample an image at runtime (no canvas
   getImageData / CORS). It reads ASCII text already pasted into the
   element (baked offline by ascii-gen-particles.html), turns every
   non-space glyph into a particle on an overlaid <canvas>, and runs
   the cursor-repel + scroll-scatter + spring-return physics.

   Usage (Webflow Footer Code — no gsap needed):
       asciiParticles('.ascii-particles');
       asciiParticles('.ascii-particles', { cursorRadius: 180, weight: 400 });
       asciiParticles('.ascii-particles', { fontSize: '1.2rem' }); // global size

   The element keeps owning layout; the canvas overlays it and owns
   paint (same model as ascii.js). JetBrains Mono 400 must be loaded
   on the page; particle color = the element's CSS `color`.
   ============================================================ */
function asciiParticles(selector, opts) {
  opts = opts || {};

  var SELECTOR = selector || ".ascii_wrap";
  var TEXT_SEL = opts.textSelector || ".ascii_text";

  // Glyphs are drawn this many times their cell size — >1 makes the
  // strokes overlap so the mass reads brighter/denser on a dark bg
  // (the tiny thin glyphs otherwise look dim due to sub-pixel AA).
  var GLYPH_SCALE = opts.glyphScale != null ? opts.glyphScale : 1.32;

  // Global font-size override. If set (e.g. '1.2rem' or 14), every
  // instance uses this size instead of the auto-fit-to-box default.
  // Accepts: number (px) | string ending in 'rem' / 'px' / unitless.
  var FONT_SIZE_OPT = opts.fontSize != null ? opts.fontSize : null;
  function resolveFontPx() {
    if (FONT_SIZE_OPT == null) return null;
    if (typeof FONT_SIZE_OPT === "number") return FONT_SIZE_OPT;
    var s = String(FONT_SIZE_OPT).trim();
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    if (/rem$/i.test(s)) {
      var root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return n * (root || 16);
    }
    return n; // px or unitless
  }

  // Physics + look (verbatim defaults from the reference, overridable).
  var CFG = {
    // Heavier default weight reads much brighter than hairline 400.
    weight: opts.weight != null ? opts.weight : 600,
    cursorRadius: opts.cursorRadius != null ? opts.cursorRadius : 235,
    cursorForce: opts.cursorForce != null ? opts.cursorForce : 3,
    idleTimeout: opts.idleTimeout != null ? opts.idleTimeout : 200,
    scrollForce: opts.scrollForce != null ? opts.scrollForce : 35,
    scrollDecay: opts.scrollDecay != null ? opts.scrollDecay : 81,
    scrollMult: opts.scrollMult != null ? opts.scrollMult : 3,
    returnSpeed: opts.returnSpeed != null ? opts.returnSpeed : 5,
    friction: opts.friction != null ? opts.friction : 75,
  };
  // Reference glyph cell geometry (charW = fs*0.62, lineH = fs*1.3).
  var CW = 0.62;
  var LH = 1.3;
  var MAX_DPR = opts.maxDpr != null ? opts.maxDpr : 2;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var instances = [];
  var scrollVelocity = 0;
  var lastScrollY = window.scrollY;
  var rafId = 0;

  /* ---- Read the pasted ASCII out of the element (ascii.js parser):
     supports a Webflow Text block (real \n) or an Embed (<br>). ---- */
  function readGrid(el) {
    var raw;
    if (/<br\s*\/?>/i.test(el.innerHTML)) {
      raw = el.innerHTML
        .split(/<br\s*\/?>/i)
        .map(function (s) {
          var d = document.createElement("div");
          d.innerHTML = s;
          return d.textContent;
        })
        .join("\n");
    } else {
      raw = el.textContent;
    }
    return raw.replace(/\s+$/, "").split("\n");
  }

  function fontColor(el) {
    var m = window.getComputedStyle(el).color.match(/(\d+)/g);
    if (m && m.length >= 3) return { r: +m[0], g: +m[1], b: +m[2] };
    return { r: 126, g: 244, b: 208 };
  }

  function Particle(x, y, ch) {
    this.ox = x;
    this.oy = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.char = ch;
  }
  Particle.prototype.update = function () {
    var friction = CFG.friction / 100;
    var returnSpd = CFG.returnSpeed / 100;
    this.vx += (this.ox - this.x) * returnSpd;
    this.vy += (this.oy - this.y) * returnSpd;
    this.vx *= friction;
    this.vy *= friction;
    this.x += this.vx;
    this.y += this.vy;
  };

  // Lay the grid out into particles sized to the element's box, and
  // size the overlay canvas. Reused on first build and every resize.
  function layout(state) {
    var grid = state.grid;
    var rows = grid.length;
    var cols = 0;
    for (var i = 0; i < rows; i++)
      if (grid[i].length > cols) cols = grid[i].length;
    if (!rows || !cols) return;

    var box = state.el.getBoundingClientRect();
    var W = box.width,
      H = box.height;
    if (!W || !H) return;

    // If opts.fontSize was provided, honour it verbatim (rem/px); else
    // pick the largest font where the whole grid fits the box (contain).
    var override = resolveFontPx();
    var fontPx =
      override != null
        ? Math.max(1, override)
        : Math.max(1, Math.min(W / (cols * CW), H / (rows * LH)));
    var charW = fontPx * CW;
    var lineH = fontPx * LH;
    var gridW = cols * charW;
    var gridH = rows * lineH;
    var offX = (W - gridW) / 2;
    var offY = (H - gridH) / 2;

    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var cv = state.canvas;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cssW = W;
    state.cssH = H;
    state.fontPx = fontPx;

    var ps = [];
    for (var r = 0; r < rows; r++) {
      var line = grid[r];
      for (var c = 0; c < line.length; c++) {
        var ch = line.charAt(c);
        if (ch === " " || ch === "") continue;
        ps.push(new Particle(offX + c * charW, offY + r * lineH, ch));
      }
    }
    state.particles = ps;
  }

  function paint(state) {
    var ctx = state.ctx;
    var fc = state.color;
    ctx.clearRect(0, 0, state.cssW, state.cssH);
    // Draw the glyph larger than its cell (GLYPH_SCALE), re-centered
    // on the cell so the heavier mass overlaps neighbours → brighter.
    var drawFs = state.fontPx * GLYPH_SCALE;
    var off = (state.fontPx - drawFs) / 2;
    ctx.font = CFG.weight + " " + drawFs + 'px "JetBrains Mono", monospace';
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgb(" + fc.r + "," + fc.g + "," + fc.b + ")";
    var ps = state.particles;
    for (var i = 0; i < ps.length; i++) {
      ctx.fillText(ps[i].char, ps[i].x + off, ps[i].y + off);
    }
  }

  function buildInstance(wrap) {
    if (wrap.dataset.particlesBound === "1") return;

    // Text source: a dedicated .ascii_text child (Text block / Embed),
    // else the wrap itself if the ASCII was pasted straight into it.
    // The <img.ascii_image> never contributes text and is left
    // untouched (stays opacity:0 as the size driver / CMS source).
    var textEl = wrap.querySelector(TEXT_SEL) || wrap;
    var grid = readGrid(textEl);
    if (grid.length < 2) return; // nothing pasted yet
    wrap.dataset.particlesBound = "1";

    var color = fontColor(textEl); // strictly the .ascii_text CSS color
    wrap._pGrid = grid; // immutable source for re-layout
    if (textEl === wrap) {
      // ASCII sat in the wrap: strip only text nodes, keep elements
      // (e.g. the image) intact.
      for (var k = wrap.childNodes.length - 1; k >= 0; k--) {
        if (wrap.childNodes[k].nodeType === 3)
          wrap.removeChild(wrap.childNodes[k]);
      }
    } else {
      textEl.style.display = "none"; // keep in DOM (CMS) but hide
    }

    var cs = window.getComputedStyle(wrap);
    if (cs.position === "static") wrap.style.position = "relative";

    var canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;" +
      "pointer-events:none;display:block";
    wrap.appendChild(canvas);

    var state = {
      el: wrap,
      canvas: canvas,
      ctx: canvas.getContext("2d"),
      grid: grid,
      particles: [],
      color: color,
      mouse: { x: -9999, y: -9999, active: false },
      mouseIdleTimer: null,
      cssW: 0,
      cssH: 0,
      fontPx: 12,
      visible: true,
    };
    layout(state);
    instances.push(state);
    paint(state); // immediate static frame (don't wait for the rAF/IO)

    // Reduced motion → keep the static paint, no physics, no rAF.
    if (reduce) return;

    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(
        function (entries) {
          state.visible = entries[0].isIntersecting;
          ensureRunning();
        },
        { rootMargin: "120px" },
      );
      io.observe(wrap);
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        layout(state);
      });
      ro.observe(wrap);
    }
    ensureRunning();
  }

  /* ---- Shared loop (one rAF for every instance) ---- */
  function frame() {
    rafId = 0;
    scrollVelocity *= CFG.scrollDecay / 100;
    if (Math.abs(scrollVelocity) < 0.02) scrollVelocity = 0;

    var anyVisible = false;
    for (var s = 0; s < instances.length; s++) {
      var state = instances[s];
      if (!state.visible) continue;
      anyVisible = true;
      var mouse = state.mouse;
      var ps = state.particles;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        if (mouse.active) {
          var dx = p.x - mouse.x;
          var dy = p.y - mouse.y;
          var dSq = dx * dx + dy * dy;
          var r = CFG.cursorRadius;
          if (dSq < r * r && dSq > 0) {
            var dist = Math.sqrt(dSq);
            var f = (r - dist) / r;
            var ang = Math.atan2(dy, dx);
            var str = f * f * CFG.cursorForce * 0.5;
            p.vx += Math.cos(ang) * str;
            p.vy += Math.sin(ang) * str;
          }
        }
        var absScroll = Math.abs(scrollVelocity);
        if (absScroll > 0.3) {
          var sv = Math.min(absScroll, 150) / 150;
          var a2 = Math.random() * Math.PI * 2;
          var sf =
            sv *
            CFG.scrollForce *
            CFG.scrollMult *
            (0.15 + Math.random() * 0.85) *
            0.08;
          p.vx += Math.cos(a2) * sf;
          p.vy +=
            Math.sin(a2) * sf +
            (scrollVelocity > 0 ? 1 : -1) * sv * CFG.scrollForce * 0.04;
        }
        p.update();
      }
      paint(state);
    }
    // Keep ticking only while something is on screen (or settling).
    if (anyVisible || scrollVelocity !== 0)
      rafId = requestAnimationFrame(frame);
  }
  function ensureRunning() {
    if (reduce || rafId) return;
    var any = false;
    for (var i = 0; i < instances.length; i++)
      if (instances[i].visible) {
        any = true;
        break;
      }
    if (any) rafId = requestAnimationFrame(frame);
  }

  /* ---- Global input (mouse + scroll), once ---- */
  window.addEventListener(
    "scroll",
    function () {
      var cur = window.scrollY;
      scrollVelocity += (cur - lastScrollY) * 0.6;
      lastScrollY = cur;
      ensureRunning();
    },
    { passive: true },
  );
  window.addEventListener("mousemove", function (e) {
    for (var i = 0; i < instances.length; i++) {
      var state = instances[i];
      var rect = state.canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        state.mouse.x = e.clientX - rect.left;
        state.mouse.y = e.clientY - rect.top;
        state.mouse.active = true;
        clearTimeout(state.mouseIdleTimer);
        state.mouseIdleTimer = setTimeout(
          (function (st) {
            return function () {
              st.mouse.active = false;
            };
          })(state),
          CFG.idleTimeout,
        );
        ensureRunning();
      } else if (state.mouse.active) {
        state.mouse.active = false;
        state.mouse.x = -9999;
        state.mouse.y = -9999;
      }
    }
  });

  var rT;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      for (var i = 0; i < instances.length; i++) layout(instances[i]);
      ensureRunning();
    }, 200);
  });

  document.querySelectorAll(SELECTOR).forEach(buildInstance);
}

function initAsciiParticles() {
  // Edit fontSize below to change ASCII text size for ALL instances.
  // Accepts '1rem', '14px', a unitless number = px, or null = auto-fit.
  asciiParticles(".ascii_wrap", { fontSize: "1.2rem" });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAsciiParticles, {
    once: true,
  });
} else {
  initAsciiParticles(); // DOM already parsed (script loaded late / async)
}
