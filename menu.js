/* ============================================================
   MENU — mobile burger panel. Class-toggle + stagger reveal.

   What this script does:
     1. On burger click, toggles `is--open` on BOTH `.header` and
        `.burger`. The panel reveal itself is pure CSS (clip-path
        transition keyed to `.header.is--open`), authored in Webflow.
     2. Staggers the `.nav_link-wrp` items in/out for the "красива
        поява посилань" feel — this is the only animation done in JS.
     3. Closes the menu when any nav <a> is tapped.

   What it deliberately doesn't do:
     • no body{overflow:hidden} scroll lock
     • no ScrollTrigger header recolor
     • no Esc / outside-click handlers

   Crucial: the same `.nav_link-wrp` elements form the visible
   horizontal nav on desktop. The hidden-initial state and the click
   handlers MUST be scoped to (max-width: 991.98px) — `gsap.matchMedia`
   handles auto-revert when the breakpoint stops matching.
   ============================================================ */
function initMenu() {
  var header = document.querySelector(".header");
  if (!header || header.dataset.menuBound === "1") return;
  var burger = header.querySelector(".burger");
  var nav = header.querySelector(".nav");
  if (!burger || !nav) return;
  header.dataset.menuBound = "1";

  // Wrps live under .nav_inner — query deep, not nav.children.
  var wrps = nav.querySelectorAll(".nav_link-wrp");

  function openMenu() {
    header.classList.add("is--open");
    burger.classList.add("is--open");
    if (typeof disableScroll === "function") disableScroll();
    if (wrps.length) {
      window.gsap.fromTo(
        wrps,
        { opacity: 0, y: -24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: { each: 0.07, from: "start" },
          // Slight delay so the clip-path panel starts opening first;
          // links then appear inside it instead of pre-empting the reveal.
          delay: 0.2,
          overwrite: "auto",
        },
      );
    }
  }
  function closeMenu() {
    header.classList.remove("is--open");
    burger.classList.remove("is--open");
    if (typeof enableScroll === "function") enableScroll();
    // The closing clip-path hides the wrps visually — just snap them
    // back to the hidden state so the next open animates from scratch.
    if (wrps.length) window.gsap.set(wrps, { opacity: 0, y: -24 });
  }

  var mm = window.gsap.matchMedia();
  mm.add("(max-width: 991.98px)", function () {
    // Hidden initial state — only on mobile. matchMedia auto-reverts
    // these sets when the MQ stops matching, so the desktop nav links
    // don't get stuck at opacity:0.
    window.gsap.set(wrps, { opacity: 0, y: -24 });

    function onBurger() {
      if (header.classList.contains("is--open")) closeMenu();
      else openMenu();
    }
    burger.addEventListener("click", onBurger);

    var links = nav.querySelectorAll("a");
    function onLink() {
      if (header.classList.contains("is--open")) closeMenu();
    }
    links.forEach(function (a) {
      a.addEventListener("click", onLink);
    });

    // matchMedia cleanup: detach listeners + drop class on resize-up.
    // If the menu was open at that moment, scroll lock must release too.
    return function () {
      burger.removeEventListener("click", onBurger);
      links.forEach(function (a) {
        a.removeEventListener("click", onLink);
      });
      var wasOpen = header.classList.contains("is--open");
      header.classList.remove("is--open");
      burger.classList.remove("is--open");
      if (wasOpen && typeof enableScroll === "function") enableScroll();
    };
  });
}

/* ============================================================
   HEADER DROPDOWN — `.nav_drop` open/close + blur overlay.

   The reveal itself is pure CSS in Webflow, keyed to `.nav_drop.open`
   (grid-template-rows 0fr→1fr on `.nav-dropdown_height`, icon flip,
   label recolor). JS only toggles the `.open` class — same idea as the
   burger `is--open` above.

   On open we also reveal `.drop_overlay` (a full-screen fixed backdrop,
   display:none by default) and GSAP-animate its backdrop-filter blur
   0→20px. The overlay is DESKTOP-ONLY (min-width: 992px): below that the
   burger panel already owns the screen, so no separate backdrop. A click
   on the overlay closes the dropdown (so does Escape / re-clicking the
   toggle).
   ============================================================ */

/* Generic dropdown toggler — ported from the project's `drop()` util,
   extended with onOpen/onClose hooks + overlay-click close so the same
   function can drive the header (with backdrop) and plain accordions
   (footer / FAQ) alike. */
