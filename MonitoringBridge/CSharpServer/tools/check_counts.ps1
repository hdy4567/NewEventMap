$path = 'c:\YOON\CSrepos\NewEventMap\MonitoringBridge\CSharpServer\global_knowledge_cache.json'
if (Test-Path $path) {
    $json = Get-Content $path -Raw | ConvertFrom-Json
    $json.PSObject.Properties | ForEach-Object {
        Write-Host "$($_.Name): $($_.Value.Count)"
    }
} else {
    Write-Host "File not found"
}
