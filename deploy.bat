@echo off
echo ========================================
echo   ARCHITECTURE SURVEY - DEPLOY SCRIPT
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from https://nodejs.org
    echo Then run this script again.
    pause
    exit /b 1
)

echo Node.js found! Installing dependencies...
npm install

echo Installing Wrangler CLI...
npm install -g wrangler

echo Building project...
npm run build

echo.
echo ========================================
echo   READY TO DEPLOY!
echo ========================================
echo.
echo Next steps:
echo 1. wrangler login
echo 2. wrangler d1 create architecture-survey-production
echo 3. wrangler pages project create architecture-survey-app
echo 4. wrangler pages deploy dist --project-name architecture-survey-app
echo.
echo Your app will be live at:
echo https://architecture-survey-app.pages.dev
echo.
pause