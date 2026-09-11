@echo off
setlocal

rem Edit these two values before running this script.
set "TBA_AUTH_KEY=eEFUlYooyVPeyGj1T07Z3AVTQoDHPM4MssTRD9XLDCapqhGepo1UQCj0OlL7AtqK"
rem Use a space-separated list when recording multiple events.
set "EVENT_CODES=2026azscor"

if "%TBA_AUTH_KEY%"=="REPLACE_WITH_YOUR_TBA_AUTH_KEY" (
  echo Please edit TBA_AUTH_KEY in this file before running it.
  exit /b 1
)
if "%EVENT_CODES%"=="REPLACE_WITH_EVENT_CODES" (
  echo Please edit EVENT_CODES in this file before running it.
  exit /b 1
)

pushd "%~dp0.."
node eventSimulator\recorder.mjs %EVENT_CODES%
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
