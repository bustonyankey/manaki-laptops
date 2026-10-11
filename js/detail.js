/**
 * Laptop Detail Page Controller (detail.html)
 * Shopify Dawn theme layout with multi-image gallery,
 * zoom lightbox, detailed hardware specs, and WhatsApp ordering.
 */

document.addEventListener('DOMContentLoaded', () => {
  LaptopStore.init();

  // Get ID from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const laptopId = urlParams.get('id');

  if (!laptopId) {
    renderNotFound('No laptop specified.');
    return;
  }

  const laptop = LaptopStore.getById(laptopId);
  if (!laptop) {
    renderNotFound('This laptop could not be found or may have been removed.');
    return;
  }

  // Populate detail page
  renderLaptopDetail(laptop);
  renderSimilarLaptops(laptop);
});

let currentImageIndex = 0;
let laptopImages = [];

function renderLaptopDetail(laptop) {
  document.title = `${laptop.title} · Manaki Laptop Deals`;

  const container = document.getElementById('detailContent');
  if (!container) return;

  laptopImages = (laptop.images && laptop.images.length > 0) ? laptop.images : ['images/L 1 A.webp'];
  currentImageIndex = 0;

  const isSold = laptop.status === 'Sold Out';
  const isFav = FavoritesStore.isFavorite(laptop.id);
  const waUrl = WhatsAppHelper.getInquiryUrl(laptop);

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

  container.innerHTML = `
    <!-- Shopify Breadcrumbs -->
    <div class="shopify-breadcrumbs">
      <a href="${RouteHelper.getHomeUrl()}">Home</a>
      <span>/</span>
      <a href="${RouteHelper.getHomeUrl()}">Laptops</a>
      <span>/</span>
      <span style="color: #121212; font-weight: 600;">${laptop.title}</span>
    </div>

    <div class="shopify-product-layout detail-grid">
      <!-- Left: Media Gallery -->
      <div class="shopify-gallery gallery-wrapper">
        <div class="shopify-main-image-wrap main-image-container" id="mainImageContainer">
          <img 
            id="mainDetailImg" 
            src="${laptopImages[0]}" 
            alt="${laptop.title}" 
            class="shopify-main-img main-detail-img"
            onerror="ImageHelper.handleError(this, '${laptop.number || laptop.id}')"
          />

          <div class="shopify-badge-container card-badges">
            ${badgeHtml}
          </div>

          ${laptopImages.length > 1 ? `
            <button class="gallery-nav-arrow gallery-nav-btn prev" id="galleryPrevBtn" aria-label="Previous Image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <button class="gallery-nav-arrow gallery-nav-btn next" id="galleryNextBtn" aria-label="Next Image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          ` : ''}

          <div class="photo-count-tag" style="bottom: 0.85rem; right: 0.85rem;">
            <span id="photoCounter">1 / ${laptopImages.length}</span> (Click to Zoom)
          </div>
        </div>

        ${laptopImages.length > 1 ? `
          <div class="shopify-thumbnails-list thumbnails-strip" id="thumbnailsStrip">
            ${laptopImages.map((img, idx) => `
              <div class="shopify-thumb-box thumb-item ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                <img src="${img}" alt="Thumbnail ${idx + 1}" loading="lazy" onerror="this.src='images/L 1 A.webp';"/>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Right: Product Purchase Form & Specs -->
      <div class="shopify-product-details detail-info">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span class="product-vendor-subtitle">MANAKI LAPTOP DEALS · #${laptop.number || laptop.id}</span>
          <span class="shopify-spec-tag">${laptop.category || 'Business'}</span>
        </div>

        <h1 class="shopify-product-heading detail-title">${laptop.title}</h1>

        <!-- Stock Indicator -->
        <div class="stock-ticker-row">
          <span class="stock-pulse-dot" style="${isSold ? 'background-color: #6b7280; box-shadow: none;' : ''}"></span>
          <span>${isSold ? 'Sold Out / Out of Stock' : 'In Stock · Ready for Doorstep Delivery in Accra & Ghana'}</span>
        </div>

        <!-- Pricing Card -->
        <div class="shopify-price-strip detail-price-box">
          <div>
            <div class="price-main-bold detail-price-main">${laptop.priceFormatted}</div>
            ${laptop.originalPrice ? `
              <div class="price-compare-sub detail-price-sub">
                Regular price <s>${laptop.originalPriceFormatted}</s> <span style="color: var(--color-sale-red); font-weight: 700;">(Save GH₵${(laptop.originalPrice - laptop.price).toLocaleString()})</span>
              </div>
            ` : ''}
          </div>
          <span style="font-size: 0.8rem; color: #6b7280; font-weight: 500;">Pay on Delivery Available</span>
        </div>

        <!-- Purchase & Wishlist Actions -->
        <div class="shopify-buy-block">
          ${!isSold ? `
            <a href="${waUrl}" target="_blank" rel="noopener" class="btn-shopify-checkout-wa btn-detail-wa">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.488-8.482"/>
              </svg>
              Order via WhatsApp (0543862551)
            </a>
          ` : `
            <button class="btn-shopify-checkout-wa" style="background-color: #9ca3af; cursor: not-allowed; box-shadow: none;" disabled>
              Sold Out / Unavailable
            </button>
          `}

          <div class="shopify-action-row">
            <button class="btn-shopify-secondary" id="detailFavBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'var(--color-sale-red)' : 'none'}" stroke="${isFav ? 'var(--color-sale-red)' : 'currentColor'}" stroke-width="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
              <span>${isFav ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
            </button>

            <button class="btn-shopify-secondary" id="shareBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" x2="12" y1="2" y2="15"/>
              </svg>
              <span>Share Product</span>
            </button>
          </div>
        </div>

        <!-- Description -->
        <div style="background-color: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;">
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: #121212;">Product Overview</h3>
          <p style="color: var(--color-text-secondary); font-size: 0.92rem; line-height: 1.6;">
            ${laptop.description}
          </p>
        </div>

        <!-- Full Hardware Specifications -->
        <div class="shopify-specs-table-card specs-card">
          <h2 class="specs-table-title specs-heading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--shopify-black)" stroke-width="2">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M7 7h10M7 12h10M7 17h10"/>
            </svg>
            Technical Specifications
          </h2>
          <table class="shopify-spec-table specs-table">
            <tbody>
              <tr>
                <td class="spec-key spec-label">Processor</td>
                <td class="spec-val">${laptop.processor} ${laptop.generation ? `(${laptop.generation})` : ''}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Clock Speed</td>
                <td class="spec-val">${laptop.speed}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">RAM Memory</td>
                <td class="spec-val">${laptop.ram} High-Speed RAM</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Internal Storage</td>
                <td class="spec-val">${laptop.storage} (Fast SSD Performance)</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Display & Screen</td>
                <td class="spec-val">${laptop.display}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Graphics (GPU)</td>
                <td class="spec-val">${laptop.graphics}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Touchscreen</td>
                <td class="spec-val">${laptop.isTouchscreen ? '✅ Touch Supported' : 'Non-Touch'}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Form Factor</td>
                <td class="spec-val">${laptop.isConvertible ? '🔄 360° Convertible (Laptop + Tablet)' : 'Standard Laptop'}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Backlit Keyboard</td>
                <td class="spec-val">${laptop.hasBacklitKeyboard ? '💡 Yes, Illuminated Keyboard' : 'Standard'}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Fingerprint Security</td>
                <td class="spec-val">${laptop.hasFingerprint ? '🔒 Yes, Biometric Reader' : 'No'}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Battery Condition</td>
                <td class="spec-val">🔋 ${laptop.battery || 'Tested & Strong Duration'}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Physical Condition</td>
                <td class="spec-val">${laptop.condition}</td>
              </tr>
              <tr>
                <td class="spec-key spec-label">Package Contents</td>
                <td class="spec-val">Laptop + Original Power Adapter Charger</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 4 Pillars Trust Bar -->
        <div class="trust-ticker-grid" style="border-radius: var(--radius-md);">
          <div class="trust-ticker-item">
            <div class="trust-ticker-icon">✅</div>
            <div class="trust-ticker-text">
              <span class="trust-ticker-title">100% Tested</span>
              <span class="trust-ticker-sub">Verified components</span>
            </div>
          </div>
          <div class="trust-ticker-item">
            <div class="trust-ticker-icon">🚀</div>
            <div class="trust-ticker-text">
              <span class="trust-ticker-title">Fast Delivery</span>
              <span class="trust-ticker-sub">Accra & nationwide</span>
            </div>
          </div>
          <div class="trust-ticker-item">
            <div class="trust-ticker-icon">🔌</div>
            <div class="trust-ticker-text">
              <span class="trust-ticker-title">OEM Charger</span>
              <span class="trust-ticker-sub">Original power cord</span>
            </div>
          </div>
          <div class="trust-ticker-item">
            <div class="trust-ticker-icon">🛡️</div>
            <div class="trust-ticker-text">
              <span class="trust-ticker-title">Store Warranty</span>
              <span class="trust-ticker-sub">Protected purchase</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Gallery Events Setup
  setupGallery();

  // Favorite button
  const favBtn = document.getElementById('detailFavBtn');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      const isNowFav = FavoritesStore.toggle(laptop.id);
      const svg = favBtn.querySelector('svg');
      const span = favBtn.querySelector('span');
      if (svg) {
        svg.setAttribute('fill', isNowFav ? 'var(--color-sale-red)' : 'none');
        svg.setAttribute('stroke', isNowFav ? 'var(--color-sale-red)' : 'currentColor');
      }
      if (span) {
        span.textContent = isNowFav ? 'Saved in Wishlist' : 'Add to Wishlist';
      }
      showToast(isNowFav ? 'Added to Wishlist ❤️' : 'Removed from Wishlist');
    });
  }

  // Share button
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: `${laptop.title} - ${laptop.priceFormatted}`,
          text: `Check out this ${laptop.title} (${laptop.processor}, ${laptop.ram} RAM, ${laptop.storage}) for ${laptop.priceFormatted} on Manaki Laptop Deals!`,
          url: window.location.href
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          showToast('Product link copied to clipboard! 📋', 'success');
        });
      }
    });
  }
}

/**
 * Gallery Interactivity
 */
function setupGallery() {
  const mainImg = document.getElementById('mainDetailImg');
  const mainContainer = document.getElementById('mainImageContainer');
  const prevBtn = document.getElementById('galleryPrevBtn');
  const nextBtn = document.getElementById('galleryNextBtn');
  const counter = document.getElementById('photoCounter');
  const thumbs = document.querySelectorAll('.shopify-thumb-box, .thumb-item');

  function updateImage(index) {
    if (index < 0) index = laptopImages.length - 1;
    if (index >= laptopImages.length) index = 0;
    currentImageIndex = index;

    if (mainImg) {
      mainImg.src = laptopImages[currentImageIndex];
    }
    if (counter) {
      counter.textContent = `${currentImageIndex + 1} / ${laptopImages.length}`;
    }

    thumbs.forEach((t, i) => {
      t.classList.toggle('active', i === currentImageIndex);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateImage(currentImageIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateImage(currentImageIndex + 1);
    });
  }

  thumbs.forEach(t => {
    t.addEventListener('click', () => {
      const idx = parseInt(t.getAttribute('data-index'), 10);
      updateImage(idx);
    });
  });

  // Lightbox Zoom on Main Image click
  if (mainContainer) {
    mainContainer.addEventListener('click', () => {
      openLightbox(laptopImages[currentImageIndex]);
    });
  }
}

/**
 * Lightbox Modal Logic
 */
function openLightbox(src) {
  let modal = document.getElementById('lightboxModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'lightboxModal';
    modal.className = 'lightbox-modal';
    modal.innerHTML = `
      <button class="lightbox-close" id="lightboxCloseBtn">&times;</button>
      <img src="" class="lightbox-img" id="lightboxImg" alt="Enlarged Laptop View" />
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target.id === 'lightboxModal' || e.target.id === 'lightboxCloseBtn') {
        modal.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
  }

  const lightboxImg = document.getElementById('lightboxImg');
  if (lightboxImg) lightboxImg.src = src;
  modal.classList.add('active');
}

/**
 * Similar Laptops
 */
function renderSimilarLaptops(currentLaptop) {
  const container = document.getElementById('similarLaptopsGrid');
  if (!container) return;

  const all = LaptopStore.getAll();
  let similar = all.filter(l => l.id !== currentLaptop.id && (l.brand === currentLaptop.brand || l.category === currentLaptop.category));
  if (similar.length < 4) {
    similar = all.filter(l => l.id !== currentLaptop.id);
  }
  similar = similar.slice(0, 4);

  container.innerHTML = similar.map(l => {
    const mainImg = (l.images && l.images[0]) || 'images/L 1 A.webp';
    const detailUrl = RouteHelper.getDetailUrl(l.id);
    return `
      <article class="shopify-card" style="box-shadow: none;">
        <div class="card-image-box">
          <a href="${detailUrl}" style="display: block; width: 100%; height: 100%;">
            <img src="${mainImg}" alt="${l.title}" class="card-product-img" loading="lazy" onerror="ImageHelper.handleError(this, '${l.number || l.id}')"/>
          </a>
        </div>
        <div class="card-info-content">
          <div class="card-vendor-tag">${l.brand} · ${l.screenSize}</div>
          <h4 class="card-product-title">
            <a href="${detailUrl}">${l.title}</a>
          </h4>
          <div class="card-pricing-block" style="margin-top: 0.5rem;">
            <div class="shopify-price-now">${l.priceFormatted}</div>
            <a href="${detailUrl}" class="btn-quick-view">View</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderNotFound(message) {
  const container = document.getElementById('detailContent');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <h2 class="empty-title">Product Not Found</h2>
        <p class="empty-desc">${message}</p>
        <a href="${RouteHelper.getHomeUrl()}" class="btn-shopify-primary">Browse All Products</a>
      </div>
    `;
  }
}
