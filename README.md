# 💻 Manaki Laptop Deals - Modern Laptop Marketing Website

A modern, minimal, mobile-first static laptop marketing website with an app-like feel, comprehensive hardware specifications, high-resolution photo galleries, direct WhatsApp ordering (0543862551), and a secure Admin Portal with client-side JavaScript CRUD management.

---

## 🚀 Features

### 1. 📱 App-Like Mobile & Desktop Experience (`index.html`)
- **Mobile Bottom Navigation Bar**: Quick touch access to **Explore**, **Search**, **Saved Favorites**, **WhatsApp Direct (0543862551)**, and **Admin Portal**.
- **Touch-Friendly Multi-Photo Previews**: Swipe or click thumbnails to view all angles of each machine right on the card.
- **Glassmorphic Design**: Dark-mode aesthetic inspired by modern tech hubs (Linear / Apple / Vercel) with smooth micro-interactions and tactile feedback.
- **Pill Filter Bar**: Filter by brand (**Dell, HP, Lenovo, Apple MacBook, Samsung, Acer, Microsoft**) or by hardware feature (**Touchscreen, 360° Flip, Dedicated GPU, 16GB+ RAM, Under GH₵4,000, In Stock, Hot Deals**).
- **Instant Live Search**: Real-time filtering across titles, processors, RAM sizes, and features without page reloads.
- **Sorting**: Sort by Featured Picks, Price (Low to High), Price (High to Low), RAM, Storage, and Recently Added.

### 2. 🔍 Dedicated Laptop Detail Pages (`detail.html?id=X`)
- **Direct Shareable Links**: Share individual laptop links directly on WhatsApp, Telegram, or social media.
- **Multi-Photo Interactive Gallery**: Main high-res viewer with thumbnail carousel and **Tap-to-Zoom Lightbox Modal** for inspecting laptop condition and ports.
- **Full Hardware Breakdown**:
  - Processor Model, Generation & Clock Speed
  - RAM & NVMe SSD Storage
  - Display Size & Touchscreen support
  - Dedicated vs Integrated Graphics (GPU)
  - Backlit Keyboard, Fingerprint Security, Battery Condition
  - Included Accessories (Original OEM Charger)
- **Direct WhatsApp Order CTA**: One-tap ordering via **0543862551** (`wa.me/233543862551`) with pre-filled message including model name, ID number, and Ghana Cedis price.
- **"Similar Laptops You Might Like"**: Automatic smart recommendation rail at the bottom.

### 3. 🔐 Admin Portal & Pure JavaScript CRUD (`manaki_admin.html`)
- **Direct Access URL**: Intentionally unlinked from the public customer storefront for security and privacy. Accessible directly at: `http://localhost:8000/manaki_admin.html`.
- **Secure Password Gate**: Protected by static password:
  ```
  Fakeme@12345
  ```
- **Session Persistence**: Session stored securely in `sessionStorage` / `localStorage`.
- **Live Inventory KPI Counters**:
  - Total Models in Catalog
  - Available In Stock
  - Sold Out / Reserved
  - Total Active Inventory Valuation (in GH₵)
- **WhatsApp Phone Number Setting**: Live indicator and one-click update button to change the seller WhatsApp number anytime without touching code!
- **Full CRUD Capabilities**:
  - **Create**: Add new laptops with rich hardware specs, feature checkboxes, and custom photos (via image URLs or uploading image files from your computer).
  - **Read**: Live filterable data table with photo thumbnails and spec summaries.
  - **Update**:
    - Full editing modal for any laptop field.
    - **In-line Quick Price Editor**: Update prices directly in the table by typing and pressing Enter.
    - **Instant Status Switch**: Click the status badge to toggle between `● Available` and `● Sold Out`.
  - **Delete**: Remove listings with confirmation dialog.
  - **Reset to Defaults**: One-click restore back to the original 41 laptops shipment data.
  - **Export & Import JSON**: Download database backups or restore from a backup file.
  - **Google Drive & Cloud Sync**: Scan Google Drive folder `laptops` in `yankeybuston@gmail.com` and automatically map all 267+ photos to laptops.

