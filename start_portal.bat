@echo off
echo Starting University Portal Services...

:: Start Backend
start "LMS Backend" cmd /c "cd Backend && npm start"

:: Start Agent Chatbot
start "LMS Agent Chatbot" cmd /c "cd agent-chatbot && npm start"

:: Start Frontend
start "LMS Frontend" cmd /c "cd Frontend && npm run dev"

echo All services are starting in separate windows.
pause
