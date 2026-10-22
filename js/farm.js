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
    // 위쪽 검색 영역: 주간농사정보·재배력은 작물 검색, 병해충 정보는 병해충 검색
    const active = current.hash.slice(1);
    document.querySelectorAll('[data-tab-for]').forEach((box) => { box.hidden = !box.dataset.tabFor.split(' ').includes(active); });
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

  // 작물 선택: 위쪽 주력 작물 버튼·작물 검색을 주간농사정보와 작물재배력이 함께 사용
  const chips = [...document.querySelectorAll('.crop-chip')];
  const cropWatchers = [];
  let crop = chips.find((chip) => chip.getAttribute('aria-pressed') === 'true')?.dataset.crop || '';
  const selectCrop = (name) => {
    crop = name;
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.crop === name)));
    cropWatchers.forEach((watch) => watch());
  };
  chips.forEach((chip) => chip.addEventListener('click', () => selectCrop(chip.dataset.crop)));
  const cropForm = document.querySelector('[data-crop-search]');
  // 검색 결과로 화면 이동: 지금 열린 탭에서 강조된 항목 → 없으면 '정보 없음' 안내 → 재배력 카드 순
  const scrollToResult = () => requestAnimationFrame(() => {
    const panel = document.querySelector('.farm-panel:not([hidden])');
    const target = panel?.querySelector('.is-match, [data-weekly-notice]:not([hidden]), [data-calendar-notice]:not([hidden]), .cal-now');
    (target || panel)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  cropForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = cropForm.elements.crop.value.trim();
    if (!name) return;
    selectCrop(name);
    scrollToResult();
  });
  // farm.html?crop=마늘 처럼 주소로 작물을 정해서 열 수 있음
  const cropParam = new URLSearchParams(location.search).get('crop');
  if (cropParam) {
    selectCrop(cropParam.trim());
    if (cropForm) cropForm.elements.crop.value = cropParam.trim();
  }
  // 정보가 없을 때 안내 (TODO: 문자 상담 번호를 받으면 sms: 링크 추가)
  const noInfo = (what) => `${what} 정보가 없습니다. 궁금하신 작물이 있으시면 상담전화나 문자 주시면 상세히 상담해드리겠습니다. <a href="tel:15227008">☎ 1522-7008</a>`;

  // ① 주간농사정보: data/weekly.json (scripts/fetch-weekly.ps1이 매주 갱신)
  (() => {
    const panel = document.getElementById('weekly');
    if (!panel) return;

    // 모두싹과 관련 있는 분야만, 이 순서로 보여줌
    const FIELDS = [['채소', 'veg'], ['과수', 'fruit'], ['벼', 'rice'], ['밭작물', 'field'], ['특작', 'special']];
    const $ = (name) => panel.querySelector(`[data-weekly-${name}]`);
    const els = {
      prev: $('prev'), next: $('next'), title: $('title'), period: $('period'), weather: $('weather'),
      source: $('source'), pdf: $('pdf'), notice: $('notice'), fields: $('fields'),
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

    const renderNotice = () => {
      const issue = issues[index];
      if (!issue || !els.notice) return;
      // 고른 작물이 나오는 항목은 강조 (검색하면 첫 항목으로 화면 이동)
      els.fields.querySelectorAll('dl > div').forEach((row) => {
        row.classList.toggle('is-match', Boolean(crop) && row.textContent.includes(crop));
      });
      const mentioned = !crop || shownFields(issue).some((f) => f.name.includes(crop)
        || f.items.some((item) => `${item.topic} ${item.text}`.includes(crop)));
      els.notice.hidden = mentioned;
      if (!mentioned) {
        els.notice.innerHTML = noInfo(`이번 주 ${esc(crop)} 농작업`);
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
          <dl>${field.items.map((item) => `<div><dt>${esc(item.topic || field.name)}</dt><dd>${itemBody(item)}</dd></div>`).join('')}</dl>
        </section>`).join('');

      renderNotice();
    };

    els.prev.addEventListener('click', () => { if (index < issues.length - 1) { index += 1; render(); } });
    els.next.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });

    cropWatchers.push(renderNotice);

    // 불러오지 못하면 HTML에 적힌 내용을 그대로 둠
    loadJson('data/weekly.json')
      .then((data) => {
        issues = (data.issues || []).filter((issue) => issue.fields?.length);
        if (issues.length) render();
      })
      .catch(() => {});
  })();

  // ② 작물재배력: data/calendar.json (images/calendar 재배력 그림을 옮겨 적은 데이터)
  (() => {
    const panel = document.getElementById('calendar');
    if (!panel) return;

    const $ = (name) => document.querySelector(`[data-calendar-${name}]`);
    const els = {
      notice: $('notice'), body: $('body'), nowTag: $('now-tag'), nowTitle: $('now-title'), nowPoints: $('now-points'),
      photo: $('photo'), pests: $('pests'), title: $('title'), table: $('table'), uses: $('uses'),
      dilution: $('dilution'), notes: $('notes'), downloadTitle: $('download-title'), download: $('download'),
    };
    const allButton = document.querySelector('[data-crop-all]');
    const allList = document.querySelector('[data-crop-all-list]');
    let data = { crops: [] };

    // 상·중·하순 → 1~36칸 (1월 상순 = 1, 12월 하순 = 36)
    const DEKADS = ['상', '중', '하'];
    const SPAN = /^(\d{1,2})(상|중|하)(?:-(\d{1,2})(상|중|하))?$/;
    const toSlot = (month, dekad) => (month - 1) * 3 + DEKADS.indexOf(dekad) + 1;
    const parseSpan = (text) => {
      const [, m1, d1, m2 = m1, d2 = d1] = text.match(SPAN);
      return [toSlot(+m1, d1), toSlot(+m2, d2)];
    };
    // 해를 넘기는 기간(11중-2상)은 두 토막으로 나눔
    const pieces = ([from, to]) => (from <= to ? [[from, to]] : [[from, 36], [1, to]]);
    const covers = (span, slot) => pieces(parseSpan(span)).some(([from, to]) => from <= slot && slot <= to);

    const ROWS = {
      stage: { title: '생육 단계', tone: 'green' }, task: { title: '주요 작업', tone: 'sand' },
      fert: { title: '웃거름', tone: 'cream' }, uses: { title: '모두싹 사용' },
      weather: { title: '기상', tone: 'blue' }, pest: { title: '주의할 병해충', tone: 'pink' },
    };
    const toneOf = (kind, label) => {
      if ((kind === 'stage' || kind === 'task') && /수확|수매|저장|출하/.test(label)) return 'harvest';
      if (kind === 'weather' && /가뭄|고온/.test(label)) return 'dry';
      return ROWS[kind].tone;
    };

    // 오늘 날짜 → 지금 칸, 이번 주(월~일)
    const today = new Date();
    const nowMonth = today.getMonth() + 1;
    const nowDekad = DEKADS[Math.min(2, Math.floor((today.getDate() - 1) / 10))];
    const nowSlot = toSlot(nowMonth, nowDekad);
    const weekRange = () => {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
      return `${fmt(monday)} – ${fmt(sunday)}`;
    };

    const findCrop = (name) => {
      const q = name.replace(/\s+/g, '');
      return data.crops.find((c) => c.name === q)
        || data.crops.find((c) => (c.aliases || []).includes(q))
        || data.crops.find((c) => c.name.includes(q));
    };
    const usesOf = (cropData) => cropData.uses.map((use, i) => ({ ...use, no: i + 1, slot: parseSpan(use.at)[0] }));
    const activeLabels = (cropData, kinds) => cropData.rows
      .filter((row) => kinds.includes(row.kind))
      .flatMap((row) => (row.bars || []).filter(([, span]) => covers(span, nowSlot)).map(([label]) => label));
    const unique = (list) => [...new Set(list)];
    const slotLabel = (at) => at.replace(/(\d+)(.)/, '$1월 $2순');

    // 지금 시기 카드
    const renderNow = (cropData) => {
      els.nowTag.textContent = `지금 시기 · ${nowMonth}월 ${Math.ceil(today.getDate() / 7)}주 (${weekRange()})`;
      const doing = unique(activeLabels(cropData, ['stage', 'task'])).map((label) => label.replace(/ · /g, '·'));
      els.nowTitle.title = els.nowTitle.textContent = doing.length
        ? `${cropData.name} ${doing.slice(0, 2).join(', ')} 시기`
        : `${cropData.name} 다음 작기 준비 시기`;

      const points = [];
      const tasks = unique(activeLabels(cropData, ['task', 'fert']));
      if (tasks.length) points.push(`지금 할 일: ${tasks.join(', ')}`);
      const weather = unique(activeLabels(cropData, ['weather']));
      if (weather.length) points.push(`${weather.join(', ')} — 날씨 대비가 필요합니다`);
      const pests = unique(activeLabels(cropData, ['pest']));
      if (pests.length) points.push(`주의: ${pests.join(', ')}`);
      // 다음 모두싹 사용 시기 (올해 남은 게 없으면 내년 첫 번째)
      const uses = [...usesOf(cropData)].sort((a, b) => a.slot - b.slot);
      const next = uses.find((use) => use.slot >= nowSlot) || uses[0];
      if (next) points.push(`다음 모두싹 사용: ${next.no}번 ${next.title} (${slotLabel(next.at)})`);
      els.nowPoints.innerHTML = points.slice(0, 3).map((point) => `<li title="${esc(point)}">${esc(point)}</li>`).join('');

      els.photo.hidden = !cropData.photo;
      els.photo.closest('.cal-now').classList.toggle('has-photo', Boolean(cropData.photo));
      if (cropData.photo) els.photo.src = cropData.photo;
    };

    // 연간 재배력 표: 첫 칸은 줄 제목, 나머지 36칸은 상·중·하순
    const renderTable = (cropData) => {
      const cells = ['<div class="cal-table__corner" role="columnheader"></div>'];
      for (let m = 1; m <= 12; m += 1) {
        cells.push(`<div class="cal-table__month${m === nowMonth ? ' is-now' : ''}" role="columnheader" style="grid-column:${(m - 1) * 3 + 2} / span 3">${m}월</div>`);
      }
      let line = 2;  // 1줄은 월 머리글
      cropData.rows.filter((row) => row.kind === 'uses' || row.bars?.length).forEach((row) => {
        // 겹치는 막대는 아래 줄로 내림
        const lanes = [];
        if (row.kind === 'uses') {
          lanes.push(usesOf(cropData).map((use) => ({ dot: use.no, from: use.slot, to: use.slot, label: use.title })));
        } else {
          row.bars
            .flatMap(([label, span]) => pieces(parseSpan(span)).map(([from, to]) => ({ label, from, to, tone: toneOf(row.kind, label) })))
            .sort((a, b) => a.from - b.from)
            .forEach((item) => {
              const lane = lanes.find((list) => list.at(-1).to < item.from);
              if (lane) lane.push(item); else lanes.push([item]);
            });
        }
        const rows = `grid-row:${line} / span ${lanes.length}`;
        cells.push(`<div class="cal-table__label" role="rowheader" style="${rows}">${esc(row.title || ROWS[row.kind].title)}</div>`);
        cells.push(`<div class="cal-table__line" aria-hidden="true" style="${rows}"></div>`);
        lanes.forEach((lane, i) => lane.forEach((item) => {
          const place = `grid-row:${line + i};grid-column:${item.from + 1} / ${item.to + 2}`;
          cells.push(item.dot
            ? `<span class="cal-dot cal-dot--${item.dot}" role="cell" style="${place}" title="${esc(item.label)}">${item.dot}</span>`
            : `<span class="cal-bar cal-bar--${item.tone}" role="cell" style="${place}" title="${esc(item.label)}">${esc(item.label)}</span>`);
        }));
        line += lanes.length;
      });
      // 지금 달 노란 열 + '지금 · 중순' 표시
      cells.push(`<div class="cal-table__now" aria-hidden="true" style="grid-column:${(nowMonth - 1) * 3 + 2} / span 3;grid-row:1 / ${line}"><span>지금 · ${nowDekad}순</span></div>`);
      els.table.innerHTML = cells.join('');
      // 좁은 화면에서는 표를 지금 달 근처로 밀어 둠
      const scroller = els.table.parentElement;
      const nowColumn = els.table.querySelector('.cal-table__now');
      scroller.scrollLeft = Math.max(0, nowColumn.offsetLeft - scroller.clientWidth / 2);
    };

    const renderUses = (cropData) => {
      els.uses.innerHTML = usesOf(cropData).map((use) => `
        <li class="cal-use">
          <h3><span class="cal-dot cal-dot--${use.no}" aria-hidden="true">${use.no}</span>${esc(use.title)}</h3>
          <p>${esc(use.desc)}</p>
          <div class="cal-use__recipe">${use.recipe.map((text) => `<span>${highlight(text)}</span>`).join('')}</div>
        </li>`).join('');
      els.notes.innerHTML = [
        ...(cropData.notes || []),
        '지역과 작형에 따라 시기가 다를 수 있으니, 궁금한 점은 상담으로 확인하세요.',
        '경엽 살포 시 모두싹딱풀을 섞으면 약흔이 줄고 약효가 높아집니다.',
      ].map((note) => `<li>${esc(note)}</li>`).join('');
    };

    const render = () => {
      const cropData = crop ? findCrop(crop) : data.crops[0];
      allList.querySelectorAll('[data-crop]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.crop === cropData?.name)));
      els.notice.hidden = Boolean(cropData);
      els.body.hidden = !cropData;
      if (!cropData) {
        els.notice.innerHTML = noInfo(`${esc(crop)} 재배력`);
        return;
      }
      const name = cropData.subtitle ? `${cropData.name}(${cropData.subtitle})` : cropData.name;
      renderNow(cropData);
      els.title.textContent = `${name} 연간 재배력`;
      renderTable(cropData);
      renderUses(cropData);
      els.downloadTitle.textContent = `${name} 재배력 원본`;
      els.download.href = cropData.image;
      els.download.download = `${cropData.name} 재배력.png`;
    };

    // 위쪽 '전체 작물 보기': 재배력이 있는 작물을 분야별로
    const renderAll = () => {
      const groups = [...new Set(data.crops.map((c) => c.group))];
      allButton.textContent = `전체 작물 ${data.crops.length}종 보기 ▾`;
      allList.innerHTML = groups.map((group) => `
        <div class="crop-all-list__group">
          <strong>${esc(group)}</strong>
          ${data.crops.filter((c) => c.group === group).map((c) => `<button type="button" class="crop-chip" aria-pressed="false" data-crop="${esc(c.name)}">${esc(c.name)}</button>`).join('')}
        </div>`).join('');
    };
    const toggleAll = (open) => {
      allList.hidden = !open;
      allButton.setAttribute('aria-expanded', String(open));
    };
    allButton.addEventListener('click', () => toggleAll(allList.hidden));
    allList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-crop]');
      if (!button) return;
      selectCrop(button.dataset.crop);
      toggleAll(false);
    });

    // '이 시기 병해충 보기': 병해충 검색에 작물 이름을 넣어 병해충 탭으로
    els.pests.addEventListener('click', () => {
      const form = document.querySelector('[data-pest-search]');
      const cropData = findCrop(crop || '') || data.crops[0];
      if (!form || !cropData) { location.hash = '#pests'; return; }
      form.elements.q.value = cropData.name;
      form.requestSubmit();
    });

    cropWatchers.push(() => { if (data.crops.length) render(); });

    loadJson('data/calendar.json')
      .then((json) => {
        data = json;
        els.dilution.innerHTML = `<dt>물 1말(20L) 기준</dt>${(data.dilution || []).map((d) => `<dd><b>${esc(d.rate)}</b> ${esc(d.amount)}</dd>`).join('')}`;
        renderAll();
        render();
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
    // farm.html?pest=채소#pests 처럼 분야를 정해서 열 수 있음 (메인 '작물별 병해충 정보'에서 사용)
    let category = new URLSearchParams(location.search).get('pest') || '전체';
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
      if (location.hash !== '#pests') { history.replaceState(null, '', '#pests'); showTab('pests'); }
      // '○○ 검색 결과 N건'과 결과 목록이 보이게 이동
      requestAnimationFrame(() => panel.querySelector('.pest-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
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
