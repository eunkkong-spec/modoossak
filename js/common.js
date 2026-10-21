// 헤더 메뉴: 메뉴에 마우스를 올리거나 ☰를 누르면 메가메뉴가 내려옴 (전 페이지 공통)
(() => {
  const menuToggle = document.querySelector('.menu-toggle');
  const header = document.querySelector('.site-header');
  const megaMenu = document.querySelector('.mega-menu');
  const menuItems = [...document.querySelectorAll('.primary-nav__item')];
  const menuGroups = [...document.querySelectorAll('.mega-menu__group')];
  let menuCloseTimer;

  const setActiveMenu = (index = -1) => {
    menuGroups.forEach((group, groupIndex) => group.classList.toggle('is-active', groupIndex === index));
    menuItems.forEach((item, itemIndex) => item.setAttribute('aria-expanded', String(itemIndex === index)));
  };

  // Desktop: shrink the panel to its content-width columns (equal spacing comes from
  // .is-aligned group padding) and start the first column's text under the first nav button.
  const alignMegaMenu = () => {
    const inner = megaMenu?.querySelector('.mega-menu__inner');
    if (!inner || !menuGroups.length) return;
    inner.style.margin = '';
    megaMenu.classList.remove('is-aligned');
    if (!menuItems.length || menuItems[0].offsetWidth === 0) return;
    megaMenu.classList.add('is-aligned');
    const menuRect = megaMenu.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(menuGroups[0]).paddingLeft) || 0;
    const maxLeft = Math.max(0, menuRect.width - inner.offsetWidth);
    const left = menuItems[0].getBoundingClientRect().left - menuRect.left - padLeft;
    inner.style.margin = `0 0 0 ${Math.min(Math.max(0, left), maxLeft)}px`;
  };

  const openMegaMenu = (index = -1) => {
    if (!megaMenu) return;
    window.clearTimeout(menuCloseTimer);
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
    item.addEventListener('click', () => {
      if (menuToggle?.getAttribute('aria-expanded') === 'true' && item.getAttribute('aria-expanded') === 'true') closeMegaMenu();
      else openMegaMenu(index);
    });
  });

  menuGroups.forEach((group, index) => {
    group.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') setActiveMenu(index);
    });
    group.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMegaMenu));
  });

  header?.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    menuCloseTimer = window.setTimeout(closeMegaMenu, 120);
  });
  header?.addEventListener('pointerenter', () => window.clearTimeout(menuCloseTimer));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMegaMenu();
  });
  window.addEventListener('resize', () => {
    if (megaMenu && !megaMenu.hidden) alignMegaMenu();
  });
})();

// 떠 있는 버튼(전 페이지 공통): 히어로를 지나 내려가면 오른쪽 아래에 '뒤로'와 'TOP'이 나타남
(() => {
  const box = document.createElement('div');
  box.className = 'float-actions';
  box.innerHTML = `
    <button type="button" class="float-actions__btn" data-float-back aria-label="이전 페이지로 돌아가기"><span aria-hidden="true">←</span>뒤로</button>
    <button type="button" class="float-actions__btn float-actions__btn--top" data-float-top aria-label="맨 위로 가기"><span aria-hidden="true">↑</span>TOP</button>`;
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
