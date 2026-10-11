#!/usr/bin/env python3
"""
build_gas.py
Compiler & Packager for Manaki Laptop Deals Google Apps Script (GAS) deployment.
Generates standalone, self-contained Google Apps Script files in `google_apps_script/`:
  - Code.gs (Apps Script server backend with Drive scanner, Google Sheet DB, API & page routing)
  - index.html (Online customer storefront template)
  - detail.html (Product detail page template)
  - admin.html (Polaris Admin dashboard & Drive Sync manager)
  - appsscript.json (Project manifest with Drive and Sheets OAuth permissions)
  - README.md (Deployment guide)
"""

import os
import json
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(BASE_DIR, "google_apps_script")
os.makedirs(OUT_DIR, exist_ok=True)

def read_file(rel_path):
    p = os.path.join(BASE_DIR, rel_path)
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

def write_file(filename, content):
    p = os.path.join(OUT_DIR, filename)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  [OK] Generated {filename} ({len(content):,} bytes)")

print("Building Google Apps Script deployment package...")

# 1. Read source assets
css_styles = read_file("css/styles.css")
css_admin = read_file("css/admin.css")

js_data = read_file("js/data.js")
js_store = read_file("js/store.js")
js_app = read_file("js/app.js")
js_detail = read_file("js/detail.js")
js_admin = read_file("js/admin.js")

laptops_json = read_file("data/laptops.json")
laptops_data = json.loads(laptops_json)

html_index = read_file("index.html")
html_detail = read_file("detail.html")
html_admin = read_file("manaki_admin.html")

# 2. Build Code.gs template
code_gs_template = '''/**
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

      if (mime.indexOf("image/") === 0 || /\\.(jpe?g|png|webp|gif)$/i.test(name)) {
        var m = name.match(/^L\\s*(\\d+(?:-\\d+)?)\\s*(.*)/i);
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
          images: row[24] ? String(row[24]).split("\\n").map(function(s){ return s.trim(); }).filter(Boolean) : [],
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
        (l.images || []).join("\\n"),
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
var DEFAULT_CATALOG = __DEFAULT_CATALOG_JSON__;
'''

code_gs = code_gs_template.replace("__DEFAULT_CATALOG_JSON__", json.dumps(laptops_data, indent=2))
write_file("Code.gs", code_gs)

# 3. Build index.html for GAS
gas_index_html = html_index
gas_index_html = gas_index_html.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    f'<style>\n{css_styles}\n</style>'
)
gas_index_scripts = f'''  <!-- Server Data Injection -->
  <script>
    window.SERVER_LAPTOPS = <?!= JSON.stringify(laptops) ?>;
    window.GAS_EXEC_URL = "<?= (function() {{ try {{ return ScriptApp.getService().getUrl(); }} catch(e) {{ return ''; }} }})() ?>";
  </script>
  <script>
{js_data}
  </script>
  <script>
{js_store}
  </script>
  <script>
{js_app}
  </script>'''

target_index_scripts = '''  <!-- Scripts -->
  <script src="js/data.js"></script>
  <script src="js/store.js"></script>
  <script src="js/app.js"></script>'''

if target_index_scripts in gas_index_html:
    gas_index_html = gas_index_html.replace(target_index_scripts, gas_index_scripts)
else:
    gas_index_html = re.sub(
        r'<!-- Scripts -->\s*<script src="js/data\.js"></script>\s*<script src="js/store\.js"></script>\s*<script src="js/app\.js"></script>',
        lambda m: gas_index_scripts,
        gas_index_html
    )
write_file("index.html", gas_index_html)

# 4. Build detail.html for GAS
gas_detail_html = html_detail
gas_detail_html = gas_detail_html.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    f'<style>\n{css_styles}\n</style>'
)
gas_detail_scripts = f'''  <!-- Server Data Injection -->
  <script>
    window.SERVER_LAPTOP = <?!= JSON.stringify(laptop) ?>;
    window.SERVER_LAPTOPS = <?!= JSON.stringify(laptops) ?>;
    window.GAS_EXEC_URL = "<?= (function() {{ try {{ return ScriptApp.getService().getUrl(); }} catch(e) {{ return ''; }} }})() ?>";
  </script>
  <script>
{js_data}
  </script>
  <script>
{js_store}
  </script>
  <script>
{js_detail}
  </script>'''

target_detail_scripts = '''  <!-- Scripts -->
  <script src="js/data.js"></script>
  <script src="js/store.js"></script>
  <script src="js/detail.js"></script>'''

