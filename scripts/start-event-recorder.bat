@echo off
setlocal

rem Edit these two values before running this script.
set "TBA_AUTH_KEY=eEFUlYooyVPeyGj1T07Z3AVTQoDHPM4MssTRD9XLDCapqhGepo1UQCj0OlL7AtqK"
set "EVENT_CODE=2026cc"

if "%TBA_AUTH_KEY%"=="REPLACE_WITH_YOUR_TBA_AUTH_KEY" (
  echo Please edit TBA_AUTH_KEY in this file before running it.
  exit /b 1
)
if "%EVENT_CODE%"=="REPLACE_WITH_EVENT_CODE" (
  echo Please edit EVENT_CODE in this file before running it.
  exit /b 1
)

pushd "%~dp0.."
node eventSimulator\recorder.mjs "%EVENT_CODE%"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
