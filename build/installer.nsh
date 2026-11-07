; Tama installer hooks (SHIP-1, D-059), included by electron-builder's NSIS script.
; The uninstaller asks whether to delete her data. It never asks (and never deletes) during an update, and a silent
; uninstall (/S) keeps the data.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete your Tamas and Tama's settings on this PC?$\r$\n$\r$\nThis removes her memories, diary, bond and your settings in$\r$\n$APPDATA\Tama$\r$\n$\r$\nChoose No to keep them for a later install (or export her first: My Tamas > Export)." /SD IDNO IDYES tamaDeleteData IDNO tamaKeepData
    tamaDeleteData:
      SetShellVarContext current
      RMDir /r "$APPDATA\Tama"
    tamaKeepData:
  ${endIf}
!macroend
