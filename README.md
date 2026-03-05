# Meme币追踪器

实时追踪币安热门Meme币价格

## 在线预览

### 方案1：Netlify 一键部署（推荐）
1. 打开 https://app.netlify.com/drop
2. 把 `meme-tracker` 文件夹直接拖进去
3. 自动获得网址，全球可访问

### 方案2：Vercel 部署
1. 把代码推送到 GitHub
2. 登录 https://vercel.com
3. 导入 GitHub 仓库，自动部署

### 方案3：本地使用
1. 开代理/VPN
2. 直接双击 `index.html` 打开

## 功能
- 实时连接币安 WebSocket
- 追踪 DOGE、SHIB、PEPE、FLOKI 等热门Meme币
- 按涨跌幅排序，带迷你走势图
- 24h 交易量和成交额

## 技术栈
- 纯 HTML/CSS/JavaScript
- 币安官方 WebSocket API
- 无需后端