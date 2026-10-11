/**
 * Store & Data Management Layer for Manaki Laptop Deals
 * Handles LocalStorage persistence, CRUD, Admin Auth, WhatsApp linking,
 * Route Navigation (GAS Web App vs Standalone), Google Drive Image handling, and Cloud Sync.
 */

const STORAGE_KEY = 'manaki_laptops_v1';
const AUTH_KEY = 'manaki_admin_auth';
const FAVORITES_KEY = 'manaki_favorites';
const ADMIN_PASSWORD = 'Fakeme@12345';
const DEFAULT_WHATSAPP_NUMBER = '233543862551'; // Manaki Laptop Deals Ghana: 0543862551

const LaptopStore = {
  /**
   * Initializes store with window.SERVER_LAPTOPS or window.DEFAULT_LAPTOPS
   */
  init() {
    // If running in Google Apps Script or server injected data
    if (typeof window !== 'undefined' && Array.isArray(window.SERVER_LAPTOPS) && window.SERVER_LAPTOPS.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.SERVER_LAPTOPS));
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      let hasValidData = false;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasValidData = true;
          }
        } catch(e) {}
      }
      if (!hasValidData) {
        // Fallback to window.DEFAULT_LAPTOPS or window.SERVER_LAPTOPS
        const fallback = (typeof window !== 'undefined' && Array.isArray(window.DEFAULT_LAPTOPS) && window.DEFAULT_LAPTOPS.length > 0)
          ? window.DEFAULT_LAPTOPS
          : ((typeof window !== 'undefined' && Array.isArray(window.SERVER_LAPTOPS) && window.SERVER_LAPTOPS.length > 0) ? window.SERVER_LAPTOPS : []);
        if (fallback.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
        }
      }
    }

    // Ensure phone number is set to Manaki's number
    const savedPhone = localStorage.getItem('manaki_whatsapp_number') || localStorage.getItem('akiola_whatsapp_number');
    if (!savedPhone || savedPhone === '233540000000') {
      localStorage.setItem('manaki_whatsapp_number', DEFAULT_WHATSAPP_NUMBER);
    }

    // Auto-migrate any cached local images from .jpg to .webp (safely avoid touching Drive links)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored.includes('images/L') && (stored.includes('.jpg') || stored.includes('.JPG') || stored.includes('.jpeg')))) {
      const updated = stored.replace(/images\/(L[^\"]+?)\.jpe?g/gi, 'images/$1.webp');
      localStorage.setItem(STORAGE_KEY, updated);
    }
  },

  /**
   * Get all laptops from localStorage with automatic fallback recovery
   */
  getAll() {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse laptops from localStorage', e);
    }

    // Fallback if localStorage was empty [] or missing
    const fallback = (typeof window !== 'undefined' && Array.isArray(window.SERVER_LAPTOPS) && window.SERVER_LAPTOPS.length > 0)
      ? window.SERVER_LAPTOPS
      : ((typeof window !== 'undefined' && Array.isArray(window.DEFAULT_LAPTOPS) && window.DEFAULT_LAPTOPS.length > 0) ? window.DEFAULT_LAPTOPS : []);
    
    if (fallback.length > 0) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback)); } catch(e) {}
    }
    return fallback;
  },

  /**
   * Get a single laptop by ID or number
   */
  getById(id) {
    const list = this.getAll();
    return list.find(item => String(item.id) === String(id) || String(item.number) === String(id)) || null;
  },

  /**
   * Add a new laptop
   */
  add(laptopData) {
    const list = this.getAll();
    const nextId = list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    
    const newLaptop = {
      id: nextId,
      number: nextId,
      title: laptopData.title || 'Untitled Laptop',
      brand: laptopData.brand || 'Dell',
      category: laptopData.category || 'Business',
      processor: laptopData.processor || 'Intel Core i5',
      generation: laptopData.generation || '10th Gen',
      speed: laptopData.speed || '2.4 GHz',
      ram: laptopData.ram || '8GB',
      ramGb: parseInt(laptopData.ram) || 8,
      storage: laptopData.storage || '256GB SSD',
      storageGb: parseInt(laptopData.storage) || 256,
      storageType: laptopData.storageType || 'SSD',
      display: laptopData.display || '14" FHD Display',
      screenSize: laptopData.screenSize || '14"',
      graphics: laptopData.graphics || 'Integrated Intel UHD',
      hasDedicatedGpu: Boolean(laptopData.hasDedicatedGpu),
      isTouchscreen: Boolean(laptopData.isTouchscreen),
      isConvertible: Boolean(laptopData.isConvertible),
      hasBacklitKeyboard: Boolean(laptopData.hasBacklitKeyboard),
      hasFingerprint: Boolean(laptopData.hasFingerprint),
      features: Array.isArray(laptopData.features) ? laptopData.features : [],
      price: Number(laptopData.price) || 0,
      priceFormatted: `GH₵${Number(laptopData.price || 0).toLocaleString()}`,
      originalPrice: Number(laptopData.originalPrice) || Math.round(Number(laptopData.price || 0) * 1.1),
      originalPriceFormatted: `GH₵${(Number(laptopData.originalPrice) || Math.round(Number(laptopData.price || 0) * 1.1)).toLocaleString()}`,
      status: laptopData.status || 'Available',
      condition: laptopData.condition || 'Grade A+ Clean Direct Import',
      battery: laptopData.battery || 'Tested Strong Battery',
      description: laptopData.description || 'High-performance laptop in excellent condition.',
      images: Array.isArray(laptopData.images) && laptopData.images.length > 0 
        ? laptopData.images 
        : ['images/L 1 A.webp'],
      featured: Boolean(laptopData.featured),
      notes: laptopData.notes || '',
      created_at: new Date().toISOString()
    };

    list.unshift(newLaptop);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return newLaptop;
  },

  /**
   * Update an existing laptop by ID
   */
  update(id, updates) {
    const list = this.getAll();
    const index = list.findIndex(item => String(item.id) === String(id));
    if (index === -1) return null;

    const existing = list[index];
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      number: existing.number
    };

    if (updates.price !== undefined) {
      updated.price = Number(updates.price);
      updated.priceFormatted = `GH₵${Number(updates.price).toLocaleString()}`;
    }
    if (updates.originalPrice !== undefined) {
      updated.originalPrice = Number(updates.originalPrice);
      updated.originalPriceFormatted = `GH₵${Number(updates.originalPrice).toLocaleString()}`;
    }
    if (updates.ram !== undefined) {
      updated.ramGb = parseInt(updates.ram) || existing.ramGb;
    }
    if (updates.storage !== undefined) {
      updated.storageGb = parseInt(updates.storage) || existing.storageGb;
    }

    list[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return updated;
  },

  /**
   * Delete a laptop by ID
   */
  delete(id) {
    const list = this.getAll();
    const filtered = list.filter(item => String(item.id) !== String(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },

  /**
   * Reset store to initial defaults from data.js
   */
  resetToDefaults() {
    if (window.DEFAULT_LAPTOPS && window.DEFAULT_LAPTOPS.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.DEFAULT_LAPTOPS));
      return true;
    }
    return false;
  },

  /**
   * Export all data as JSON string
   */
  exportJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  /**
   * Import data from JSON string
   */
  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      }
      return false;
    } catch (e) {
      console.error('Invalid JSON for import', e);
      return false;
    }
  }
};

