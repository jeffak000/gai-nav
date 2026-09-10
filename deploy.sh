#!/usr/bin/env bash
# gai溜子导航站 · 一键部署到 EdgeOne Makers
#
# 用法:
#   ./deploy.sh <MAKERS_API_TOKEN> [项目名]
#
# 说明:
#   MAKERS_API_TOKEN 在 EdgeOne 控制台 → Makers → 创建 API Token 获取
#   项目名默认 gai-nav，可自定义
#
# 部署完成后请到 EdgeOne 控制台给项目设置环境变量 APP_PASSWORD=你的密码
# （不设置则默认登录密码为 admin，请务必修改）
set -e
TOKEN="${1:?缺少参数：EdgeOne Makers API Token}"
NAME="${2:-gai-nav}"

echo ">> 开始部署到 EdgeOne Makers（项目名: $NAME）"
npx --yes edgeone makers deploy -n "$NAME" -t "$TOKEN"

echo ""
echo "✅ 部署完成！"
echo ">> 下一步：到 EdgeOne 控制台给项目设置环境变量 APP_PASSWORD=你的密码"
echo "   （不设置则默认登录密码为 admin，请务必修改）"
