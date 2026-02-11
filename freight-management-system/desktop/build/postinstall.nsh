!macro customInstall
  DetailPrint "Configuring shared data workspace (shared_db_manager.exe)"
  ${If} ${FileExists} "$INSTDIR\resources\tools\shared_db_manager.exe"
    nsExec::ExecToLog '"$INSTDIR\resources\tools\shared_db_manager.exe"'
  ${Else}
    DetailPrint "shared_db_manager.exe not found in resources/tools"
  ${EndIf}
!macroend
