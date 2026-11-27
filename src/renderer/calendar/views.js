/* Calendar views (D-084): month grid, week hour-grid and agenda list. Dumb DOM builders: they get the events and two
   callbacks (open an event, plan something at a time). Event text comes from Google: textContent only, never HTML. */
(function () {
  const DAY = 86400000;
  const HOUR_PX = 44;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  /** Compact 24-hour times (fit the month chips and match the week grid). */
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  /** Monday-start week. */
  const weekStart = (d) => { const x = day0(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };

  /** Event start/end as Dates (all-day "YYYY-MM-DD" in local time; its end date is exclusive). */
  function span(e) {
    if (e.allDay) {
      const [y, m, dd] = e.start.split('-').map(Number);
      const [y2, m2, d2] = (e.end || e.start).split('-').map(Number);
      return { s: new Date(y, m - 1, dd), e: new Date(y2, m2 - 1, d2) };
    }
    return { s: new Date(e.start), e: new Date(e.end || e.start) };
  }
  /** Events that touch this day, all-day first, then by start. */
  function onDay(events, d) {
    const a = day0(d).getTime();
    const b = a + DAY;
    return events.filter((e) => { const t = span(e); return t.s.getTime() < b && (t.e.getTime() > a || t.s.getTime() === a); })
      .sort((x, y) => (y.allDay - x.allDay) || (span(x).s - span(y).s));
  }
  const cls = (e, now) => ['ev', e.allDay ? 'all' : '', span(e).e < now ? 'past' : '', e.myResponse === 'declined' ? 'declined' : '', e.meet ? 'has-meet' : ''].filter(Boolean).join(' ');

  function chip(e, ctx) {
    const c = el('button', cls(e, ctx.now));
    if (!e.allDay) c.append(el('span', 't', hm(span(e).s)));
    c.append(el('span', 'n', e.summary));
    if (e.meet) c.append(el('span', 'cam', '●'));
    c.title = `${e.summary}${e.location ? ` · ${e.location}` : ''}`;
    c.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.open(e); });
    return c;
  }

  /** Month: 6 Monday-start weeks around the month of `cursor`. */
  function month(root, events, cursor, ctx) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = weekStart(first);
    const grid = el('div', 'month');
    for (const name of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) grid.append(el('div', 'dow', name));
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const cell = el('div', `cell${d.getMonth() !== cursor.getMonth() ? ' out' : ''}${sameDay(d, ctx.now) ? ' today' : ''}`);
      const head = el('div', 'dnum', String(d.getDate()));
      const add = el('button', 'add ico', null); add.dataset.i = 'plus'; add.title = 'Plan something on this day with Tama';
      add.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.plan(d, false); });
      head.append(add);
      cell.append(head);
      const list = onDay(events, d);
      for (const e of list.slice(0, 3)) cell.append(chip(e, ctx));
      if (list.length > 3) { const more = el('button', 'more', `+${list.length - 3} more`); more.addEventListener('click', () => ctx.goto(d, 'agenda')); cell.append(more); }
      cell.addEventListener('dblclick', () => ctx.goto(d, 'week'));
      grid.append(cell);
    }
    root.replaceChildren(grid);
  }

  /** Lay out overlapping timed events side by side (greedy columns per cluster). */
  function columns(list) {
    const items = list.map((e) => ({ e, s: span(e).s.getTime(), t: Math.max(span(e).e.getTime(), span(e).s.getTime() + 15 * 60000), col: 0, cols: 1 }))
      .sort((a, b) => a.s - b.s);
    let cluster = []; let end = 0;
    const flush = () => { const n = Math.max(1, ...cluster.map((x) => x.col + 1)); for (const x of cluster) x.cols = n; cluster = []; };
    for (const it of items) {
      if (cluster.length && it.s >= end) flush();
      const used = new Set(cluster.filter((x) => x.t > it.s).map((x) => x.col));
      let c = 0; while (used.has(c)) c++;
      it.col = c; cluster.push(it); end = Math.max(end, it.t);
    }
    flush();
    return items;
  }

  /** Week: all-day row + an hour grid for Monday..Sunday of `cursor`'s week. */
  function week(root, events, cursor, ctx) {
    const start = weekStart(cursor);
    const wrap = el('div', 'week');
    const head = el('div', 'whead'); head.append(el('div', 'gutter'));
    const allRow = el('div', 'wall'); allRow.append(el('div', 'gutter', 'all day'));
    const body = el('div', 'wbody');
    const hours = el('div', 'hours');
    for (let h = 0; h < 24; h++) hours.append(el('div', 'h', h ? `${String(h).padStart(2, '0')}:00` : ''));
    body.append(hours);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      head.append(el('div', `wd${sameDay(d, ctx.now) ? ' today' : ''}`, d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })));
      const list = onDay(events, d);
      const allCell = el('div', 'wallc');
      for (const e of list.filter((x) => x.allDay)) allCell.append(chip(e, ctx));
      allRow.append(allCell);
      const col = el('div', `wcol${sameDay(d, ctx.now) ? ' today' : ''}`);
      col.style.height = `${24 * HOUR_PX}px`;
      col.addEventListener('click', (ev) => {
        const y = ev.offsetY; const mins = Math.floor((y / HOUR_PX) * 2) * 30;
        const at = new Date(d); at.setHours(0, mins, 0, 0); ctx.plan(at, true);
      });
      for (const it of columns(list.filter((x) => !x.allDay))) {
        const s = new Date(Math.max(it.s, d.getTime())); const t = new Date(Math.min(it.t, d.getTime() + DAY));
        const top = ((s - d) / 3600000) * HOUR_PX; const h = Math.max(18, ((t - s) / 3600000) * HOUR_PX - 2);
        const b = chip(it.e, ctx); b.classList.add('block');
        if (h < 34) b.classList.add('short'); // too short for two lines: time and title side by side
        b.style.top = `${top}px`; b.style.height = `${h}px`;
        b.style.left = `calc(${(100 / it.cols) * it.col}% + 2px)`; b.style.width = `calc(${100 / it.cols}% - 4px)`;
        col.append(b);
      }
      if (sameDay(d, ctx.now)) { const line = el('div', 'nowline'); line.style.top = `${((ctx.now - d) / 3600000) * HOUR_PX}px`; col.append(line); }
      body.append(col);
    }
    wrap.append(head, allRow, body);
    root.replaceChildren(wrap);
    // Start just above the earliest event of the week (or 8:00), so the first meetings are in view.
    const firsts = events.filter((e) => !e.allDay).map((e) => span(e).s).filter((s) => s >= start && s < addDays(start, 7)).map((s) => s.getHours() + s.getMinutes() / 60);
    body.scrollTop = Math.max(0, (Math.min(8, ...firsts) - 0.5) * HOUR_PX);
  }

  /** Agenda: the next 14 days from `cursor`, grouped by day. */
  function agenda(root, events, cursor, ctx) {
    const list = el('div', 'agenda');
    let any = false;
    for (let i = 0; i < 14; i++) {
      const d = addDays(day0(cursor), i);
      const items = onDay(events, d);
      if (!items.length) continue;
      any = true;
      const g = el('section', `aday${sameDay(d, ctx.now) ? ' today' : ''}`);
      g.append(el('h3', '', d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })));
      for (const e of items) {
        const row = el('button', `arow ${cls(e, ctx.now)}`);
        const t = span(e);
        row.append(el('span', 'at', e.allDay ? 'all day' : `${hm(t.s)}–${hm(t.e)}`), el('span', 'an', e.summary));
        if (e.location) row.append(el('span', 'al', e.location));
        if (e.meet) { const j = el('span', 'aj', 'Join'); row.append(j); }
        row.addEventListener('click', () => ctx.open(e));
        g.append(row);
      }
      list.append(g);
    }
    if (!any) list.append(el('div', 'empty', 'Nothing in the next two weeks. Enjoy~'));
    root.replaceChildren(list);
  }

  /** The date range each view needs from Google. */
  function rangeOf(view, cursor) {
    if (view === 'month') { const s = weekStart(new Date(cursor.getFullYear(), cursor.getMonth(), 1)); return { from: s, to: addDays(s, 42) }; }
    if (view === 'week') { const s = weekStart(cursor); return { from: s, to: addDays(s, 7) }; }
    const s = day0(cursor); return { from: s, to: addDays(s, 14) };
  }

  window.TamaCalViews = { month, week, agenda, rangeOf, span, addDays, weekStart, day0, sameDay, hm };
})();