/**
 * Admin Authentication Controller
 */
const AdminAuth = {
  login(password) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(AUTH_KEY, 'true');
      return { success: true };
    }
    return { success: false, message: 'Invalid password. Access denied.' };
  },

  isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true' || localStorage.getItem(AUTH_KEY) === 'true';
  },

  logout() {
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  }
};

/**
 * Favorites Manager
 */
const FavoritesStore = {
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  isFavorite(id) {
    const list = this.getAll();
    return list.includes(Number(id)) || list.includes(String(id));
  },

  toggle(id) {
    let list = this.getAll();
    const numId = Number(id);
    if (list.includes(numId)) {
      list = list.filter(item => item !== numId);
    } else {
      list.push(numId);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    return list.includes(numId);
  }
};

/**
 * WhatsApp Helper for Manaki Laptop Deals
 */
const WhatsAppHelper = {
  getNumber() {
    return localStorage.getItem('manaki_whatsapp_number') || DEFAULT_WHATSAPP_NUMBER;
  },

  setNumber(num) {
    let clean = String(num).replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '233' + clean.slice(1);
    }
    if (!clean.startsWith('233') && clean.length === 9) {
      clean = '233' + clean;
    }
    localStorage.setItem('manaki_whatsapp_number', clean || DEFAULT_WHATSAPP_NUMBER);
    return clean || DEFAULT_WHATSAPP_NUMBER;
  },

  getInquiryUrl(laptop) {
    const phone = this.getNumber();
    const text = encodeURIComponent(
      `Hello Manaki Laptop Deals! 👋\n` +
      `I am interested in buying this laptop:\n\n` +
      `📌 Model: *${laptop.title}* (ID #${laptop.number || laptop.id})\n` +
      `⚙️ Specs: ${laptop.processor} | ${laptop.ram} RAM | ${laptop.storage}\n` +
      `💰 Price: *${laptop.priceFormatted}*\n\n` +
      `Is this laptop currently in stock? Please send more details or delivery information.`
    );
    return `https://wa.me/${phone}?text=${text}`;
  },

  getGeneralContactUrl() {
    const phone = this.getNumber();
    const text = encodeURIComponent(
      `Hello Manaki Laptop Deals! 👋\nI am browsing your website catalog and would like to ask some questions regarding available laptops and delivery in Ghana.`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }
};

/**
 * Route & Link Navigation Helper
 * Automatically handles routing between standalone HTML pages and Google Apps Script Web App (?page=X&id=Y)
 */
const RouteHelper = {
  isGAS() {
    return Boolean(
      (typeof window !== 'undefined' && window.GAS_EXEC_URL) ||
      (typeof google !== 'undefined' && typeof google.script !== 'undefined') ||
      (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('script.google.com'))
    );
  },

  getBaseUrl() {
    if (typeof window !== 'undefined') {
      if (window.GAS_EXEC_URL) return window.GAS_EXEC_URL;
      if (this.isGAS() && window.location) return window.location.href.split('?')[0];
    }
    return '';
  },

  getHomeUrl() {
    if (this.isGAS()) {
      return this.getBaseUrl();
    }
    return 'index.html';
  },

  getDetailUrl(id) {
    if (this.isGAS()) {
      return `${this.getBaseUrl()}?page=detail&id=${encodeURIComponent(id)}`;
    }
    return `detail.html?id=${encodeURIComponent(id)}`;
  },

  getAdminUrl() {
    if (this.isGAS()) {
      return `${this.getBaseUrl()}?page=admin`;
    }
    return 'manaki_admin.html';
  },

  fixStaticLinks() {
    if (typeof document === 'undefined' || !this.isGAS()) return;
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href === 'index.html' || href === './index.html') {
        a.setAttribute('href', this.getHomeUrl());
      } else if (href.startsWith('detail.html?id=')) {
        const id = href.split('id=')[1];
        a.setAttribute('href', this.getDetailUrl(id));
      } else if (href === 'manaki_admin.html' || href === './manaki_admin.html') {
        a.setAttribute('href', this.getAdminUrl());
      }
    });
  }
};