---

## ☁️ 🌐 Online Hosting with Google Apps Script & Google Drive

You can run this entire website **100% online for free** 24/7 using **Google Apps Script** as the host/database and **Google Drive** for your pictures!

### How it works:
1. **Google Drive**: You already have your images inside the folder named **`laptops`** under **`yankeybuston@gmail.com`**. Make sure the folder sharing is set to **"Anyone with the link can view"**.
2. **Google Apps Script**:
   - Go to [script.google.com](https://script.google.com) signed in as **`yankeybuston@gmail.com`**.
   - Create a new project named **`Manaki Laptop Store`**.
   - Copy the ready-made files from the [`google_apps_script/`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/) folder:
     - `Code.gs`
     - `index.html`
     - `detail.html`
     - `admin.html`
   - Run the function **`setupStore`** once to authorize Google Drive & Sheets permissions.
   - Click **Deploy** → **New deployment** → **Web app** (Execute as: **Me**, Who has access: **Anyone**).
   - Google gives you a live permanent URL (e.g. `https://script.google.com/macros/s/AKfycb.../exec`)!
3. **Google Sheets Database**: The script automatically creates and manages a Google Sheet named **`Manaki_Laptop_Inventory`** in your Drive, so you can edit stock and prices either through the Admin Web Portal or right in Google Sheets!

Detailed step-by-step instructions are available in [`google_apps_script/README.md`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/README.md).

---

## 🗂️ Project Structure

```text
laptop_marketing/
├── index.html            # Main storefront & catalog feed
├── detail.html           # Dedicated product details page (?id=X)
├── manaki_admin.html     # Admin login & CRUD portal (unlinked from storefront)
├── start-server.bat      # One-click local web server launcher
├── build_catalog.py      # Parser script from docx files & images
├── build_gas.py          # Compiler script that packages Google Apps Script files
├── google_apps_script/   # Ready-to-deploy Google Apps Script online package
│   ├── Code.gs           # Server script: Drive scanner, Google Sheet DB & API router
│   ├── index.html        # Online customer storefront template
│   ├── detail.html       # Online product detail page template
│   ├── admin.html        # Online Polaris Admin portal template
│   ├── appsscript.json   # Apps Script manifest with Drive/Sheets permissions
│   └── README.md         # Deployment walkthrough for yankeybuston@gmail.com
├── css/
│   ├── styles.css        # Main app-like styles, responsive layout, dark theme
│   └── admin.css         # Admin dashboard, data table, and modal styles
├── js/
│   ├── data.js           # Default catalog (41 laptops with 285 verified photos)
│   ├── store.js          # LocalStorage CRUD manager, RouteHelper, Drive image fallback & CloudSync
│   ├── app.js            # Home page controller (search, filter pills, sorting)
│   ├── detail.js         # Detail page controller (photo gallery, specs, lightbox)
│   └── admin.js          # Admin dashboard controller (auth check, CRUD actions, Drive sync)
├── data/
│   └── laptops.json      # Structured JSON database
└── images/               # Junction link to Akiola Laptop pictures folder
```

---

## 💡 How to Launch

1. **Option A (Online via Google Apps Script - Recommended)**:
   - Follow [`google_apps_script/README.md`](file:///c:/Users/busto/OneDrive/Desktop/WEB%20PROJECTS/laptop_marketing/google_apps_script/README.md) to deploy your Web App.
   - Access from anywhere in the world on phone, tablet, or PC!

2. **Option B (One-Click Local Launcher)**:
   - Double-click `start-server.bat` in the project folder.
   - It will automatically start a local server at `http://localhost:8000` and open your default browser.

3. **Admin Login**:
   - Web App: `https://script.google.com/macros/s/.../exec?page=admin`
   - Local: `http://localhost:8000/manaki_admin.html`
   

