/**
 * Manaki Laptop Deals - Google Apps Script Backend & Web App Server
 * Google Account: yankeybuston@gmail.com
 *
 * Provides:
 * 1. Automatic Google Drive Image Scanner & Linker for folder 'laptops'
 * 2. Google Sheets Database ('Manaki_Laptop_Inventory') for live online stock/price management
 * 3. Fast Web App Server for Storefront, Product Detail & Admin Portal
 * 4. RESTful JSON API endpoints for remote integrations
 */

var DRIVE_FOLDER_NAME = "laptops";
var SPREADSHEET_NAME = "Manaki_Laptop_Inventory";
var ADMIN_PASSWORD = "Fakeme@12345";
var DEFAULT_WHATSAPP = "233543862551";

/**
 * ⚡ 1-CLICK SETUP FUNCTION
 * Run this from the top toolbar dropdown in Apps Script to authorize permissions,
 * create the Google Sheet database, and link your Drive photos.
 */
function setupStore() {
  Logger.log("=== Setting up Manaki Laptop Deals Web App & Google Drive ===");
  var laptops = getLaptops();
  Logger.log("Loaded " + laptops.length + " laptops.");
  var syncRes = syncDriveImages();
  Logger.log("Drive Sync Result: " + JSON.stringify(syncRes));
  Logger.log("Setup complete! Deploy as Web app with access: Anyone.");
  return {
    success: true,
    laptopsCount: laptops.length,
    syncResult: syncRes
  };
}

/**
 * HTTP GET Router: Serves Web App HTML pages and handles JSON API requests
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  
  // API requests (action=...)
  if (params.action) {
    return handleApiGet(params);
  }

  // Web App Page Navigation
  var page = (params.page || "").toLowerCase();
  var id = params.id;

  if (page === "admin") {
    return renderAdminPage();
  } else if (page === "detail" || id) {
    return renderDetailPage(id);
  } else {
    return renderIndexPage();
  }
}

/**
 * HTTP POST Router: Handles mutations (updating stock, prices, syncing images)
 */
