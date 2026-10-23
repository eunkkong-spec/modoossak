// 헤더 메뉴: 메뉴에 마우스를 올리거나 ☰를 누르면 메가메뉴가 내려옴 (전 페이지 공통)
(() => {
  const menuToggle = document.querySelector('.menu-toggle');
  const header = document.querySelector('.site-header');
  const megaMenu = document.querySelector('.mega-menu');
  const menuItems = [...document.querySelectorAll('.primary-nav__item')];
  const menuGroups = [...document.querySelectorAll('.mega-menu__group')];

  const setActiveMenu = (index = -1) => {
    menuGroups.forEach((group, groupIndex) => group.classList.toggle('is-active', groupIndex === index));
    menuItems.forEach((item, itemIndex) => item.setAttribute('aria-expanded', String(itemIndex === index)));
  };

  // 데스크톱: 서브메뉴 각 칸의 가운데가 위 메뉴 글자의 가운데와 일치하도록 맞춤
  // (칸 경계 = 이웃한 두 메뉴 가운데의 중간 지점, 양 끝 칸은 옆 칸과 같은 폭으로)
  const alignMegaMenu = () => {
    const inner = megaMenu?.querySelector('.mega-menu__inner');
    if (!inner || !menuGroups.length) return;
    inner.style.margin = '';
    inner.style.gridTemplateColumns = '';
    megaMenu.classList.remove('is-aligned');
    if (menuItems.length !== menuGroups.length || menuItems.length < 2 || menuItems[0].offsetWidth === 0) return;
    megaMenu.classList.add('is-aligned');
    const menuLeft = megaMenu.getBoundingClientRect().left;
    const centers = menuItems.map((item) => {
      const r = item.getBoundingClientRect();
      return r.left + r.width / 2 - menuLeft;
    });
    const n = centers.length;
    const bounds = [centers[0] - (centers[1] - centers[0]) / 2];
    for (let i = 1; i < n; i += 1) bounds.push((centers[i - 1] + centers[i]) / 2);
    bounds.push(centers[n - 1] + (centers[n - 1] - centers[n - 2]) / 2);
    inner.style.gridTemplateColumns = bounds.slice(1).map((b, i) => `${Math.round(b - bounds[i])}px`).join(' ');
    inner.style.margin = `0 0 0 ${Math.max(0, Math.round(bounds[0]))}px`;
  };

  let openScrollY = 0;

  const openMegaMenu = (index = -1) => {
    if (!megaMenu) return;
    if (megaMenu.hidden) openScrollY = window.scrollY;
    megaMenu.hidden = false;
    alignMegaMenu();
    megaMenu.classList.add('is-open');
    menuToggle?.setAttribute('aria-expanded', 'true');
    menuToggle?.setAttribute('aria-label', '전체 메뉴 닫기');
    setActiveMenu(index);
  };

  const closeMegaMenu = () => {
    if (!megaMenu || megaMenu.hidden) return;
    megaMenu.classList.remove('is-open');
    megaMenu.hidden = true;
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', '전체 메뉴 열기');
    setActiveMenu(-1);
  };

  if (menuToggle && megaMenu) {
    menuToggle.addEventListener('click', () => {
      if (menuToggle.getAttribute('aria-expanded') === 'true') closeMegaMenu();
      else openMegaMenu();
    });
    menuToggle.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') openMegaMenu();
    });
  }

  menuItems.forEach((item, index) => {
    item.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') openMegaMenu(index);
    });
    item.addEventListener('focus', () => openMegaMenu(index));
    // 헤더 메뉴를 누르면 그 메뉴의 첫 서브페이지로 바로 이동 (예: 제품 → product.html#all)
    item.addEventListener('click', () => {
      const first = menuGroups[index]?.querySelector('a[href]');
      if (first) { location.href = first.href; return; }
      openMegaMenu(index);
    });
  });

  menuGroups.forEach((group, index) => {
    group.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') setActiveMenu(index);
    });
    group.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMegaMenu));
  });

  // 한 번 내려온 서브메뉴는 마우스가 헤더 밖으로 나가도 그대로 둠 → ☰(X)를 누르거나 Esc, 메뉴 링크를 누르거나, 아래로 한 화면 넘게 스크롤하면 닫힘
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMegaMenu();
  });
  window.addEventListener('scroll', () => {
    if (megaMenu && !megaMenu.hidden && window.scrollY - openScrollY > window.innerHeight) closeMegaMenu();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (megaMenu && !megaMenu.hidden) alignMegaMenu();
  });
})();

// 떠 있는 버튼(전 페이지 공통): 히어로를 지나 내려가면 오른쪽 아래에 '뒤로'와 '위로'가 나타남
(() => {
  const box = document.createElement('div');
  box.className = 'float-actions';
  box.innerHTML = `
    <button type="button" class="float-actions__btn" data-float-back aria-label="이전 페이지로 돌아가기"><span aria-hidden="true">←</span>뒤로</button>
    <button type="button" class="float-actions__btn float-actions__btn--top" data-float-top aria-label="맨 위로 가기"><span aria-hidden="true">↑</span>위로</button>`;
  document.body.append(box);

  // 같은 사이트에서 넘어왔으면 이전 페이지로, 아니면(바로 들어온 경우) 홈으로
  box.querySelector('[data-float-back]').addEventListener('click', () => {
    const fromSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (fromSite && history.length > 1) history.back();
    else location.href = 'index.html';
  });
  box.querySelector('[data-float-top]').addEventListener('click', () => window.scrollTo({ top: 0 }));

  // 메인은 히어로, 서브는 서브 히어로를 지나면 보임 (히어로가 없으면 화면 절반쯤 내려갔을 때)
  const hero = document.querySelector('.hero, .sub-hero');
  const update = () => {
    const passed = hero ? hero.getBoundingClientRect().bottom <= 0 : window.scrollY > window.innerHeight / 2;
    box.classList.toggle('is-visible', passed);
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
