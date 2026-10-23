(() => {
  // 기술 > 시험성적서: data/reports.json으로 분류 버튼·검색·카드 목록을 그림
  const panel = document.getElementById('reports');
  if (!panel) return;

  const $ = (name) => panel.querySelector(`[data-reports-${name}]`);
  const els = { total: $('total'), filter: $('filter'), search: $('search'), count: $('count'), list: $('list') };
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const norm = (s = '') => s.replace(/\s+/g, '').toLowerCase();
  const dateLabel = (d = '') => d.replace(/-/g, '.');
  let data = { categories: [], reports: [] };
  let category = '전체';
  let query = '';

  const matches = (r) => (category === '전체' || r.category === category)
    && (!query || norm([r.title, r.crop, r.org, r.category].join(' ')).includes(norm(query)));

  const renderFilter = () => {
    const names = ['전체', ...data.categories];
    els.filter.innerHTML = names.map((name) => {
      const count = name === '전체' ? data.reports.length : data.reports.filter((r) => r.category === name).length;
      return `<button type="button" class="news-filter__btn" aria-pressed="${name === category}" data-category="${esc(name)}">${esc(name)}<span>${count}</span></button>`;
    }).join('');
  };

  // 성적서가 아직 없으면 같은 모양의 '정리 중' 카드로 자리를 보여 줌
  const placeholder = () => data.categories.map((name) => `
    <li class="report-card report-card--empty">
      <span class="report-card__cat">${esc(name)}</span>
      <strong class="report-card__title">시험성적서를 정리하고 있습니다</strong>
      <p class="report-card__meta">곧 성적서 파일과 함께 올라옵니다</p>
    </li>`).join('');

  const card = (r) => {
    const meta = [r.crop, r.org, dateLabel(r.date)].filter(Boolean).map(esc).join(' · ');
    const body = `
      <span class="report-card__cat">${esc(r.category)}</span>
      <strong class="report-card__title">${esc(r.title)}</strong>
      <p class="report-card__meta">${meta}</p>`;
    return r.file
      ? `<li><a class="report-card" href="${esc(r.file)}" target="_blank" rel="noopener">${body}<span class="report-card__open">성적서 보기 ↗</span></a></li>`
      : `<li class="report-card">${body}</li>`;
  };

  const renderList = () => {
    if (!data.reports.length) {
      els.count.textContent = '';
      els.list.innerHTML = placeholder();
      return;
    }
    const found = data.reports.filter(matches);
    els.count.textContent = query ? `'${query}' 검색 결과 ${found.length}건` : `${category} ${found.length}건`;
    els.list.innerHTML = found.length ? found.map(card).join('') : '<li class="news-empty">찾는 시험성적서가 없습니다. 다른 이름으로 검색해 보세요.</li>';
  };

  els.filter.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    renderFilter();
    renderList();
  });
  els.search.addEventListener('submit', (event) => {
    event.preventDefault();
    query = els.search.elements.q.value.trim();
    renderList();
  });
  els.search.elements.q.addEventListener('input', (event) => { if (!event.target.value && query) { query = ''; renderList(); } });

  fetch('data/reports.json', { cache: 'no-cache' })
    .then((res) => res.json())
    .then((json) => {
      data = { categories: json.categories || [], reports: json.reports || [] };
      if (json.total) els.total.textContent = json.total;
      // 성적서가 올라오기 전에는 분류·검색 줄을 숨김 (모두 0건으로 보이지 않게)
      panel.querySelector('.reports-tools').hidden = !data.reports.length;
      renderFilter();
      renderList();
    })
    .catch(() => {});
})();
