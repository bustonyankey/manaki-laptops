/**
 * Admin Portal Controller (manaki_admin.html)
 * Handles static password authentication ('Fakeme@12345') and
 * full client-side CRUD capabilities for laptop listings.
 */

document.addEventListener('DOMContentLoaded', () => {
  LaptopStore.init();

  // Authentication UI Elements
  const loginOverlay = document.getElementById('adminLoginOverlay');
  const adminPortal = document.getElementById('adminPortal');
  const loginForm = document.getElementById('adminLoginForm');
  const passwordInput = document.getElementById('adminPasswordInput');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const togglePwdBtn = document.getElementById('togglePwdBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');

  // Dashboard Elements
  const statTotalLaptops = document.getElementById('statTotalLaptops');
  const statAvailable = document.getElementById('statAvailable');
  const statSold = document.getElementById('statSold');
  const statTotalValue = document.getElementById('statTotalValue');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const adminStatusFilter = document.getElementById('adminStatusFilter');
  const adminTableBody = document.getElementById('adminTableBody');

  // Action Buttons
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const btnResetData = document.getElementById('btnResetData');
  const btnExportData = document.getElementById('btnExportData');
  const btnImportData = document.getElementById('btnImportData');
  const importFileInput = document.getElementById('importFileInput');

  // Modal Elements
  const laptopModal = document.getElementById('laptopModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const laptopForm = document.getElementById('laptopForm');
  const modalTitle = document.getElementById('modalTitle');
  const formLaptopId = document.getElementById('formLaptopId');
  const modalImagePreviewList = document.getElementById('modalImagePreviewList');
  const addImageUrlInput = document.getElementById('addImageUrlInput');
  const btnAddImageUrl = document.getElementById('btnAddImageUrl');
  const imageUploadInput = document.getElementById('imageUploadInput');

  // State
  let editingImages = [];

  // ==========================================
  // AUTHENTICATION LOGIC
  // ==========================================
  function checkAuth() {
    if (AdminAuth.isAuthenticated()) {
      loginOverlay.style.display = 'none';
      adminPortal.classList.add('active');
      renderDashboard();
    } else {
      loginOverlay.style.display = 'flex';
      adminPortal.classList.remove('active');
      passwordInput.value = '';
      if (loginErrorMsg) loginErrorMsg.classList.remove('visible');
    }
  }

  // Handle Login Submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPassword = passwordInput.value;
      const res = AdminAuth.login(enteredPassword);

      if (res.success) {
        checkAuth();
        showToast('Welcome back, Admin! 🔓', 'success');
      } else {
        loginErrorMsg.textContent = res.message;
        loginErrorMsg.classList.add('visible');
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 500);
      }
    });
  }

  // Toggle Password Visibility
  if (togglePwdBtn) {
    togglePwdBtn.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      AdminAuth.logout();
      checkAuth();
      showToast('Logged out successfully.');
    });
  }

  // ==========================================
  // DASHBOARD RENDERING & STATS
  // ==========================================
  function renderDashboard() {
    const laptops = LaptopStore.getAll();

    // Calculate KPIs
    const totalCount = laptops.length;
    const availableCount = laptops.filter(l => l.status !== 'Sold Out').length;
    const soldCount = laptops.filter(l => l.status === 'Sold Out').length;
    const totalValue = laptops
      .filter(l => l.status !== 'Sold Out')
      .reduce((sum, l) => sum + (Number(l.price) || 0), 0);

    if (statTotalLaptops) statTotalLaptops.textContent = totalCount;
    if (statAvailable) statAvailable.textContent = availableCount;
    if (statSold) statSold.textContent = soldCount;
    if (statTotalValue) statTotalValue.textContent = `GH₵${totalValue.toLocaleString()}`;

    updateWhatsAppDisplay();
    renderTable();
  }

  // Update WhatsApp display in admin bar
  function updateWhatsAppDisplay() {
    const display = document.getElementById('currentWhatsAppDisplay');
    if (display) {
      const num = WhatsAppHelper.getNumber();
      let formatted = num;
      if (num.startsWith('233')) {
        formatted = '0' + num.slice(3);
      }
      display.textContent = formatted;
    }
  }

  // Render Admin Table
  function renderTable() {
    if (!adminTableBody) return;
    const all = LaptopStore.getAll();
    const query = (adminSearchInput ? adminSearchInput.value : '').toLowerCase().trim();
    const statusFilter = adminStatusFilter ? adminStatusFilter.value : 'all';

    let filtered = all.filter(l => {
      const matchesQuery = !query || (
        l.title.toLowerCase().includes(query) ||
        l.brand.toLowerCase().includes(query) ||
        l.processor.toLowerCase().includes(query) ||
        String(l.number || l.id).includes(query)
      );

      const matchesStatus = statusFilter === 'all' || (
        statusFilter === 'available' ? l.status !== 'Sold Out' : l.status === 'Sold Out'
      );

      return matchesQuery && matchesStatus;
    });

    if (filtered.length === 0) {
      adminTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No laptops found matching current search.
          </td>
        </tr>
      `;
      return;
    }

    adminTableBody.innerHTML = filtered.map(l => {
      const isSold = l.status === 'Sold Out';
      const mainImg = (l.images && l.images[0]) || 'images/L 1 A.webp';

      return `
        <tr data-row-id="${l.id}">
          <td style="font-weight: 700; color: var(--text-muted);">#${l.number || l.id}</td>
          <td>
            <img src="${mainImg}" alt="${l.title}" class="table-thumb" onerror="ImageHelper.handleError(this, '${l.number || l.id}')"/>
          </td>
          <td class="table-title-cell">
            <div class="table-laptop-title">${l.title}</div>
            <div class="table-laptop-specs">${l.brand} · ${l.processor} · ${l.ram} · ${l.storage}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">GH₵</span>
              <input 
                type="number" 
                class="table-price-input" 
                value="${l.price}" 
                data-price-id="${l.id}" 
                title="Edit price & press enter"
              />
            </div>
          </td>
          <td>
            <span 
              class="status-pill-toggle ${isSold ? 'sold' : 'available'}" 
              data-toggle-id="${l.id}"
              title="Click to toggle status"
            >
              ${isSold ? '● Sold Out' : '● Available'}
            </span>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${(l.images || []).length} photos</span>
          </td>
          <td>
            <div class="table-actions">
              <a href="${RouteHelper.getDetailUrl(l.id)}" target="_blank" class="btn-action-icon" title="View on site">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </a>
              <button class="btn-action-icon edit" data-edit-id="${l.id}" title="Edit Laptop Specs">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
              </button>
              <button class="btn-action-icon delete" data-delete-id="${l.id}" title="Delete Listing">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach in-table event listeners
    attachTableListeners();
  }

  function attachTableListeners() {
    // Quick price change on Enter or Blur
    document.querySelectorAll('.table-price-input').forEach(input => {
      const savePrice = () => {
        const id = input.getAttribute('data-price-id');
        const val = Number(input.value);
        if (val > 0) {
          LaptopStore.update(id, { price: val });
          showToast(`Price updated to GH₵${val.toLocaleString()} 💰`, 'success');
          renderDashboard();
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });
      input.addEventListener('change', savePrice);
    });

    // Quick status toggle
    document.querySelectorAll('.status-pill-toggle').forEach(pill => {
      pill.addEventListener('click', () => {
        const id = pill.getAttribute('data-toggle-id');
        const laptop = LaptopStore.getById(id);
        if (!laptop) return;

        const newStatus = laptop.status === 'Sold Out' ? 'Available' : 'Sold Out';
        LaptopStore.update(id, { status: newStatus });
        showToast(`Marked #${id} as ${newStatus}`);
        renderDashboard();
      });
    });

    // Edit button click
    document.querySelectorAll('.btn-action-icon.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-id');
        openEditModal(id);
      });
    });

    // Delete button click
    document.querySelectorAll('.btn-action-icon.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-id');
        const laptop = LaptopStore.getById(id);
        if (!laptop) return;

        if (confirm(`Are you sure you want to permanently delete "${laptop.title}" (ID #${id})?`)) {
          LaptopStore.delete(id);
          showToast(`Deleted "${laptop.title}"`, 'error');
          renderDashboard();
        }
      });
    });
  }

  // Live filter handlers
  if (adminSearchInput) adminSearchInput.addEventListener('input', renderTable);
  if (adminStatusFilter) adminStatusFilter.addEventListener('change', renderTable);

  // ==========================================
  // MODAL LOGIC (ADD / EDIT)
  // ==========================================
  function openAddModal() {
    modalTitle.textContent = 'Add New Laptop Listing';
    laptopForm.reset();
    formLaptopId.value = '';
    editingImages = ['images/L 1 A.webp'];
    renderImagePreviews();
    laptopModal.classList.add('active');
  }

  function openEditModal(id) {
    const laptop = LaptopStore.getById(id);
    if (!laptop) return;

    modalTitle.textContent = `Edit Laptop (ID #${laptop.number || laptop.id})`;
    formLaptopId.value = laptop.id;

    // Populate inputs
    document.getElementById('inputTitle').value = laptop.title || '';
    document.getElementById('inputBrand').value = laptop.brand || 'Dell';
    document.getElementById('inputCategory').value = laptop.category || 'Business';
    document.getElementById('inputProcessor').value = laptop.processor || 'Intel Core i5';
    document.getElementById('inputGeneration').value = laptop.generation || '';
    document.getElementById('inputSpeed').value = laptop.speed || '';
    document.getElementById('inputRam').value = laptop.ram || '8GB';
    document.getElementById('inputStorage').value = laptop.storage || '256GB SSD';
    document.getElementById('inputDisplay').value = laptop.display || '14" FHD Display';
    document.getElementById('inputScreenSize').value = laptop.screenSize || '14"';
    document.getElementById('inputGraphics').value = laptop.graphics || 'Integrated Intel UHD';
    document.getElementById('inputPrice').value = laptop.price || '';
    document.getElementById('inputOriginalPrice').value = laptop.originalPrice || '';
    document.getElementById('inputStatus').value = laptop.status || 'Available';
    document.getElementById('inputCondition').value = laptop.condition || 'Grade A+ Clean Direct Import';
    document.getElementById('inputBattery').value = laptop.battery || 'Tested Strong Battery';
    document.getElementById('inputDescription').value = laptop.description || '';

    // Checkboxes
    document.getElementById('checkTouch').checked = Boolean(laptop.isTouchscreen);
    document.getElementById('checkConvertible').checked = Boolean(laptop.isConvertible);
    document.getElementById('checkBacklit').checked = Boolean(laptop.hasBacklitKeyboard);
    document.getElementById('checkFingerprint').checked = Boolean(laptop.hasFingerprint);
    document.getElementById('checkDedicatedGpu').checked = Boolean(laptop.hasDedicatedGpu);
    document.getElementById('checkFeatured').checked = Boolean(laptop.featured);

    editingImages = [...(laptop.images || [])];
    if (editingImages.length === 0) editingImages = ['images/L 1 A.webp'];
    renderImagePreviews();

    laptopModal.classList.add('active');
  }

  function closeModal() {
    laptopModal.classList.remove('active');
  }

  if (btnOpenAddModal) btnOpenAddModal.addEventListener('click', openAddModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

  // Render modal image thumbnails
  function renderImagePreviews() {
    if (!modalImagePreviewList) return;
    modalImagePreviewList.innerHTML = editingImages.map((src, idx) => `
      <div class="image-preview-chip">
        <img src="${src}" alt="Preview" onerror="this.src='images/L 1 A.webp';"/>
        <button type="button" class="image-remove-btn" data-img-idx="${idx}" title="Remove image">&times;</button>
      </div>
    `).join('');

    // Attach remove handlers
    modalImagePreviewList.querySelectorAll('.image-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-img-idx'), 10);
        editingImages.splice(idx, 1);
        if (editingImages.length === 0) editingImages = ['images/L 1 A.webp'];
        renderImagePreviews();
      });
    });
  }

  // Add image by URL
  if (btnAddImageUrl) {
    btnAddImageUrl.addEventListener('click', () => {
      const url = addImageUrlInput.value.trim();
      if (url) {
        editingImages.push(url);
        addImageUrlInput.value = '';
        renderImagePreviews();
      }
    });
  }

  // Upload image from computer file
  if (imageUploadInput) {
    imageUploadInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          editingImages.push(loadEvt.target.result);
          renderImagePreviews();
        };
        reader.readAsDataURL(file);
      });
      imageUploadInput.value = '';
    });
  }

  // Form Submit (Save Laptop)
  if (laptopForm) {
    laptopForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const id = formLaptopId.value;
      const isTouch = document.getElementById('checkTouch').checked;
      const isConv = document.getElementById('checkConvertible').checked;
      const isBacklit = document.getElementById('checkBacklit').checked;
      const hasFp = document.getElementById('checkFingerprint').checked;
      const hasGpu = document.getElementById('checkDedicatedGpu').checked;

      // Build features list
      const features = [];
      if (isTouch) features.push('Touchscreen');
      if (isConv) features.push('360° Convertible');
      if (isBacklit) features.push('Backlit Keyboard');
      if (hasFp) features.push('Fingerprint Scanner');
      if (hasGpu) features.push(document.getElementById('inputGraphics').value || 'Dedicated GPU');

      const formData = {
        title: document.getElementById('inputTitle').value.trim(),
        brand: document.getElementById('inputBrand').value,
        category: document.getElementById('inputCategory').value,
        processor: document.getElementById('inputProcessor').value.trim(),
        generation: document.getElementById('inputGeneration').value.trim(),
        speed: document.getElementById('inputSpeed').value.trim(),
        ram: document.getElementById('inputRam').value.trim(),
        storage: document.getElementById('inputStorage').value.trim(),
        display: document.getElementById('inputDisplay').value.trim(),
        screenSize: document.getElementById('inputScreenSize').value.trim(),
        graphics: document.getElementById('inputGraphics').value.trim(),
        hasDedicatedGpu: hasGpu,
        isTouchscreen: isTouch,
        isConvertible: isConv,
        hasBacklitKeyboard: isBacklit,
        hasFingerprint: hasFp,
        price: Number(document.getElementById('inputPrice').value) || 0,
        originalPrice: Number(document.getElementById('inputOriginalPrice').value) || 0,
        status: document.getElementById('inputStatus').value,
        condition: document.getElementById('inputCondition').value.trim(),
        battery: document.getElementById('inputBattery').value.trim(),
        description: document.getElementById('inputDescription').value.trim(),
        features: features,
        images: editingImages.length > 0 ? editingImages : ['images/L 1 A.webp'],
        featured: document.getElementById('checkFeatured').checked
      };

      if (id) {
        // Update existing
        LaptopStore.update(id, formData);
        showToast(`Updated "${formData.title}" successfully! ✅`, 'success');
      } else {
        // Add new
        LaptopStore.add(formData);
        showToast(`Added "${formData.title}" to listings! 🚀`, 'success');
      }

      closeModal();
      renderDashboard();
    });
  }

  // ==========================================
  // BACKUP, RESET, IMPORT & EXPORT
  // ==========================================
  if (btnResetData) {
    btnResetData.addEventListener('click', () => {
      if (confirm('Warning: This will restore the catalog to the initial 41 laptops shipment data and discard custom additions. Proceed?')) {
        LaptopStore.resetToDefaults();
        showToast('Reset to original shipment catalog! 🔄', 'info');
        renderDashboard();
      }
    });
  }

  // WhatsApp Configuration Button
  const btnWhatsAppConfig = document.getElementById('btnWhatsAppConfig');
  if (btnWhatsAppConfig) {
    btnWhatsAppConfig.addEventListener('click', () => {
      const current = WhatsAppHelper.getNumber();
      const currentLocal = current.startsWith('233') ? '0' + current.slice(3) : current;
      const newNum = prompt('Enter seller WhatsApp phone number (e.g. 0543862551):', currentLocal);
      if (newNum !== null && newNum.trim()) {
        const saved = WhatsAppHelper.setNumber(newNum.trim());
        updateWhatsAppDisplay();
        showToast(`WhatsApp phone number updated to ${saved}! 💬`, 'success');
      }
    });
  }

  if (btnExportData) {
    btnExportData.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(LaptopStore.exportJSON());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `manaki_laptops_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Exported catalog backup JSON 📁', 'success');
    });
  }

  if (btnImportData && importFileInput) {
    btnImportData.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const success = LaptopStore.importJSON(evt.target.result);
        if (success) {
          showToast('Imported inventory database successfully! 🎉', 'success');
          renderDashboard();
        } else {
          showToast('Failed to import JSON: Invalid file format', 'error');
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });
  }

  // ==========================================
  // GOOGLE DRIVE & APPS SCRIPT CLOUD SYNC
  // ==========================================
  const btnSyncDriveImages = document.getElementById('btnSyncDriveImages');
  const syncSpinIcon = document.getElementById('syncSpinIcon');
  const syncBtnText = document.getElementById('syncBtnText');
  const cloudSyncStatusText = document.getElementById('cloudSyncStatusText');
  const cloudStatusBadge = document.getElementById('cloudStatusBadge');
  const btnOpenCloudConfig = document.getElementById('btnOpenCloudConfig');
  const cloudConfigModal = document.getElementById('cloudConfigModal');
  const closeCloudModalBtn = document.getElementById('closeCloudModalBtn');
  const cancelCloudModalBtn = document.getElementById('cancelCloudModalBtn');
  const gasApiUrlInput = document.getElementById('gasApiUrlInput');
  const btnTestCloudConnection = document.getElementById('btnTestCloudConnection');
  const cloudTestStatus = document.getElementById('cloudTestStatus');
  const saveCloudSettingsBtn = document.getElementById('saveCloudSettingsBtn');

  if (btnSyncDriveImages) {
    btnSyncDriveImages.addEventListener('click', async () => {
      if (syncSpinIcon) syncSpinIcon.style.display = 'inline';
      if (syncBtnText) syncBtnText.textContent = 'Scanning Drive...';
      btnSyncDriveImages.disabled = true;

      try {
        const result = await CloudSyncHelper.syncDriveImages();
        if (result && result.success) {
          const msg = result.message || `Successfully synced ${result.totalImages || 0} photos from Google Drive!`;
          showToast(msg, 'success');
          if (cloudSyncStatusText) {
            cloudSyncStatusText.innerHTML = `🟢 Synced ${result.totalImages || 0} photos across ${result.laptopsUpdated || 0} laptops from folder <strong>laptops</strong>`;
          }
          if (cloudStatusBadge) {
            cloudStatusBadge.textContent = '🟢 Synced';
          }
          renderDashboard();
        } else {
          showToast(result.error || result.message || 'Drive sync failed. Check Drive folder name and permissions.', 'error');
        }
      } catch (err) {
        showToast('Sync failed: ' + (err.message || err), 'error');
      } finally {
        if (syncSpinIcon) syncSpinIcon.style.display = 'none';
        if (syncBtnText) syncBtnText.textContent = '🔄 Scan & Sync Drive Photos';
        btnSyncDriveImages.disabled = false;
      }
    });
  }

  if (btnOpenCloudConfig && cloudConfigModal) {
    btnOpenCloudConfig.addEventListener('click', () => {
      if (gasApiUrlInput) {
        gasApiUrlInput.value = CloudSyncHelper.getApiUrl();
      }
      if (cloudTestStatus) {
        cloudTestStatus.textContent = '';
      }
      cloudConfigModal.style.display = 'flex';
    });
  }

  function closeCloudModal() {
    if (cloudConfigModal) cloudConfigModal.style.display = 'none';
  }

  if (closeCloudModalBtn) closeCloudModalBtn.addEventListener('click', closeCloudModal);
  if (cancelCloudModalBtn) cancelCloudModalBtn.addEventListener('click', closeCloudModal);

  if (btnTestCloudConnection) {
    btnTestCloudConnection.addEventListener('click', async () => {
      const url = gasApiUrlInput ? gasApiUrlInput.value.trim() : '';
      if (!url && !RouteHelper.isGAS()) {
        cloudTestStatus.textContent = '❌ Please enter a URL';
        cloudTestStatus.style.color = '#dc2626';
        return;
      }
      cloudTestStatus.textContent = '⏳ Testing...';
      cloudTestStatus.style.color = '#2563eb';
      
      const prev = CloudSyncHelper.getApiUrl();
      if (url) CloudSyncHelper.setApiUrl(url);
      const res = await CloudSyncHelper.testConnection();
      if (res.success) {
        cloudTestStatus.textContent = '✅ Connected successfully!';
        cloudTestStatus.style.color = '#16a34a';
      } else {
        cloudTestStatus.textContent = '❌ Error: ' + (res.message || 'Could not connect');
        cloudTestStatus.style.color = '#dc2626';
      }
    });
  }

  if (saveCloudSettingsBtn) {
    saveCloudSettingsBtn.addEventListener('click', () => {
      const url = gasApiUrlInput ? gasApiUrlInput.value.trim() : '';
      CloudSyncHelper.setApiUrl(url);
      closeCloudModal();
      showToast('Cloud settings saved successfully! ⚙️', 'success');
    });
  }

  // Initial Auth Check
  checkAuth();
});