/**
 * Image Helper
 * Handles Google Drive CDN URLs and fail-safe fallback transitions
 */
const ImageHelper = {
  format(url) {
    if (!url) return this.getPlaceholder();
    return url;
  },

  getPlaceholder(title, brand) {
    const text = encodeURIComponent(title || brand || 'Manaki Laptop');
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="%23f1f3f5"><rect width="600" height="400" fill="%231a1a1a"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto" font-size="48" fill="%23ffffff">💻</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto" font-size="20" font-weight="bold" fill="%2334d399">${text}</text><text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto" font-size="14" fill="%239ca3af">Manaki Laptop Deals · Ghana</text></svg>`;
  },

  handleError(imgEl, laptopNumber) {
    if (!imgEl) return;
    
    // If it's a direct Google UserContent URL, try thumbnail format
    if (imgEl.src.includes('lh3.googleusercontent.com/d/')) {
      const parts = imgEl.src.split('/d/');
      if (parts[1]) {
        const fileId = parts[1].split('?')[0].split('/')[0];
        imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
        return;
      }
    }
    
    // If thumbnail failed, try Google Drive export view
    if (imgEl.src.includes('drive.google.com/thumbnail')) {
      const match = imgEl.src.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        imgEl.src = `https://drive.google.com/uc?export=view&id=${match[1]}`;
        return;
      }
    }

    // Fallback to local image if available and NOT on GAS
    if (!imgEl.dataset.triedLocal && laptopNumber && !RouteHelper.isGAS()) {
      imgEl.dataset.triedLocal = '1';
      imgEl.src = `images/L ${laptopNumber} A.webp`;
      return;
    }

    // Ultimate SVG fallback
    imgEl.onerror = null;
    imgEl.src = this.getPlaceholder('Laptop #' + (laptopNumber || ''), 'Manaki Deals');
  }
};

/**
 * Cloud Sync Helper
 * Manages synchronization with Google Apps Script Web App & Google Drive
 */
const CloudSyncHelper = {
  getApiUrl() {
    if (typeof window !== 'undefined') {
      if (window.GAS_EXEC_URL) return window.GAS_EXEC_URL;
      return localStorage.getItem('manaki_gas_api_url') || '';
    }
    return '';
  },

  setApiUrl(url) {
    if (url) {
      localStorage.setItem('manaki_gas_api_url', url.trim());
    } else {
      localStorage.removeItem('manaki_gas_api_url');
    }
  },

  async syncDriveImages() {
    // If running inside Google Apps Script Web App:
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(res => {
            if (res && res.success && res.laptops) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(res.laptops));
            }
            resolve(res);
          })
          .withFailureHandler(err => {
            reject(err);
          })
          .syncDriveImages();
      });
    }

    // If running externally (e.g. localhost, GitHub Pages):
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      return {
        success: false,
        message: 'No Google Apps Script Web App URL configured. Please deploy the script in Google Apps Script and enter the Web App URL in Cloud Settings.'
      };
    }

    try {
      const targetUrl = `${apiUrl}?action=syncDriveImages`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'syncDriveImages' }),
        redirect: 'follow'
      });
      const data = await res.json();
      if (data.success && data.laptops) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.laptops));
      }
      return data;
    } catch (err) {
      return {
        success: false,
        message: 'Could not connect to Google Apps Script Web App: ' + err.message
      };
    }
  },

  async testConnection() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return { success: true, message: 'Connected directly via Google Apps Script runtime.' };
    }

    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      return { success: false, message: 'Google Apps Script URL is empty.' };
    }

    try {
      const res = await fetch(`${apiUrl}?action=health`, { redirect: 'follow' });
      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
};

// Initialize on script load
LaptopStore.init();

// Automatically update static links if running in Google Apps Script
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    RouteHelper.fixStaticLinks();
  });
}
