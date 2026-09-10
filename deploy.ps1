# gai溜子导航站 · 一键部署到 EdgeOne Makers (Windows)
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Name = "gai-nav"
)
Write-Host ">> 开始部署到 EdgeOne Makers（项目名: $Name）"
npx --yes edgeone makers deploy -n $Name -t $Token
Write-Host ""
Write-Host "✅ 部署完成！请到 EdgeOne 控制台给项目设置环境变量 APP_PASSWORD=你的密码（默认 admin，请务必修改）。"
