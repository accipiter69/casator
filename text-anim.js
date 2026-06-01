function initTextAnim() {
  // ACCESSIBILITY: prefers-reduced-motion
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    gsap.set("[data-text-animation]", { opacity: 1 });
    return;
  }

  // Wait for fonts so split metrics don't shift after layout.
  document.fonts.ready.then(function () {
    var allElements = gsap.utils.toArray("[data-text-animation]");

    allElements.forEach(function (element) {
      var animationType = element.getAttribute("data-text-animation");

      try {
        applyAnimation(animationType, element);
      } catch (error) {
        console.error("Animation failed for element:", element, error);
        gsap.set(element, { opacity: 1 });
      }
    });

    gsap.set("[data-text-animation]", { opacity: 1 });
  });
}

// REVERT: store SplitText instances for cleanup.
function storeSplitInstance(element, splitInstance) {
  if (!element._splitInstances) {
    element._splitInstances = [];
  }
  element._splitInstances.push(splitInstance);
}

// DRY helper: build a split + scroll-triggered animation in one call.
function createSplitAnimation(element, config) {
  // If the text uses a gradient fill (background-image + background-clip:
  // text + transparent webkit-text-fill-color) — and that gradient sits
  // either on the trigger element itself OR on any wrapper between it
  // and the chars (e.g. inner `.u-white-gradient` spans) — SplitText's
  // per-char wrappers don't inherit the gradient bg-image, so the chars
  // render as transparent (invisible). Walk up from each char to find
  // the nearest gradient ancestor and copy its bg onto the char. Run
  // in onSplit so it survives autoSplit re-splits (font load, resize).
  function findGradientAncestor(node) {
    var cur = node.parentElement;
    while (cur && cur !== document.body) {
      var s = getComputedStyle(cur);
      var clip = s.webkitBackgroundClip || s.backgroundClip;
      if (
        s.backgroundImage &&
        s.backgroundImage !== "none" &&
        clip === "text"
      ) {
        return { bgImage: s.backgroundImage, lineEl: cur };
      }
      if (cur === element) break;
      cur = cur.parentElement;
    }
    return null;
  }
  // Per-char gradient was visually wrong (each letter restarted the
  // gradient at white). Anchor the same gradient to the gradient
  // ancestor's box and offset each char's background-position so the
  // gradient reads continuously across the whole LINE.
  function applyGradient(node) {
    var info = findGradientAncestor(node);
    if (!info) return;
    var lineRect = info.lineEl.getBoundingClientRect();
    var nodeRect = node.getBoundingClientRect();
    node.style.backgroundImage = info.bgImage;
    node.style.backgroundSize = lineRect.width + "px " + lineRect.height + "px";
    node.style.backgroundPosition =
      -(nodeRect.left - lineRect.left) +
      "px " +
      -(nodeRect.top - lineRect.top) +
      "px";
    node.style.backgroundRepeat = "no-repeat";
    node.style.webkitBackgroundClip = "text";
    node.style.backgroundClip = "text";
    node.style.webkitTextFillColor = "transparent";
    node.style.color = "transparent";
  }

  var split = SplitText.create(element, {
    type: config.type, // e.g. "words,chars"
    mask: config.mask,
    wordsClass: "split-word",
    charsClass: "split-char",
    linesClass: "split-line",
    autoSplit: true,
    onSplit: function (self) {
      // autoSplit rebuilds chars on font load / resize — re-apply
      // gradient AND re-run the entry animation so it stays correct.
      if (self.chars) self.chars.forEach(applyGradient);
    },
  });

  storeSplitInstance(element, split);

  if (split.chars) split.chars.forEach(applyGradient);

  // Which split bucket to animate.
  var targets =
    config.animateTarget === "chars"
      ? split.chars
      : config.animateTarget === "words"
        ? split.words
        : config.animateTarget === "lines"
          ? split.lines
          : split[
              config.type
                .replace(",", "")
                .replace("words", "")
                .replace("lines", "") || "chars"
            ];

  // Resolve the ScrollTrigger trigger. Defaults to the animated element;
  // a preset may point it at a related element via `trigger` (selector),
  // resolved as the nearest matching self/ancestor so multiple matches on
  // the page each bind to their own — with a global querySelector fallback.
  var triggerEl = element;
  if (config.trigger) {
    triggerEl =
      element.closest(config.trigger) ||
      document.querySelector(config.trigger) ||
      element;
  }

  gsap.set(targets, config.from);
  gsap.to(
    targets,
    Object.assign({}, config.to, {
      scrollTrigger: Object.assign(
        {
          trigger: triggerEl,
          start: config.start || "top 90%",
          toggleActions: config.toggleActions || "play none none none",
        },
        config.scrollTrigger || {},
      ),
    }),
  );
}

// 📚 Animation presets — easy to extend.
var animationPresets = {
  "letters-blur": {
    type: "words,chars", // split into words AND chars
    animateTarget: "chars", // ...but animate only chars
    from: { opacity: 0, filter: "blur(5px)" },
    to: {
      opacity: 1,
      filter: "blur(0px)",
      duration: 1,
      ease: "power3.out",
      stagger: { amount: 0.5 },
    },
    start: "top 80%",
  },
  "text-fill-scrub": {
    type: "words",
    animateTarget: "words",
    trigger: ".text-fill",
    from: { opacity: 0.18 },
    to: {
      opacity: 1,
      duration: 0.3,
      ease: "none",
      stagger: { each: 0.4 },
    },
    start: "top top",
    scrollTrigger: { end: "bottom bottom", scrub: 0.6 },
  },
};

function applyAnimation(animationType, element) {
  var config = animationPresets[animationType];

  if (!config) {
    console.warn('Animation type "' + animationType + '" is not defined');
    return;
  }

  createSplitAnimation(element, config);
}

// Public utilities.
var TextAnimations = {
  refresh: function () {
    ScrollTrigger.refresh();
  },

  killAll: function () {
    ScrollTrigger.getAll().forEach(function (st) {
      st.kill();
    });

    document.querySelectorAll("[data-text-animation]").forEach(function (el) {
      if (el._splitInstances) {
        el._splitInstances.forEach(function (instance) {
          if (instance && typeof instance.revert === "function") {
            instance.revert();
          }
        });
        el._splitInstances = null;
      }
    });

    gsap.killTweensOf("*");
  },

  isReducedMotion: function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  addPreset: function (name, config) {
    animationPresets[name] = config;
  },
};

/* GSAP + ScrollTrigger + SplitText load from the SITE-WIDE footer,
   which Webflow emits AFTER this page-level script — so they don't
   exist yet at parse time. Wait for them (poll a few frames) before
   initialising, instead of bailing. */
function bootTextAnim() {
  if (window.gsap && window.ScrollTrigger && window.SplitText) {
    window.gsap.registerPlugin(window.ScrollTrigger, window.SplitText);
    return initTextAnim();
  }
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap && window.ScrollTrigger && window.SplitText) {
      clearInterval(iv);
      window.gsap.registerPlugin(window.ScrollTrigger, window.SplitText);
      initTextAnim();
    } else if (++n > 200) {
      clearInterval(iv);
      console.warn(
        "text-anim: gsap/ScrollTrigger/SplitText not available after ~10s",
      );
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTextAnim, { once: true });
} else {
  bootTextAnim();
}
