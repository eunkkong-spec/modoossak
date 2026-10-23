(() => {
  const header = document.querySelector('.site-header');

  // Header: transparent over the hero video, white with dark text once the hero has scrolled past.
  const hero = document.querySelector('.hero');
  const updateHeader = () => {
    header?.classList.toggle('is-solid', !hero || hero.getBoundingClientRect().bottom <= header.offsetHeight);
  };
  window.addEventListener('scroll', updateHeader, { passive: true });
  window.addEventListener('resize', updateHeader);
  updateHeader();

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
})();

// 히어로 문구 칸 높이를 평소(가장 긴 문구) 기준으로 고정: 검색창에 마우스를 올려 문구가 작아져도 검색창이 제자리에 있게
(() => {
  const inner = document.querySelector('.hero__inner');
  const messages = [...document.querySelectorAll('.hero__message')];
  if (!inner || !messages.length) return;
  const measure = () => {
    inner.style.removeProperty('--hero-msg-h');
    const heights = messages.map((m) => {
      const was = m.style.cssText;
      m.style.cssText = 'display:block;position:absolute;visibility:hidden;width:' + inner.clientWidth + 'px';
      const h = m.offsetHeight;
      m.style.cssText = was;
      return h;
    });
    inner.style.setProperty('--hero-msg-h', Math.max(...heights) + 'px');
  };
  measure();
  window.addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
})();

// 비교용: index.html?hero=shrink 로 열면 검색창에 마우스를 올릴 때 위 문구가 작아지는 A안
if (new URLSearchParams(location.search).get('hero') === 'shrink') document.body.classList.add('hero-shrink');
