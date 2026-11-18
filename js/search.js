(() => {
  // 사이트 전체 검색 (search.html?q=...)
  // 낱말을 따로 정해 두지 않고, 사이트에 있는 글을 모두 모아 실제로 그 말이 나오는 곳을 찾아 보여 줌.
  // 모으는 곳: 회사소개·기술·소식 페이지 본문, 제품(products.json), 병해충(pest.json), 작물재배력(calendar.json),
  // 주간농사정보(weekly.json), 공지·뉴스(news.json), 모두싹TV(tv.json), 시험성적서(reports.json)
  // TODO: 회사에서 상담 · FAQ 자료를 받으면 data/faq.json으로 만들어 여기에도 넣기
  const root = document.querySelector('[data-search]');
  if (!root) return;
  const $ = (name) => root.querySelector(`[data-search-${name}]`);
  const els = { form: $('form'), count: $('count'), list: $('list') };
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const squash = (s = '') => String(s).replace(/\s+/g, '').toLowerCase();
  const load = (url) => fetch(url, { cache: 'no-cache' }).then((res) => (res.ok ? res.json() : null)).catch(() => null);
  const loadPage = (url) => fetch(url).then((res) => res.text()).then((html) => new DOMParser().parseFromString(html, 'text/html')).catch(() => null);

  const q = (new URLSearchParams(location.search).get('q') || '').trim();
  els.form.elements.q.value = q;

  // 검색어 다듬기: 자주 틀리는 글자, 붙여 쓴 '고추탄저병' → '고추 탄저병'
  const TYPOS = { 베추: '배추', 배츄: '배추', 마눌: '마늘', 고쭈: '고추', 유항: '유황' };
  const CROPS = ['방울토마토', '결구상추', '고구마', '토마토', '복숭아', '배추', '고추', '마늘', '양파', '대파', '쪽파', '상추', '딸기', '감자', '사과', '인삼', '오이', '수박', '참외', '호박', '가지', '당근', '생강', '포도'];
  const fixTypos = (s) => Object.entries(TYPOS).reduce((t, [a, b]) => t.replaceAll(a, b), s);

  // 증상으로 물어도 찾게: '배추가 무를 때' → 무름병, '뿌리가 썩을 때' → 뿌리썩음·뿌리혹병 …
  // test: 검색어(띄어쓰기 뺀)에 이 말이 있으면 / stem: 이 말이 든 낱말은 증상으로 보고 낱말 목록에서 뺌 / alts: 이 중 하나라도 있는 글을 찾음
  const SYMPTOMS = [
    { label: '뿌리 썩음', test: /뿌리.{0,4}(썩|상하|혹|부풀|물러|무르|무를)/, stem: /뿌리|썩|상하|상해|상했|혹|부풀|물러|무르|무를/, alts: ['뿌리썩음', '뿌리혹', '뿌리마름', '무름병', '시들음'] },
    { label: '무름', test: /무르|무를|무른|무름|물러|물렁|짓무|녹아|녹는|흐물/, stem: /무르|무를|무른|무름|물러|물렁|짓무|녹아|녹는|흐물/, alts: ['무름병', '무름', '세균'] },
    { label: '썩음', test: /썩|부패/, stem: /썩|부패/, alts: ['썩음', '무름', '부패', '역병', '탄저', '균핵'], unless: ['뿌리 썩음'] },
    { label: '시듦', test: /시들|시듦|시드|처지|축처/, stem: /시들|시듦|시드|처지|축처/, alts: ['시들음', '시듦', '위조', '풋마름', '시들'] },
    { label: '마름', test: /말라|마르|마름|타들|잎끝이?타/, stem: /말라|마르|마름|타들|타요|탄다/, alts: ['마름병', '마름', '말라', '고사', '시들음'] },
    { label: '반점 · 무늬', test: /반점|점이|점무늬|얼룩|무늬|갈색점|검은점|까만점|점박이/, stem: /반점|점이|점무늬|얼룩|무늬|갈색점|검은점|까만점|점박이/, alts: ['반점', '무늬병', '점무늬', '갈색무늬', '검은', '탄저', '겹둥근'] },
    { label: '흰가루', test: /흰가루|하얀가루|하얗게|밀가루/, stem: /흰가루|하얀|하얗게|밀가루|가루/, alts: ['흰가루'] },
    { label: '곰팡이', test: /곰팡|곰팽/, stem: /곰팡|곰팽/, alts: ['곰팡이', '잿빛곰팡이', '노균병', '역병', '균핵', '흰가루'] },
    { label: '잎이 누렇게', test: /노랗|누렇|누래|황화|노래지|노래져|노래요/, stem: /노랗|누렇|누래|황화|노래/, alts: ['황화', '노균병', '노랗', '결핍', '바이러스', '누렇'] },
    { label: '잎에 구멍', test: /구멍|갉아|파먹|먹어|먹는|뜯어/, stem: /구멍|갉아|파먹|먹어|먹는|뜯어/, alts: ['나방', '벼룩잎벌레', '좀나방', '거세미', '애벌레', '유충', '잎벌'] },
    { label: '벌레', test: /벌레|해충|애벌레|유충|날파리/, stem: /벌레|해충|유충|날파리/, alts: ['나방', '진딧물', '총채벌레', '응애', '벌레', '해충', '노린재', '멸구', '가루이', '파리'] },
    { label: '잎이 오그라듦', test: /오그라|쭈글|말려|말림|기형|모자이크/, stem: /오그라|쭈글|말려|말림|기형|모자이크/, alts: ['바이러스', '잎말림', '모자이크', '오갈'] },
  ];
  const squashedQ = squash(fixTypos(q));
  const concepts = [];
  SYMPTOMS.forEach((s) => { if (s.test.test(squashedQ) && !(s.unless || []).some((l) => concepts.some((c) => c.label === l))) concepts.push(s); });

  // 질문에 흔히 붙는 말은 찾는 낱말에서 빼고, '심는·수확·시기·키우는 법'은 재배력을 찾는 뜻으로 씀
  const FILLER = /^(작물|정보|방법|법|어떻게|어떡해|왜|알려줘|알고|싶어|싶다|궁금|뭐|무엇|어떤|하는|하기|하나|관련|대해|대한|좋은|추천|언제|시기|철|경우|원인|이유|증상|대처|해야|하면|되면|생겨|생김|났어|걸렸|걸림|변해|변했|잎|줄기|열매)$/;
  const SEASON = /^(심는|심기|심을|심어|심고|파종|정식|모종|수확|수확하는|거두는|재배|재배력|재배시기|재배법|키우는|키우기|기르는|기르기|농사)$/;
  // 끝에 붙은 조사·말끝 ('배추가' → '배추', '잎에' → '잎', '시기에' → '시기')
  const ENDING = /(에서|으로|인가요|나요|해요|돼요|할때|을때|은|는|이|가|을|를|에|의|로|도|좀|요|때)$/;
  const words = fixTypos(q).split(/\s+/).filter(Boolean).flatMap((w) => {
    const crop = CROPS.find((c) => w.length > c.length && w.startsWith(c));
    if (!crop) return [w];
    const rest = w.slice(crop.length);
    return ENDING.test(rest) && rest.replace(ENDING, '') === '' ? [crop] : [crop, rest];
  })
    // 증상을 나타낸 낱말은 위 concepts로 찾으므로 빼고
    .filter((w) => !concepts.some((c) => c.stem.test(w)))
    // 작물 이름('오이' 등)은 그대로, 나머지는 끝의 조사를 뗌
    .map((w) => (CROPS.includes(w) || SEASON.test(w) || FILLER.test(w) ? w : w.replace(ENDING, (m, _p, offset) => (offset >= 1 ? '' : m))));
  const month = Number(q.match(/(\d{1,2})\s*월/)?.[1] || 0);
  const wantsSeason = month > 0 || words.some((w) => SEASON.test(w) || /^(언제|시기)$/.test(w));
  let keys = words.filter((w) => !FILLER.test(w) && !SEASON.test(w) && !/^\d{1,2}월$/.test(w)).map(squash).filter(Boolean);

  // 문서 하나 = { group, title, text, url, external, kind }
  const docs = [];
  const add = (doc) => docs.push({ ...doc, hay: squash(`${doc.title} ${doc.text}`), head: squash(doc.title) });

  // 페이지 본문: 탭(role=tabpanel)마다 하나. '내용이 들어갈 자리' 같은 임시 글은 빼고
  const PAGES = [['company.html', '회사소개'], ['tech.html', '기술'], ['news.html', '소식 · 고객지원']];
  const fromPage = ([url, group], doc) => {
    if (!doc) return;
    doc.querySelectorAll('[role="tabpanel"][id]').forEach((panel) => {
      const clone = panel.cloneNode(true);
      clone.querySelectorAll('.section-slot, script, [hidden]').forEach((el) => el.remove());
      const tab = doc.querySelector(`[aria-controls="${panel.id}"]`);
      add({ group, title: tab?.textContent.trim() || clone.querySelector('h2')?.textContent.trim() || group, text: clone.textContent.replace(/\s+/g, ' '), url: `${url}#${panel.id}`, kind: 'page' });
    });
  };

  const build = ([pages, products, pest, calendar, weekly, news, tv, reports]) => {
    pages.forEach((doc, i) => fromPage(PAGES[i], doc));
    (products?.products || products || []).forEach((p) => add({
      group: '제품', title: p.name, text: [p.group, p.tagline, p.summary].join(' '),
      url: p.video ? `https://www.youtube.com/watch?v=${p.video}` : `product.html#${p.audience === 'garden' ? 'garden' : 'pro'}`, external: Boolean(p.video), kind: 'product',
    }));
    // 병해충: 여러 호에 같은 항목이 되풀이되므로 제목이 같으면 가장 최근 호만
    const seen = new Set();
    (pest?.issues || []).forEach((issue) => (issue.items || []).forEach((item) => {
      if (seen.has(item.title)) return;
      seen.add(item.title);
      add({ group: '병해충 정보', title: item.title, text: [item.category, ...(item.situation || []), ...(item.control || [])].join(' '), url: 'farm.html?q=', kind: 'pest' });
    }));
    (calendar?.crops || []).forEach((c) => add({
      group: '작물재배력', title: `${c.name} 재배력`,
      text: [c.name, ...(c.aliases || []), c.group, ...c.rows.flatMap((r) => (r.bars || []).map(([label]) => label)), ...(c.uses || []).map((u) => `${u.title} ${u.desc}`)].join(' '),
      url: `farm.html?q=${encodeURIComponent(`${c.name} 재배 시기`)}`, kind: 'calendar', crop: c,
    }));
    const week = weekly?.issues?.[0];
    (week?.fields || []).forEach((field) => (field.items || []).forEach((item) => add({
      group: '주간농사정보', title: `${field.name} · ${item.topic}`, text: `${item.text} ${item.note || ''}`, url: 'farm.html#weekly', kind: 'weekly',
    })));
    (news?.posts || []).forEach((post) => add({
      group: '공지 · 뉴스', title: post.title, text: [post.category, ...(post.body || [])].join(' '),
      url: post.body ? `post.html?id=${encodeURIComponent(post.id)}` : (post.url || 'news.html#notice'), external: !post.body && /^https?:/.test(post.url || ''), kind: 'news',
    }));
    (tv?.videos || []).forEach((v) => add({ group: '모두싹TV', title: v.title, text: v.category, url: `https://www.youtube.com/watch?v=${v.id}`, external: true, kind: 'tv' }));
    (reports?.reports || []).forEach((r) => add({ group: '시험성적서', title: r.title, text: [r.category, r.crop, r.org].join(' '), url: r.file || 'tech.html#reports', external: Boolean(r.file), kind: 'report' }));
  };

  // 점수: 찾는 낱말이 모두 들어 있고, 증상마다 관련된 말이 하나라도 있는 글만. 제목에 있으면 더 위로.
  // 심는·수확·시기를 물으면 재배력을, 증상을 물으면 병해충 정보를 맨 위로
  const score = (doc) => {
    if (!keys.length && !concepts.length) return wantsSeason && doc.kind === 'calendar' ? 1 : 0;
    if (!keys.every((k) => doc.hay.includes(k))) return 0;
    const altHits = concepts.map((c) => c.alts.map(squash).filter((a) => doc.hay.includes(a)));
    if (altHits.some((hits) => !hits.length)) return 0;
    let s = keys.reduce((sum, k) => sum + (doc.head.includes(k) ? 3 : 1), 0);
    s += altHits.reduce((sum, hits) => sum + (hits.some((a) => doc.head.includes(a)) ? 3 : 1), 0);
    if (wantsSeason && doc.kind === 'calendar') s += 10;
    if (concepts.length && doc.kind === 'pest') s += 5;
    return s;
  };

  // '11월에 심는 작물'처럼 달을 물으면 그 달에 심는(거두는) 작물을 재배력에서 골라 맨 위에
  const monthCard = () => {
    if (!month || month > 12 || !wantsSeason) return '';
    const harvest = /수확|거두/.test(q);
    const slots = [1, 2, 3].map((n) => (month - 1) * 3 + n);
    const SPAN = /^(\d{1,2})(상|중|하)(?:-(\d{1,2})(상|중|하))?$/;
    const slotOf = (m, d) => (m - 1) * 3 + ['상', '중', '하'].indexOf(d) + 1;
    const covers = (span) => {
      const [, m1, d1, m2 = m1, d2 = d1] = span.match(SPAN) || [];
      if (!m1) return false;
      const from = slotOf(+m1, d1), to = slotOf(+m2, d2);
      return slots.some((s) => (from <= to ? from <= s && s <= to : s >= from || s <= to));
    };
    const want = harvest ? /수확|출하|수매/ : /파종|정식|아주심기|심기|육묘|씨/;
    const crops = docs.filter((d) => d.kind === 'calendar' && (!keys.length || keys.every((k) => d.hay.includes(k))))
      .filter((d) => d.crop.rows.some((r) => (r.kind === 'stage' || r.kind === 'task') && (r.bars || []).some(([label, span]) => want.test(label) && covers(span))));
    const what = harvest ? '수확하는' : '심는(파종 · 정식)';
    return `<section class="search-group search-group--top"><h2>${month}월에 ${what} 작물</h2>${crops.length
      ? `<ul class="search-chips">${crops.map((d) => `<li><a href="farm.html?q=${encodeURIComponent(`${month}월 ${harvest ? '수확' : '심는'} ${d.crop.name}`)}">${esc(d.crop.name)}</a></li>`).join('')}</ul>
        <p class="search-more"><a href="farm.html?q=${encodeURIComponent(q)}">작물재배력에서 ${month}월 작물 모아 보기 →</a></p>`
      : '<p class="search-empty">재배력에 있는 작물 중 해당하는 작물이 없습니다.</p>'}</section>`;
  };

  const snippet = (doc) => {
    const text = doc.text.replace(/\s+/g, ' ').trim();
    const marks = [...keys, ...concepts.flatMap((c) => c.alts.map(squash).filter((a) => doc.hay.includes(a)))];
    const first = marks.map((k) => text.replace(/\s+/g, '').toLowerCase().indexOf(k)).filter((i) => i >= 0)[0] ?? 0;
    // 띄어쓰기를 뺀 위치를 원문 위치로 대략 옮김
    let pos = 0, count = 0;
    while (pos < text.length && count < first) { if (!/\s/.test(text[pos])) count += 1; pos += 1; }
    const start = Math.max(0, pos - 30);
    let out = esc((start ? '…' : '') + text.slice(start, start + 110) + (text.length > start + 110 ? '…' : ''));
    marks.forEach((k) => {
      const re = new RegExp(k.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), 'gi');
      out = out.replace(re, (m) => `<mark>${m}</mark>`);
    });
    return out;
  };
  // 병해충은 영농정보에서 그 항목 제목으로 다시 찾게 (증상으로 물어도 정확한 항목이 열리도록)
  const linkOf = (doc) => (doc.kind === 'pest' ? `farm.html?q=${encodeURIComponent(doc.title)}` : doc.url);

  const render = () => {
    if (!q) { els.count.textContent = '찾고 싶은 작물, 병해충, 제품 이름을 넣어 보세요.'; els.list.innerHTML = ''; return; }
    const hits = docs.map((doc) => ({ doc, s: score(doc) })).filter((h) => h.s > 0).sort((a, b) => b.s - a.s);
    const top = monthCard();
    if (!hits.length && !top) {
      els.count.textContent = '';
      els.list.innerHTML = `<p class="search-none">'${esc(q)}'에 대한 자료는 준비 중입니다. 전화나 카카오톡으로 문의 주시면 상담해 드리겠습니다. <a href="tel:15227008">☎ 1522-7008</a></p>`;
      return;
    }
    // 묶음(제품·병해충 등)별로, 가장 잘 맞는 묶음부터
    const groups = [...new Set(hits.map((h) => h.doc.group))];
    const LIMIT = 6;
    const how = [...keys, ...concepts.map((c) => `${c.label} 관련`)].join(' + ');
    els.count.textContent = `'${q}' 검색 결과 ${hits.length}건${how && how !== squash(q) ? ` (찾은 말: ${how})` : ''}`;
    els.list.innerHTML = top + groups.map((group) => {
      const list = hits.filter((h) => h.doc.group === group);
      return `<section class="search-group"><h2>${esc(group)} <span>${list.length}</span></h2><ul>${list.map(({ doc }, i) => `
        <li${i >= LIMIT ? ' hidden' : ''}><a class="search-item" href="${esc(linkOf(doc))}"${doc.external ? ' target="_blank" rel="noopener"' : ''}>
          <strong>${esc(doc.title)}${doc.external ? ' <span aria-hidden="true">↗</span>' : ''}</strong><p>${snippet(doc)}</p></a></li>`).join('')}</ul>
        ${list.length > LIMIT ? `<button type="button" class="search-more-btn" data-search-more>${list.length - LIMIT}건 더 보기 ▾</button>` : ''}</section>`;
    }).join('');
  };

  els.list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-more]');
    if (!button) return;
    button.closest('.search-group').querySelectorAll('li[hidden]').forEach((li) => { li.hidden = false; });
    button.remove();
  });

  els.count.textContent = q ? '찾는 중…' : '';
  Promise.all([
    Promise.all(PAGES.map(([url]) => loadPage(url))),
    load('data/products.json'), load('data/pest.json'), load('data/calendar.json'), load('data/weekly.json'),
    load('data/news.json'), load('data/tv.json'), load('data/reports.json'),
  ]).then((all) => {
    build(all);
    // 사이트 어디에도 없는 낱말(예: '배추 키우는 법'의 '키우는')은 빼고 찾음. 남는 게 없으면 '준비 중' 안내
    const unknown = keys.filter((k) => !docs.some((d) => d.hay.includes(k)));
    if (unknown.length && unknown.length < keys.length + concepts.length) keys = keys.filter((k) => !unknown.includes(k));
    render();
  });
})();
