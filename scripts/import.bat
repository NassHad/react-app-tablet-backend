@echo off
echo Starting Brand and Model Import...
echo.

REM Check if ts-node is available
node -e "require('ts-node/register/transpile-only')" 2>nul
if %errorlevel% neq 0 (
    echo ts-node is missing. Installing dependencies...
    npm install -D ts-node typescript @types/node
    if %errorlevel% neq 0 (
        echo Failed to install dependencies. Please run: npm install -D ts-node typescript @types/node
        pause
        exit /b 1
    )
)

echo.
echo Choose import option:
echo 1. Import brands and models (draft mode)
echo 2. Import and auto-publish
echo 3. Clear existing data and import fresh
echo 4. Clear existing data, import and auto-publish
echo 5. Test import results
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo Running import in draft mode...
    node scripts/import-brands-and-models.cjs
) else if "%choice%"=="2" (
    echo Running import with auto-publish...
    set PUBLISH=true
    node scripts/import-brands-and-models.cjs
) else if "%choice%"=="3" (
    echo Clearing existing data and importing fresh...
    set CLEAR_EXISTING=true
    node scripts/import-brands-and-models.cjs
) else if "%choice%"=="4" (
    echo Clearing existing data, importing and auto-publishing...
    set CLEAR_EXISTING=true
    set PUBLISH=true
    node scripts/import-brands-and-models.cjs
) else if "%choice%"=="5" (
    echo Testing import results...
    node scripts/test-import.cjs
) else (
    echo Invalid choice. Please run the script again.
    pause
    exit /b 1
)

echo.
echo Import completed!
pause
