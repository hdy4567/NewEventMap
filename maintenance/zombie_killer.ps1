# Antigravity Zombie Killer
# This script kills background processes (node, dotnet, chrome, msedge) that:
# 1. Have Antigravity as a parent process but might be orphaned
# 2. Or simply cleanup logic to ensure no leaked processes exist from previous runs.

function Clean-AntigravityZombies {
    $processesToWatch = "node", "dotnet", "chrome", "msedge", "msedgewebview2", "chromedriver"
    
    # Identify Antigravity parent process
    $antigravity = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue
    
    if ($null -eq $antigravity) {
        Write-Host "Antigravity process not found. Cleaning up all related background processes..." -ForegroundColor Yellow
        # If Antigravity is not running, we might want to kill ALL related processes that are not system-critical
        # But let's be safe and only kill ones that are likely leaked.
    } else {
        Write-Host "Antigravity found (IDs: $($antigravity.Id)). Cleaning up children..." -ForegroundColor Green
    }
    
    $allProcesses = Get-CimInstance Win32_Process
    
    foreach ($procName in $processesToWatch) {
        $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
            $winProc = $allProcesses | Where-Object { $_.ProcessId -eq $p.Id }
            $parentId = $winProc.ParentProcessId
            
            # Check if parent exists
            $parent = Get-Process -Id $parentId -ErrorAction SilentlyContinue
            
            if ($null -eq $parent) {
                Write-Host "Killing orphaned $procName (PID: $($p.Id))" -ForegroundColor Cyan
                Stop-Process -Id $p.Id -Force
            } elseif ($antigravity -and ($antigravity.Id -contains $parentId)) {
                # This is a direct child of Antigravity. 
                # Usually we want these running, but if the user requested "periodic cleaning", 
                # they might want us to kill idle ones or ones that have been running too long.
                # For now, let's just log them.
                Write-Host "Found child of Antigravity: $procName (PID: $($p.Id))" -ForegroundColor Gray
            }
        }
    }
}

# Run once
Clean-AntigravityZombies
