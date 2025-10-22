@echo off
chcp 65001 > nul
cd /d C:\Users\heidari\Desktop\robat
cls
echo ====================================
echo     ربات واتساپ در حال اجرا...
echo ====================================
echo.
echo مسیر فعلی: %CD%
echo.
node index.js
echo.
echo ====================================
pause