Set-Location $PSScriptRoot
$env:NLTK_DATA = "$PSScriptRoot\.venv\nltk_data;$env:APPDATA\nltk_data"
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000
