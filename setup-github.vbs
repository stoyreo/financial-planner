' VBScript to execute setup-github.bat
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory of this script
strScriptPath = objShell.CurrentDirectory
strBatchFile = strScriptPath & "\setup-github.bat"

' Check if batch file exists
If objFSO.FileExists(strBatchFile) Then
    ' Execute the batch file
    objShell.Run strBatchFile, 1, True
Else
    MsgBox "Error: setup-github.bat not found in " & strScriptPath
End If
