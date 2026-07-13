import { data } from '../data.js';
import { fmtDate, daysBetween, statusColor } from '../helpers.js';

export function render() {
  const wrap = document.getElementById('timelineWrap');
  if (!data.projects.length) { wrap.innerHTML = '<div class="empty-state">No projects to show.</div>'; return; }

  const starts = data.projects.map(p => new Date(p.start));
  const ends   = data.projects.map(p => new Date(p.end));
  let rangeStart = new Date(Math.min(...starts));
  let rangeEnd   = new Date(Math.max(...ends));
  rangeStart.setDate(1);
  rangeEnd = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, 0);
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));

  const months = [];
  let cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    months.push(cur.toLocaleDateString(undefined, { month: 'short', year: cur.getMonth() === 0 ? 'numeric' : undefined }));
    cur.setMonth(cur.getMonth() + 1);
  }

  let html = `<div class="timeline-header"><div class="label-col"></div><div class="months">${months.map(m => `<div class="month">${m}</div>`).join('')}</div></div>`;
  data.projects.forEach(p => {
    const offsetPct = daysBetween(rangeStart, p.start) / totalDays * 100;
    const widthPct  = Math.max(1.5, daysBetween(p.start, p.end) / totalDays * 100);
    const taskDots  = data.tasks.filter(t => t.project === p.id).map(t => {
      const dotPct = daysBetween(rangeStart, t.due) / totalDays * 100;
      const done = t.status === 'Done';
      return `<div title="${t.name} (${fmtDate(t.due)})" style="position:absolute;left:${dotPct}%;top:-4px;width:8px;height:8px;border-radius:50%;background:${done ? 'var(--green)' : 'var(--text)'};border:2px solid #fff;transform:translateX(-50%)"></div>`;
    }).join('');
    html += `<div class="timeline-row">
      <div class="label-col">${p.name}</div>
      <div class="track">
        <div class="timeline-bar" style="left:${offsetPct}%;width:${widthPct}%;background:${statusColor(p.status)}">${p.name}</div>
        ${taskDots}
      </div>
    </div>`;
  });
  wrap.innerHTML = html;
}
