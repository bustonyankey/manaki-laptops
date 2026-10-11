/**
 * Main Application Controller (index.html)
 * Handles rendering laptop catalog, live search, filter pills, sorting,
 * favorites, and mobile interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Ensure store is ready
  LaptopStore.init();

  // State
  const state = {
    laptops: LaptopStore.getAll(),
    activeBrand: 'all',
    activeFeature: 'all',
    searchQuery: '',
    sortBy: 'featured',
    showFavoritesOnly: false
  };

  // DOM Elements
  const laptopsGrid = document.getElementById('laptopsGrid');
  const resultsCount = document.getElementById('resultsCount');
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const sortSelect = document.getElementById('sortSelect');
  const brandPills = document.querySelectorAll('.filter-pill[data-brand]');
  const featurePills = document.querySelectorAll('.filter-pill[data-feature]');
  const favoritesBadge = document.getElementById('favoritesBadge');
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');

  /**
   * Filter and Sort Laptops based on current state
   */
  function getFilteredLaptops() {
    let result = [...state.laptops];

    // Search query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.processor.toLowerCase().includes(q) ||
          item.ram.toLowerCase().includes(q) ||
          item.storage.toLowerCase().includes(q) ||
          (item.graphics && item.graphics.toLowerCase().includes(q)) ||
          item.features.some(f => f.toLowerCase().includes(q))
        );
      });
    }

    // Brand filter
    if (state.activeBrand !== 'all') {
      result = result.filter(item => item.brand.toLowerCase() === state.activeBrand.toLowerCase());
    }

    // Feature filter
    if (state.activeFeature !== 'all') {
      switch (state.activeFeature) {
        case 'touch':
          result = result.filter(item => item.isTouchscreen);
          break;
        case 'convertible':
          result = result.filter(item => item.isConvertible);
          break;
        case 'gpu':
          result = result.filter(item => item.hasDedicatedGpu);
          break;
        case 'ram16':
          result = result.filter(item => item.ramGb >= 16);
          break;
        case 'budget4k':
          result = result.filter(item => item.price <= 4000);
          break;
        case 'hot':
          result = result.filter(item => item.status === 'Hot Deal' || item.status === 'Almost New');
          break;
        case 'available':
          result = result.filter(item => item.status !== 'Sold Out');
          break;
      }
    }

    // Favorites only
    if (state.showFavoritesOnly) {
      const favs = FavoritesStore.getAll();
      result = result.filter(item => favs.includes(Number(item.id)));
    }

    // Sorting
    switch (state.sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'ram-desc':
        result.sort((a, b) => (b.ramGb || 0) - (a.ramGb || 0));
        break;
      case 'storage-desc':
        result.sort((a, b) => (b.storageGb || 0) - (a.storageGb || 0));
        break;
      case 'newest':
        result.sort((a, b) => b.id - a.id);
        break;
      case 'featured':
      default:
        // Available & featured first, sold out last
        result.sort((a, b) => {
          if (a.status === 'Sold Out' && b.status !== 'Sold Out') return 1;
          if (a.status !== 'Sold Out' && b.status === 'Sold Out') return -1;
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return a.id - b.id;
        });
        break;
    }

    return result;
  }

  /**
   * Render Laptop Cards
   */
  function renderLaptops() {
    const filtered = getFilteredLaptops();

    // Update count
    if (resultsCount) {
      resultsCount.textContent = `Showing ${filtered.length} laptop${filtered.length === 1 ? '' : 's'}`;
    }

    // Update favorites badge count
    updateFavoritesBadge();

    if (filtered.length === 0) {
      laptopsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No laptops found</h3>
          <p class="empty-desc">We couldn't find any laptops matching your current filters or search terms. Try clearing your filters.</p>
          <button class="btn-primary" id="resetFiltersBtn">Reset All Filters</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetFiltersBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', resetAllFilters);
      }
      return;
    }

    laptopsGrid.innerHTML = filtered.map(laptop => {
      const isFav = FavoritesStore.isFavorite(laptop.id);
      const isSold = laptop.status === 'Sold Out';
      const mainImg = laptop.images && laptop.images.length > 0 ? laptop.images[0] : 'images/L 1 A.webp';
      const totalImages = laptop.images ? laptop.images.length : 1;

      // Status badge
      let badgeHtml = '';
      if (isSold) {
        badgeHtml = `<span class="shopify-badge badge-soldout">Sold Out</span>`;
      } else if (laptop.status === 'Hot Deal') {
        badgeHtml = `<span class="shopify-badge badge-sale">SALE · HOT DEAL</span>`;
      } else if (laptop.status === 'Almost New') {
        badgeHtml = `<span class="shopify-badge badge-hot">✨ Almost New</span>`;
      } else {
        badgeHtml = `<span class="shopify-badge badge-instock">● In Stock</span>`;
      }

      // Feature pills (up to 3)
      const featurePillsHtml = laptop.features.slice(0, 3).map(f => {
        return `<span class="shopify-spec-tag">${f}</span>`;
      }).join('');

      // WhatsApp URL
      const waUrl = WhatsAppHelper.getInquiryUrl(laptop);

      const detailUrl = RouteHelper.getDetailUrl(laptop.id);

      return `
        <article class="shopify-card laptop-card" data-id="${laptop.id}">
          <div class="card-image-box card-media-wrapper" data-images='${JSON.stringify(laptop.images || [])}'>
            <a href="${detailUrl}" style="display: block; width: 100%; height: 100%;">
              <img 
                src="${mainImg}" 
                alt="${laptop.title}" 
                class="card-product-img card-img" 
                loading="lazy" 
                onerror="ImageHelper.handleError(this, '${laptop.number || laptop.id}')"
              />
            </a>
            
            <div class="shopify-badge-container card-badges">
              ${badgeHtml}
            </div>

            <button 
              class="shopify-card-wishlist card-fav-btn ${isFav ? 'active' : ''}" 
              data-fav-id="${laptop.id}" 
              title="${isFav ? 'Remove from wishlist' : 'Save to wishlist'}"
              aria-label="Save to wishlist"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </button>

            ${totalImages > 1 ? `
              <div class="photo-count-tag">
                📷 ${totalImages} Photos
              </div>
            ` : ''}
          </div>

          <div class="card-info-content card-body">
            <div class="card-vendor-tag">
              ${laptop.brand} · ${laptop.screenSize} · #${laptop.number || laptop.id}
            </div>

            <h3 class="card-product-title card-title">
              <a href="${detailUrl}">${laptop.title}</a>
            </h3>

            <div class="card-specs-row spec-chips">
              <span class="shopify-spec-tag">${laptop.processor} ${laptop.generation || ''}</span>
              <span class="shopify-spec-tag">${laptop.ram} RAM</span>
              <span class="shopify-spec-tag">${laptop.storage}</span>
              ${featurePillsHtml}
            </div>

            <div class="card-pricing-block card-footer">
              <div class="price-display-group price-box">
                <div class="shopify-price-now current-price">${laptop.priceFormatted}</div>
                ${laptop.originalPrice ? `<div class="shopify-price-compare original-price">Regular ${laptop.originalPriceFormatted}</div>` : ''}
              </div>

              <div class="card-btn-actions card-actions">
                <a href="${detailUrl}" class="btn-quick-view">View</a>
                ${!isSold ? `
                  <a href="${waUrl}" target="_blank" rel="noopener" class="btn-card-whatsapp btn-card-wa" title="Order via WhatsApp" aria-label="Order via WhatsApp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.488-8.482"/>
                    </svg>
                  </a>
                ` : ''}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach event listeners to favorite buttons
    attachFavoriteListeners();
  }

  const headerWishlistBtn = document.getElementById('headerWishlistBtn');
  const bottomFavoritesBadge = document.getElementById('bottomFavoritesBadge');

  /**
   * Favorites Badge Update
   */
  function updateFavoritesBadge() {
    const favCount = FavoritesStore.getAll().length;
    if (favoritesBadge) {
      favoritesBadge.textContent = favCount;
      favoritesBadge.style.display = favCount > 0 ? 'flex' : 'none';
    }
    if (bottomFavoritesBadge) {
      bottomFavoritesBadge.textContent = favCount;
      bottomFavoritesBadge.style.display = favCount > 0 ? 'flex' : 'none';
    }
  }

  if (headerWishlistBtn) {
    headerWishlistBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.showFavoritesOnly = !state.showFavoritesOnly;
      renderLaptops();
      showToast(state.showFavoritesOnly ? 'Viewing Wishlist items ❤️' : 'Viewing All Products');
    });
  }

  /**
   * Attach Favorite Listeners
   */
  function attachFavoriteListeners() {
    document.querySelectorAll('.card-fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-fav-id');
        const isNowFav = FavoritesStore.toggle(id);
        
        btn.classList.toggle('active', isNowFav);
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.setAttribute('fill', isNowFav ? 'currentColor' : 'none');
        }

        updateFavoritesBadge();
        showToast(isNowFav ? 'Added to Saved Laptops ❤️' : 'Removed from Saved');

        // If in favorites-only view, re-render
        if (state.showFavoritesOnly) {
          renderLaptops();
        }
      });
    });
  }

  /**
   * Filter Pill Handlers
   */
  brandPills.forEach(pill => {
    pill.addEventListener('click', () => {
      brandPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeBrand = pill.getAttribute('data-brand');
      state.showFavoritesOnly = false;
      renderLaptops();
    });
  });

  featurePills.forEach(pill => {
    pill.addEventListener('click', () => {
      featurePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFeature = pill.getAttribute('data-feature');
      state.showFavoritesOnly = false;
      renderLaptops();
    });
  });

  /**
   * Search Inputs
   */
  function handleSearchInput(value) {
    state.searchQuery = value;
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('visible', value.length > 0);
    }
    renderLaptops();
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (mobileSearchInput) mobileSearchInput.value = e.target.value;
      handleSearchInput(e.target.value);
    });
  }

  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
      if (searchInput) searchInput.value = e.target.value;
      handleSearchInput(e.target.value);
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (mobileSearchInput) mobileSearchInput.value = '';
      handleSearchInput('');
    });
  }

  /**
   * Sort Handler
   */
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderLaptops();
    });
  }

  /**
   * Reset All Filters
   */
  function resetAllFilters() {
    state.activeBrand = 'all';
    state.activeFeature = 'all';
    state.searchQuery = '';
    state.sortBy = 'featured';
    state.showFavoritesOnly = false;

    if (searchInput) searchInput.value = '';
    if (mobileSearchInput) mobileSearchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.remove('visible');
    if (sortSelect) sortSelect.value = 'featured';

    brandPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-brand') === 'all'));
    featurePills.forEach(p => p.classList.toggle('active', p.getAttribute('data-feature') === 'all'));

    renderLaptops();
  }

  /**
   * Bottom Nav Handling
   */
  bottomNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const target = item.getAttribute('data-target');
      if (target === 'favorites') {
        e.preventDefault();
        bottomNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.showFavoritesOnly = true;
        renderLaptops();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target === 'home') {
        bottomNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.showFavoritesOnly = false;
        renderLaptops();
      } else if (target === 'search') {
        e.preventDefault();
        if (mobileSearchInput) {
          mobileSearchInput.focus();
        } else if (searchInput) {
          searchInput.focus();
        }
      }
    });
  });

  /**
   * Initial Render
   */
  renderLaptops();
});

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
