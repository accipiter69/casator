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
  var split = SplitText.create(element, {
    type: config.type, // e.g. "words,chars"
    mask: config.mask,
    wordsClass: "split-word",
    charsClass: "split-char",
    linesClass: "split-line",
    autoSplit: true,
  });

  storeSplitInstance(element, split);

  // If the source element uses gradient text (e.g. `.u-white-gradient`
  // with background-image + background-clip:text + transparent fill),
  // SplitText's per-char wrappers don't inherit the background, so the
  // chars render as transparent (invisible). Copy the gradient props
  // onto every child so the look survives the split.
  var cs = getComputedStyle(element);
  var bgImg = cs.backgroundImage;
  if (bgImg && bgImg !== "none") {
    var apply = function (node) {
      node.style.backgroundImage = bgImg;
      node.style.webkitBackgroundClip = "text";
      node.style.backgroundClip = "text";
      node.style.webkitTextFillColor = "transparent";
      node.style.color = "transparent";
    };
    if (split.chars) split.chars.forEach(apply);
    if (split.words) split.words.forEach(apply);
  }

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

  gsap.set(targets, config.from);
  gsap.to(
    targets,
    Object.assign({}, config.to, {
      scrollTrigger: Object.assign(
        {
          trigger: element,
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

document.addEventListener("DOMContentLoaded", () => {
  // Teachers slider
  const aboutSection = document.querySelector(".about_container");
  if (aboutSection) {
    const aboutWrp = aboutSection.querySelector(".swiper");
    if (aboutWrp) {
      const slidesCount = aboutWrp.querySelectorAll(".swiper-slide").length;

      const breakpoints = {
        1280: { slidesPerView: 3 },
      };

      if (slidesCount > 3) {
        breakpoints[1440] = { slidesPerView: 4 };
      }

      new Swiper(aboutWrp, {
        slidesPerView: "auto",
        spaceBetween: 8,
        breakpoints,
      });
    }
  }
  const cards = document.querySelectorAll(".about_card");
  if (!cards.length) return;
  const style = document.createElement("style");
  style.textContent = `
    .about_popap {
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .about_popap.is-open {
      opacity: 1;
      pointer-events: all;
    }
    .about_popap.is-closing {
      opacity: 0;
      pointer-events: none;
    }
    .about_popap-content {
      transform: scale(0.95);
      transition: transform 0.3s ease;
    }
    .about_popap.is-open .about_popap-content {
      transform: scale(1);
    }
    .about_popap.is-closing .about_popap-content {
      transform: scale(0.95);
    }
  `;
  document.head.appendChild(style);
  function openPopap(popap) {
    popap.style.display = "flex";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popap.classList.add("is-open");
      });
    });
    disableScroll();
  }
  function closePopap(popap) {
    popap.classList.add("is-closing");
    popap.classList.remove("is-open");
    popap.addEventListener(
      "transitionend",
      () => {
        popap.classList.remove("is-closing");
        popap.style.display = "none";
        enableScroll();
      },
      { once: true },
    );
  }
  cards.forEach((card) => {
    const popap = card.querySelector(".about_popap");
    if (!popap) return;
    const popapContent = popap.querySelector(".about_popap-content");
    if (!popapContent) return;
    const closeBtn = card.querySelector(".about_popap-close");
    if (!closeBtn) return;
    document.body.appendChild(popap);
    card.addEventListener("click", () => openPopap(popap));
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopap(popap);
    });
    popap.addEventListener("click", (e) => {
      if (!popapContent.contains(e.target)) closePopap(popap);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".about_popap.is-open").forEach(closePopap);
  });
});
