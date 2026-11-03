/** Keeps the fake menu bar's clock reading the real time, macOS-style. */
export function initMenubar(section: HTMLElement): void {
  const clock = section.querySelector<HTMLElement>('.brand__menubar-clock');
  if (!clock) return;

  function tick() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    clock!.textContent = `${hours}:${minutes} ${period}`;
  }

  tick();
  setInterval(tick, 15000);
}
