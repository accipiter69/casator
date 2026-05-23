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
    return function () {
      burger.removeEventListener("click", onBurger);
      links.forEach(function (a) {
        a.removeEventListener("click", onLink);
      });
      header.classList.remove("is--open");
      burger.classList.remove("is--open");
    };
  });
}

/* GSAP loads from the SITE-WIDE footer, which Webflow emits AFTER
   this page-level script — so it doesn't exist yet at parse time.
   Poll a few frames before initialising. */
function bootMenu() {
  if (window.gsap) return initMenu();
  var n = 0;
  var iv = setInterval(function () {
    if (window.gsap) {
      clearInterval(iv);
      initMenu();
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