function doPost(e) {
  var payload = {};
  try {
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else {
      payload = e.parameter || {};
    }

    var action = payload.action;
    var result = { success: false, message: "Unknown action" };

    if (action === "syncDriveImages") {
      result = syncDriveImages();
    } else if (action === "saveLaptop") {
      result = saveLaptop(payload.laptop);
    } else if (action === "deleteLaptop") {
      result = deleteLaptop(payload.id);
    } else if (action === "updateSettings") {
      result = updateSettings(payload.settings);
    } else if (action === "resetToDefaults") {
      result = resetCatalogToDefaults();
    } else {
      result = { success: false, error: "Unsupported POST action: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET API endpoints
 */
function handleApiGet(params) {
  var action = params.action;
  var data = {};

  if (action === "setup") {
    data = setupStore();
  } else if (action === "getLaptops") {
    data = getLaptops();
  } else if (action === "getLaptop") {
    data = getLaptopById(params.id);
  } else if (action === "syncDriveImages") {
    data = syncDriveImages();
  } else if (action === "getDriveImages") {
    data = scanDriveImages();
  } else if (action === "getSettings") {
    data = getSettings();
  } else if (action === "health") {
    data = {
      status: "online",
      store: "Manaki Laptop Deals",
      googleAccount: "yankeybuston@gmail.com",
      timestamp: new Date().toISOString()
    };
  } else {
    data = { success: false, error: "Unknown GET action: " + action };
  }

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Scans the Google Drive folder named 'laptops' and extracts high-res and thumbnail CDN links.
 */
function scanDriveImages() {
  try {
    var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    if (!folders.hasNext()) {
      return {
        success: false,
        error: "Google Drive folder named '" + DRIVE_FOLDER_NAME + "' was not found in yankeybuston@gmail.com. Please make sure the folder is named 'laptops'."
      };
    }

    var folder = folders.next();
    var folderId = folder.getId();

    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log("Folder setSharing warning: " + e.message);
    }

    var files = folder.getFiles();
    var imageMap = {};
    var totalFound = 0;

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var mime = file.getMimeType();

      if (mime.indexOf("image/") === 0 || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
        var m = name.match(/^L\s*(\d+(?:-\d+)?)\s*(.*)/i);
        if (m) {
          var laptopNum = m[1];
          var id = file.getId();

          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (e) {}

          var directUrl = "https://lh3.googleusercontent.com/d/" + id;
          var thumbUrl = "https://drive.google.com/thumbnail?id=" + id + "&sz=w1200";

          if (!imageMap[laptopNum]) {
            imageMap[laptopNum] = [];
          }

          imageMap[laptopNum].push({
            name: name,
            id: id,
            url: directUrl,
            thumbUrl: thumbUrl
          });
          totalFound++;
        }
      }
    }

    for (var k in imageMap) {
      imageMap[k].sort(function(a, b) {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });
    }

    return {
      success: true,
      folderId: folderId,
      totalImages: totalFound,
      laptopsCount: Object.keys(imageMap).length,
      imageMap: imageMap
    };
  } catch (err) {
    Logger.log("Error in scanDriveImages: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Synchronizes Drive photos with the catalog and persists into Google Sheets.
 */
function syncDriveImages() {
  var scanRes = scanDriveImages();
  if (!scanRes.success) {
    return scanRes;
  }

  var imageMap = scanRes.imageMap;
  var laptops = getLaptops();
  var updatedLaptopsCount = 0;

  for (var i = 0; i < laptops.length; i++) {
    var lap = laptops[i];
    var key = String(lap.number || lap.id);

    var imgs = imageMap[key];
    if (!imgs && key === "36") imgs = imageMap["36-1"];
    if (!imgs && key === "36-1") imgs = imageMap["36"];

    if (imgs && imgs.length > 0) {
      lap.images = imgs.map(function(item) { return item.url; });
      lap.thumbnailImages = imgs.map(function(item) { return item.thumbUrl; });
      lap.driveFileIds = imgs.map(function(item) { return item.id; });
      updatedLaptopsCount++;
    }
  }

  saveAllLaptopsToStore(laptops);

  return {
    success: true,
    message: "Successfully synced " + scanRes.totalImages + " photos across " + updatedLaptopsCount + " laptops from Google Drive folder 'laptops'!",
    totalImages: scanRes.totalImages,
    laptopsUpdated: updatedLaptopsCount,
    folderId: scanRes.folderId,
    laptops: laptops
  };
}

/**
 * Accesses or creates the Google Sheet 'Manaki_Laptop_Inventory'
 */
function getDatabaseSpreadsheet() {
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }

  var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  var invSheet = ss.getActiveSheet();
  invSheet.setName("Inventory");

  var headers = [
    "ID", "Number", "Title", "Brand", "Category", "Processor", "Generation",
    "Speed", "RAM", "Storage", "Display", "Graphics", "HasDedicatedGPU",
    "IsTouchscreen", "IsConvertible", "HasBacklitKeyboard", "HasFingerprint",
    "Features", "Price", "OriginalPrice", "Status", "Condition", "Battery",
    "Description", "Images", "Featured", "Notes"
  ];
  invSheet.appendRow(headers);
  invSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e3f1df");
  invSheet.setFrozenRows(1);

  var setSheet = ss.insertSheet("Settings");
  setSheet.appendRow(["Key", "Value"]);
  setSheet.appendRow(["whatsapp_number", DEFAULT_WHATSAPP]);
  setSheet.appendRow(["admin_password", ADMIN_PASSWORD]);
  setSheet.appendRow(["store_name", "Manaki Laptop Deals"]);
  setSheet.appendRow(["currency", "GH₵"]);
  setSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#e3f1df");

  return ss;
}

/**
 * Get all laptops (from Google Sheets or cache, guaranteed fallback to DEFAULT_CATALOG)
 */
function getLaptops() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("manaki_laptops_cache");
    if (cached) {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // Read from Google Sheet
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Inventory");
    var data = sheet.getDataRange().getValues();

    if (data && data.length > 1) {
      var laptops = [];
      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (!row[0]) continue;
        laptops.push({
          id: Number(row[0]) || r,
          number: row[1] || r,
          title: String(row[2] || ""),
          brand: String(row[3] || ""),
          category: String(row[4] || ""),
          processor: String(row[5] || ""),
          generation: String(row[6] || ""),
          speed: String(row[7] || ""),
          ram: String(row[8] || ""),
          ramGb: parseInt(row[8]) || 8,
          storage: String(row[9] || ""),
          storageGb: parseInt(row[9]) || 256,
          display: String(row[10] || ""),
          graphics: String(row[11] || ""),
          hasDedicatedGpu: Boolean(row[12]),
          isTouchscreen: Boolean(row[13]),
          isConvertible: Boolean(row[14]),
          hasBacklitKeyboard: Boolean(row[15]),
          hasFingerprint: Boolean(row[16]),
          features: row[17] ? String(row[17]).split(",").map(function(s){ return s.trim(); }) : [],
          price: Number(row[18]) || 0,
          priceFormatted: "GH₵" + Number(row[18] || 0).toLocaleString(),
          originalPrice: Number(row[19]) || Math.round(Number(row[18] || 0) * 1.1),
          originalPriceFormatted: "GH₵" + (Number(row[19]) || Math.round(Number(row[18] || 0) * 1.1)).toLocaleString(),
          status: String(row[20] || "Available"),
          condition: String(row[21] || "Grade A+ Clean"),
          battery: String(row[22] || "Tested Strong Battery"),
          description: String(row[23] || ""),
          images: row[24] ? String(row[24]).split("\n").map(function(s){ return s.trim(); }).filter(Boolean) : [],
          featured: Boolean(row[25]),
          notes: String(row[26] || "")
        });
      }
      if (laptops.length > 0) {
        try {
          CacheService.getScriptCache().put("manaki_laptops_cache", JSON.stringify(laptops), 21600);
        } catch(e) {}
        return laptops;
      }
    }
  } catch (err) {
    Logger.log("Sheet read warning: " + err.toString());
  }

  // Guaranteed fallback to DEFAULT_CATALOG
  var initial = (typeof DEFAULT_CATALOG !== 'undefined' && DEFAULT_CATALOG.length > 0) ? DEFAULT_CATALOG : [];
  try {
    saveAllLaptopsToStore(initial);
  } catch(e) {}
  return initial;
}

/**
 * Saves all laptops to Google Sheet & Cache (never exceeds PropertiesService limit)
 */
function saveAllLaptopsToStore(laptops) {
  if (!laptops || laptops.length === 0) return;
  
  try {
    var jsonStr = JSON.stringify(laptops);
    CacheService.getScriptCache().put("manaki_laptops_cache", jsonStr, 21600);
  } catch(e) {
    Logger.log("Cache error: " + e.toString());
  }

  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName("Inventory");
    sheet.clearContents();

    var headers = [
      "ID", "Number", "Title", "Brand", "Category", "Processor", "Generation",
      "Speed", "RAM", "Storage", "Display", "Graphics", "HasDedicatedGPU",
      "IsTouchscreen", "IsConvertible", "HasBacklitKeyboard", "HasFingerprint",
      "Features", "Price", "OriginalPrice", "Status", "Condition", "Battery",
      "Description", "Images", "Featured", "Notes"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e3f1df");
    sheet.setFrozenRows(1);

    var rows = [];
    for (var i = 0; i < laptops.length; i++) {
      var l = laptops[i];
      rows.push([
        l.id,
        l.number || l.id,
        l.title || "",
        l.brand || "",
        l.category || "",
        l.processor || "",
        l.generation || "",
        l.speed || "",
        l.ram || "",
        l.storage || "",
        l.display || "",
        l.graphics || "",
        Boolean(l.hasDedicatedGpu),
        Boolean(l.isTouchscreen),
        Boolean(l.isConvertible),
        Boolean(l.hasBacklitKeyboard),
        Boolean(l.hasFingerprint),
        (l.features || []).join(", "),
        Number(l.price) || 0,
        Number(l.originalPrice) || 0,
        l.status || "Available",
        l.condition || "",
        l.battery || "",
        l.description || "",
        (l.images || []).join("\n"),
        Boolean(l.featured),
        l.notes || ""
      ]);
    }
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  } catch (err) {
    Logger.log("Failed to write to Google Sheet: " + err.toString());
  }
}

/**
 * Get laptop by ID
 */
function getLaptopById(id) {
  var list = getLaptops();
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id) || String(list[i].number) === String(id)) {
      return list[i];
    }
  }
  return null;
}

/**
 * Save or update laptop
 */
