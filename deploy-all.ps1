$auth = Get-Content "C:\Users\vanzy\AppData\Roaming\com.vercel.cli\Data\auth.json" | ConvertFrom-Json
$token = $auth.token
$teamId = "team_4wEdQc9zvzNhLuPTcyYHP4Es"
$orgId = $teamId

$ids = Get-Content "vercel-project-ids.json" | ConvertFrom-Json

$apps = @(
    @{ name = "borrower";        projectId = $ids.borrower  },
    @{ name = "capstack-ops";    projectId = $ids.ops       },
    @{ name = "capstack-partner";projectId = $ids.partner   },
    @{ name = "capstack-api";    projectId = $ids.api       }
)

# Write project.json files from REPO ROOT (rootDirectory is relative to repo root)
$repoRoot = $PSScriptRoot

foreach ($app in $apps) {
    Write-Host ""
    Write-Host "=== Deploying $($app.name) ==="

    # Put .vercel/project.json at repo root pointing to this project
    $dotVercel = Join-Path $repoRoot ".vercel"
    New-Item -ItemType Directory -Force -Path $dotVercel | Out-Null
    @{
        projectId = $app.projectId
        orgId     = $orgId
    } | ConvertTo-Json | Set-Content (Join-Path $dotVercel "project.json")

    # Deploy from repo root — Vercel will use rootDirectory from the project settings
    vercel deploy --prod --yes --token $token 2>&1
}

# Clean up root .vercel
Remove-Item -Recurse -Force (Join-Path $repoRoot ".vercel") -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "All deployments complete!"
