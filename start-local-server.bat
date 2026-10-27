@echo off
REM Double-click to preview the site at http://localhost:8080 (needs Python installed).
cd /d "%~dp0"
start "" http://localhost:8080
python -m http.server 8080 || py -m http.server 8080
pause