function saveLaptop(laptopData) {
  var list = getLaptops();
  var id = laptopData.id;
  var index = -1;

  if (id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        index = i;
        break;
      }
    }
  }

  if (index >= 0) {
    var existing = list[index];
    for (var key in laptopData) {
      existing[key] = laptopData[key];
    }
    existing.priceFormatted = "GH₵" + Number(existing.price || 0).toLocaleString();
    list[index] = existing;
  } else {
    var maxId = 0;
    for (var j = 0; j < list.length; j++) {
      if (Number(list[j].id) > maxId) maxId = Number(list[j].id);
    }
    laptopData.id = maxId + 1;
    laptopData.number = maxId + 1;
    laptopData.priceFormatted = "GH₵" + Number(laptopData.price || 0).toLocaleString();
    list.unshift(laptopData);
  }

  saveAllLaptopsToStore(list);
  return { success: true, laptop: (index >= 0 ? list[index] : laptopData), laptops: list };
}

/**
 * Delete laptop by ID
 */
function deleteLaptop(id) {
  var list = getLaptops();
  var filtered = list.filter(function(item) {
    return String(item.id) !== String(id);
  });
  saveAllLaptopsToStore(filtered);
  return { success: true, count: filtered.length, laptops: filtered };
}

/**
 * Get store settings
 */
function getSettings() {
  var props = PropertiesService.getScriptProperties();
  return {
    whatsappNumber: props.getProperty("WHATSAPP_NUMBER") || DEFAULT_WHATSAPP,
    storeName: "Manaki Laptop Deals",
    currency: "GH₵"
  };
}

/**
 * Update store settings
 */
function updateSettings(settings) {
  var props = PropertiesService.getScriptProperties();
  if (settings.whatsappNumber) {
    props.setProperty("WHATSAPP_NUMBER", String(settings.whatsappNumber));
  }
  return { success: true, settings: getSettings() };
}

/**
 * Reset catalog back to original shipment data
 */
function resetCatalogToDefaults() {
  saveAllLaptopsToStore(DEFAULT_CATALOG);
  syncDriveImages();
  return { success: true, count: DEFAULT_CATALOG.length, laptops: getLaptops() };
}

/**
 * Render Storefront Page (index.html)
 */
