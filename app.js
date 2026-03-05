/**
 * Meme币实时追踪器
 * 使用币安WebSocket API获取实时数据
 */

// Meme币配置 - 币安USDT交易对
const MEME_COINS = [
    { symbol: 'DOGEUSDT', name: 'Dogecoin', icon: 'Ð', color: '#c2a633' },
    { symbol: 'SHIBUSDT', name: 'Shiba Inu', icon: 'S', color: '#ff6b6b' },
    { symbol: 'PEPEUSDT', name: 'Pepe', icon: 'P', color: '#00d26a' },
    { symbol: 'FLOKIUSDT', name: 'Floki', icon: 'F', color: '#ffd700' },
    { symbol: 'BONKUSDT', name: 'Bonk', icon: 'B', color: '#ffa500' },
    { symbol: 'WIFUSDT', name: 'dogwifhat', icon: 'W', color: '#9b59b6' },
    { symbol: 'BOMEUSDT', name: 'BOOK OF MEME', icon: 'M', color: '#3498db' },
    { symbol: 'MEMEUSDT', name: 'Memecoin', icon: 'M', color: '#e74c3c' },
    { symbol: 'PEOPLEUSDT', name: 'ConstitutionDAO', icon: 'P', color: '#2ecc71' }
];

// 价格历史数据存储
const priceHistory = {};
const MAX_HISTORY = 50;

// 当前币数据
let coinsData = {};
let ws = null;
let isConnected = false;

// DOM元素
const container = document.getElementById('coinsContainer');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// 检查值是否有效
function isValidNumber(val) {
    return val !== undefined && val !== null && !isNaN(parseFloat(val)) && isFinite(val);
}

// 格式化价格
function formatPrice(price) {
    if (!isValidNumber(price)) return '--';
    const p = parseFloat(price);
    if (p >= 1) {
        return p.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } else if (p >= 0.01) {
        return p.toFixed(6);
    } else {
        return p.toFixed(8);
    }
}

// 格式化交易量
function formatVolume(volume) {
    if (!isValidNumber(volume)) return '--';
    const v = parseFloat(volume);
    if (v >= 1e9) {
        return (v / 1e9).toFixed(2) + 'B';
    } else if (v >= 1e6) {
        return (v / 1e6).toFixed(2) + 'M';
    } else if (v >= 1e3) {
        return (v / 1e3).toFixed(2) + 'K';
    }
    return v.toFixed(2);
}

