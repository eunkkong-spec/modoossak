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

  // 마우스: 헤더·서브메뉴 영역을 벗어나면 닫힘 (잠깐 스쳐 나가도 바로 닫히지 않게 0.2초 여유, 다시 들어오면 취소)
  let leaveTimer;
  header?.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(closeMegaMenu, 200);
  });
  header?.addEventListener('pointerenter', () => clearTimeout(leaveTimer));

  // 그 밖에 ☰(X)를 누르거나 Esc, 메뉴 링크를 누르거나, 아래로 한 화면 넘게 스크롤해도 닫힘 (터치 화면은 이쪽으로만 닫힘)
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

// 서브페이지를 '#탭' 주소로 열어도(헤더 메뉴·서브메뉴·메인 카드 등) 브라우저가 탭 내용으로 내려가지 않고
// 맨 위 서브 히어로부터 보이게 함. 뒤로/앞으로 가기와 새로고침은 원래 보던 위치 그대로
(() => {
  if (!location.hash || !document.querySelector('.sub-hero')) return;
  if (performance.getEntriesByType('navigation')[0]?.type !== 'navigate') return;
  const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' });
  toTop();
  requestAnimationFrame(toTop);
  window.addEventListener('load', () => { toTop(); setTimeout(toTop, 50); }, { once: true });
})();

// 떠 있는 버튼(전 페이지 공통): 히어로를 지나 내려가면 오른쪽 아래에 '위로싹' 로고 버튼이 나타남
// (사용자가 만든 위로싹 로고: images/common/_00_Top_Wiro_Ssak.png)
(() => {
  const box = document.createElement('div');
  box.className = 'float-actions';
  box.innerHTML = `
    <button type="button" class="float-actions__btn float-actions__btn--top" data-float-top aria-label="맨 위로 가기"><img src="images/common/_00_Top_Wiro_Ssak.png" alt=""></button>`;
  document.body.append(box);

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