function renderIndexPage() {
  var tmpl = HtmlService.createTemplateFromFile("index");
  var laps = [];
  try {
    laps = getLaptops();
  } catch(e) {
    Logger.log("getLaptops error: " + e.toString());
    laps = DEFAULT_CATALOG;
  }
  tmpl.laptops = (laps && laps.length > 0) ? laps : DEFAULT_CATALOG;
  tmpl.settings = getSettings();
  var output = tmpl.evaluate();
  output.setTitle("Manaki Laptop Deals · Official Store")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

/**
 * Render Product Detail Page (detail.html)
 */
function renderDetailPage(id) {
  var tmpl = HtmlService.createTemplateFromFile("detail");
  var laps = [];
  try { laps = getLaptops(); } catch(e) { laps = DEFAULT_CATALOG; }
  if (!laps || laps.length === 0) laps = DEFAULT_CATALOG;
  var selected = getLaptopById(id) || laps[0];
  tmpl.laptop = selected;
  tmpl.laptops = laps;
  tmpl.settings = getSettings();
  var title = selected ? (selected.title + " · Manaki Laptop Deals") : "Laptop Details";
  var output = tmpl.evaluate();
  output.setTitle(title)
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

/**
 * Render Admin Portal (admin.html)
 */
function renderAdminPage() {
  var tmpl = HtmlService.createTemplateFromFile("admin");
  var laps = [];
  try { laps = getLaptops(); } catch(e) { laps = DEFAULT_CATALOG; }
  if (!laps || laps.length === 0) laps = DEFAULT_CATALOG;
  tmpl.laptops = laps;
  tmpl.settings = getSettings();
  var output = tmpl.evaluate();
  output.setTitle("Manaki Admin Portal · Inventory & Drive Sync")
        .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

// Embedded default catalog (41 laptops with complete hardware specs)
var DEFAULT_CATALOG = [
  {
    "id": 1,
    "number": 1,
    "title": "Dell Inspiron 7386 2-in-1",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "8th Gen",
    "speed": "2.8 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "13\" FHD Display (Touch)",
    "screenSize": "13\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Backlit Keyboard",
      "Fingerprint Scanner",
      "Alexa Built-in"
    ],
    "price": 4500,
    "priceFormatted": "GH\u20b54,500",
    "originalPrice": 4950,
    "originalPriceFormatted": "GH\u20b54,950",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Inspiron 7386 2-in-1 powered by Intel Core i5 8th Gen with 8GB RAM and ultra-fast 8GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 1 A.webp",
      "images/L 1 B.webp",
      "images/L 1 C.webp",
      "images/L 1 D.webp",
      "images/L 1 E.webp",
      "images/L 1 F.webp",
      "images/L 1 G.webp"
    ],
    "featured": true,
    "views": 137
  },
  {
    "id": 2,
    "number": 2,
    "title": "HP EliteBook 830 G5",
    "brand": "HP",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "8th Gen",
    "speed": "2.11 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4950,
    "priceFormatted": "GH\u20b54,950",
    "originalPrice": 5450,
    "originalPriceFormatted": "GH\u20b55,450",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP EliteBook 830 G5 powered by Intel Core i7 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 2 A.webp",
      "images/L 2 B.webp",
      "images/L 2 C.webp",
      "images/L 2 D.webp",
      "images/L 2 E.webp",
      "images/L 2 F.webp",
      "images/L 2 G.webp"
    ],
    "featured": true,
    "views": 154
  },
  {
    "id": 3,
    "number": 3,
    "title": "HP Envy x360 Convertible",
    "brand": "HP",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "8th Gen",
    "speed": "1.8 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": false,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Fingerprint Scanner"
    ],
    "price": 4500,
    "priceFormatted": "GH\u20b54,500",
    "originalPrice": 4950,
    "originalPriceFormatted": "GH\u20b54,950",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP Envy x360 Convertible powered by Intel Core i5 8th Gen with 8GB RAM and ultra-fast 8GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 3 A.webp",
      "images/L 3 B.webp",
      "images/L 3 C.webp",
      "images/L 3 D.webp",
      "images/L 3 E.webp"
    ],
    "featured": false,
    "views": 171
  },
  {
    "id": 4,
    "number": 4,
    "title": "Dell XPS 15 7590",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "9th Gen",
    "speed": "2.60 GHz",
    "ram": "32GB",
    "ramGb": 32,
    "storage": "32GB SSD",
    "storageGb": 32,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner",
      "4GB Dedicated Graphics"
    ],
    "price": 6950,
    "priceFormatted": "GH\u20b56,950",
    "originalPrice": 7650,
    "originalPriceFormatted": "GH\u20b57,650",
    "status": "Hot Deal",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell XPS 15 7590 powered by Intel Core i7 9th Gen with 32GB RAM and ultra-fast 32GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 4 A.webp",
      "images/L 4 B.webp",
      "images/L 4 C.webp",
      "images/L 4 D(1).webp",
      "images/L 4 D.webp",
      "images/L 4 E.webp",
      "images/L 4 F.webp",
      "images/L 4 G.webp"
    ],
    "featured": true,
    "views": 188
  },
  {
    "id": 5,
    "number": 5,
    "title": "Dell Precision 5560 Workstation",
    "brand": "Dell",
    "category": "Workstation",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "2.50 GHz",
    "ram": "32GB",
    "ramGb": 32,
    "storage": "32GB SSD",
    "storageGb": 32,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner",
      "4GB Dedicated Graphics"
    ],
    "price": 6000,
    "priceFormatted": "GH\u20b56,000",
    "originalPrice": 6600,
    "originalPriceFormatted": "GH\u20b56,600",
    "status": "Sold Out",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Precision 5560 Workstation powered by Intel Core i7 11th Gen with 32GB RAM and ultra-fast 32GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 5 for Paul(1).webp",
      "images/L 5 for Paul(2).webp",
      "images/L 5 for Paul(3).webp",
      "images/L 5 for Paul(4).webp",
      "images/L 5 for Paul(5).webp",
      "images/L 5 for Paul(6).webp",
      "images/L 5 for Paul(7).webp",
      "images/L 5 for Paul.webp"
    ],
    "featured": false,
    "views": 205
  },
  {
    "id": 6,
    "number": 6,
    "title": "Dell Latitude 7400 2-in-1",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "8th Gen",
    "speed": "2.10 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "13\" FHD Display (Touch)",
    "screenSize": "13\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4350,
    "priceFormatted": "GH\u20b54,350",
    "originalPrice": 4800,
    "originalPriceFormatted": "GH\u20b54,800",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 7400 2-in-1 powered by Intel Core i7 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 6 A.webp",
      "images/L 6 B.webp",
      "images/L 6 C.webp",
      "images/L 6 D.webp",
      "images/L 6 E.webp",
      "images/L 6 F.webp"
    ],
    "featured": false,
    "views": 222
  },
  {
    "id": 7,
    "number": 7,
    "title": "Dell Latitude 7440 2-in-1",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "13th Gen",
    "speed": "1.80 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "360\u00b0 Convertible",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 5950,
    "priceFormatted": "GH\u20b55,950",
    "originalPrice": 6550,
    "originalPriceFormatted": "GH\u20b56,550",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 7440 2-in-1 powered by Intel Core i7 13th Gen with 16GB RAM and ultra-fast 16GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 7 A.webp",
      "images/L 7 B.webp",
      "images/L 7 C.webp",
      "images/L 7 D.webp"
    ],
    "featured": true,
    "views": 239
  },
  {
    "id": 8,
    "number": 8,
    "title": "HP EliteBook 830 G5",
    "brand": "HP",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "8th Gen",
    "speed": "2.11 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4800,
    "priceFormatted": "GH\u20b54,800",
    "originalPrice": 5300,
    "originalPriceFormatted": "GH\u20b55,300",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP EliteBook 830 G5 powered by Intel Core i7 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 8 A.webp",
      "images/L 8 B.webp",
      "images/L 8 C.webp",
      "images/L 8 D.webp",
      "images/L 8 E.webp",
      "images/L 8 F.webp",
      "images/L 8 G.webp"
    ],
    "featured": false,
    "views": 256
  },
  {
    "id": 9,
    "number": 9,
    "title": "Dell Latitude 5420",
    "brand": "Dell",
    "category": "Performance",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "1.8 GHz",
    "ram": "32GB",
    "ramGb": 32,
    "storage": "32GB SSD",
    "storageGb": 32,
    "storageType": "SSD",
    "display": "14\" FHD Display",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 6200,
    "priceFormatted": "GH\u20b56,200",
    "originalPrice": 6850,
    "originalPriceFormatted": "GH\u20b56,850",
    "status": "Hot Deal",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 5420 powered by Intel Core i7 11th Gen with 32GB RAM and ultra-fast 32GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 9 A.webp",
      "images/L 9 B.webp",
      "images/L 9 C.webp",
      "images/L 9 D.webp",
      "images/L 9 E.webp"
    ],
    "featured": true,
    "views": 273
  },
  {
    "id": 10,
    "number": 10,
    "title": "Microsoft Surface Pro 4",
    "brand": "Microsoft",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "6th Gen",
    "speed": "2.50 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "12\" FHD Display (Touch)",
    "screenSize": "12\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "Backlit Keyboard"
    ],
    "price": 3350,
    "priceFormatted": "GH\u20b53,350",
    "originalPrice": 3700,
    "originalPriceFormatted": "GH\u20b53,700",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Microsoft Surface Pro 4 powered by Intel Core i5 6th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 10 A.webp",
      "images/L 10 B.webp",
      "images/L 10 C.webp",
      "images/L 10 D.webp"
    ],
    "featured": false,
    "views": 290
  },
  {
    "id": 11,
    "number": 11,
    "title": "HP EliteBook 830 G5",
    "brand": "HP",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "8th Gen",
    "speed": "2.11 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4800,
    "priceFormatted": "GH\u20b54,800",
    "originalPrice": 5300,
    "originalPriceFormatted": "GH\u20b55,300",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP EliteBook 830 G5 powered by Intel Core i7 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 11 B.webp",
      "images/L 11 C.webp",
      "images/L 11 D.webp",
      "images/L 11 E.webp",
      "images/L 11 F.webp",
      "images/L 11 G.webp",
      "images/L 11 H.webp"
    ],
    "featured": false,
    "views": 307
  },
  {
    "id": 12,
    "number": 12,
    "title": "Dell Latitude 7200 2-in-1",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "10th Gen",
    "speed": "2.21 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "12\" FHD Display (Touch)",
    "screenSize": "12\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Backlit Keyboard"
    ],
    "price": 3700,
    "priceFormatted": "GH\u20b53,700",
    "originalPrice": 4100,
    "originalPriceFormatted": "GH\u20b54,100",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 7200 2-in-1 powered by Intel Core i5 10th Gen with 8GB RAM and ultra-fast 8GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 12 A.webp",
      "images/L 12 B.webp",
      "images/L 12 C.webp",
      "images/L 12 D.webp",
      "images/L 12 F.webp",
      "images/L 12 G.webp"
    ],
    "featured": false,
    "views": 324
  },
  {
    "id": 13,
    "number": 13,
    "title": "Lenovo ThinkPad",
    "brand": "Lenovo",
    "category": "Performance",
    "processor": "Intel Core i7",
    "generation": "8th Gen",
    "speed": "1.99 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 3600,
    "priceFormatted": "GH\u20b53,600",
    "originalPrice": 4000,
    "originalPriceFormatted": "GH\u20b54,000",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo ThinkPad powered by Intel Core i7 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 13 A.webp",
      "images/L 13 B.webp",
      "images/L 13 C.webp",
      "images/L 13 D.webp",
      "images/L 13 F.webp",
      "images/L 13 G.webp"
    ],
    "featured": false,
    "views": 341
  },
  {
    "id": 14,
    "number": 14,
    "title": "Dell Latitude 3510",
    "brand": "Dell",
    "category": "Performance",
    "processor": "Intel Core i5",
    "generation": "10th Gen",
    "speed": "2.11 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 3650,
    "priceFormatted": "GH\u20b53,650",
    "originalPrice": 4050,
    "originalPriceFormatted": "GH\u20b54,050",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 3510 powered by Intel Core i5 10th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 14 A.webp",
      "images/L 14 B.webp",
      "images/L 14 C(1).webp",
      "images/L 14 C.webp",
      "images/L 14 D.webp",
      "images/L 14 E.webp",
      "images/L 14 F.webp"
    ],
    "featured": false,
    "views": 358
  },
  {
    "id": 15,
    "number": 15,
    "title": "HP Laptop",
    "brand": "HP",
    "category": "Performance",
    "processor": "Intel Core i7",
    "generation": "10th Gen",
    "speed": "1.50 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": false,
    "hasFingerprint": false,
    "features": [],
    "price": 4400,
    "priceFormatted": "GH\u20b54,400",
    "originalPrice": 4850,
    "originalPriceFormatted": "GH\u20b54,850",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP Laptop powered by Intel Core i7 10th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students.",
    "images": [
      "images/L 15 A.webp",
      "images/L 15 B.webp",
      "images/L 15 C.webp",
      "images/L 15 D.webp",
      "images/L 15 E.webp",
      "images/L 15 F.webp",
      "images/L 15 G.webp",
      "images/L 15 H.webp"
    ],
    "featured": false,
    "views": 375
  },
  {
    "id": 16,
    "number": 16,
    "title": "Dell XPS 13 9350",
    "brand": "Dell",
    "category": "Ultrabook",
    "processor": "Intel Core i5",
    "generation": "6th Gen",
    "speed": "Up to 3.4 GHz Turbo",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "13\" FHD Display",
    "screenSize": "13\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard",
      "Extended Battery Life (8-10+ Hrs)"
    ],
    "price": 3900,
    "priceFormatted": "GH\u20b53,900",
    "originalPrice": 4300,
    "originalPriceFormatted": "GH\u20b54,300",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell XPS 13 9350 powered by Intel Core i5 6th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 16 A(1).webp",
      "images/L 16 A.webp",
      "images/L 16 B.webp",
      "images/L 16 C(1).webp",
      "images/L 16 C.webp",
      "images/L 16 D.webp",
      "images/L 16 E.webp"
    ],
    "featured": true,
    "views": 392
  },
  {
    "id": 17,
    "number": 17,
    "title": "HP Pavilion x360",
    "brand": "HP",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "10th Gen",
    "speed": "1.5 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": false,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "4GB Dedicated Graphics"
    ],
    "price": 4950,
    "priceFormatted": "GH\u20b54,950",
    "originalPrice": 5450,
    "originalPriceFormatted": "GH\u20b55,450",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP Pavilion x360 powered by Intel Core i7 10th Gen with 16GB RAM and ultra-fast 16GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 17 A.webp",
      "images/L 17 B.webp",
      "images/L 17 C(1).webp",
      "images/L 17 C.webp",
      "images/L 17 D.webp",
      "images/L 17 E.webp",
      "images/L 17 F.webp",
      "images/L 17 G.webp"
    ],
    "featured": false,
    "views": 409
  },
  {
    "id": 18,
    "number": 18,
    "title": "Lenovo AMD Laptop",
    "brand": "Lenovo",
    "category": "Business",
    "processor": "AMD Ryzen 5",
    "generation": "",
    "speed": "2.1 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "2GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": false,
    "hasFingerprint": false,
    "features": [
      "2GB Dedicated Graphics"
    ],
    "price": 3950,
    "priceFormatted": "GH\u20b53,950",
    "originalPrice": 4350,
    "originalPriceFormatted": "GH\u20b54,350",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo AMD Laptop powered by AMD Ryzen 5  with 8GB RAM and ultra-fast 8GB SSD. Equipped with 2GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming.",
    "images": [
      "images/L 18 A.webp",
      "images/L 18 B.webp",
      "images/L 18 C.webp",
      "images/L 18 D.webp",
      "images/L 18 E.webp",
      "images/L 18 F.webp"
    ],
    "featured": false,
    "views": 426
  },
  {
    "id": 19,
    "number": 19,
    "title": "Dell Latitude 7420 2-in-1",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "3.0 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4000,
    "priceFormatted": "GH\u20b54,000",
    "originalPrice": 4400,
    "originalPriceFormatted": "GH\u20b54,400",
    "status": "Sold Out",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 7420 2-in-1 powered by Intel Core i7 11th Gen with 16GB RAM and ultra-fast 16GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 19 A.webp",
      "images/L 19 B.webp",
      "images/L 19 C.webp",
      "images/L 19 D.webp",
      "images/L 19 E.webp",
      "images/L 19 F.webp",
      "images/L 19 G.webp"
    ],
    "featured": false,
    "views": 443
  },
  {
    "id": 20,
    "number": 20,
    "title": "Lenovo Flex 14",
    "brand": "Lenovo",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "8th Gen",
    "speed": "1.80 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4300,
    "priceFormatted": "GH\u20b54,300",
    "originalPrice": 4750,
    "originalPriceFormatted": "GH\u20b54,750",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo Flex 14 powered by Intel Core i5 8th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 20 A.webp",
      "images/L 20 B.webp",
      "images/L 20 C.webp",
      "images/L 20 D.webp",
      "images/L 20 E.webp",
      "images/L 20 F.webp"
    ],
    "featured": false,
    "views": 460
  },
  {
    "id": 21,
    "number": 21,
    "title": "HP EliteBook 845 G7",
    "brand": "HP",
    "category": "Performance",
    "processor": "AMD Ryzen 7 Pro",
    "generation": "",
    "speed": "1.7 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "13\" FHD Display",
    "screenSize": "13\"",
    "graphics": "AMD Radeon Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4950,
    "priceFormatted": "GH\u20b54,950",
    "originalPrice": 5450,
    "originalPriceFormatted": "GH\u20b55,450",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP EliteBook 845 G7 powered by AMD Ryzen 7 Pro  with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 21 A.webp",
      "images/L 21 B.webp",
      "images/L 21 C.webp",
      "images/L 21 D.webp",
      "images/L 21 E.webp",
      "images/L 21 F.webp",
      "images/L 21 G.webp",
      "images/L 21 H.webp"
    ],
    "featured": false,
    "views": 477
  },
  {
    "id": 22,
    "number": 22,
    "title": "Dell Precision 3561 Workstation",
    "brand": "Dell",
    "category": "Workstation",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "2.3 GHz",
    "ram": "32GB",
    "ramGb": 32,
    "storage": "32GB SSD",
    "storageGb": 32,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard",
      "4GB Dedicated Graphics",
      "Extended Battery Life (8-10+ Hrs)"
    ],
    "price": 7000,
    "priceFormatted": "GH\u20b57,000",
    "originalPrice": 7700,
    "originalPriceFormatted": "GH\u20b57,700",
    "status": "Hot Deal",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Precision 3561 Workstation powered by Intel Core i7 11th Gen with 32GB RAM and ultra-fast 32GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 22 A.webp",
      "images/L 22 B.webp",
      "images/L 22 C.webp",
      "images/L 22 D.webp",
      "images/L 22 E.webp",
      "images/L 22 F.webp",
      "images/L 22 G.webp",
      "images/L 22 H.webp",
      "images/L 22 I.webp"
    ],
    "featured": true,
    "views": 494
  },
  {
    "id": 23,
    "number": 23,
    "title": "Lenovo Yoga 80VF",
    "brand": "Lenovo",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "7th Gen",
    "speed": "2.90 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4500,
    "priceFormatted": "GH\u20b54,500",
    "originalPrice": 4950,
    "originalPriceFormatted": "GH\u20b54,950",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo Yoga 80VF powered by Intel Core i7 7th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 23 A.webp",
      "images/L 23 B.webp",
      "images/L 23 C.webp",
      "images/L 23 D.webp",
      "images/L 23 E.webp",
      "images/L 23 F.webp",
      "images/L 23 G.webp",
      "images/L 23 H.webp",
      "images/L 23 I.webp",
      "images/L 23 J.webp",
      "images/L 23 K.webp",
      "images/L 23 L.webp"
    ],
    "featured": false,
    "views": 511
  },
  {
    "id": 24,
    "number": 24,
    "title": "MacBook Pro 2017",
    "brand": "Apple",
    "category": "Ultrabook",
    "processor": "Intel Core i5",
    "generation": "2017 Model",
    "speed": "2.3 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "13\" FHD Display",
    "screenSize": "13\"",
    "graphics": "Intel Iris Plus Graphics 640",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 3750,
    "priceFormatted": "GH\u20b53,750",
    "originalPrice": 4150,
    "originalPriceFormatted": "GH\u20b54,150",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "MacBook Pro 2017 powered by Intel Core i5 2017 Model with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 24 A.webp",
      "images/L 24 B.webp",
      "images/L 24 C.webp",
      "images/L 24 D.webp",
      "images/L 24 E.webp",
      "images/L 24 F.webp"
    ],
    "featured": false,
    "views": 128
  },
  {
    "id": 25,
    "number": 25,
    "title": "Lenovo Yoga",
    "brand": "Lenovo",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "11th Gen",
    "speed": "2.42 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4300,
    "priceFormatted": "GH\u20b54,300",
    "originalPrice": 4750,
    "originalPriceFormatted": "GH\u20b54,750",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo Yoga powered by Intel Core i5 11th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 25 A.webp",
      "images/L 25 B.webp",
      "images/L 25 C.webp",
      "images/L 25 D.webp",
      "images/L 25 E.webp",
      "images/L 25 F.webp",
      "images/L 25 G.webp",
      "images/L 25 H.webp",
      "images/L 25 I.webp"
    ],
    "featured": false,
    "views": 145
  },
  {
    "id": 26,
    "number": 26,
    "title": "HP Laptop",
    "brand": "HP",
    "category": "Business",
    "processor": "Intel Core i5",
    "generation": "10th Gen",
    "speed": "1.20 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": false,
    "hasFingerprint": false,
    "features": [],
    "price": 3600,
    "priceFormatted": "GH\u20b53,600",
    "originalPrice": 4000,
    "originalPriceFormatted": "GH\u20b54,000",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP Laptop powered by Intel Core i5 10th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students.",
    "images": [
      "images/L 26 A.webp",
      "images/L 26 B.webp",
      "images/L 26 C.webp",
      "images/L 26 D.webp",
      "images/L 26 F.webp"
    ],
    "featured": false,
    "views": 162
  },
  {
    "id": 27,
    "number": 27,
    "title": "Dell Latitude 5501",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "9th Gen",
    "speed": "2.60 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": false,
    "hasFingerprint": false,
    "features": [
      "Touchscreen"
    ],
    "price": 5000,
    "priceFormatted": "GH\u20b55,000",
    "originalPrice": 5500,
    "originalPriceFormatted": "GH\u20b55,500",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 5501 powered by Intel Core i7 9th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 27 A.webp",
      "images/L 27 B.webp",
      "images/L 27 C.webp",
      "images/L 27 D.webp",
      "images/L 27 E.webp",
      "images/L 27 F.webp",
      "images/L 27 G.webp",
      "images/L 27 H.webp"
    ],
    "featured": false,
    "views": 179
  },
  {
    "id": 28,
    "number": 28,
    "title": "HP G7 Notebook",
    "brand": "HP",
    "category": "Business",
    "processor": "Intel Core i3",
    "generation": "10th Gen",
    "speed": "Up to 3.4 GHz Turbo",
    "ram": "4GB",
    "ramGb": 4,
    "storage": "4GB SSD",
    "storageGb": 4,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": false,
    "hasFingerprint": false,
    "features": [],
    "price": 4100,
    "priceFormatted": "GH\u20b54,100",
    "originalPrice": 4550,
    "originalPriceFormatted": "GH\u20b54,550",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP G7 Notebook powered by Intel Core i3 10th Gen with 4GB RAM and ultra-fast 4GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students.",
    "images": [
      "images/L 28 A.webp",
      "images/L 28 B.webp",
      "images/L 28 C.webp",
      "images/L 28 E.webp",
      "images/L 28 F.webp",
      "images/L 28 G.webp",
      "images/L 28 H.webp",
      "images/L 28 I.webp",
      "images/L 28 J.webp"
    ],
    "featured": false,
    "views": 196
  },
  {
    "id": 29,
    "number": 29,
    "title": "Dell Laptop",
    "brand": "Dell",
    "category": "Business",
    "processor": "Intel Core i5",
    "generation": "10th Gen",
    "speed": "1.20 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 3950,
    "priceFormatted": "GH\u20b53,950",
    "originalPrice": 4350,
    "originalPriceFormatted": "GH\u20b54,350",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Laptop powered by Intel Core i5 10th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 29 A.webp",
      "images/L 29 B.webp",
      "images/L 29 C.webp",
      "images/L 29 D.webp",
      "images/L 29 E.webp",
      "images/L 29 F.webp",
      "images/L 29 G.webp"
    ],
    "featured": false,
    "views": 213
  },
  {
    "id": 30,
    "number": 30,
    "title": "Dell XPS",
    "brand": "Dell",
    "category": "Ultrabook",
    "processor": "Intel Core i7",
    "generation": "8th Gen",
    "speed": "2.20 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard",
      "4GB Dedicated Graphics"
    ],
    "price": 5300,
    "priceFormatted": "GH\u20b55,300",
    "originalPrice": 5850,
    "originalPriceFormatted": "GH\u20b55,850",
    "status": "Hot Deal",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell XPS powered by Intel Core i7 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 30 A.webp",
      "images/L 30 B.webp",
      "images/L 30 C.webp",
      "images/L 30 D.webp",
      "images/L 30 E.webp",
      "images/L 30 F.webp",
      "images/L 30 G.webp",
      "images/L 30 H.webp",
      "images/L 30 I.webp"
    ],
    "featured": false,
    "views": 230
  },
  {
    "id": 31,
    "number": 31,
    "title": "Dell Precision 5510 Workstation",
    "brand": "Dell",
    "category": "Workstation",
    "processor": "Intel Xeon",
    "generation": "",
    "speed": "2.80 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "2GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard",
      "2GB Dedicated Graphics"
    ],
    "price": 3750,
    "priceFormatted": "GH\u20b53,750",
    "originalPrice": 4150,
    "originalPriceFormatted": "GH\u20b54,150",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Precision 5510 Workstation powered by Intel Xeon  with 16GB RAM and ultra-fast 16GB SSD. Equipped with 2GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 31 A.webp",
      "images/L 31 B.webp",
      "images/L 31 C.webp",
      "images/L 31 D.webp",
      "images/L 31 E.webp",
      "images/L 31 F.webp",
      "images/L 31 G.webp"
    ],
    "featured": false,
    "views": 247
  },
  {
    "id": 32,
    "number": 32,
    "title": "Samsung Laptop",
    "brand": "Samsung",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "10th Gen",
    "speed": "2.30 GHz",
    "ram": "12GB",
    "ramGb": 12,
    "storage": "12GB SSD",
    "storageGb": 12,
    "storageType": "SSD",
    "display": "13\" FHD Display (Touch)",
    "screenSize": "13\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "Backlit Keyboard"
    ],
    "price": 5300,
    "priceFormatted": "GH\u20b55,300",
    "originalPrice": 5850,
    "originalPriceFormatted": "GH\u20b55,850",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Samsung Laptop powered by Intel Core i7 10th Gen with 12GB RAM and ultra-fast 12GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 32 A.webp",
      "images/L 32 B.webp",
      "images/L 32 C.webp",
      "images/L 32 D.webp",
      "images/L 32 E.webp",
      "images/L 32 F.webp",
      "images/L 32 G.webp",
      "images/L 32 H.webp",
      "images/L 32 I.webp"
    ],
    "featured": false,
    "views": 264
  },
  {
    "id": 33,
    "number": 33,
    "title": "Acer Nitro 5 Gaming Laptop",
    "brand": "Acer",
    "category": "Gaming",
    "processor": "Intel Core i5",
    "generation": "11th Gen",
    "speed": "2.70 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard",
      "4GB Dedicated Graphics"
    ],
    "price": 4800,
    "priceFormatted": "GH\u20b54,800",
    "originalPrice": 5300,
    "originalPriceFormatted": "GH\u20b55,300",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Acer Nitro 5 Gaming Laptop powered by Intel Core i5 11th Gen with 8GB RAM and ultra-fast 8GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 33 A.webp",
      "images/L 33 B.webp",
      "images/L 33 C.webp",
      "images/L 33 D.webp",
      "images/L 33 E.webp",
      "images/L 33 F.webp",
      "images/L 33 G.webp",
      "images/L 33 H.webp",
      "images/L 33 I.webp"
    ],
    "featured": true,
    "views": 281
  },
  {
    "id": 34,
    "number": 34,
    "title": "Dell Precision 3560",
    "brand": "Dell",
    "category": "Workstation",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "2.80 GHz",
    "ram": "32GB",
    "ramGb": 32,
    "storage": "32GB SSD",
    "storageGb": 32,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 5500,
    "priceFormatted": "GH\u20b55,500",
    "originalPrice": 6050,
    "originalPriceFormatted": "GH\u20b56,050",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Precision 3560 powered by Intel Core i7 11th Gen with 32GB RAM and ultra-fast 32GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 34 A.webp",
      "images/L 34 B.webp",
      "images/L 34 C.webp",
      "images/L 34 D.webp",
      "images/L 34 E.webp",
      "images/L 34 F.webp",
      "images/L 34 G.webp"
    ],
    "featured": false,
    "views": 298
  },
  {
    "id": 35,
    "number": 35,
    "title": "HP ProBook 430 G6",
    "brand": "HP",
    "category": "Performance",
    "processor": "Intel Core i5",
    "generation": "8th Gen",
    "speed": "1.80 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "13\" FHD Display",
    "screenSize": "13\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 4350,
    "priceFormatted": "GH\u20b54,350",
    "originalPrice": 4800,
    "originalPriceFormatted": "GH\u20b54,800",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "HP ProBook 430 G6 powered by Intel Core i5 8th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 35 A.webp",
      "images/L 35 B.webp",
      "images/L 35 C.webp",
      "images/L 35 D.webp",
      "images/L 35 E.webp",
      "images/L 35 F.webp",
      "images/L 35 G.webp"
    ],
    "featured": false,
    "views": 315
  },
  {
    "id": 36,
    "number": 36,
    "title": "Dell Latitude 5520",
    "brand": "Dell",
    "category": "Performance",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "2.80 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": false,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Backlit Keyboard"
    ],
    "price": 5200,
    "priceFormatted": "GH\u20b55,200",
    "originalPrice": 5750,
    "originalPriceFormatted": "GH\u20b55,750",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 5520 powered by Intel Core i7 11th Gen with 16GB RAM and ultra-fast 16GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition.",
    "images": [
      "images/L 36 A.webp",
      "images/L 36 B.webp",
      "images/L 36 C.webp",
      "images/L 36 D.webp",
      "images/L 36 E.webp",
      "images/L 36 F.webp",
      "images/L 36 G.webp",
      "images/L 36 H.webp"
    ],
    "featured": false,
    "views": 332
  },
  {
    "id": 37,
    "number": 37,
    "title": "Lenovo Flex 5",
    "brand": "Lenovo",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i5",
    "generation": "11th Gen",
    "speed": "2.4 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Backlit Keyboard",
      "Fingerprint Scanner"
    ],
    "price": 5200,
    "priceFormatted": "GH\u20b55,200",
    "originalPrice": 5750,
    "originalPriceFormatted": "GH\u20b55,750",
    "status": "Sold Out",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo Flex 5 powered by Intel Core i5 11th Gen with 8GB RAM and ultra-fast 8GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 37-38 A.webp",
      "images/L 37-38 B.webp",
      "images/L 37-38 C.webp",
      "images/L 37-38 D.webp",
      "images/L 37-38 E.webp",
      "images/L 37-38 F.webp",
      "images/L 37-38 G.webp",
      "images/L 37-38 H.webp",
      "images/L 37-38 I.webp"
    ],
    "featured": false,
    "views": 349
  },
  {
    "id": 38,
    "number": 38,
    "title": "Lenovo Flex Almost New",
    "brand": "Lenovo",
    "category": "2-in-1 Touch",
    "processor": "AMD Ryzen 5 / Core i5",
    "generation": "11th Gen",
    "speed": "Up to 3.4 GHz Turbo",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "256GB SSD",
    "storageGb": 256,
    "storageType": "SSD",
    "display": "14\" FHD Display (Touch)",
    "screenSize": "14\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": true,
    "hasBacklitKeyboard": true,
    "hasFingerprint": true,
    "features": [
      "Touchscreen",
      "360\u00b0 Convertible",
      "Fingerprint Scanner",
      "Backlit Keyboard",
      "Almost New Grade A+"
    ],
    "price": 5350,
    "priceFormatted": "GH\u20b55,350",
    "originalPrice": 5900,
    "originalPriceFormatted": "GH\u20b55,900",
    "status": "Almost New",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Lenovo Flex Almost New powered by AMD Ryzen 5 / Core i5 11th Gen with 8GB RAM and ultra-fast 256GB SSD. Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 37-38 A.webp",
      "images/L 37-38 B.webp",
      "images/L 37-38 C.webp",
      "images/L 37-38 D.webp",
      "images/L 37-38 E.webp",
      "images/L 37-38 F.webp",
      "images/L 37-38 G.webp",
      "images/L 37-38 H.webp",
      "images/L 37-38 I.webp"
    ],
    "featured": false,
    "views": 366
  },
  {
    "id": 39,
    "number": 39,
    "title": "Dell Inspiron 5593",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "10th Gen",
    "speed": "1.3 GHz",
    "ram": "8GB",
    "ramGb": 8,
    "storage": "8GB SSD",
    "storageGb": 8,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "Integrated Intel UHD Graphics",
    "hasDedicatedGpu": false,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "Backlit Keyboard"
    ],
    "price": 3800,
    "priceFormatted": "GH\u20b53,800",
    "originalPrice": 4200,
    "originalPriceFormatted": "GH\u20b54,200",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Inspiron 5593 powered by Intel Core i7 10th Gen with 8GB RAM and ultra-fast 8GB SSD. Engineered for speed, durability, and seamless everyday multitasking for professionals and students. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 1 A.webp",
      "images/L 1 B.webp",
      "images/L 1 C.webp"
    ],
    "featured": false,
    "views": 383
  },
  {
    "id": 40,
    "number": 40,
    "title": "Samsung Laptop",
    "brand": "Samsung",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "2.8 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "4GB Dedicated Graphics"
    ],
    "price": 4800,
    "priceFormatted": "GH\u20b54,800",
    "originalPrice": 5300,
    "originalPriceFormatted": "GH\u20b55,300",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Samsung Laptop powered by Intel Core i7 11th Gen with 16GB RAM and ultra-fast 16GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 32 A.webp",
      "images/L 32 B.webp",
      "images/L 32 C.webp"
    ],
    "featured": false,
    "views": 400
  },
  {
    "id": 41,
    "number": 41,
    "title": "Dell Latitude 5510",
    "brand": "Dell",
    "category": "2-in-1 Touch",
    "processor": "Intel Core i7",
    "generation": "11th Gen",
    "speed": "2.8 GHz",
    "ram": "16GB",
    "ramGb": 16,
    "storage": "16GB SSD",
    "storageGb": 16,
    "storageType": "SSD",
    "display": "15.6\" FHD Display (Touch)",
    "screenSize": "15.6\"",
    "graphics": "4GB Dedicated Graphics",
    "hasDedicatedGpu": true,
    "isTouchscreen": true,
    "isConvertible": false,
    "hasBacklitKeyboard": true,
    "hasFingerprint": false,
    "features": [
      "Touchscreen",
      "Backlit Keyboard",
      "4GB Dedicated Graphics"
    ],
    "price": 4600,
    "priceFormatted": "GH\u20b54,600",
    "originalPrice": 5100,
    "originalPriceFormatted": "GH\u20b55,100",
    "status": "Available",
    "condition": "Grade A+ Clean Direct Import",
    "battery": "Tested Strong Battery (Health 85%+)",
    "description": "Dell Latitude 5510 powered by Intel Core i7 11th Gen with 16GB RAM and ultra-fast 16GB SSD. Equipped with 4GB Dedicated Graphics making it outstanding for design, video editing, CAD, and gaming. Comes with a backlit keyboard for comfortable typing in any lighting condition. Crisp, responsive touchscreen display.",
    "images": [
      "images/L 36 A.webp",
      "images/L 36 B.webp",
      "images/L 36 C.webp"
    ],
    "featured": false,
    "views": 417
  }
];
