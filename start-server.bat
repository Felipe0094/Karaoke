@echo off
title Servidor Karaoke
color 0A
echo ==========================================
echo      INICIANDO SERVIDOR DO KARAOKE
echo ==========================================
echo.
echo Navegando para a pasta do projeto...
:: Garante o caminho absoluto para funcionar do Desktop
cd /d "C:\Users\felip\Desktop\Karaoke-master"

echo.
echo Verificando instalacao...
if not exist node_modules (
    echo Instalando dependencias (apenas na primeira vez)...
    call npm install
)

echo.
echo Iniciando o servidor...
echo Mantenha esta janela aberta para que o Karaoke funcione.
echo Voce pode minimiza-la.
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo O servidor parou com erro!
    echo Verifique se ha outra janela aberta usando a porta 3001.
    pause
)
pause