(() => {
  // ① 주간농사정보: data/weekly.json (scripts/fetch-weekly.ps1이 매주 갱신)
  const weekly = document.getElementById('weekly');
  if (!weekly) return;

  // 모두싹과 관련 있는 분야만, 이 순서로 보여줌
  const FIELDS = [['채소', 'veg'], ['과수', 'fruit'], ['벼', 'rice'], ['밭작물', 'field'], ['특작', 'special']];

  const $ = (name) => weekly.querySelector(`[data-weekly-${name}]`);
  const els = {
    prev: $('prev'), next: $('next'), title: $('title'), period: $('period'), weather: $('weather'),
    source: $('source'), pdf: $('pdf'), notice: $('notice'), fields: $('fields'),
  };
  let issues = [];
  let index = 0;

  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const parts = (iso) => iso.split('-').map(Number);
  const weekLabel = (iso) => { const [, m, d] = parts(iso); return `${m}월 ${Math.ceil(d / 7)}주`; };
  const periodLabel = (start, end) => {
    const [y, m, d] = parts(start);
    const [, em, ed] = parts(end);
    const pad = (n) => String(n).padStart(2, '0');
    return `${y}.${pad(m)}.${pad(d)} – ${pad(em)}.${pad(ed)}`;
  };

  const shownFields = (issue) => FIELDS
    .map(([name, tag]) => ({ tag, ...issue.fields.find((f) => f.name === name) }))
    .filter((f) => f.name && f.items.length);

  const selectedCrop = () => document.querySelector('.crop-chip[aria-pressed="true"]')?.dataset.crop;

  const renderNotice = () => {
    const issue = issues[index];
    const crop = selectedCrop();
    if (!issue || !els.notice) return;
    const mentioned = !crop || shownFields(issue).some((f) => f.name.includes(crop)
      || f.items.some((item) => `${item.topic} ${item.text}`.includes(crop)));
    els.notice.hidden = mentioned;
    if (!mentioned) {
      els.notice.innerHTML = `이번 주 주간농사정보에는 ${esc(crop)} 관련 지침이 없습니다. ${esc(crop)} 농작업은 재배력에서 확인하세요. <a href="#calendar">${esc(crop)} 재배력 보기 →</a>`;
    }
  };

  const render = () => {
    const issue = issues[index];
    const label = issue.start ? weekLabel(issue.start) : '';
    els.title.textContent = `${label} 주간농사정보 (제${issue.no}호)`.trim();
    if (issue.start) {
      els.period.textContent = periodLabel(issue.start, issue.end);
      els.period.dateTime = issue.start;
    }
    els.prev.disabled = index >= issues.length - 1;
    els.next.disabled = index === 0;

    els.weather.innerHTML = issue.weather.map((card) => `
      <li class="weather-card weather-card--${esc(card.type)}"><span class="weather-card__tag">${esc(card.tag)}</span><strong>${esc(card.title)}</strong><p>${esc(card.desc)}</p></li>`).join('');

    els.source.textContent = `농촌진흥청 주간농사정보 제${issue.no}호 요약입니다. 모두싹과 관련 있는 분야만 골라 보여드립니다.`;
    els.pdf.hidden = !issue.pdf;
    if (issue.pdf) els.pdf.href = issue.pdf;

    els.fields.innerHTML = shownFields(issue).map((field) => `
      <section class="field-row">
        <h4 class="field-row__tag field-row__tag--${field.tag}">${esc(field.name)}</h4>
        <dl>${field.items.map((item) => `<div><dt>${esc(item.topic || field.name)}</dt><dd>${esc(item.text)}</dd></div>`).join('')}</dl>
      </section>`).join('');

    renderNotice();
  };

  els.prev.addEventListener('click', () => { if (index < issues.length - 1) { index += 1; render(); } });
  els.next.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });

  document.querySelectorAll('.crop-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.crop-chip').forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
      renderNotice();
    });
  });

  // 불러오지 못하면 HTML에 적힌 내용을 그대로 둠
  fetch('data/weekly.json', { cache: 'no-cache' })
    .then((res) => res.json())
    .then((data) => {
      issues = (data.issues || []).filter((issue) => issue.fields?.length);
      if (issues.length) render();
    })
    .catch(() => {});
})();
