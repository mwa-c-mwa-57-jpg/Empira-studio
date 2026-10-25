@echo off
rem Ouvre l'overlay dans une fenetre Chrome verticale, a capturer dans TikTok LIVE Studio.
rem Les options --disable-... empechent Chrome de figer l'overlay quand la fenetre est cachee derriere une autre.
set URL=http://localhost:3000/overlay.html
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe
if exist "%CHROME%" (
  start "" "%CHROME%" --app=%URL% --window-size=540,990 --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --user-data-dir="%TEMP%\la-grimpe-overlay"
) else (
  start "" msedge --app=%URL% --window-size=540,990 --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows
)
