// platform cards horizontal scroll — sticky variant
// .platform_contain = tall outer wrapper, .w-dyn-list = sticky stage,
// .platform_scroll = the track translated on scroll progress.
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector(".platform_contain");
  if (!wrap) return;
  const stage = wrap.querySelector(".platform_stage");
  const line = wrap.querySelector(".platform_scroll");
  const items = wrap.querySelectorAll(".platform_item");
  if (!stage || !line || !items.length) return;

  gsap.matchMedia().add("(min-width: 992px)", () => {
    const stageWidth = stage.offsetWidth;
    const lineWidth = line.scrollWidth;
    if (lineWidth <= stageWidth) return;

    const scrollAmount = lineWidth - stageWidth;

    // Make .w-dyn-list the sticky stage and .platform_contain the tall
    // scrollable wrapper. Done inline so Webflow CSS doesn't need edits.
    stage.style.position = "sticky";
    stage.style.top = "3.61rem";
    stage.style.height = "calc(100vh - 3.61rem)";
    stage.style.overflowX = "clip";
    wrap.style.height = window.innerHeight + scrollAmount + "px";

    gsap.to(line, {
      x: -scrollAmount,
      ease: "none",
      scrollTrigger: {
        trigger: wrap,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        // markers: true,
      },
    });
  });
});
