/**
 * 热点新闻模块 - 实时热榜聚合
 * 数据源: 60s.viki.moe API (开源、免费、CORS支持)
 */

const Trending = {
    API_BASE: 'https://60s.viki.moe/v2',
    CACHE_KEY: 'wb_trending_cache',
    CACHE_TIME: 10 * 60 * 1000, // 10分钟缓存

    sources: {
        douyin: {
            name: '抖音热榜',
            icon: '🎵',
            url: '/douyin',
            color: '#000000'
        },
        baidu: {
            name: '百度热榜',
            icon: '🔍',
            url: '/baidu/realtime',
            color: '#2932E1'
        },
        rednote: {
            name: '小红书热榜',
            icon: '📕',
            url: '/rednote',
            color: '#FF2442'
        },
        finance: {
            name: '财经股票',
            icon: '📈',
            url: '/36kr',
            color: '#E74C3C'
        }
    },

    currentTab: 'douyin',
    cache: {},

    // 从缓存获取
    getCache(source) {
        try {
            const all = JSON.parse(localStorage.getItem(this.CACHE_KEY) || '{}');
            const item = all[source];
            if (item && Date.now() - item.time < this.CACHE_TIME) {
                return item.data;
            }
        } catch(e) {}
        return null;
    },

    // 保存缓存
    setCache(source, data) {
        try {
            const all = JSON.parse(localStorage.getItem(this.CACHE_KEY) || '{}');
            all[source] = { data, time: Date.now() };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(all));
        } catch(e) {}
    },

    // 获取热榜数据
    async fetch(source) {
        // 先查缓存
        const cached = this.getCache(source);
        if (cached) return cached;

        const cfg = this.sources[source];
        if (!cfg) return [];

        try {
            const resp = await fetch(`${this.API_BASE}${cfg.url}`);
            if (!resp.ok) throw new Error('API error');
            const json = await resp.json();
            const rawItems = json.data || [];
            const items = this.normalize(source, rawItems);
            this.setCache(source, items);
            return items;
        } catch (e) {
            console.error(`Trending.fetch(${source}) error:`, e);
            return [];
        }
    },

    // 标准化数据格式
    normalize(source, rawItems) {
        return rawItems.slice(0, 100).map((item, idx) => {
            let title, heat, url, desc, cover;

            switch (source) {
                case 'douyin':
                    title = item.title || '';
                    heat = item.hot_value ? this.formatHeat(item.hot_value) : '';
                    url = item.link || `https://www.douyin.com/search/${encodeURIComponent(title)}`;
                    cover = item.cover || '';
                    break;
                case 'baidu':
                    title = item.title || '';
                    heat = item.score_desc || (item.score ? this.formatHeat(item.score) : '');
                    url = item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`;
                    desc = item.desc || '';
                    cover = item.cover || '';
                    break;
                case 'rednote':
                    title = item.title || '';
                    heat = item.hot_value ? this.formatHeat(item.hot_value) : '';
                    url = item.link || `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(title)}`;
                    cover = item.cover || '';
                    break;
                case 'finance':
                    title = item.title || '';
                    heat = item.hot_value ? this.formatHeat(item.hot_value) : '';
                    url = item.link || 'https://36kr.com';
                    cover = item.cover || '';
                    break;
                default:
                    title = item.title || '未知';
                    heat = '';
                    url = '#';
            }

            return {
                rank: idx + 1,
                title,
                heat,
                url,
                desc: desc || '',
                cover: cover || '',
                source: source
            };
        });
    },

    // 格式化热度值
    formatHeat(val) {
        if (!val) return '';
        val = parseInt(val);
        if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
        if (val >= 10000) return (val / 10000).toFixed(1) + 'w';
        return val.toString();
    },

    // 渲染热榜列表
    async render(source) {
        this.currentTab = source || this.currentTab;
        const container = document.getElementById('trendingList');
        if (!container) return;

        container.innerHTML = '<div class="trending-loading">⏳ 正在加载热榜数据...</div>';

        // 更新tab高亮
        document.querySelectorAll('.trending-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.source === this.currentTab);
        });

        const items = await this.fetch(this.currentTab);
        const cfg = this.sources[this.currentTab];

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="trending-loading">
                    <p>暂无数据，请稍后重试</p>
                    <button class="btn-primary" style="margin-top:10px" onclick="Trending.render()">🔄 刷新</button>
                </div>`;
            return;
        }

        let html = `
            <div class="trending-refresh">
                <span style="font-size:0.82rem;color:var(--text-muted)">${cfg.icon} ${cfg.name} · 共${items.length}条</span>
                <button onclick="Trending.refresh()">🔄 刷新</button>
            </div>
            <div class="trending-list">
        `;

        items.forEach(item => {
            const rankClass = item.rank <= 3 ? `top${item.rank}` : '';
            html += `
                <a class="trending-item" href="${item.url}" target="_blank" rel="noopener">
                    <span class="trending-rank ${rankClass}">${item.rank}</span>
                    <div class="trending-content">
                        <div class="trending-title">${this.escapeHtml(item.title)}</div>
                        ${item.heat ? `<div class="trending-heat">🔥 ${item.heat}</div>` : ''}
                    </div>
                    <span class="trending-source">${cfg.icon}</span>
                </a>`;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // 刷新（清除缓存重新加载）
    refresh() {
        try {
            const all = JSON.parse(localStorage.getItem(this.CACHE_KEY) || '{}');
            delete all[this.currentTab];
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(all));
        } catch(e) {}
        this.render(this.currentTab);
    },

    // 渲染热榜区域（在推荐页内）
    renderSection() {
        let html = `
            <div class="trending-section">
                <h3 class="section-title">📊 热点新闻 · 实时热榜</h3>
                <div class="trending-tabs">
        `;

        Object.entries(this.sources).forEach(([key, cfg]) => {
            html += `<button class="trending-tab ${key === this.currentTab ? 'active' : ''}" data-source="${key}" onclick="Trending.render('${key}')">${cfg.icon} ${cfg.name}</button>`;
        });

        html += `
                </div>
                <div class="trending-list" id="trendingList">
                    <div class="trending-loading">⏳ 正在加载热榜数据...</div>
                </div>
                <div style="text-align:center;margin-top:10px;font-size:0.72rem;color:var(--text-muted)">
                    数据来源: 60s.viki.moe 开源API · 10分钟缓存 · 点击条目跳转来源
                </div>
            </div>
        `;

        return html;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