if target_detail_scripts in gas_detail_html:
    gas_detail_html = gas_detail_html.replace(target_detail_scripts, gas_detail_scripts)
else:
    gas_detail_html = re.sub(
        r'<!-- Scripts -->\s*<script src="js/data\.js"></script>\s*<script src="js/store\.js"></script>\s*<script src="js/detail\.js"></script>',
        lambda m: gas_detail_scripts,
        gas_detail_html
    )
write_file("detail.html", gas_detail_html)

# 5. Build admin.html for GAS
gas_admin_html = html_admin
gas_admin_html = gas_admin_html.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    f'<style>\n{css_styles}\n</style>'
)
gas_admin_html = gas_admin_html.replace(
    '<link rel="stylesheet" href="css/admin.css">',
    f'<style>\n{css_admin}\n</style>'
)
gas_admin_scripts = f'''  <!-- Server Data Injection -->
  <script>
    window.SERVER_LAPTOPS = <?!= JSON.stringify(laptops) ?>;
    window.GAS_EXEC_URL = "<?= (function() {{ try {{ return ScriptApp.getService().getUrl(); }} catch(e) {{ return ''; }} }})() ?>";
  </script>
  <script>
{js_data}
  </script>
  <script>
{js_store}
  </script>
  <script>
{js_admin}
  </script>'''

target_admin_scripts = '''  <!-- Scripts -->
  <script src="js/data.js"></script>
  <script src="js/store.js"></script>
  <script src="js/admin.js"></script>'''

if target_admin_scripts in gas_admin_html:
    gas_admin_html = gas_admin_html.replace(target_admin_scripts, gas_admin_scripts)
else:
    gas_admin_html = re.sub(
        r'<!-- Scripts -->\s*<script src="js/data\.js"></script>\s*<script src="js/store\.js"></script>\s*<script src="js/admin\.js"></script>',
        lambda m: gas_admin_scripts,
        gas_admin_html
    )
write_file("admin.html", gas_admin_html)

# 6. Build appsscript.json
appsscript_json = '''{
  "timeZone": "Africa/Accra",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
'''
write_file("appsscript.json", appsscript_json)

# 7. Build README.md guide
gas_readme = '''# 🚀 Deploying Manaki Laptop Deals to Google Apps Script & Google Drive

This guide walks you through putting the **Manaki Laptop Deals** website online for free using your Google account (`yankeybuston@gmail.com`), **Google Drive** for your photos, and **Google Apps Script** as the 24/7 web host and database.

---

## 📁 1. Verify Your Google Drive Folder

1. Open [Google Drive](https://drive.google.com) signed in as **`yankeybuston@gmail.com`**.
2. Make sure you have a folder called **`laptops`**.
3. **Make the folder publicly accessible for image viewing:**
   - Right-click the **`laptops`** folder → Click **Share**.
   - Under **General access**, change from **Restricted** to **"Anyone with the link"** (Role: **Viewer**).
   - Click **Done**.
4. Your images inside are named `L 1 A.webp` (or `.jpg`), `L 1 B.webp`, `L 2 A.webp`, etc. The script will automatically link them to each laptop!

---

## ⚡ 2. Create or Update Your Google Apps Script Project

1. Go to [script.google.com](https://script.google.com) signed in as **`yankeybuston@gmail.com`**.
2. Open your project **`Manaki Laptop Store`**.

---

## 📋 3. Paste the Updated Files

In the left panel of Google Apps Script, update these files:

### File 1: `Code.gs`
1. Open `Code.gs`.
2. Select all (`Ctrl + A`) and replace with [`google_apps_script/Code.gs`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/Code.gs).

### File 2: `index.html`
1. Open `index.html`.
2. Select all and replace with [`google_apps_script/index.html`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/index.html).

### File 3: `detail.html`
1. Open `detail.html`.
2. Select all and replace with [`google_apps_script/detail.html`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/detail.html).

### File 4: `admin.html`
1. Open `admin.html`.
2. Select all and replace with [`google_apps_script/admin.html`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/admin.html).

3. Press **`Ctrl + S`** to save.

---

## 🌐 4. Deploy or Update Deployment

1. Click the blue **Deploy** button (top right) → **Manage deployments**.
2. Click the pencil icon ✏️ (Edit) next to your deployment.
3. In the **Version** dropdown, choose **New version**.
4. Click **Deploy**.
5. Open your live Web App URL! All 41 laptops will appear immediately!
'''

write_file("README.md", gas_readme)

print("\n Google Apps Script package built successfully in 'google_apps_script/'!")
