(() => {
  const FRAME_COUNT = 240;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // DOM Elements
  const header = document.getElementById('site-header');
  const progressBar = document.getElementById('progress-bar');
  const progressItems = document.querySelectorAll('.progress-item');
  const navLinks = document.querySelectorAll('.nav-link');

  const secHero = document.getElementById('section-hero');
  const secArrival = document.getElementById('section-arrival');
  const secKitchen = document.getElementById('section-kitchen');
  const secSuite = document.getElementById('section-suite');

  const arrivalDetails = [
    document.getElementById('arrival-detail-1'),
    document.getElementById('arrival-detail-2'),
    document.getElementById('arrival-detail-3')
  ];

  const kitchenDetails = [
    document.getElementById('kitchen-detail-1'),
    document.getElementById('kitchen-detail-2'),
    document.getElementById('kitchen-detail-3')
  ];

  const heroExploreBtn = document.getElementById('hero-explore-btn');
  const startProjectBtn = document.getElementById('start-project-btn');
  const viewWorkBtn = document.getElementById('view-work-btn');
  const navInquireBtn = document.getElementById('nav-inquire');
  const inquireModal = document.getElementById('inquire-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Frame path generator (0 -> 001, ..., 239 -> 240)
  const getFramePath = (index) => {
    const frameNum = String(index + 1).padStart(3, '0');
    return `ezgif-20cd0d7d31aec394-jpg/ezgif-frame-${frameNum}.jpg`;
  };

  const images = new Array(FRAME_COUNT);
  const loaded = new Array(FRAME_COUNT).fill(false);
  let lastDrawnIndex = -1;
  let currentTargetFrame = 0;
  let currentScale = 1.0;

  // Maximum scroll calculation
  const getMaxScroll = () => {
    const track = document.getElementById('scroll-track');
    if (track) {
      return track.offsetHeight - window.innerHeight;
    }
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
  };

  // High-DPI canvas resizing for crystal-clear clarity across all devices (320px to 1440px+)
  let lastWidth = 0;
  let lastHeight = 0;

  const resizeCanvas = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Prevent mobile address-bar hide/show jitter (< 80px delta in height with unchanged width)
    if (lastWidth === w && Math.abs(lastHeight - h) < 80) {
      return;
    }
    lastWidth = w;
    lastHeight = h;

    // Native device pixel ratio: capped at 2.0 to balance extreme sharpness and 60/120fps GPU performance
    // Avoid artificial minimums that cause subpixel blur on standard 1.0 displays
    const rawDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(Math.max(rawDpr, 1.0), 2.0);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (lastDrawnIndex >= 0 && loaded[lastDrawnIndex]) {
      drawImageCover(images[lastDrawnIndex], currentScale);
    }
  };

  // Draw image with cover aspect ratio, dynamic camera scale & sub-pixel alignment prevention
  const drawImageCover = (img, scaleMultiplier = 1.0) => {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const baseRatio = Math.max(cw / iw, ch / ih);
    const finalRatio = baseRatio * scaleMultiplier;
    const renderWidth = Math.round(iw * finalRatio);
    const renderHeight = Math.round(ih * finalRatio);
    const offsetX = Math.round((cw - renderWidth) / 2);
    const offsetY = Math.round((ch - renderHeight) / 2);

    ctx.drawImage(img, 0, 0, iw, ih, offsetX, offsetY, renderWidth, renderHeight);
  };

  // Closest available frame selector
  const findClosestLoadedIndex = (targetIdx) => {
    if (loaded[targetIdx]) return targetIdx;

    let closest = -1;
    let minDistance = Infinity;

    for (let i = 0; i < FRAME_COUNT; i++) {
      if (loaded[i]) {
        const dist = Math.abs(i - targetIdx);
        if (dist < minDistance) {
          minDistance = dist;
          closest = i;
        }
      }
    }
    return closest;
  };

  const renderFrame = (targetIdx, scaleMultiplier = 1.0, force = false) => {
    currentTargetFrame = targetIdx;
    currentScale = scaleMultiplier;
    const bestIdx = findClosestLoadedIndex(targetIdx);
    if (bestIdx < 0) return;

    if (force || bestIdx !== lastDrawnIndex || Math.abs(currentScale - scaleMultiplier) > 0.001) {
      drawImageCover(images[bestIdx], scaleMultiplier);
      lastDrawnIndex = bestIdx;
    }
  };

  // Intelligent progressive preloader with offscreen asynchronous decode
  const preloadImages = () => {
    const loadFrame = (index, callback) => {
      if (images[index] && loaded[index]) {
        if (callback) callback();
        return;
      }
      const img = new Image();
      img.src = getFramePath(index);
      images[index] = img;

      const onDecoded = () => {
        loaded[index] = true;
        if (index === 0 && lastDrawnIndex === -1) {
          renderFrame(0, 1.0, true);
        } else {
          const currentDist = Math.abs(lastDrawnIndex - currentTargetFrame);
          const newDist = Math.abs(index - currentTargetFrame);
          if (newDist < currentDist) {
            renderFrame(currentTargetFrame, currentScale, true);
          }
        }
        if (callback) callback();
      };

      if (typeof img.decode === 'function') {
        img.decode().then(onDecoded).catch(onDecoded);
      } else {
        img.onload = onDecoded;
        img.onerror = () => { if (callback) callback(); };
      }
    };

    // 1. Frame 0 immediate priority
    loadFrame(0, () => {
      // 2. Load landmark keyframes every 8 frames (0, 8, 16, 24 ... 239) across the 4 sections
      const keyframes = [];
      for (let i = 8; i < FRAME_COUNT; i += 8) {
        keyframes.push(i);
      }
      [52, 115, 177, 239].forEach(f => {
        if (!keyframes.includes(f) && f !== 0) keyframes.push(f);
      });

      let kIdx = 0;
      const loadKeyframeBatch = () => {
        if (kIdx >= keyframes.length) {
          // 3. Load all remaining in-between frames progressively
          loadRemainingFrames();
          return;
        }
        const target = keyframes[kIdx++];
        loadFrame(target, loadKeyframeBatch);
      };

      // 4 concurrent parallel pipelines for landmark frames
      for (let s = 0; s < 4; s++) {
        loadKeyframeBatch();
      }
    });

    const loadRemainingFrames = () => {
      let rIdx = 1;
      const loadNextRemaining = () => {
        while (rIdx < FRAME_COUNT && loaded[rIdx]) {
          rIdx++;
        }
        if (rIdx >= FRAME_COUNT) return;
        const cur = rIdx++;
        loadFrame(cur, loadNextRemaining);
      };

      // 4 concurrent background streams
      for (let s = 0; s < 4; s++) {
        loadNextRemaining();
      }
    };
  };

  // Smooth scroll & mouse wheel momentum engine
  let targetScroll = window.scrollY || 0;
  let currentScroll = window.scrollY || 0;
  let isWheelActive = false;
  let isProgrammaticScroll = false;
  let wheelTimer = null;
  let programmaticTimer = null;

  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const maxScroll = getMaxScroll();
    if (maxScroll <= 0) return;

    isWheelActive = true;
    isProgrammaticScroll = false;
    clearTimeout(programmaticTimer);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      isWheelActive = false;
    }, 120);

    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 35;
    else if (e.deltaMode === 2) delta *= window.innerHeight;

    targetScroll = Math.max(0, Math.min(maxScroll, targetScroll + delta));
  }, { passive: false });

  // Passive window scroll listener (handles native mobile touch momentum, scrollbar drags, etc.)
  window.addEventListener('scroll', () => {
    if (!isWheelActive && !isProgrammaticScroll) {
      targetScroll = window.scrollY;
    }
  }, { passive: true });

  // Keyboard navigation support
  window.addEventListener('keydown', (e) => {
    const maxScroll = getMaxScroll();
    if (maxScroll <= 0) return;

    let delta = 0;
    if (e.key === 'ArrowDown') delta = 100;
    else if (e.key === 'ArrowUp') delta = -100;
    else if (e.key === 'PageDown' || e.key === ' ') delta = window.innerHeight * 0.85;
    else if (e.key === 'PageUp') delta = -window.innerHeight * 0.85;
    else if (e.key === 'Home') delta = -targetScroll;
    else if (e.key === 'End') delta = maxScroll - targetScroll;
    else if (e.key === 'Escape') {
      if (inquireModal) inquireModal.classList.remove('open');
    }

    if (delta !== 0) {
      e.preventDefault();
      targetScroll = Math.max(0, Math.min(maxScroll, targetScroll + delta));
    }
  });


  // Section targets for smooth navigation
  const SECTION_PROGRESS_MAP = {
    hero: 0.00,
    arrival: 0.34,
    kitchen: 0.61,
    suite: 0.89
  };

  const scrollToSection = (sectionKey) => {
    const maxScroll = getMaxScroll();
    const prog = SECTION_PROGRESS_MAP[sectionKey] !== undefined ? SECTION_PROGRESS_MAP[sectionKey] : 0;
    targetScroll = maxScroll * prog;
    isProgrammaticScroll = true;
    clearTimeout(programmaticTimer);
    programmaticTimer = setTimeout(() => {
      isProgrammaticScroll = false;
    }, 1500);
  };

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.target;
      if (target) scrollToSection(target);
    });
  });

  progressItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      if (target) scrollToSection(target);
    });
  });

  const navBrand = document.getElementById('nav-brand');
  if (navBrand) {
    navBrand.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection('hero');
    });
  }

  if (heroExploreBtn) {
    heroExploreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollToSection('arrival');
    });
  }

  if (viewWorkBtn) {
    viewWorkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection('hero');
    });
  }

  // Inquire Modal triggers
  const openModal = () => {
    if (inquireModal) {
      inquireModal.classList.add('open');
      inquireModal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeModal = () => {
    if (inquireModal) {
      inquireModal.classList.remove('open');
      inquireModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (startProjectBtn) startProjectBtn.addEventListener('click', openModal);
  if (navInquireBtn) navInquireBtn.addEventListener('click', openModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (inquireModal) {
    inquireModal.addEventListener('click', (e) => {
      if (e.target === inquireModal) closeModal();
    });
  }

  // Update Section Storytelling Overlays & Camera Scale based on Scroll Progress
  const updateStoryExperience = (progress) => {
    // 1. Header Scrolled State
    if (header) {
      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    // 2. Right-side Section Progress Indicator
    if (progressBar) {
      progressBar.style.height = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }

    let activeSectionName = 'hero';
    if (progress >= 0.74) activeSectionName = 'suite';
    else if (progress >= 0.48) activeSectionName = 'kitchen';
    else if (progress >= 0.22) activeSectionName = 'arrival';

    progressItems.forEach((item) => {
      if (item.dataset.target === activeSectionName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 3. Cinematic Camera Scale Calculation
    let cameraScale = 1.00;
    if (progress < 0.22) {
      cameraScale = 1.00 + (progress / 0.22) * 0.06;
    } else if (progress < 0.48) {
      cameraScale = 1.02;
    } else if (progress < 0.74) {
      const kP = (progress - 0.48) / (0.74 - 0.48);
      cameraScale = 1.06 - kP * 0.06;
    } else {
      const sP = (progress - 0.74) / 0.26;
      cameraScale = 1.00 + sP * 0.02;
    }

    // 4. Section 01: Hero / Mansion (0.00 -> 0.22)
    if (secHero) {
      if (progress <= 0.24) {
        secHero.classList.add('active');
        const fadeOut = progress > 0.14 ? Math.max(0, 1 - (progress - 0.14) / 0.08) : 1;
        const translateY = (progress / 0.22) * -35;
        secHero.style.opacity = fadeOut.toFixed(3);
        secHero.style.transform = `translateY(${translateY.toFixed(1)}px)`;
      } else {
        secHero.classList.remove('active');
        secHero.style.opacity = '0';
      }
    }

    // 5. Section 02: Hall / Arrival (0.22 -> 0.48)
    if (secArrival) {
      if (progress >= 0.20 && progress <= 0.50) {
        secArrival.classList.add('active');
        let op = 1;
        if (progress < 0.26) {
          op = (progress - 0.20) / 0.06;
        } else if (progress > 0.42) {
          op = Math.max(0, 1 - (progress - 0.42) / 0.06);
        }
        const translateY = (0.34 - progress) * 18;
        secArrival.style.opacity = Math.max(0, Math.min(1, op)).toFixed(3);
        secArrival.style.transform = `translateY(${translateY.toFixed(1)}px)`;

        // Sequential Detail Reveal: LIGHT -> SPACE -> DETAIL
        if (arrivalDetails[0]) {
          if (progress >= 0.26) arrivalDetails[0].classList.add('revealed');
          else arrivalDetails[0].classList.remove('revealed');
        }
        if (arrivalDetails[1]) {
          if (progress >= 0.31) arrivalDetails[1].classList.add('revealed');
          else arrivalDetails[1].classList.remove('revealed');
        }
        if (arrivalDetails[2]) {
          if (progress >= 0.36) arrivalDetails[2].classList.add('revealed');
          else arrivalDetails[2].classList.remove('revealed');
        }
      } else {
        secArrival.classList.remove('active');
        secArrival.style.opacity = '0';
        arrivalDetails.forEach(d => d && d.classList.remove('revealed'));
      }
    }

    // 6. Section 03: Kitchen (0.48 -> 0.74)
    if (secKitchen) {
      if (progress >= 0.46 && progress <= 0.76) {
        secKitchen.classList.add('active');
        let op = 1;
        if (progress < 0.52) {
          op = (progress - 0.46) / 0.06;
        } else if (progress > 0.68) {
          op = Math.max(0, 1 - (progress - 0.68) / 0.06);
        }
        const translateY = (0.60 - progress) * 25;
        secKitchen.style.opacity = Math.max(0, Math.min(1, op)).toFixed(3);
        secKitchen.style.transform = `translateY(${translateY.toFixed(1)}px)`;

        // Sequential Reveal: MATERIALS -> LIGHT -> FORM
        if (kitchenDetails[0]) {
          if (progress >= 0.52) kitchenDetails[0].classList.add('revealed');
          else kitchenDetails[0].classList.remove('revealed');
        }
        if (kitchenDetails[1]) {
          if (progress >= 0.57) kitchenDetails[1].classList.add('revealed');
          else kitchenDetails[1].classList.remove('revealed');
        }
        if (kitchenDetails[2]) {
          if (progress >= 0.62) kitchenDetails[2].classList.add('revealed');
          else kitchenDetails[2].classList.remove('revealed');
        }
      } else {
        secKitchen.classList.remove('active');
        secKitchen.style.opacity = '0';
        kitchenDetails.forEach(d => d && d.classList.remove('revealed'));
      }
    }

    // 7. Section 04: Bedroom / Private Suite (0.74 -> 1.00)
    if (secSuite) {
      if (progress >= 0.72) {
        secSuite.classList.add('active');
        let op = 1;
        if (progress < 0.80) {
          op = (progress - 0.72) / 0.08;
        }
        const translateY = (0.88 - progress) * 20;
        secSuite.style.opacity = Math.max(0, Math.min(1, op)).toFixed(3);
        secSuite.style.transform = `translateY(${translateY.toFixed(1)}px)`;
      } else {
        secSuite.classList.remove('active');
        secSuite.style.opacity = '0';
      }
    }

    return cameraScale;
  };

  // Continuous animation loop
  const animationLoop = () => {
    const maxScroll = getMaxScroll();

    if (maxScroll > 0) {
      const diff = targetScroll - currentScroll;
      // High-performance adaptive lerping: 0.095 for momentum wheel, 0.20 for direct touch response
      const lerpFactor = isWheelActive ? 0.095 : 0.20;
      if (Math.abs(diff) > 0.05) {
        currentScroll += diff * lerpFactor;
      } else {
        currentScroll = targetScroll;
        if (isProgrammaticScroll) {
          isProgrammaticScroll = false;
          clearTimeout(programmaticTimer);
        }
      }

      if (isWheelActive || isProgrammaticScroll) {
        window.scrollTo(0, Math.round(currentScroll));
      }

      const progress = Math.max(0, Math.min(1, currentScroll / maxScroll));
      const targetFrame = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(progress * (FRAME_COUNT - 1)))
      );

      const dynamicScale = updateStoryExperience(progress);
      renderFrame(targetFrame, dynamicScale);
    } else {
      updateStoryExperience(0);
    }

    requestAnimationFrame(animationLoop);
  };

  // Window resize listener
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Initialize
  resizeCanvas();
  preloadImages();
  targetScroll = window.scrollY || 0;
  currentScroll = targetScroll;
  const initialMax = getMaxScroll();
  const initialProg = initialMax > 0 ? currentScroll / initialMax : 0;
  updateStoryExperience(initialProg);
  requestAnimationFrame(animationLoop);
})();
