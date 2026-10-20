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

  // Technology video: start with sound only when the play button is pressed.
  const techVideo = document.querySelector('.technology__video video');
  const techPlay = document.querySelector('.technology__play');
  if (techVideo && techPlay) {
    techPlay.addEventListener('click', () => {
      techVideo.controls = true;
      techVideo.play();
    });
    techVideo.addEventListener('play', () => { techPlay.hidden = true; });
    techVideo.addEventListener('ended', () => {
      techVideo.controls = false;
      techVideo.currentTime = 0;
      techPlay.hidden = false;
    });
  }

  const videos = [...document.querySelectorAll('.hero__video')];
  const messages = [...document.querySelectorAll('.hero__message')];
  const controls = [...document.querySelectorAll('.hero__pagination button')];
  const counter = document.querySelector('.hero__count');
  let activeIndex = 0;
  const pauseTimers = new WeakMap();
  let messageTransition = 0;
  let isInitialized = false;

  const showSlide = (index) => {
    if (!videos.length) return;
    const previousIndex = activeIndex;
    const nextIndex = (index + videos.length) % videos.length;
    if (nextIndex === previousIndex && isInitialized) return;
    const isInitial = !isInitialized;
    isInitialized = true;
    activeIndex = nextIndex;
    const transition = ++messageTransition;

    videos.forEach((video, videoIndex) => {
      const isActive = videoIndex === activeIndex;
      video.classList.toggle('is-active', isActive);
      if (isActive) {
        window.clearTimeout(pauseTimers.get(video));
        const startPlayback = () => {
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
        };
        if (videoIndex !== previousIndex || isInitial) {
          const startTime = Number(video.dataset.start || 0);
          if (Math.abs(video.currentTime - startTime) > 0.05) {
            video.addEventListener('seeked', startPlayback, { once: true });
            video.currentTime = startTime;
          } else {
            startPlayback();
          }
        } else {
          startPlayback();
        }
      } else {
        const timer = window.setTimeout(() => {
          if (!video.classList.contains('is-active')) {
            video.pause();
            video.currentTime = 0;
          }
        }, 1250);
        pauseTimers.set(video, timer);
      }
    });

    const incomingMessage = messages[activeIndex];
    const outgoingMessage = messages.find((message) => message.classList.contains('is-active') || message.classList.contains('is-leaving'));
    messages.forEach((message) => {
      message.classList.remove('is-active', 'is-leaving');
      message.setAttribute('aria-hidden', 'true');
    });

    if (!isInitial && outgoingMessage && outgoingMessage !== incomingMessage) {
      outgoingMessage.classList.add('is-leaving');
      window.setTimeout(() => {
        if (transition !== messageTransition) return;
        outgoingMessage.classList.remove('is-leaving');
        incomingMessage?.classList.add('is-active');
        incomingMessage?.setAttribute('aria-hidden', 'false');
      }, 170);
    } else {
      incomingMessage?.classList.add('is-active');
      incomingMessage?.setAttribute('aria-hidden', 'false');
    }

    controls.forEach((control, controlIndex) => {
      const isActive = controlIndex === activeIndex;
      control.classList.toggle('is-active', isActive);
      control.setAttribute('aria-pressed', String(isActive));
    });

    if (counter) counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(videos.length).padStart(2, '0')}`;
  };

  controls.forEach((control, index) => {
    control.addEventListener('click', () => {
      showSlide(index);
    });
  });

  videos.forEach((video, index) => {
    video.addEventListener('ended', () => {
      if (index === activeIndex) showSlide(activeIndex + 1);
    });
  });

  if (videos.length) showSlide(0);

  const quickLinks = [...document.querySelectorAll('.quick-nav a')];
  quickLinks.forEach((link) => {
    link.addEventListener('click', () => {
      quickLinks.forEach((item) => item.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'location');
    });
  });
})();
