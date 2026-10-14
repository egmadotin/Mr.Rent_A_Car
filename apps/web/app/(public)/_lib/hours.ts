const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h! % 12 === 0 ? 12 : h! % 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h! < 12 ? "am" : "pm"}`;
};

/** Collapse weekly hours into "Monday – Friday: 8:30am – 6pm" style lines (as on the current site). */
export function hoursLines(hours: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const text = (d: number) => {
    const h = hours.find((x) => x.dayOfWeek === d);
    return !h || h.isClosed || !h.opensAt || !h.closesAt ? "Closed" : `${fmt(h.opensAt)} – ${fmt(h.closesAt)}`;
  };
  const lines: string[] = [];
  let start = order[0]!;
  for (let i = 1; i <= order.length; i++) {
    const prev = order[i - 1]!;
    const cur = order[i];
    if (cur === undefined || text(cur) !== text(prev)) {
      const span = start === prev ? DAYS[start] : `${DAYS[start]} – ${DAYS[prev]}`;
      lines.push(`${span}: ${text(prev)}`);
      if (cur !== undefined) start = cur;
    }
  }
  return lines;
}
