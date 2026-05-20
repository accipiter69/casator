document.addEventListener("DOMContentLoaded", () => {
  // ACCESSIBILITY: Перевірка prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    gsap.set("[data-text-animation]", { opacity: 1 });
    console.log("Animations disabled due to prefers-reduced-motion");
    return;
  }

  // Чекаємо завантаження шрифтів
  document.fonts.ready.then(() => {
    const allElements = gsap.utils.toArray("[data-text-animation]");

    allElements.forEach((element) => {
      const animationType = element.getAttribute("data-text-animation");

      try {
        applyAnimation(animationType, element);
      } catch (error) {
        console.error(`Animation failed for element:`, element, error);
        gsap.set(element, { opacity: 1 });
      }
    });

    gsap.set("[data-text-animation]", { opacity: 1 });
  });
});

// REVERT: Функція для збереження SplitText інстансів
function storeSplitInstance(element, splitInstance) {
  if (!element._splitInstances) {
    element._splitInstances = [];
  }
  element._splitInstances.push(splitInstance);
}

// Хелпер для створення анімації - DRY principle
function createSplitAnimation(element, config) {
  const split = SplitText.create(element, {
    type: config.type, // тепер може бути "words,chars"
    mask: config.mask,
    wordsClass: "split-word",
    charsClass: "split-char",
    linesClass: "split-line",
    autoSplit: true,
  });

  storeSplitInstance(element, split);

  // Визначаємо, які елементи анімувати
  const targets =
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
  gsap.to(targets, {
    ...config.to,
    scrollTrigger: {
      trigger: element,
      start: config.start || "top 90%",
      toggleActions: config.toggleActions || "play none none none",
      ...config.scrollTrigger,
    },
  });
}

// 📚 БІБЛІОТЕКА АНІМАЦІЙ - легко додавати/видаляти
const animationPresets = {
  "letters-blur": {
    type: "words,chars", // 👈 КЛЮЧОВА ЗМІНА: розбиваємо на слова І чари
    animateTarget: "chars", // 👈 але анімуємо тільки чари
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

// Функція застосування анімації
function applyAnimation(animationType, element) {
  const config = animationPresets[animationType];

  if (!config) {
    console.warn(`Animation type "${animationType}" is not defined`);
    return;
  }

  createSplitAnimation(element, config);
}

// Утиліти для керування анімаціями
const TextAnimations = {
  refresh: () => {
    ScrollTrigger.refresh();
  },

  killAll: () => {
    ScrollTrigger.getAll().forEach((st) => st.kill());

    document.querySelectorAll("[data-text-animation]").forEach((el) => {
      if (el._splitInstances) {
        el._splitInstances.forEach((instance) => {
          if (instance && typeof instance.revert === "function") {
            instance.revert();
          }
        });
        el._splitInstances = null;
      }
    });

    gsap.killTweensOf("*");
    console.log("All animations cleaned up");
  },

  isReducedMotion: () => {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  // Додати нову анімацію динамічно
  addPreset: (name, config) => {
    animationPresets[name] = config;
  },
};
