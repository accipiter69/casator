document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".position-item");
  const wrp = document.querySelector(".position_popup");
  if (!items.length || !wrp || typeof gsap === "undefined") return;
  const popupForm = wrp.querySelector(".position_popup-form");
  const form = wrp.querySelector(".form");
  if (!form) return;

  gsap.set(wrp, { display: "none", opacity: 0 });
  gsap.set(form, { xPercent: 100 });

  let pendingRole = null;

  function openPopup(role) {
    pendingRole = role || null;
    if (typeof disableScroll === "function") disableScroll();
    gsap.set(wrp, { display: "flex" });
    gsap.to(wrp, { opacity: 1, duration: 0.3 });
    gsap.to(form, { xPercent: 0, duration: 0.5, ease: "power3.out" });
  }

  function closePopup() {
    gsap.to(form, { xPercent: 100, duration: 0.4, ease: "power3.in" });
    gsap.to(wrp, {
      opacity: 0,
      duration: 0.3,
      delay: 0.1,
      onComplete: () => {
        gsap.set(wrp, { display: "none" });
        form.reset();
        pendingRole = null;
        if (typeof enableScroll === "function") enableScroll();
      },
    });
  }

  form.addEventListener(
    "submit",
    () => {
      if (!pendingRole) return;
      const input = form.querySelector('input[name="role"]');
      if (input) input.value = pendingRole;
    },
    true,
  );

  items.forEach((item) => {
    const btn = item.querySelector(".clickable_btn");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopup(item.getAttribute("data-position"));
    });
  });

  wrp.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".close-btn");
    if (closeBtn) {
      e.preventDefault();
      closePopup();
      return;
    }
    if (popupForm && popupForm.contains(e.target)) return;
    if (!form.contains(e.target)) closePopup();
  });
});
