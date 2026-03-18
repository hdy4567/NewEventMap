$path = 'c:\YOON\CSrepos\NewEventMap\MonitoringBridge\CSharpServer\global_knowledge_cache.json'
if (Test-Path $path) {
    $json = Get-Content $path -Raw | ConvertFrom-Json
    $props = $json.PSObject.Properties
    foreach ($p in $props) {
        if ($p.Name -like "*제주*") {
            Write-Host "FOUND_KEY: $($p.Name) (Count: $($p.Value.Count))"
            if ($p.Value.Count -gt 50) {
                $p.Value = $p.Value | Select-Object -First 50
                Write-Host "PRUNED_TO_50"
            }
        }
    }
    $json | ConvertTo-Json -Depth 20 | Out-File $path -Encoding utf8
    Write-Host "SAVE_COMPLETE"
}
