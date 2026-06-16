#!/usr/bin/env pwsh
# Opens Render one-click deploy for MealPlan.
# After deploy, set these secrets in the Render dashboard:
#   GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_ID (same value), OPENAI_API_KEY, CORS_ORIGINS
$repo = "https://github.com/hayeso/MealPlan"
$url = "https://dashboard.render.com/blueprint/new?repo=$repo"
Write-Host "Opening Render Blueprint deploy for $repo"
Write-Host ""
Write-Host "Before first deploy, create Google OAuth credentials:"
Write-Host "  https://console.cloud.google.com/apis/credentials"
Write-Host ""
Write-Host "After deploy, add your Render URL to Google authorized origins."
Start-Process $url
