(function () {
  const mainContent = document.getElementById('main-content');
  const pageLoader = document.getElementById('pageLoader');
  if (!mainContent || !pageLoader) return;

  if (!window.__spaCleanupFns) {
    window.__spaCleanupFns = [];
  }

  function setLoader(active) {
    if (active) {
      document.body.classList.add('spa-loading');
    } else {
      document.body.classList.remove('spa-loading');
    }
  }

  function fadeOut(current) {
    current.classList.add('spa-leaving');
  }

  function fadeIn(current) {
    requestAnimationFrame(() => {
      current.classList.remove('spa-leaving');
      current.classList.add('spa-entering');
      requestAnimationFrame(() => {
        current.classList.remove('spa-entering');
      });
    });
  }

  function cleanupBeforeLoad() {
    if (Array.isArray(window.__spaCleanupFns)) {
      window.__spaCleanupFns.forEach((fn) => {
        if (typeof fn === 'function') {
          try {
            fn();
          } catch (err) {
            console.error('SPA cleanup error:', err);
          }
        }
      });
      window.__spaCleanupFns.length = 0;
    }
    if (typeof window.cleanupLanding === 'function') {
      try {
        window.cleanupLanding();
      } catch (err) {
        console.error('SPA cleanup error:', err);
      }
    }
  }

  async function fetchPage(href, isPop = false) {
    if (!href || href === window.location.href) return;

    cleanupBeforeLoad();
    setLoader(true);
    fadeOut(mainContent);

    try {
      const response = await fetch(href, {
        headers: {
          'X-Requested-With': 'SPA',
          Accept: 'text/html',
        },
      });
      if (!response.ok) {
        window.location.href = href;
        return;
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newContent = doc.getElementById('main-content');
      if (!newContent) {
        window.location.href = href;
        return;
      }
      const newTitle = doc.querySelector('title');
      if (newTitle) {
        document.title = newTitle.textContent;
      }
      mainContent.innerHTML = newContent.innerHTML;
      handleNewScriptElements(doc);
      if (!isPop) {
        window.history.pushState({}, '', href);
      }
      resetScroll();
      fadeIn(mainContent);
      initPage();
    } catch (error) {
      console.error('SPA navigation failed:', error);
      window.location.href = href;
    } finally {
      setLoader(false);
    }
  }

  function handleNewScriptElements(doc) {
    const scripts = doc.querySelectorAll('script');
    scripts.forEach((script) => {
      if (script.hasAttribute('data-spa-global')) return;
      if (script.src) {
        if (script.src.includes('/js/spa.js')) return;
        const existing = document.querySelector(`script[src="${script.src}"]`);
        if (existing) return;
        const cloned = document.createElement('script');
        cloned.src = script.src;
        cloned.defer = true;
        document.body.appendChild(cloned);
      } else if (script.textContent.trim()) {
        const inline = document.createElement('script');
        inline.textContent = script.textContent;
        document.body.appendChild(inline);
      }
    });
  }

  function resetScroll() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function firePageReady() {
    document.dispatchEvent(new CustomEvent('spa:ready', { bubbles: true }));
  }

  function isLocalLink(anchor) {
    return (
      anchor.host === window.location.host &&
      anchor.protocol === window.location.protocol &&
      anchor.getAttribute('target') !== '_blank' &&
      !anchor.hasAttribute('download') &&
      !anchor.href.startsWith('mailto:') &&
      !anchor.href.startsWith('tel:')
    );
  }

  function setupNavigation() {
    document.body.addEventListener('click', (event) => {
      const anchor = event.target.closest('a');
      if (!anchor || !anchor.href) return;
      if (!isLocalLink(anchor)) return;
      if (anchor.classList.contains('no-spa')) return;
      if (anchor.closest('form')) return;
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;

      if (anchor.closest('form')?.enctype === 'multipart/form-data') return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.target === '_blank') return;

      event.preventDefault();
      fetchPage(anchor.href);
    });

    window.addEventListener('popstate', () => {
      fetchPage(window.location.href, true);
    });
  }

  function rebindPageActions() {
    const cards = document.querySelectorAll('[data-href]');
    cards.forEach((card) => {
      card.style.cursor = 'pointer';
      if (!card.dataset.spaBound) {
        card.addEventListener('click', () => {
          if (!card.dataset.href) return;
          fetchPage(card.dataset.href);
        });
        card.dataset.spaBound = 'true';
      }
    });
  }

  function initPage() {
    rebindPageActions();
    firePageReady();
  }

  setupNavigation();
  initPage();
})();