// 生成迷你图SVG
function generateSparkline(data, isPositive) {
    if (!data || data.length < 2) return '';
    
    const validData = data.filter(isValidNumber);
    if (validData.length < 2) return '';
    
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const range = max - min || 1;
    
    const width = 100;
    const height = 40;
    const padding = 2;
    
    const points = validData.map((price, i) => {
        const x = (i / (validData.length - 1)) * width;
        const y = height - padding - ((parseFloat(price) - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');
    
    const color = isPositive ? '#00d26a' : '#ff4757';
    
    return `
        <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <polyline
                fill="none"
                stroke="${color}"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                points="${points}"
                opacity="0.8"
            />
        </svg>
    `;
}

// 创建币卡
function createCoinCard(coin, data, index) {
    const price = isValidNumber(data?.lastPrice) ? parseFloat(data.lastPrice) : null;
    const change = isValidNumber(data?.priceChangePercent) ? parseFloat(data.priceChangePercent) : 0;
    const isPositive = change >= 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    const arrow = isPositive ? '↗' : '↘';
    
    // 更新价格历史
    if (!priceHistory[coin.symbol]) {
        priceHistory[coin.symbol] = [];
    }
    if (price !== null) {
        priceHistory[coin.symbol].push(price);
        if (priceHistory[coin.symbol].length > MAX_HISTORY) {
            priceHistory[coin.symbol].shift();
        }
    }
    
    return `
        <div class="coin-card" data-symbol="${coin.symbol}" style="position:relative">
            <div class="rank-badge">${index + 1}</div>
            <div class="coin-header">
                <div class="coin-icon" style="background: ${coin.color}">${coin.icon}</div>
                <div class="coin-info">
                    <h3>${coin.name}</h3>
                    <span>${coin.symbol.replace('USDT', '')}/USDT</span>
                </div>
            </div>
            
            <div class="coin-price" data-price="${data?.lastPrice || ''}">
                ${price !== null ? '$' + formatPrice(price) : '加载中...'}
            </div>
            
            <div class="coin-change ${changeClass}">
                ${arrow} ${Math.abs(change).toFixed(2)}%
            </div>
            
            <div class="sparkline">
                ${generateSparkline(priceHistory[coin.symbol], isPositive)}
            </div>
            
            <div class="coin-stats">
                <div class="stat">
                    <div class="stat-value">$${formatVolume(data?.volume)}</div>
                    <div class="stat-label">24h 交易量</div>
                </div>
                <div class="stat">
                    <div class="stat-value">$${formatVolume(data?.quoteVolume)}</div>
                    <div class="stat-label">24h 成交额</div>
                </div>
            </div>
        </div>
    `;
}

// 更新UI
function updateUI() {
    // 按涨跌幅排序（有数据的在前）
    const sortedCoins = MEME_COINS.map(coin => ({
        coin,
        data: coinsData[coin.symbol]
    })).sort((a, b) => {
        // 有数据的排前面
        const hasDataA = a.data && isValidNumber(a.data.priceChangePercent);
        const hasDataB = b.data && isValidNumber(b.data.priceChangePercent);
        if (hasDataA && !hasDataB) return -1;
        if (!hasDataA && hasDataB) return 1;
        if (!hasDataA && !hasDataB) return 0;
        
        const changeA = parseFloat(a.data.priceChangePercent);
        const changeB = parseFloat(b.data.priceChangePercent);
        return changeB - changeA;
    });
    
    container.innerHTML = sortedCoins.map(({ coin, data }, index) => 
        createCoinCard(coin, data, index)
    ).join('');
}

// 连接WebSocket
function connect() {
    // 币安WebSocket 24hr ticker流
    const streams = MEME_COINS.map(c => c.symbol.toLowerCase() + '@ticker').join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket 已连接');
        isConnected = true;
        statusDot.classList.add('connected');
        statusText.textContent = '实时连接中';
    };
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            const { data, stream } = message;
            
            if (data && data.s) {
                coinsData[data.s] = data;
                
                // 更新UI（节流，每300ms最多一次）
                if (!window.updateTimeout) {
                    window.updateTimeout = setTimeout(() => {
                        updateUI();
                        window.updateTimeout = null;
                    }, 300);
                }
            }
        } catch (e) {
            console.error('解析消息失败:', e);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        statusDot.classList.remove('connected');
        statusText.textContent = '连接失败，可能需要科学上网';
    };
    
    ws.onclose = () => {
        console.log('WebSocket 断开，5秒后重连...');
        isConnected = false;
        statusDot.classList.remove('connected');
        statusText.textContent = '断开重连中...';
        setTimeout(connect, 5000);
    };
}

// 获取初始数据（REST API）
async function fetchInitialData() {
    try {
        // 使用 CORS 代理或直接请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('API 返回错误: ' + response.status);
        }
        
        const allTickers = await response.json();
        
        // 过滤出meme币
        let foundCount = 0;
        MEME_COINS.forEach(coin => {
            const ticker = allTickers.find(t => t.symbol === coin.symbol);
            if (ticker) {
                coinsData[coin.symbol] = ticker;
                if (isValidNumber(ticker.lastPrice)) {
                    priceHistory[coin.symbol] = [parseFloat(ticker.lastPrice)];
                }
                foundCount++;
            }
        });
        
        if (foundCount === 0) {
            throw new Error('未找到任何币种数据');
        }
        
        updateUI();
    } catch (error) {
        console.error('获取初始数据失败:', error);
        // 显示骨架屏，等待WebSocket
        container.innerHTML = MEME_COINS.map((coin, index) => `
            <div class="coin-card" style="position:relative; opacity: 0.7;">
                <div class="rank-badge">${index + 1}</div>
                <div class="coin-header">
                    <div class="coin-icon" style="background: ${coin.color}">${coin.icon}</div>
                    <div class="coin-info">
                        <h3>${coin.name}</h3>
                        <span>${coin.symbol.replace('USDT', '')}/USDT</span>
                    </div>
                </div>
                <div class="coin-price">等待连接...</div>
                <div class="coin-change" style="background: rgba(255,255,255,0.1); color: #888;">--</div>
                <div class="sparkline" style="height: 40px;"></div>
                <div class="coin-stats">
                    <div class="stat"><div class="stat-value">--</div><div class="stat-label">24h 交易量</div></div>
                    <div class="stat"><div class="stat-value">--</div><div class="stat-label">24h 成交额</div></div>
                </div>
            </div>
        `).join('');
    }
}

// 初始化
async function init() {
    // 先显示加载状态
    container.innerHTML = '<div class="loading">正在连接币安服务器...</div>';
    
    // 尝试获取REST数据
    await fetchInitialData();
    
    // 连接WebSocket（无论REST是否成功）
    connect();
}

// 启动
init();

// 页面卸载时关闭WebSocket
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
});