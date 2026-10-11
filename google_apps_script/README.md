# 🚀 Deploying Manaki Laptop Deals to Google Apps Script & Google Drive

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
