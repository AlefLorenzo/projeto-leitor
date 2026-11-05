Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c node """ & strPath & "\scripts\auto-sync-git.js""", 0, False

