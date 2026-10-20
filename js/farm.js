(() => {
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const parts = (iso) => iso.split('-').map(Number);
  const periodLabel = (start, end) => {
    const [y, m, d] = parts(start);
    const [, em, ed] = parts(end);
    const pad = (n) => String(n).padStart(2, '0');
    return `${y}.${pad(m)}.${pad(d)} – ${pad(em)}.${pad(ed)}`;
  };
  // 온도·비율·양 같은 수치는 굵게
  const UNIT = /(\d+(?:[.,]\d+)?(?:\s*~\s*\d+(?:[.,]\d+)?)?\s*(?:℃|%|㎜|㎝|cm|mm|kg\/10a|kg|주일|일|회|시간))/g;
  const highlight = (s) => esc(s).replace(UNIT, '<b>$1</b>');
  const loadJson = (url) => fetch(url, { cache: 'no-cache' }).then((res) => res.json());

  // 탭: #weekly / #calendar / #pests
  const tabs = [...document.querySelectorAll('.farm-tabs__item')];
  const breadcrumb = document.querySelector('[data-breadcrumb-current]');
  const showTab = (id) => {
    const current = tabs.find((tab) => tab.hash === `#${id}`) || tabs[0];
    if (!current) return;
    tabs.forEach((tab) => {
      const selected = tab === current;
      tab.setAttribute('aria-selected', String(selected));
      const panel = document.getElementById(tab.hash.slice(1));
      if (panel) panel.hidden = !selected;
    });
    if (breadcrumb) breadcrumb.textContent = current.textContent;
  };
  tabs.forEach((tab) => tab.addEventListener('click', (event) => {
    event.preventDefault();
    history.replaceState(null, '', tab.hash);
    showTab(tab.hash.slice(1));
  }));
  // 본문 안 '#calendar' 같은 링크로 탭을 옮기면 탭 줄이 보이게 올려 줌
  window.addEventListener('hashchange', () => {
    showTab(location.hash.slice(1));
    document.querySelector('.farm-tabs')?.scrollIntoView({ block: 'start' });
  });
  showTab(location.hash.slice(1));

  // ① 주간농사정보: data/weekly.json (scripts/fetch-weekly.ps1이 매주 갱신)
  (() => {
    const panel = document.getElementById('weekly');
    if (!panel) return;

    // 모두싹과 관련 있는 분야만, 이 순서로 보여줌
    const FIELDS = [['채소', 'veg'], ['과수', 'fruit'], ['벼', 'rice'], ['밭작물', 'field'], ['특작', 'special']];
    const $ = (name) => panel.querySelector(`[data-weekly-${name}]`);
    const els = {
      prev: $('prev'), next: $('next'), title: $('title'), period: $('period'), weather: $('weather'),
      source: $('source'), pdf: $('pdf'), fields: $('fields'),
    };
    let issues = [];
    let index = 0;

    const weekLabel = (iso) => { const [, m, d] = parts(iso); return `${m}월 ${Math.ceil(d / 7)}주`; };

    // 쉼표로 길게 이어진 문장은 '○○은/는'으로 새 대상이 시작될 때만 줄을 나눔 (1,331 같은 숫자 쉼표 제외)
    const splitPoints = (text) => text.split(/,\s*(?!\d)/).reduce((points, part) => {
      const words = part.trim().split(/\s+/).slice(0, 2);
      if (!points.length || words.some((word) => /[은는]$/.test(word))) points.push(part.trim());
      else points[points.length - 1] += `, ${part.trim()}`;
      return points;
    }, []);
    const itemBody = (item) => {
      const points = splitPoints(item.text);
      const body = points.length > 1
        ? `<ul class="field-points">${points.map((point) => `<li>${highlight(point)}</li>`).join('')}</ul>`
        : highlight(item.text);
      return item.note ? `${body}<small class="field-note">※ ${esc(item.note)}</small>` : body;
    };

    const shownFields = (issue) => FIELDS
      .map(([name, tag]) => ({ tag, ...issue.fields.find((f) => f.name === name) }))
      .filter((f) => f.name && f.items.length);

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
          <dl>${field.items.map((item) => `<div><dt>${esc(item.topic || field.name)}</dt><dd>${itemBody(item)}</dd></div>`).join('')}</dl>
        </section>`).join('');
    };

    els.prev.addEventListener('click', () => { if (index < issues.length - 1) { index += 1; render(); } });
    els.next.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });

    // 불러오지 못하면 HTML에 적힌 내용을 그대로 둠
    loadJson('data/weekly.json')
      .then((data) => {
        issues = (data.issues || []).filter((issue) => issue.fields?.length);
        if (issues.length) render();
      })
      .catch(() => {});
  })();

  // ③ 병해충 정보: data/pest.json (scripts/fetch-pest.ps1이 매달 갱신)
  (() => {
    const panel = document.getElementById('pests');
    if (!panel) return;

    const LEVELS = { 경보: 'alert', 주의보: 'caution', 예보: 'forecast' };
    const rank = (level) => Object.keys(LEVELS).indexOf(level);
    const byLevel = (a, b) => rank(a.level) - rank(b.level);
    const $ = (name) => panel.querySelector(`[data-pest-${name}]`);
    const els = {
      prev: $('prev'), next: $('next'), title: $('title'), period: $('period'), pdf: $('pdf'),
      summary: $('summary'), desc: $('desc'), filter: $('filter'), list: $('list'),
    };
    let issues = [];
    let index = 0;
    let category = '전체';
    let query = '';  // 히어로 아래 병해충 검색어
    let expanded = false;  // 처음엔 카드 3개만, 더보기로 나머지 펼침
    const PREVIEW = 3;

    // 반달 호(1~15일, 16~말일)는 상·하반기로 표시
    const issueLabel = (issue) => {
      if (!issue.start) return '';
      const [, m, d] = parts(issue.start);
      const [, , ed] = parts(issue.end);
      if (d >= 16) return `${m}월 하반기`;
      return ed <= 15 ? `${m}월 상반기` : `${m}월`;
    };
    const badge = (level) => `<span class="pest-level pest-level--${LEVELS[level] || 'forecast'}">${esc(level)}</span>`;
    // 띄어쓰기 없이 비교 (예: '배추 노균병' = '배추노균병')
    const squash = (s) => s.replace(/\s+/g, '');
    const matchesQuery = (item, q) => [item.title, ...item.situation, ...item.control, ...(item.images || []).map((img) => img.alt)]
      .some((text) => squash(text).includes(squash(q)));
    const bullets = (list) => `<ul class="pest-points">${list.map((text) => `<li>${highlight(text)}</li>`).join('')}</ul>`;
    // PDF에서 잘라 온 증상·해충 사진 (누르면 원본 크기로 열림)
    const photos = (images) => `<div class="pest-photos">${images.map((img) => `
      <figure><a href="${esc(img.src)}" target="_blank" rel="noopener"><img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy"></a><figcaption>${esc(img.alt)}</figcaption></figure>`).join('')}</div>`;

    const renderSummary = (issue) => {
      els.summary.innerHTML = issue.summary.map((group) => `
        <section class="pest-sum">
          <h4>${esc(group.category)}</h4>
          <dl>${[...group.alerts].sort(byLevel).map((alert) => `
            <div><dt>${badge(alert.level)}<span>${esc(alert.type)}</span></dt>
            <dd>${alert.names.map((name) => `<span class="pest-name${query && squash(name).includes(squash(query)) ? ' is-match' : ''}">${esc(name)}</span>`).join('')}</dd></div>`).join('')}
          </dl>
        </section>`).join('');
    };

    const renderList = () => {
      const issue = issues[index];
      const matched = query ? issue.items.filter((item) => matchesQuery(item, query)) : [];
      const base = matched.length ? matched : issue.items;
      const categories = ['전체', ...new Set(base.map((item) => item.category))];
      if (!categories.includes(category)) category = '전체';
      const shown = base.filter((item) => category === '전체' || item.category === category).sort(byLevel);

      if (!query) els.desc.textContent = '이번 호 병해충 정보입니다.';
      else if (matched.length) els.desc.textContent = `'${query}' 검색 결과 ${matched.length}건입니다.`;
      else els.desc.textContent = `'${query}' 검색 결과가 없어 이번 호 전체 병해충 정보를 보여드립니다.`;

      els.filter.innerHTML = categories.map((name) => `
        <button type="button" class="pest-filter__btn" aria-pressed="${name === category}" data-category="${esc(name)}">${esc(name)}</button>`).join('');

      const visible = expanded || query ? shown : shown.slice(0, PREVIEW);
      const rest = shown.length - PREVIEW;
      const moreButton = rest > 0 && !query
        ? `<button type="button" class="pest-more" data-pest-more aria-expanded="${expanded}">${expanded ? '접기 ▴' : `더보기 (${rest}건) ▾`}</button>`
        : '';

      els.list.innerHTML = visible.map((item, i) => `
        <details class="pest-card pest-card--${LEVELS[item.level] || 'forecast'}"${matched.length || i < 2 ? ' open' : ''}>
          <summary>${item.images?.length ? `<img class="pest-card__thumb" src="${esc(item.images[0].src)}" alt="" loading="lazy">` : ''}${badge(item.level)}<span class="pest-card__cat">${esc(item.category)}</span><strong>${esc(item.title)}</strong></summary>
          <div class="pest-card__body">
            ${item.images?.length ? photos(item.images) : ''}
            ${item.situation.length ? `<section><h5>발생 상황</h5>${bullets(item.situation)}</section>` : ''}
            ${item.control.length ? `<section><h5>방제 요령</h5>${bullets(item.control)}</section>` : ''}
            ${item.notes.length ? `<ul class="pest-notes">${item.notes.map((note) => `<li>※ ${esc(note)}</li>`).join('')}</ul>` : ''}
          </div>
        </details>`).join('') + moreButton || '<p class="pest-empty">이 분야에 해당하는 항목이 없습니다.</p>';
    };

    const render = () => {
      const issue = issues[index];
      if (!issue) return;
      els.title.textContent = `${issueLabel(issue)} 병해충 발생정보 (제${issue.no}호)`.trim();
      if (issue.start) {
        els.period.textContent = periodLabel(issue.start, issue.end);
        els.period.dateTime = issue.start;
      }
      els.prev.disabled = index >= issues.length - 1;
      els.next.disabled = index === 0;
      els.pdf.hidden = !issue.pdf;
      if (issue.pdf) els.pdf.href = issue.pdf;
      expanded = false;
      renderSummary(issue);
      renderList();
    };

    // 검색: 이번 호에 없으면 지난호 중 가장 최근에 나온 호로 옮겨 보여줌
    const search = (value) => {
      query = value.trim();
      category = '전체';
      if (query && !issues[index]?.items.some((item) => matchesQuery(item, query))) {
        const found = issues.findIndex((issue) => issue.items.some((item) => matchesQuery(item, query)));
        if (found >= 0) index = found;
      }
      render();
    };
    const searchForm = document.querySelector('[data-pest-search]');
    searchForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      search(searchForm.elements.q.value);
      if (location.hash !== '#pests') location.hash = '#pests';
      else document.querySelector('.farm-tabs')?.scrollIntoView({ block: 'start' });
    });
    // 검색창을 비우면(× 버튼 포함) 검색 해제
    searchForm?.elements.q.addEventListener('input', (event) => { if (!event.target.value && query) search(''); });

    els.prev.addEventListener('click', () => { if (index < issues.length - 1) { index += 1; render(); } });
    els.next.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
    els.filter.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      category = button.dataset.category;
      expanded = false;
      renderList();
    });
    els.list.addEventListener('click', (event) => {
      if (!event.target.closest('[data-pest-more]')) return;
      expanded = !expanded;
      renderList();
      // 접을 때는 목록 처음으로 돌아가 위치를 잃지 않게
      if (!expanded) els.filter.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });

    loadJson('data/pest.json')
      .then((data) => {
        issues = (data.issues || []).filter((issue) => issue.items?.length);
        render();
      })
      .catch(() => {});
  })();
})();
