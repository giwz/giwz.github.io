document.addEventListener('DOMContentLoaded', () => {
  const MOBILE_Q = '(orientation: portrait)';
  const isMobileQuery = () => window.matchMedia(MOBILE_Q).matches;
  // Inverso exato da MOBILE_Q: paisagem (notebook, tablet deitado, celular deitado) = desktop
  const DESKTOP_Q = '(orientation: landscape)';

  const modalOverlay = document.getElementById('modal-overlay');
  const interactiveItems = document.querySelectorAll('.interactive-item');
  const closeButtons = document.querySelectorAll('.close-modal');
  const modalWindows = document.querySelectorAll('.modal-window');
  let activeModal = null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =========================================================================
  // 1. Navegação nos itens interativos da mesa
  // =========================================================================
  interactiveItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const href = item.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const targetId = href.substring(1); // ex: 'projetos', 'ilustracoes'
      const modalId = `modal-${targetId}`;
      const targetElement = document.getElementById(modalId);
      if (!targetElement) return;

      e.preventDefault();

      if (isMobileQuery()) {
        // MODO MOBILE: feedback visual ("acende") e scroll suave até a seção
        item.classList.add('is-lit');
        setTimeout(() => item.classList.remove('is-lit'), 450);

        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // MODO DESKTOP: abre o modal flutuante sobre a mesa
        modalWindows.forEach(m => m.classList.add('hidden'));
        modalOverlay.classList.remove('hidden');
        targetElement.classList.remove('hidden');
        activeModal = targetElement;

        if (targetId === 'ilustracoes' && typeof ScrollTrigger !== 'undefined') {
          setTimeout(() => ScrollTrigger.refresh(), 100);
        }
      }
    });
  });

  // =========================================================================
  // 2. Fechamento de modais (Desktop)
  // =========================================================================
  const closeModal = () => {
    if (activeModal) {
      activeModal.classList.add('hidden');
      modalOverlay.classList.add('hidden');
      activeModal = null;
    }
  };

  closeButtons.forEach(btn => btn.addEventListener('click', closeModal));

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    // Com o lightbox aberto, o Esc fecha só o lightbox (o modal continua aberto)
    const lightboxOpen = !document.getElementById('lightbox')?.classList.contains('hidden');
    if (e.key === 'Escape' && !lightboxOpen) closeModal();
  });

  // =========================================================================
  // 3. Dock Flutuante no Mobile (aparece ao subir o scroll, some ao descer)
  // =========================================================================
  const mobileDock = document.getElementById('mobile-dock');
  const dockLinks = document.querySelectorAll('#mobile-dock .dock-link');
  let lastScrollY = window.scrollY;
  let dockTicking = false;

  const handleDockScroll = () => {
    if (!mobileDock || !isMobileQuery()) {
      dockTicking = false;
      return;
    }

    const currentY = window.scrollY;
    const diff = currentY - lastScrollY;
    const heroHeight = document.querySelector('.mobile-hero')?.offsetHeight || 500;

    // Se estiver no topo da página (dentro da mesa hero), esconde a dock
    if (currentY < heroHeight * 0.75) {
      mobileDock.classList.remove('is-visible');
    } else if (diff < -8) {
      // Rolando para CIMA: exibe a dock
      mobileDock.classList.add('is-visible');
    } else if (diff > 8) {
      // Rolando para BAIXO: esconde a dock para cima
      mobileDock.classList.remove('is-visible');
    }

    lastScrollY = currentY;
    dockTicking = false;
  };

  window.addEventListener('scroll', () => {
    if (!dockTicking) {
      window.requestAnimationFrame(handleDockScroll);
      dockTicking = true;
    }
  }, { passive: true });

  // Cliques na dock com scroll suave
  dockLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // =========================================================================
  // 4. Observador de seções visíveis (acende objeto do topo e atualiza dock)
  // =========================================================================
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.id;
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');

          // Atualiza link ativo na dock
          dockLinks.forEach(link => {
            if (link.getAttribute('data-target') === id) {
              link.classList.add('is-active');
            } else {
              link.classList.remove('is-active');
            }
          });
        } else {
          entry.target.classList.remove('in-view');
        }
      });
    }, {
      rootMargin: '-20% 0px -40% 0px',
      threshold: 0.1
    });

    modalWindows.forEach(win => sectionObserver.observe(win));

    // Pausa o vídeo do Chico quando estiver fora da tela para poupar bateria
    const chicoVideo = document.querySelector('.item-chico video');
    if (chicoVideo) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            chicoVideo.play().catch(() => {});
          } else {
            chicoVideo.pause();
          }
        });
      }, { threshold: 0.1 });
      videoObserver.observe(chicoVideo);

      // O vídeo só é baixado onde aparece (desktop): no celular a mesa não é exibida
      if (!isMobileQuery()) chicoVideo.play().catch(() => {});
    }
  }

  // =========================================================================
  // 5. Lightbox para Artes
  // =========================================================================
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeLightboxBtn = document.getElementById('closeLightbox');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxCounter = document.getElementById('lightboxCounter');

  // Abre uma arte em tela cheia (usado pelo carrossel do celular e pela grade bento do desktop)
  let openLightbox = () => {};

  if (lightbox && lightboxImg) {
    let arts = [];        // artes da galeria de onde veio o clique (na ordem)
    let artIndex = 0;
    let clearTimer = null;

    const showArt = (index, direction = 0) => {
      artIndex = (index + arts.length) % arts.length;
      const art = arts[artIndex];

      lightboxImg.style.opacity = '0';
      // No celular usa a versão média (1400): leve e de sobra para a tela pequena
      const full = art.getAttribute('data-full');
      lightboxImg.src = full
        ? (isMobileQuery() ? full.replace('-2560', '-1400') : full)
        : (art.currentSrc || art.src);
      lightboxImg.alt = art.alt || 'Arte Ampliada';
      if (lightboxImg.complete && lightboxImg.naturalWidth) lightboxImg.style.opacity = '1';
      if (lightboxCounter) lightboxCounter.textContent = `${artIndex + 1} / ${arts.length}`;

      if (direction && typeof gsap !== 'undefined') {
        gsap.fromTo(lightboxImg, { x: 40 * direction }, { x: 0, duration: 0.35, ease: 'power2.out' });
      }
    };

    // A imagem só aparece quando termina de carregar (a versão grande demora um pouco)
    lightboxImg.addEventListener('load', () => { lightboxImg.style.opacity = '1'; });

    openLightbox = (img) => {
      if (!img) return;
      clearTimeout(clearTimer);

      const group = img.closest('.horiz-gallery-strip, .bento-gallery');
      arts = group ? Array.from(group.querySelectorAll('.art-img')) : [img];
      const hasMany = arts.length > 1;
      [lightboxPrev, lightboxNext, lightboxCounter].forEach((el) => { if (el) el.hidden = !hasMany; });

      showArt(Math.max(arts.indexOf(img), 0));
      lightbox.classList.remove('hidden');
      document.documentElement.classList.add('lightbox-open');
      document.dispatchEvent(new CustomEvent('lightbox:open'));

      // Adiciona estado no histórico para o botão "Voltar" do celular fechar o lightbox
      try {
        history.pushState({ lightboxOpen: true }, '');
      } catch (_) {}
    };

    // Delegação: a galeria é remontada pelo matchMedia, então o clique é ouvido no documento
    document.addEventListener('click', (e) => {
      const img = e.target.closest('.horiz-gallery-strip .art-img');
      if (img) openLightbox(img);
    });

    const closeLightboxFunc = (shouldPopState = true) => {
      lightbox.classList.add('hidden');
      document.documentElement.classList.remove('lightbox-open');
      clearTimer = setTimeout(() => { lightboxImg.src = ''; }, 250);
      // Avisa qual arte estava aberta (o carrossel do celular volta para ela)
      document.dispatchEvent(new CustomEvent('lightbox:close', { detail: { index: artIndex } }));

      if (shouldPopState && history.state?.lightboxOpen) {
        history.back();
      }
    };

    if (closeLightboxBtn) {
      closeLightboxBtn.addEventListener('click', () => closeLightboxFunc(true));
    }

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightboxFunc(true);
    });

    // Troca de arte: botões, setas do teclado e deslizar o dedo para o lado
    const stepArt = (direction) => {
      if (arts.length > 1) showArt(artIndex + direction, direction);
    };

    if (lightboxPrev) lightboxPrev.addEventListener('click', () => stepArt(-1));
    if (lightboxNext) lightboxNext.addEventListener('click', () => stepArt(1));

    let swipeStartX = null;
    lightbox.addEventListener('touchstart', (e) => {
      swipeStartX = e.touches.length === 1 ? e.touches[0].clientX : null;
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
      if (swipeStartX === null) return;
      const dx = e.changedTouches[0].clientX - swipeStartX;
      swipeStartX = null;
      if (Math.abs(dx) > 50) stepArt(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (lightbox.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightboxFunc(true);
      else if (e.key === 'ArrowRight') stepArt(1);
      else if (e.key === 'ArrowLeft') stepArt(-1);
    });

    window.addEventListener('popstate', () => {
      if (!lightbox.classList.contains('hidden')) {
        closeLightboxFunc(false);
      }
    });
  }

  // =========================================================================
  // 6. GSAP e ScrollTrigger: Divisão Responsiva via matchMedia
  // =========================================================================
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    if (typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);

    const pinWrap = document.querySelector('.horiz-gallery-strip');
    const galleryWrapper = document.querySelector('.horiz-gallery-wrapper');
    const originalGalleryHTML = pinWrap ? pinWrap.innerHTML : '';

    const mm = gsap.matchMedia();

    // -----------------------------------------------------------------------
    // 6A. BRANCH DESKTOP (Mesa horizontal clássica + Galeria Bento no modal)
    // -----------------------------------------------------------------------
    mm.add(DESKTOP_Q, () => {
      // Fecha qualquer estado mobile e restaura modais
      document.querySelectorAll('.modal-window').forEach(m => m.classList.add('hidden'));
      modalOverlay.classList.add('hidden');
      activeModal = null;

      // Entrada da mesa: os objetos "caem" no lugar, um depois do outro, com uma leve girada.
      // A transição de transform do CSS (hover) fica desligada durante a animação.
      if (!prefersReducedMotion) {
        const deskItems = gsap.utils.toArray('.desk-container .item-wrapper');
        gsap.set(deskItems, { transition: 'none' });
        gsap.from(deskItems, {
          y: -40,
          opacity: 0,
          rotation: () => gsap.utils.random(-8, 8),
          duration: 0.9,
          ease: 'back.out(1.5)',
          stagger: 0.07,
          delay: 0.1,
          clearProps: 'transform,opacity,transition'
        });
      }

      if (!pinWrap || !galleryWrapper) return;

      galleryWrapper.classList.remove('gallery-scrub');
      galleryWrapper.style.height = '';
      galleryWrapper.style.display = 'none';

      // Monta a grade bento a partir das mesmas artes da faixa (mesma ordem).
      // Cada linha recebe as artes em sequência; a largura de cada bloco segue a
      // proporção real da arte (--a) e a altura da linha segue a soma delas (--g),
      // então em repouso nenhuma arte fica muito cortada.
      const ROWS = [4, 3, 3, 4];
      const sources = Array.from(pinWrap.querySelectorAll('.art-img'));
      const bento = document.createElement('div');
      bento.className = 'bento-gallery';

      let index = 0;
      let heightSum = 0;
      ROWS.forEach(count => {
        const row = document.createElement('div');
        row.className = 'bento-row';
        let aspectSum = 0;

        sources.slice(index, index + count).forEach(src => {
          const tile = document.createElement('button');
          tile.type = 'button';
          tile.className = 'bento-tile';
          tile.setAttribute('aria-label', `Abrir "${src.alt}" em tela cheia`);

          const img = src.cloneNode(true);
          img.sizes = '(max-width: 1400px) 50vw, 700px';
          const aspect = Number(src.dataset.aspect) || 1;
          tile.style.setProperty('--a', aspect);
          aspectSum += aspect;

          tile.appendChild(img);
          row.appendChild(tile);
        });

        row.style.setProperty('--g', (1 / aspectSum).toFixed(4));
        heightSum += 1 / aspectSum;
        bento.appendChild(row);
        index += count;
      });

      // Proporção total da grade = largura / soma das alturas naturais das linhas
      bento.style.setProperty('--bento-ratio', (1 / heightSum).toFixed(4));
      galleryWrapper.after(bento);

      // Clique no bloco abre a arte em tela cheia (mesmo lightbox do celular)
      const onTileClick = (e) => {
        const tile = e.target.closest('.bento-tile');
        if (tile) openLightbox(tile.querySelector('.art-img'));
      };
      bento.addEventListener('click', onTileClick);

      // Entrada suave das artes na primeira vez que o modal abre
      const tiles = bento.querySelectorAll('.bento-tile');
      gsap.set(tiles, { opacity: 0, y: 16 });
      const reveal = () => gsap.to(tiles, {
        opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.03,
        clearProps: 'transform,opacity'
      });
      const ilustracoes = document.getElementById('modal-ilustracoes');
      const observer = new MutationObserver(() => {
        if (!ilustracoes.classList.contains('hidden')) {
          reveal();
          observer.disconnect();
        }
      });
      observer.observe(ilustracoes, { attributes: true, attributeFilter: ['class'] });

      return () => {
        observer.disconnect();
        bento.removeEventListener('click', onTileClick);
        bento.remove();
        galleryWrapper.style.display = '';
      };
    });

    // -----------------------------------------------------------------------
    // 6B. BRANCH MOBILE (banner + Galeria em carrossel automático)
    // -----------------------------------------------------------------------
    mm.add(MOBILE_Q, (ctx) => {
      // Garante que o conteúdo da galeria é o original de 14 fotos (sem clones)
      if (pinWrap) pinWrap.innerHTML = originalGalleryHTML;

      // 1. Carrossel automático: uma arte inteira por vez, passando sozinha.
      //    Tocar numa arte abre o lightbox, onde dá para trocar de arte à vontade.
      //    Com "movimento reduzido" fica a faixa nativa com swipe (só CSS).
      let galleryTeardown = () => {};
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (pinWrap && galleryWrapper && !reduceMotion) {
        const sticky = galleryWrapper.querySelector('.horiz-gallery-sticky');
        const slides = Array.from(pinWrap.querySelectorAll('.project-wrap'));
        galleryWrapper.classList.add('gallery-carousel');

        const SLIDE_SECONDS = 2; // passagem automática: rápida e constante (só o toque muda o ritmo)
        let current = 0;
        let transition = null;
        let timer = null;
        let inView = false;
        let lightboxOpen = false;

        // Só a arte atual e as 2 seguintes ficam renderizadas: as outras só são baixadas quando chegam perto
        const markNear = () => {
          slides.forEach((slide, i) => {
            const ahead = (i - current + slides.length) % slides.length;
            const near = ahead <= 2 || ahead === slides.length - 1; // atual, 2 seguintes e a anterior
            slide.classList.toggle('is-near', near);
            // Quem está perto carrega já (o lazy-load só espera a imagem aparecer, e ela entra "fora" da tela)
            const img = slide.querySelector('img');
            if (img) img.loading = near ? 'eager' : 'lazy';
          });
        };

        let nextDelay = SLIDE_SECONDS; // depois de um toque, o automático espera o tempo definido no toque

        const schedule = () => {
          if (timer) timer.kill();
          timer = inView && !lightboxOpen ? gsap.delayedCall(nextDelay, () => go(1)) : null;
          nextDelay = SLIDE_SECONDS;
        };

        // direction: 1 = próxima (entra pela direita), -1 = anterior (entra pela esquerda)
        // duration: o tempo da troca. O automático usa 0.6s; o toque define o seu (rápido ou lento)
        function go(direction, duration = 0.6) {
          if (transition && transition.isActive()) transition.progress(1); // termina a troca anterior
          const from = slides[current];
          current = (current + direction + slides.length) % slides.length;
          const to = slides[current];
          markNear();
          from.classList.add('is-near'); // continua visível enquanto sai

          const startTransition = () => {
            if (slides[current] !== to) return; // o usuário já trocou de arte enquanto a imagem carregava
            transition = gsap.timeline({
              onComplete: () => {
                gsap.set(from, { xPercent: 100 });
                markNear();
                schedule();
              }
            })
              .fromTo(to, { xPercent: 100 * direction }, { xPercent: 0, duration, ease: 'power2.inOut' }, 0)
              .to(from, { xPercent: -100 * direction, duration, ease: 'power2.inOut' }, 0);
          };

          // A troca só começa com a imagem que entra já decodificada: senão ela aparece de repente
          const incoming = to.querySelector('img');
          if (incoming && !incoming.complete) {
            transition = null;
            incoming.decode().catch(() => {}).then(startTransition);
          } else {
            startTransition();
          }
        }

        const jumpTo = (index) => {
          if (transition) transition.kill();
          current = ((index % slides.length) + slides.length) % slides.length;
          gsap.set(slides, { xPercent: 100 });
          gsap.set(slides[current], { xPercent: 0 });
          markNear();
        };

        jumpTo(0);

        const viewObserver = new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          schedule();
        }, { threshold: 0.5 });
        viewObserver.observe(sticky);

        // Arrastar o dedo para o lado troca de arte e dá uma pausa maior no avanço automático
        let touchStart = null;
        const onTouchStart = (e) => {
          if (e.touches.length !== 1) return;
          touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
          if (timer) timer.kill();
        };
        const onTouchEnd = (e) => {
          if (!touchStart) return;
          const dx = e.changedTouches[0].clientX - touchStart.x;
          const dy = e.changedTouches[0].clientY - touchStart.y;
          // Quem controla o ritmo é o dedo: um gesto rápido troca depressa e deixa o automático esperar mais;
          // um gesto lento troca devagar e o automático demora um pouco para voltar
          const seconds = Math.max((performance.now() - touchStart.t) / 1000, 0.05);
          const speed = Math.abs(dx) / seconds; // px por segundo
          touchStart = null;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            const fast = speed > 900;
            nextDelay = fast ? 5 : 3;
            go(dx < 0 ? 1 : -1, fast ? 0.3 : 1.1);
          } else {
            schedule();
          }
        };
        const onTouchCancel = () => { touchStart = null; schedule(); };
        sticky.addEventListener('touchstart', onTouchStart, { passive: true });
        sticky.addEventListener('touchend', onTouchEnd, { passive: true });
        sticky.addEventListener('touchcancel', onTouchCancel, { passive: true });

        const onLightboxOpen = () => { lightboxOpen = true; schedule(); };
        const onLightboxClose = (e) => {
          lightboxOpen = false;
          const index = e.detail?.index;
          if (Number.isInteger(index) && index !== current) jumpTo(index);
          schedule();
        };
        document.addEventListener('lightbox:open', onLightboxOpen);
        document.addEventListener('lightbox:close', onLightboxClose);

        galleryTeardown = () => {
          if (timer) timer.kill();
          if (transition) transition.kill();
          viewObserver.disconnect();
          sticky.removeEventListener('touchstart', onTouchStart);
          sticky.removeEventListener('touchend', onTouchEnd);
          sticky.removeEventListener('touchcancel', onTouchCancel);
          document.removeEventListener('lightbox:open', onLightboxOpen);
          document.removeEventListener('lightbox:close', onLightboxClose);
          galleryWrapper.classList.remove('gallery-carousel');
        };
      }

      // 2. Faixa do hero: artes horizontais passando sem parar (loop infinito para o lado)
      let marqueeTeardown = () => {};
      let marqueeDrift = null;
      const marquee = document.querySelector('.hero-marquee-track');

      if (marquee && !reduceMotion) {
        const originals = Array.from(marquee.children);
        const copies = originals.map((img) => marquee.appendChild(img.cloneNode(true)));

        // Largura de um conjunto = distância até a primeira cópia (as larguras vêm do CSS, sem esperar o download)
        const setWidth = copies[0].offsetLeft - originals[0].offsetLeft;
        const PX_PER_SECOND = 40;

        const drift = gsap.to(marquee, {
          x: -setWidth,
          duration: setWidth / PX_PER_SECOND,
          ease: 'none',
          repeat: -1
        });
        marqueeDrift = drift;

        // Entrada: a faixa "abre" de cima para baixo, como uma cortina
        gsap.from(marquee.parentElement, {
          clipPath: 'inset(0% 0% 100% 0%)',
          duration: 1.2,
          ease: 'power4.inOut',
          clearProps: 'clipPath'
        });

        // Só anda enquanto a faixa aparece na tela (poupa bateria)
        const driftTrigger = ScrollTrigger.create({
          trigger: marquee.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => (self.isActive ? drift.play() : drift.pause())
        });

        marqueeTeardown = () => {
          driftTrigger.kill();
          drift.kill();
          copies.forEach((img) => img.remove());
          gsap.set(marquee, { clearProps: 'transform' });
        };
      }

      // 3. Rotação sutil da polaroid em "Sobre Mim" ao rolar a tela
      const polaroid = document.querySelector('.perfil-foto-flutuante');
      if (polaroid) {
        gsap.fromTo(polaroid, 
          { rotation: 5 },
          {
            rotation: -2,
            ease: 'none',
            scrollTrigger: {
              trigger: polaroid,
              start: 'top 80%',
              end: 'bottom 20%',
              scrub: true
            }
          }
        );
      }

      // 4. Textos entram ao rolar, subindo de dentro de uma "máscara" (SplitText responsivo:
      //    se a tela mudar, as linhas são refeitas). Títulos letra por letra; parágrafos linha por linha.
      const splits = [];
      if (!reduceMotion && typeof SplitText !== 'undefined') {
        const revealOnScroll = (selector, splitVars, tweenVars) => {
          gsap.utils.toArray(selector).forEach((el) => {
            let played = false;
            splits.push(SplitText.create(el, {
              ...splitVars,
              mask: 'lines',
              autoSplit: true,
              onSplit: (self) => {
                if (played) return; // já apareceu: só refaz as linhas, sem animar de novo
                return gsap.from(splitVars.type.includes('chars') ? self.chars : self.lines, {
                  ...tweenVars,
                  scrollTrigger: { trigger: el, start: 'top 88%', once: true, onEnter: () => { played = true; } }
                });
              }
            }));
          });
        };

        // Títulos: letra por letra, numa "onda"
        revealOnScroll(
          '.mobile-intro .welcome, #modal-projetos h2, #modal-ilustracoes h2, #modal-contato h2, .sobre-texto h3',
          { type: 'chars, lines' },
          { yPercent: 120, rotate: 10, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.025 }
        );

        // Parágrafos: linha por linha
        revealOnScroll(
          '.sobre-texto > p, .behance-desc, #modal-ilustracoes .modal-content > p, #modal-contato .modal-content > p, .social-badges-container h3',
          { type: 'lines' },
          { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.08 }
        );
      }

      // 5. Cartões, galeria e redes também sobem de dentro de uma máscara (a máscara é um
      //    recorte que se abre de baixo para cima enquanto o bloco sobe), em sequência
      if (!reduceMotion) {
        const blocks = gsap.utils.toArray('.sobre-texto, .behance-card, .horiz-gallery-wrapper, .contact-form, .social-badge');
        gsap.set(blocks, { clipPath: 'inset(100% 0% 0% 0% round 14px)', y: 60 });
        const revealBlock = (targets, extra) => gsap.to(targets, {
          clipPath: 'inset(0% 0% 0% 0% round 14px)',
          y: 0,
          clearProps: 'clipPath,transform',
          ...extra
        });
        ScrollTrigger.batch(blocks, {
          start: 'top 100%', // assim que encosta na tela (antes era 92%, o que deixava os últimos sem gatilho)
          once: true,
          onEnter: (batch) => revealBlock(batch, { duration: 1.1, ease: 'power4.out', stagger: 0.12 })
        });
        // Rede de segurança: ao chegar no fim da página, tudo que ainda estiver escondido aparece
        ScrollTrigger.create({
          trigger: document.body,
          start: 'bottom bottom',
          once: true,
          onEnter: () => revealBlock(blocks.filter((el) => el.style.clipPath), { duration: 0.6, stagger: 0.05 })
        });

        // Foto do card de Projetos: leve "zoom de câmera" enquanto o card passa pela tela
        const profilePic = document.querySelector('.behance-card .profile-pic');
        if (profilePic) {
          gsap.fromTo(profilePic, { scale: 0.85 }, {
            scale: 1.05,
            ease: 'none',
            scrollTrigger: { trigger: profilePic, start: 'top bottom', end: 'bottom top', scrub: true }
          });
        }
      }

      // 6. Velocity skew (demo do GSAP): ao rolar rápido, a faixa do topo e a galeria "entortam"
      //    de leve e a faixa acelera; quando a rolagem para, tudo volta ao normal suavemente
      let skewTrigger = null;
      if (!reduceMotion) {
        const skewTargets = gsap.utils.toArray('.hero-marquee-track, .horiz-gallery-strip');
        const setSkew = gsap.quickSetter(skewTargets, 'skewY', 'deg');
        const clampSkew = gsap.utils.clamp(-6, 6);
        const proxy = { skew: 0 };

        skewTrigger = ScrollTrigger.create({
          onUpdate: (self) => {
            const skew = clampSkew(self.getVelocity() / -350);
            if (Math.abs(skew) > Math.abs(proxy.skew)) {
              proxy.skew = skew;
              gsap.to(proxy, {
                skew: 0,
                duration: 0.8,
                ease: 'power3',
                overwrite: true,
                onUpdate: () => {
                  setSkew(proxy.skew);
                  if (marqueeDrift) marqueeDrift.timeScale(1 + Math.abs(proxy.skew) * 0.6);
                }
              });
            }
          }
        });
      }

      return () => {
        galleryTeardown();
        marqueeTeardown();
        splits.forEach((split) => split.revert());
        if (skewTrigger) skewTrigger.kill();
      };
    });

    // Refresh no carregamento completo de imagens
    window.addEventListener('load', () => {
      ScrollTrigger.refresh();
    });
  }

  // =========================================================================
  // 7. Barra de progresso de rolagem
  // Desktop: em pé, por dentro da janela aberta (é ela que rola). Celular: no topo, acompanha a página.
  // =========================================================================
  const scrollBar = document.getElementById('scroll-progress');
  if (scrollBar) {
    const scrollFill = scrollBar.querySelector('span');
    let scrollFrame = null;

    const updateScrollBar = () => {
      scrollFrame = null;
      const openModal = document.querySelector('.modal-window:not(.hidden)');
      const scroller = openModal && openModal.scrollHeight > openModal.clientHeight && getComputedStyle(openModal).overflowY === 'auto'
        ? openModal
        : null;

      // No desktop, sem janela aberta, não há o que rolar (a mesa é fixa): a barra fica escondida
      const pageScrolls = isMobileQuery();
      const top = scroller ? scroller.scrollTop : window.scrollY;
      const max = scroller
        ? scroller.scrollHeight - scroller.clientHeight
        : (pageScrolls ? document.documentElement.scrollHeight - window.innerHeight : 0);

      const progress = max > 0 ? Math.min(top / max, 1) : 0;
      const vertical = Boolean(scroller);
      scrollBar.classList.toggle('is-vertical', vertical);

      if (vertical) {
        // Encostada na lateral direita da janela, com respiro em cima e embaixo
        const box = scroller.getBoundingClientRect();
        scrollBar.style.top = `${box.top + 24}px`;
        scrollBar.style.left = `${box.right - 14}px`;
        scrollBar.style.height = `${box.height - 48}px`;
        scrollFill.style.transform = `scaleY(${progress})`;
      } else {
        scrollBar.removeAttribute('style');
        scrollFill.style.transform = `scaleX(${progress})`;
      }

      scrollBar.classList.toggle('is-visible', max > 1);
    };

    const requestScrollBar = () => {
      if (scrollFrame === null) scrollFrame = requestAnimationFrame(updateScrollBar);
    };

    document.addEventListener('scroll', requestScrollBar, { capture: true, passive: true });
    window.addEventListener('resize', requestScrollBar);
    // A janela abre com uma animação de escala: ao terminar, a posição da barra é recalculada
    modalWindows.forEach((win) => win.addEventListener('transitionend', requestScrollBar));
    // Abrir ou fechar um modal troca a classe "hidden": recalcula a barra
    new MutationObserver(requestScrollBar).observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['class']
    });
    requestScrollBar();
  }

  // =========================================================================
  // 8. Formulário de contato: envia por trás (sem sair do site) e mostra o resultado ali mesmo
  // =========================================================================
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    const submitBtn = contactForm.querySelector('.submit-btn');
    const status = contactForm.querySelector('.form-status');
    const idleLabel = submitBtn.textContent;

    const showStatus = (message, isError = false) => {
      status.textContent = message;
      status.classList.toggle('is-error', isError);
      status.hidden = false;
    };

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
      status.hidden = true;

      try {
        const response = await fetch(contactForm.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(contactForm)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Falha no envio');

        contactForm.reset();
        showStatus('Cartinha enviada! 💌 Em breve eu respondo.');
      } catch (_) {
        showStatus('Ops, não consegui enviar. Tente de novo ou me escreva por e-mail.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = idleLabel;
      }
    });
  }
});
