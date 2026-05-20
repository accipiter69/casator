// platform cards horizontal scroll (port of mindly joining section)
document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.querySelector(".platform_contain");
  if (!gallery) return;
  const line = gallery.querySelector(".platform_scroll");
  const items = gallery.querySelectorAll(".platform_item");
  if (!line || !items.length) return;

  let mm = gsap.matchMedia();

  mm.add("(min-width: 992px)", () => {
    const galleryWidth = gallery.offsetWidth;
    const lineWidth = line.scrollWidth;

    if (lineWidth > galleryWidth) {
      function getScrollAmount() {
        return -(lineWidth - galleryWidth);
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: gallery,
          pin: true,
          markers: true,
          start: "top top",
          end: () => `+=${getScrollAmount() * -1}`,
          scrub: true,
          invalidateOnRefresh: true,
          pinSpa,
        },
      });

      const itemCount = items.length;
      const duration = 3;
      const itemDuration = duration / itemCount;

      items.forEach((item, index) => {
        const position = index * itemDuration;
        tl.to(
          line,
          {
            x: (getScrollAmount() / itemCount) * (index + 1),
            duration: itemDuration,
            ease: "none",
          },
          position,
        );
      });
    }
  });
});
