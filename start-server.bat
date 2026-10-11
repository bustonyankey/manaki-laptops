@echo off
title Manaki Laptop Deals - Local Marketing Web Server
echo ========================================================
echo        MANAKI LAPTOP DEALS MARKETING WEBSITE
echo ========================================================
echo.
echo Starting local web server on port 8000...
echo.
echo Website will open automatically in your browser.
echo WhatsApp Orders: 0543862551
echo Admin Portal:    http://localhost:8000/manaki_admin.html (Password: Fakeme@12345)
echo.
echo Press Ctrl+C in this terminal window to stop the server.
echo ========================================================
echo.

start "" "http://localhost:8000/index.html"
python -m http.server 8000
pause
