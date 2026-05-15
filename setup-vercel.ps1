$auth = Get-Content "C:\Users\vanzy\AppData\Roaming\com.vercel.cli\Data\auth.json" | ConvertFrom-Json
$token = $auth.token
$teamId = "team_4wEdQc9zvzNhLuPTcyYHP4Es"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

function Set-RootDirectory($projectId, $rootDir) {
    $body = "{`"rootDirectory`":`"$rootDir`"}"
    $url = "https://api.vercel.com/v9/projects/$projectId" + "?teamId=$teamId"
    $resp = Invoke-RestMethod -Method PATCH -Uri $url -Headers $headers -Body $body
    Write-Host "  rootDirectory -> $($resp.rootDirectory)"
}

function New-VercelProject($name) {
    $body = "{`"name`":`"$name`"}"
    $url = "https://api.vercel.com/v9/projects" + "?teamId=$teamId"
    $resp = Invoke-RestMethod -Method POST -Uri $url -Headers $headers -Body $body
    Write-Host "  Created project: $($resp.name) / $($resp.id)"
    return $resp.id
}

function Get-ProjectId($name) {
    $url = "https://api.vercel.com/v9/projects/$name" + "?teamId=$teamId"
    $resp = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
    return $resp.id
}

# --- borrower (already exists) ---
Write-Host "Configuring borrower..."
$borrowerId = Get-ProjectId "borrower"
Set-RootDirectory $borrowerId "apps/borrower"

# --- ops ---
Write-Host "Configuring ops..."
try {
    $opsId = Get-ProjectId "capstack-ops"
} catch {
    $opsId = New-VercelProject "capstack-ops"
}
Set-RootDirectory $opsId "apps/ops"

# --- partner ---
Write-Host "Configuring partner..."
try {
    $partnerId = Get-ProjectId "capstack-partner"
} catch {
    $partnerId = New-VercelProject "capstack-partner"
}
Set-RootDirectory $partnerId "apps/partner"

# --- api ---
Write-Host "Configuring api..."
try {
    $apiId = Get-ProjectId "capstack-api"
} catch {
    $apiId = New-VercelProject "capstack-api"
}
Set-RootDirectory $apiId "apps/api"

Write-Host ""
Write-Host "Done. Project IDs:" 
Write-Host "  borrower : $borrowerId"
Write-Host "  ops      : $opsId"
Write-Host "  partner  : $partnerId"
Write-Host "  api      : $apiId"

# Save IDs for the deploy script
@{
    borrower = $borrowerId
    ops = $opsId
    partner = $partnerId
    api = $apiId
} | ConvertTo-Json | Set-Content "vercel-project-ids.json"
