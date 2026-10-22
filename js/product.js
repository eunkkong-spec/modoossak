(() => {
  // 제품: data/products.json, 사용 예는 data/calendar.json(작물재배력)에서 제품 이름으로 찾아 붙임
  const list = document.querySelector('[data-product-list]');
  if (!list) return;

  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const loadJson = (url) => fetch(url, { cache: 'no-cache' }).then((res) => res.json());

  // 탭: #all 전체 제품 / #pro 전문 농가용 / #garden 텃밭 입문용
  const TABS = { all: '전체 제품', pro: '전문 농가용', garden: '텃밭 입문용' };
  const tabs = [...document.querySelectorAll('.product-tabs__item')];
  const breadcrumb = document.querySelector('[data-breadcrumb-current]');
  const currentTab = () => (TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'all');

  let data = { groups: [], products: [] };
  let uses = {};  // 제품 id → [{ crop, title, text }]

  // 재배력의 '시기별 모두싹 사용법'에서 이 제품이 들어간 줄을 모음 (두 줄로 나뉜 문장은 이어 붙임)
  const collectUses = (calendar) => {
    data.products.forEach((product) => {
      if (!product.match) return;
      const re = new RegExp(product.match);
      uses[product.id] = calendar.crops.flatMap((crop) => crop.uses
        .map((use) => ({ crop: crop.name, title: use.title, text: use.recipe.join(' ').replace(/\s+\+/g, ' +') }))
        .filter((use) => re.test(use.text)));
    });
  };

  const card = (product) => {
    const found = uses[product.id] || [];
    const crops = [...new Set(found.map((use) => use.crop))];
    const name = new RegExp(product.match || '$^', 'g');
    return `
      <article class="product-item" id="${esc(product.id)}">
        <figure class="product-item__photo"${product.bg ? ` style="background-image: url('${esc(product.bg)}')"` : ''}>
          <img src="${esc(product.image)}" alt="${esc(product.alt || product.name)}" loading="lazy">
        </figure>
        <div class="product-item__body">
          <p class="product-item__group">${esc(product.group)}</p>
          <h3>${esc(product.name)}</h3>
          ${product.tagline ? `<p class="product-item__tagline">${esc(product.tagline)}</p>` : ''}
          ${product.summary ? `<p class="product-item__summary">${esc(product.summary)}</p>` : ''}
          ${crops.length ? `
          <div class="product-item__crops">
            <strong>재배력에서 쓰는 작물</strong>
            <ul>${crops.map((crop) => `<li><a href="farm.html?crop=${encodeURIComponent(crop)}#calendar">${esc(crop)}</a></li>`).join('')}</ul>
          </div>
          <details class="product-item__uses">
            <summary>사용 예 ${found.length}건 보기</summary>
            <ul>${found.map((use) => `<li><b>${esc(use.crop)} · ${esc(use.title)}</b><span>${esc(use.text).replace(name, '<mark>$&</mark>')}</span></li>`).join('')}</ul>
          </details>` : ''}
        </div>
      </article>`;
  };

  const render = () => {
    const tab = currentTab();
    tabs.forEach((item) => {
      if (item.hash === `#${tab}`) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (breadcrumb) breadcrumb.textContent = TABS[tab];

    const shown = data.products.filter((product) => tab === 'all' || product.audience === tab);
    list.innerHTML = data.groups
      .map((group) => ({ group, items: shown.filter((product) => product.group === group) }))
      .filter(({ items }) => items.length)
      .map(({ group, items }, i) => `
        <section class="product-group" aria-labelledby="product-group-${i}">
          <h2 class="product-group__title" id="product-group-${i}">${esc(group)}<span>${items.length}</span></h2>
          <div class="product-grid">${items.map(card).join('')}</div>
        </section>`).join('');
  };

  // 탭을 바꾸면 탭 줄이 보이게 올려 줌 (처음 열 때는 그대로)
  window.addEventListener('hashchange', () => {
    render();
    document.querySelector('.product-tabs')?.scrollIntoView({ block: 'start' });
  });

  Promise.all([loadJson('data/products.json'), loadJson('data/calendar.json').catch(() => ({ crops: [] }))])
    .then(([products, calendar]) => {
      data = products;
      collectUses(calendar);
      render();
    })
    .catch(() => { list.innerHTML = '<p class="product-empty">제품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>'; });
})();