function drop(options) {
  options = options || {};
  var parentClass = options.parentClass;
  var dropClass = options.dropClass;
  var toggleClass = options.toggleClass || null;
  var openClass = options.openClass || "open";
  var stopClosingAt = options.stopClosingAt != null ? options.stopClosingAt : 768;
  var overlay = options.overlay || null;
  var closeOnOverlay = !!options.closeOnOverlay;
  var onOpen = typeof options.onOpen === "function" ? options.onOpen : null;
  var onClose = typeof options.onClose === "function" ? options.onClose : null;

  if (!parentClass || !dropClass) {
    console.error("drop(): required parameters: parentClass, dropClass");
    return;
  }

  var parent = document.querySelector(parentClass);
  if (!parent) return;

  var drops = parent.querySelectorAll(dropClass);
  if (!drops.length) return;

  function toggleOf(d) {
    return toggleClass ? d.querySelector(toggleClass) : d;
  }

  function setExpanded(toggle, isOpen) {
    if (toggle.tagName !== "BUTTON" && !toggle.hasAttribute("role")) {
      toggle.setAttribute("role", "button");
      if (!toggle.hasAttribute("tabindex")) toggle.setAttribute("tabindex", "0");
    }
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  // Single close path so every route (toggle, sibling auto-close, overlay,
  // Escape) fires the onClose hook consistently.
  function closeDrop(d) {
    if (!d.classList.contains(openClass)) return;
    d.classList.remove(openClass);
    var t = toggleOf(d);
    if (t) t.setAttribute("aria-expanded", "false");
    if (onClose) onClose(d, t);
  }

  drops.forEach(function (d) {
    var toggle = toggleOf(d);
    if (!toggle) {
      console.warn('drop(): toggle "' + toggleClass + '" not found in', d);
      return;
    }

    setExpanded(toggle, d.classList.contains(openClass));

    function handleToggle(e) {
      e.preventDefault();
      var isMobile = window.innerWidth < stopClosingAt;

      // Desktop: opening one closes the others (accordion behaviour off on
      // mobile, where each drop acts independently).
      if (!isMobile) {
        drops.forEach(function (other) {
          if (other !== d) closeDrop(other);
        });
      }

      var willOpen = !d.classList.contains(openClass);
      if (willOpen) {
        d.classList.add(openClass);
        toggle.setAttribute("aria-expanded", "true");
        if (onOpen) onOpen(d, toggle);
      } else {
        closeDrop(d);
      }
    }

    toggle.addEventListener("click", handleToggle);

    toggle.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        handleToggle(e);
      } else if (e.key === "Escape" && d.classList.contains(openClass)) {
        closeDrop(d);
        toggle.focus();
      }
    });
  });

  // Clicking the backdrop closes whatever is open.
  if (overlay && closeOnOverlay) {
    overlay.addEventListener("click", function () {
      drops.forEach(closeDrop);
    });
  }
}

function initHeaderDrop() {
  var nav = document.querySelector(".nav_inner");
  if (!nav || nav.dataset.dropBound === "1") return;
  if (!nav.querySelector(".nav_drop")) return;
  nav.dataset.dropBound = "1";

  var overlay = document.querySelector(".drop_overlay");
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Only show the backdrop on desktop; below 992 the burger panel covers
  // the screen and a second overlay isn't wanted.
  var DESKTOP = "(min-width: 992px)";
  var blur = { v: 0 };

  function setBlur(px) {
    var f = "blur(" + px + "px)";
    overlay.style.backdropFilter = f;
    overlay.style.webkitBackdropFilter = f;
  }

  function showOverlay() {
    if (!overlay) return;
    if (!window.matchMedia(DESKTOP).matches) return;
    window.gsap.killTweensOf(overlay);
    window.gsap.killTweensOf(blur);
    overlay.style.display = "block";
    if (reduce) {
      window.gsap.set(overlay, { autoAlpha: 1 });
      setBlur(20);
      return;
    }
    blur.v = 0;
    setBlur(0);
    window.gsap.fromTo(
      overlay,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.4, ease: "power2.out", overwrite: "auto" },
    );
    window.gsap.to(blur, {
      v: 20,
      duration: 0.4,
      ease: "power2.out",
      onUpdate: function () {
        setBlur(blur.v);
      },
    });
  }

  function hideOverlay() {
    if (!overlay) return;
    window.gsap.killTweensOf(overlay);
    window.gsap.killTweensOf(blur);
    function done() {
      overlay.style.display = "none";
      overlay.style.backdropFilter = "";
      overlay.style.webkitBackdropFilter = "";
    }
    if (reduce || overlay.style.display === "none") {
      window.gsap.set(overlay, { autoAlpha: 0 });
      done();
      return;
    }
    window.gsap.to(overlay, {
      autoAlpha: 0,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
      onComplete: done,
    });
    window.gsap.to(blur, {
      v: 0,
      duration: 0.3,
      ease: "power2.out",
      onUpdate: function () {
        setBlur(blur.v);
      },
    });
  }

  drop({
    parentClass: ".nav_inner",
    dropClass: ".nav_drop",
    toggleClass: ".nav_drop-toggle",
    openClass: "open",
    stopClosingAt: 1, // single dropdown — sibling-close value is moot
    overlay: overlay,
    closeOnOverlay: true,
    onOpen: showOverlay,
    onClose: hideOverlay,
  });
}

/* GSAP loads from the SITE-WIDE footer, which Webflow emits AFTER
   this page-level script — so it doesn't exist yet at parse time.
   Poll a few frames before initialising. */
function bootMenu() {
  if (window.gsap) {
    initMenu();
    initHeaderDrop();
    return;
  }
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap) {
      clearInterval(iv);
      initMenu();
      initHeaderDrop();
    } else if (++n > 200) {
      clearInterval(iv);
      console.warn("menu: gsap not available after ~10s");
    }
  }, 50);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMenu, { once: true });
} else {
  bootMenu();
}
