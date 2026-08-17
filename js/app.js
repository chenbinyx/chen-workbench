/**
 * 主应用逻辑 v3
 */

let currentTab = 'dashboard';
let financeType = 'income';
let financeHistoryMonth = new Date();   // 收支历史日历当前显示的月份
let financeHistoryMode = 'income';      // 日历显示模式：income / expense
let financeHistorySelectedDate = null;  // 当前展开明细的日期
let financeHistoryOpen = true;          // 历史(日历)是否展开
let financeCalView = 'day';             // 日历视图：day(日) / month(月)
let currentFinanceCategory = '';        // 当前选中的收支分类
let inspirationFilter = 'all';
let diaryView = 'day';
let recTab = 'trending';
let diaryImageData = [];
let currentPlanDate = Store.getDateStr(); // 每日计划页当前查看的日期（默认今天）

// ==================== 计时器状态 ====================
let timerState = {
    mode: 'countdown',     // 'countdown' or 'stopwatch'
    duration: 0,           // target seconds (countdown)
    elapsed: 0,            // elapsed seconds
    running: false,
    intervalId: null
};

// ==================== textarea 自动高度 ====================
function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}
// 全局监听：任何 textarea 输入时自动调整高度
document.addEventListener('input', function(e) {
    if (e.target.tagName === 'TEXTAREA') {
        autoResizeTextarea(e.target);
    }
});

// ==================== 手机端输入框聚焦展开 ====================
// 手机端：聚焦时展开为两行 + 浮出效果；防止页面滚动
function setupMobileInputFocus() {
    var savedScrollY = 0;

    // 在 focus 之前（pointerdown/mousedown）记录滚动位置
    document.addEventListener('pointerdown', function(e) {
        var ta = e.target;
        if (ta.tagName !== 'TEXTAREA') return;
        if (ta.id === 'modalTextarea' || ta.id === 'titleEditInput') return;
        if (!ta.classList.contains('text-input') && !ta.classList.contains('dash-quick-input-field')) return;
        savedScrollY = window.scrollY;
    });

    document.addEventListener('focusin', function(e) {
        var ta = e.target;
        if (ta.tagName !== 'TEXTAREA') return;
        if (ta.id === 'modalTextarea' || ta.id === 'titleEditInput') return;
        if (!ta.classList.contains('text-input') && !ta.classList.contains('dash-quick-input-field')) return;

        ta.classList.add('mobile-input-active');
        ta.style.minHeight = '68px';
        autoResizeTextarea(ta);

        // 阻止浏览器聚焦时自动滚动
        window.scrollTo(0, savedScrollY);
    });

    document.addEventListener('focusout', function(e) {
        var ta = e.target;
        if (ta.tagName !== 'TEXTAREA') return;
        if (ta.id === 'modalTextarea' || ta.id === 'titleEditInput') return;
        if (!ta.classList.contains('text-input') && !ta.classList.contains('dash-quick-input-field')) return;

        ta.classList.remove('mobile-input-active');
        // 延迟恢复滚动位置 + 缩回单行
        setTimeout(function() {
            window.scrollTo(0, savedScrollY);
            if (document.activeElement !== ta) {
                ta.style.minHeight = '';
                autoResizeTextarea(ta);
            }
        }, 150);
    });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadSkin();
    updateDate();
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(updateDate, 60000);
    SyncManager.init();
    // 每日计划滚动：未完成的顺延到今天、长期/一周类型按期重现
    Store.rolloverPlans();
    // 初始化计划页日期选择器
    currentPlanDate = Store.getDateStr();
    const pdp = document.getElementById('planDatePicker');
    if (pdp) pdp.value = currentPlanDate;
    renderAll();
    updateNavBadges();
    loadAppTitle();
    updateTimerDisplay();

    // 预加载创作灵感（热点新闻），不用等点击才加载
    preloadRecommend();

    // 手机端输入框聚焦展开
    setupMobileInputFocus();

    document.addEventListener('click', e => {
        if (!e.target.closest('.skin-selector-wrap')) {
            const dd = document.getElementById('skinDropdown');
            if (dd) dd.style.display = 'none';
        }
        // 点击日历弹层外部时关闭
        if (!e.target.closest('.plan-date-picker')) {
            const cal = document.getElementById('planCalendar');
            if (cal) cal.style.display = 'none';
        }
    });
});

// ==================== 主题+皮肤 ====================
function loadTheme() {
    const settings = Store.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    document.documentElement.setAttribute('data-skin', settings.skin || 'macaron');
    const ti = document.getElementById('themeIcon');
    if (ti) ti.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const settings = Store.getSettings();
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    Store.saveSettings(settings);
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.getElementById('themeIcon').textContent = settings.theme === 'dark' ? '☀️' : '🌙';
    SyncManager.markDirty();
    showToast(settings.theme === 'dark' ? '深色模式' : '浅色模式');
}

function loadSkin() {
    const settings = Store.getSettings();
    document.documentElement.setAttribute('data-skin', settings.skin || 'macaron');
    updateSkinSelector();
}

function changeSkin(skin) {
    const settings = Store.getSettings();
    settings.skin = skin;
    Store.saveSettings(settings);
    document.documentElement.setAttribute('data-skin', skin);
    updateSkinSelector();
    SyncManager.markDirty();
    const names = { macaron:'马卡龙', morandi:'莫兰迪', cream:'奶油', salt:'盐系', memphis:'孟菲斯', masculine:'男色系', girly:'女生系', fresh:'清新系', gold:'土豪金', earth:'暗黑土黄' };
    showToast(`已切换至${names[skin]||skin} 🎨`);
    document.getElementById('skinDropdown').style.display = 'none';
}

function updateSkinSelector() {
    const settings = Store.getSettings();
    const current = settings.skin || 'macaron';
    document.querySelectorAll('.skin-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.skin === current);
    });
}

function toggleSkinMenu() {
    const dd = document.getElementById('skinDropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function openSyncModal() {
    SyncManager.updateSyncUI(SyncManager.getSyncCode() ? 'connected' : 'disconnected');
    document.getElementById('syncModal').classList.add('show');
}
function closeSyncModal() {
    document.getElementById('syncModal').classList.remove('show');
}

// ==================== 时钟 ====================
function updateClock() {
    const now = new Date();
    const weekdays = ['日','一','二','三','四','五','六'];
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    const dateStr = `${now.getMonth()+1}月${now.getDate()}日`;
    const weekStr = `星期${weekdays[now.getDay()]}`;
    const holiday = getHolidayInfo(now);

    const el = document.getElementById('sidebarClock');
    if (el) {
        el.innerHTML = `<div class="clock-time">${h}:${m}</div><div class="clock-seconds">${s}秒</div><div class="clock-date">${dateStr} ${weekStr}</div>${holiday ? `<div class="clock-holiday">🎉 ${holiday}</div>` : ''}`;
    }
}

function getHolidayInfo(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const holidays = {
        '1-1':'元旦', '2-14':'情人节', '3-8':'妇女节', '3-12':'植树节',
        '4-1':'愚人节', '5-1':'劳动节', '5-4':'青年节', '6-1':'儿童节',
        '7-1':'建党节', '8-1':'建军节', '9-10':'教师节', '10-1':'国庆节',
        '11-11':'光棍节', '12-25':'圣诞节', '12-24':'平安夜',
        '2-2':'世界湿地日', '3-21':'世界睡眠日', '4-22':'世界地球日',
        '5-12':'护士节', '6-5':'世界环境日', '10-31':'万圣节'
    };
    const key = `${month}-${day}`;
    return holidays[key] || '';
}

function updateDate() {
    const now = new Date();
    const weekdays = ['日','一','二','三','四','五','六'];
    document.getElementById('currentDate').textContent = `${now.getMonth()+1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
    const pe = document.getElementById('planDateDisplay');
    if (pe) pe.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
    const de = document.getElementById('diaryAutoDate');
    if (de) de.textContent = Store.getDateStr();
}

// ==================== 导航红点提醒 ====================
function updateNavBadges() {
    const badges = {
        inspiration: Store.getInspirations().filter(i => {
            const d = new Date(i.time);
            return Store.getDateStr(d) === Store.getDateStr();
        }).length === 0,
        plan: Store.getPlans().filter(p => !p.done).length > 0 || Store.getPlans().length === 0,
        finance: Store.getFinanceByDate().length === 0,
        diary: Store.getDiary().filter(d => d.date === Store.getDateStr()).length === 0
    };
    document.querySelectorAll('.nav-item').forEach(item => {
        const tab = item.dataset.tab;
        const badge = item.querySelector('.nav-badge');
        if (badge) badge.remove();
        if (badges[tab]) {
            const b = document.createElement('span');
            b.className = 'nav-badge';
            item.appendChild(b);
        }
    });
}

// ==================== Tab切换 ====================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab === tab));
    window.scrollTo(0, 0);
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'inspiration') renderInspiration();
    if (tab === 'plan') renderPlan();
    if (tab === 'finance') renderFinance();
    if (tab === 'strategy') renderStrategy();
    if (tab === 'diary') renderDiary();
    if (tab === 'recommend') renderRecommend();
    if (tab === 'wish') renderWish();
    updateNavBadges();
}

function renderAll() {
    updateTopBarIncome();
    renderDashboard();
    updateNavBadges();
}

// 刷新：类似关闭应用后重启 + 同步云数据（强制从云端拉取最新并全量重渲染）
async function refreshApp() {
    const btn = document.getElementById('refreshBtn');
    if (btn) { btn.style.transition = 'transform 0.5s'; btn.style.transform = 'rotate(360deg)'; setTimeout(() => { if (btn) btn.style.transform = ''; }, 500); }
    showToast('正在刷新并同步云端...');
    const code = SyncManager.getSyncCode();
    if (code) {
        try { await SyncManager.pullSync(true); }
        catch (e) { console.error('refresh pull error:', e); }
    }
    // 重新滚动计划（未完成顺延/长期重现）
    Store.rolloverPlans();
    currentPlanDate = Store.getDateStr();
    const pdp = document.getElementById('planDatePicker');
    if (pdp) pdp.value = currentPlanDate;
    // 全量重新渲染（模拟重启）
    renderAll();
    switchTab(typeof currentTab === 'string' && currentTab ? currentTab : 'dashboard');
    updateNavBadges();
    updateTopBarIncome();
    showToast('已刷新 ✅');
}

function updateTopBarIncome() {
    document.getElementById('todayIncomeValue').textContent = `￥${formatCalAmount(Store.getTodayIncome())}`;
}

// ==================== 总览页 ====================
function renderDashboard() {
    renderStrategyTop();

    // 灵感快速输入 + 最近灵感（置顶）
    const insps = Store.getInspirations().slice(0, 4);
    const inspBox = document.getElementById('dashInspirationBox');
    if (inspBox) {
        let html = '<div class="dash-quick-input">';
        const dashInspPh = isTouchDevice() ? '💡 随手记一笔灵感...' : '💡 随手记一笔灵感...（手机回车发送 / 电脑 Shift+回车发送）';
        html += '<textarea id="dashInspirationInput" class="dash-quick-input-field" rows="1" enterkeyhint="send" placeholder="'+dashInspPh+'" onkeydown="onInspirationKey(event)" onclick="event.stopPropagation()"></textarea>';
        html += '<button class="btn-primary dash-quick-btn" onclick="event.stopPropagation();addQuickInspiration()">记录灵感</button>';
        html += '</div>';
        html += '<div class="dash-inspiration-list" id="dashInspirationList">';
        html += insps.map(i => { const t = (i.text.split('\n')[0] || '').trim(); const shown = t.length > 50 ? t.slice(0,50) + '...' : t; return `<div class="mini-item"><span class="mini-tag">${i.tag}</span> ${escapeHtml(shown)}</div>`; }).join('') || '<div class="mini-item" style="color:var(--text-muted)">暂无灵感，快记录一条吧！</div>';
        html += '</div>';
        inspBox.innerHTML = html;
    }

    // 收支
    const ti = Store.getTodayIncome();
    const te = Store.getTodayExpense();
    document.getElementById('dashTodayIncome').textContent = `￥${formatMoney(ti)}`;
    document.getElementById('dashTodayExpense').textContent = `￥${formatMoney(te)}`;
    document.getElementById('dashTodayNet').textContent = `￥${formatMoney(ti - te)}`;

    // 收支目标进度（每日目标可自定义）
    const INCOME_GOAL = Store.getSettings().incomeGoal || 3000;
    const incomePct = Math.min(100, (ti / INCOME_GOAL) * 100);
    const incomeTitleEl = document.getElementById('dashIncomeTitle');
    if (incomeTitleEl) {
        incomeTitleEl.innerHTML = `今日收支 <span class="dash-goal-text">¥${formatMoney(ti)}/¥${formatMoney(INCOME_GOAL)}</span>`;
    }
    const goalProgressEl = document.getElementById('dashIncomeGoalProgress');
    if (goalProgressEl) {
        const hue = incomePct >= 100 ? 120 : incomePct >= 50 ? 60 : 30;
        goalProgressEl.innerHTML = `
            <div class="dash-goal-bar-bg"><div class="dash-goal-bar-fill" style="width:${incomePct}%;background:linear-gradient(90deg,hsl(${hue},70%,45%),hsl(${hue+20},75%,55%))"></div></div>
            <div class="dash-goal-pct">${incomePct.toFixed(0)}%${incomePct >= 100 ? ' 🎉 达标！' : ''}</div>`;
    }

    // 计划 - 标题旁红点显示未完成数（保留红点形式）
    const plans = sortPlans(Store.getActivePlans());
    const dc = plans.filter(p => p.done).length;
    const pending = plans.length - dc;
    const planTitleEl = document.getElementById('dashPlanTitle');
    if (planTitleEl) {
        planTitleEl.innerHTML = `📋 今日计划 ${pending > 0 ? `<span class="dash-badge">${pending}</span>` : '<span class="dash-badge done">✓</span>'}`;
    }
    // 删除「已完成X/Y」进度数字显示（仅保留标题行红点）
    const progressEl = document.getElementById('dashPlanProgress');
    if (progressEl) progressEl.textContent = '';
    // 总览计划列表：序号在前(小号)、方框在首行末尾、整行/空白区点击冒泡跳转到计划内页
    document.getElementById('dashPlanList').innerHTML = plans.slice(0,4).map((p, idx) =>
        `<div class="data-item plan-item plan-type-${p.type} ${p.done?'done':''}" style="padding:7px 12px;margin-bottom:4px;display:flex;align-items:flex-start;gap:8px">
            <span class="plan-index">${idx+1}</span>
            <div class="data-item-content" style="flex:1;min-width:0"><div class="item-text ${p.done?'done':''}">${escapeHtml(p.text)}</div></div>
            <div class="plan-checkbox ${p.done?'checked':''}" onclick="event.stopPropagation();togglePlan('${p.id}')"></div>
        </div>`
    ).join('') || '<div class="mini-item">暂无计划</div>';
    // 今日已完成（总览）：勾选完成的计划停留在当日，点方框可取消完成回到待办
    const doneEl = document.getElementById('dashPlanDone');
    if (doneEl) {
        const doneToday = sortPlans(Store.getCompletedTodayPlans());
        if (doneToday.length) {
            doneEl.style.display = 'block';
            doneEl.innerHTML = '<div class="plan-done-title">✅ 今日已完成（' + doneToday.length + '）</div>' + doneToday.slice(0,4).map((p, idx) =>
                `<div class="data-item plan-item plan-type-${p.type} done" style="padding:6px 12px;margin-bottom:4px;display:flex;align-items:flex-start;gap:8px;opacity:.6">
                    <div class="plan-checkbox checked" onclick="event.stopPropagation();togglePlan('${p.id}')"></div>
                    <div class="data-item-content" style="flex:1;min-width:0"><div class="item-text done">${escapeHtml(p.text)}</div></div>
                </div>`
            ).join('');
        } else { doneEl.style.display = 'none'; doneEl.innerHTML = ''; }
    }

    renderDashWish();

    // 创作灵感预览（热点新闻）
    const recPreview = document.getElementById('dashRecommendList');
    if (recPreview) {
        recPreview.innerHTML = '<div class="mini-item" style="color:var(--text-muted)">📰 点击查看今日热点新闻</div>';
    }
}

// 判断是否为触摸设备（手机/平板），用于区分键盘行为
function isTouchDevice() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return coarse && touch;
}

// 灵感输入框键盘行为：
// 手机端：回车(发送键)=发送，换行用键盘「换行」键（Shift+回车兜底换行）
// 电脑端：Shift+回车=发送，普通回车=换行
function onInspirationKey(e) {
    if (e.key !== 'Enter') return;
    const mobile = isTouchDevice();
    if (mobile) {
        if (e.shiftKey) return; // 手机端 Shift+回车 → 换行
        e.preventDefault();
    } else {
        if (!e.shiftKey) return; // 电脑端 普通回车 → 换行（不拦截）
        e.preventDefault();
    }
    // 发送
    if (document.activeElement && document.activeElement.id === 'inspirationInput') addInspiration();
    else addQuickInspiration();
}

// 快速记录灵感（总览页）
function addQuickInspiration() {
    const input = document.getElementById('dashInspirationInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('请输入灵感内容'); return; }
    Store.addInspiration(text, '灵感', null);
    input.value = '';
    renderDashboard();
    updateNavBadges();
    SyncManager.markDirty();
    showInputSuccess(input, '灵感已记录');
}

function renderStrategyTop() {
    const strategy = Store.getStrategy();
    const vis = strategy.visibility || { annual:true, quarterly:true, monthly:true, shortterm:true };
    let html = '';
    if (vis.annual) {
        html += `<div class="strategy-top-card annual" onclick="editStrategy('annual')"><span class="stc-badge">🎯 年度方向</span><span class="stc-content">${escapeHtml(strategy.annual.split('\n')[0])}</span><span class="stc-edit-hint" title="点击编辑">✏️</span></div>`;
    }
    if (vis.shortterm) {
        html += `<div class="strategy-top-card shortterm" onclick="editStrategy('shortterm')"><span class="stc-badge">⚡ 近期方向</span><span class="stc-content">${escapeHtml(strategy.shortterm.split('\n')[0])}</span><span class="stc-edit-hint" title="点击编辑">✏️</span></div>`;
    }
    document.getElementById('strategyTopDisplay').innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:8px;font-size:0.82rem">战略方向未展示，去年度战略页开启</div>';
}

function renderDashWish() {
    const wishes = Store.checkWishAchieved();
    const annualIncome = Store.getAnnualIncome();
    const active = wishes.filter(w => !w.achieved);
    if (active.length > 0) {
        const w = active[0];
        const pct = Math.min(100, (annualIncome / w.target) * 100);
        document.getElementById('dashWishPreview').innerHTML = `
            <div style="font-size:0.85rem;margin-bottom:6px">⭐ ${escapeHtml(w.title)}</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
            <div style="font-size:0.76rem;color:var(--text-muted);margin-top:4px">${pct.toFixed(1)}% · ￥${formatMoney(annualIncome)}/￥${formatMoney(w.target)}</div>`;
    } else {
        document.getElementById('dashWishPreview').innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted)">暂无进行中的心愿</div>';
    }
}

// ==================== 灵感记录 ====================
function addInspiration() {
    const input = document.getElementById('inspirationInput');
    const text = input.value.trim();
    if (!text) { showToast('请输入内容'); return; }
    Store.addInspiration(text, '灵感', null);
    input.value = '';
    autoResizeTextarea(input);
    renderInspiration();
    renderDashboard();
    updateNavBadges();
    SyncManager.markDirty();
    showInputSuccess(input, '灵感已记录');
}

function deleteInspiration(id) { Store.deleteInspiration(id); renderInspiration(); renderDashboard(); updateNavBadges(); SyncManager.markDirty(); showToast('已删除'); }
function filterInspiration(tag) {
    inspirationFilter = tag;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === tag));
    renderInspiration();
}

function renderInspiration() {
    const list = Store.getInspirations();
    const filtered = inspirationFilter === 'all' ? list : list.filter(i => i.tag === inspirationFilter);
    const c = document.getElementById('inspirationList');
    if (!filtered.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-text">还没有灵感记录</div></div>'; return; }
    c.innerHTML = filtered.map(item => {
        const parts = item.text.split('\n');
        const title = parts[0] || '';
        const body = parts.slice(1).join('\n');
        const bodyHtml = body ? `<div class="insp-body editable-text" id="insp-body-${item.id}" contenteditable="true" onblur="saveInspirationParts(${item.id})">${escapeHtml(body)}</div>` : '';
        return `
        <div class="data-item">
            <div class="data-item-content">
                <div class="insp-title editable-text" id="insp-title-${item.id}" contenteditable="true" onblur="saveInspirationParts(${item.id})">${escapeHtml(title)}</div>
                ${bodyHtml}
                <div class="data-item-meta">
                    <button class="insp-tag-toggle" onclick="toggleInspirationTag(${item.id})">${item.tag}</button>
                    <span class="data-time">${formatDateTime(item.time)}</span>
                </div>
            </div>
            <button class="btn-delete" onclick="deleteInspiration(${item.id})">✕</button>
        </div>`;
    }).join('');
}

// 灵感条目：标题(首行) + 正文(其余行) 分别编辑，失焦合并保存
function saveInspirationParts(id) {
    const titleEl = document.getElementById('insp-title-' + id);
    const bodyEl = document.getElementById('insp-body-' + id);
    if (!titleEl) { renderInspiration(); return; }
    const title = (titleEl.innerText || '').replace(/\u00a0/g, ' ').trim();
    const body = (bodyEl ? (bodyEl.innerText || '') : '').replace(/\u00a0/g, ' ').trim();
    const text = (title + (body ? '\n' + body : '')).trim();
    if (!text) { renderInspiration(); renderDashboard(); showToast('内容不能为空'); return; }
    Store.updateInspiration(id, text);
    renderInspiration(); renderDashboard(); updateNavBadges();
    SyncManager.markDirty();
}

// 灵感/心得 类型切换标签
function toggleInspirationTag(id) {
    const item = Store.getInspirations().find(i => i.id === id);
    if (!item) return;
    const newTag = item.tag === '灵感' ? '心得' : '灵感';
    Store.setInspirationTag(id, newTag);
    renderInspiration(); renderDashboard(); updateNavBadges();
    SyncManager.markDirty();
    showToast('已切换为「' + newTag + '」');
}



// ==================== 每日计划 ====================
// 计划排序：未完成的排到上面，已完成的排到下面
function sortPlans(plans) {
    return plans.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
}
// 格式化日期时间为 YYYY-MM-DD HH:MM:SS
function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function addPlan() {
    const input = document.getElementById('planInput');
    const text = input.value.trim();
    if (!text) { showToast('请输入计划内容'); return; }
    Store.addPlan(text, 'once', currentPlanDate);
    input.value = '';
    autoResizeTextarea(input);
    renderPlan(); renderDashboard(); updateNavBadges();
    SyncManager.markDirty();
    showInputSuccess(input, '计划已添加');
}
function togglePlan(id, date) { Store.togglePlan(id, date || currentPlanDate); renderPlan(); renderDashboard(); updateNavBadges(); SyncManager.markDirty(); }
function deletePlan(id, date) { Store.deletePlan(id, date || currentPlanDate); renderPlan(); renderDashboard(); updateNavBadges(); SyncManager.markDirty(); showToast('已删除'); }
function changePlanType(id, type, date) { Store.setPlanType(id, type, date || currentPlanDate); if (currentPlanDate === Store.getDateStr()) renderFuturePlans(); renderPlan(); renderDashboard(); SyncManager.markDirty(); }
// 内联编辑：点击条目文字出现光标，失焦保存
function saveInlineEdit(el, type, id, date) {
    const text = (el.innerText || '').replace(/\u00a0/g, ' ').trim();
    if (!text) { // 空内容还原，不保存
        if (type === 'plan') renderPlan();
        else if (type === 'inspiration') renderInspiration();
        else if (type === 'diary') renderDiary();
        else if (type === 'strategy') renderStrategy();
        renderDashboard();
        showToast('内容不能为空');
        return;
    }
    if (type === 'inspiration') { Store.updateInspiration(id, text); renderInspiration(); }
    else if (type === 'plan') { Store.updatePlanText(id, text, date || currentPlanDate); renderPlan(); }
    else if (type === 'diary') { Store.updateDiaryText(id, text); renderDiary(); }
    else if (type === 'strategy') { Store.saveStrategy(id, text); renderStrategy(); }
    renderDashboard();
    SyncManager.markDirty();
    showToast('已更新');
}
// 计划页日期选择器改变
function onPlanDateChange(resetTo) {
    const picker = document.getElementById('planDatePicker');
    if (resetTo === 'today') {
        currentPlanDate = Store.getDateStr();
        if (picker) picker.value = currentPlanDate;
    } else if (picker && picker.value) {
        currentPlanDate = picker.value;
    }
    renderPlan();
}

// ====== 日历弹层（支持双击日期确认） ======
let calViewMonth = null;
function openPlanCalendar() {
    const pop = document.getElementById('planCalendar');
    const base = currentPlanDate || Store.getDateStr();
    calViewMonth = new Date(base + 'T00:00:00');
    renderPlanCalendar();
    pop.style.display = 'block';
}
function closePlanCalendar() {
    const pop = document.getElementById('planCalendar');
    if (pop) pop.style.display = 'none';
}
function calShiftMonth(delta) {
    calViewMonth = new Date(calViewMonth.getFullYear(), calViewMonth.getMonth() + delta, 1);
    renderPlanCalendar();
}
function renderPlanCalendar() {
    const pop = document.getElementById('planCalendar');
    const y = calViewMonth.getFullYear();
    const m = calViewMonth.getMonth();
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = Store.getDateStr();
    const wks = ['日', '一', '二', '三', '四', '五', '六'];
    let html = `<div class="cal-head">
        <button class="cal-nav" onclick="calShiftMonth(-1)">‹</button>
        <span class="cal-title">${y}年${m + 1}月</span>
        <button class="cal-nav" onclick="calShiftMonth(1)">›</button>
    </div><div class="cal-grid">`;
    html += wks.map(w => `<div class="cal-dow">${w}</div>`).join('');
    for (let i = 0; i < startDow; i++) html += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cls = 'cal-cell'
            + (ds === today ? ' cal-today' : '')
            + (ds === currentPlanDate ? ' cal-selected' : '')
            + (ds > today ? ' cal-future' : '');
        html += `<div class="${cls}" onclick="selectCalDate('${ds}')" ondblclick="confirmCalDate('${ds}')">${d}</div>`;
    }
    html += '</div><div class="cal-tip">单击选中 · 双击确认</div>';
    pop.innerHTML = html;
}
function selectCalDate(ds) {
    currentPlanDate = ds;
    const picker = document.getElementById('planDatePicker');
    if (picker) picker.value = ds;
    renderPlanCalendar();
}
function confirmCalDate(ds) {
    selectCalDate(ds);
    closePlanCalendar();
    renderPlan();
}

// 未来计划：显示所有创建日期晚于今天的计划（含类型切换）
function renderFuturePlans() {
    const el = document.getElementById('planFuture');
    if (!el) return;
    const all = Store.getAllPlans();
    const today = Store.getDateStr();
    const future = all.filter(p => (p.created || '') > today);
    if (!future.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const groups = {};
    future.forEach(p => { (groups[p.created] = groups[p.created] || []).push(p); });
    const dates = Object.keys(groups).sort();
    let html = '<div class="history-section-title">🔮 未来计划</div>';
    const types = [['once','一次'],['week','一周'],['long','长期']];
    dates.forEach(d => {
        const items = sortPlans(groups[d]);
        html += `<div class="history-date-group"><div class="history-date-label">${d}（${items.length}条）</div>`;
        items.forEach(p => {
            const done = !!(p.doneDates && p.doneDates[d]);
            const typeBtns = types.map(([val,label]) =>
                `<span class="plan-type-btn ${p.type===val?'active type-'+val:'type-'+val}" onclick="changePlanType('${p.id}','${val}','${d}')">${label}</span>`
            ).join('');
            html += `<div class="data-item plan-item history-item plan-type-${p.type}">
                <div class="plan-checkbox ${done ? 'checked' : ''}"></div>
                <div class="data-item-content"><div class="item-text ${done ? 'done' : ''} editable-text" contenteditable="true" onblur="saveInlineEdit(this,'plan',${p.id},'${d}')">${escapeHtml(p.text)}</div><div class="plan-type-bar">${typeBtns}</div></div>
                <button class="btn-mini" onclick="reAddPlan('${d}', '${p.id}')">＋ 加入今日</button>
                <button class="btn-delete" onclick="deletePlan('${p.id}','${d}')">✕</button>
            </div>`;
        });
        html += '</div>';
    });
    el.innerHTML = html;
    el.style.display = 'block';
}

// 小组件功能已移除

// 计划类型中文
function planTypeLabel(t) {
    return t === 'long' ? '长期' : t === 'week' ? '一周' : '一次';
}

function renderPlan() {
    const today = Store.getDateStr();
    const isToday = currentPlanDate === today;
    const types = [['once','一次'],['week','一周'],['long','长期']];
    const todoPlans = sortPlans(Store.getActivePlans(currentPlanDate));
    const doneToday = isToday ? sortPlans(Store.getCompletedTodayPlans(currentPlanDate)) : [];
    const plans = todoPlans;
    const dc = doneToday.length;
    const total = plans.length + doneToday.length;
    const summary = document.getElementById('planSummary');
    // 日期显示（友好文本）
    const disp = document.getElementById('planDateDisplay');
    if (disp) {
        const wk = ['周日','周一','周二','周三','周四','周五','周六'][new Date(currentPlanDate + 'T00:00:00').getDay()];
        let label = isToday ? '今日' : (currentPlanDate > today ? '📅 计划日（到那天自动显示）' : '📅 往日回顾');
        disp.textContent = `${label} · ${currentPlanDate} ${wk}`;
    }
    if (total) {
        const pct = Math.round((dc / total) * 100);
        summary.innerHTML = `<span>完成进度：${dc}/${total} (${pct}%)</span><div class="progress-bar-bg" style="flex:1;margin:0 14px;max-width:280px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;
    } else {
        summary.innerHTML = `<span style="color:var(--text-muted)">${isToday ? '还没有添加今日计划' : currentPlanDate + ' 暂无计划'}</span>`;
    }
    const c = document.getElementById('planList');
    if (!plans.length) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">' + (isToday ? '今天还没有计划' : currentPlanDate + ' 暂无计划') + '</div></div>';
    } else {
        c.innerHTML = plans.map(p => {
            const typeBtns = types.map(([val,label]) =>
                `<span class="plan-type-btn ${p.type===val?'active type-'+val:'type-'+val}" onclick="changePlanType('${p.id}','${val}','${currentPlanDate}')">${label}</span>`
            ).join('');
            return `
            <div class="data-item plan-item plan-type-${p.type}">
                <div class="plan-checkbox" onclick="togglePlan('${p.id}','${currentPlanDate}')"></div>
                <div class="data-item-content">
                    <div class="item-text editable-text" contenteditable="true" onblur="saveInlineEdit(this,'plan',${p.id},'${currentPlanDate}')">${escapeHtml(p.text)}</div>
                    <div class="plan-type-bar">${typeBtns}</div>
                </div>
                <button class="btn-delete" onclick="deletePlan('${p.id}','${currentPlanDate}')">✕</button>
            </div>`;
        }).join('');
    }
    // 今日已完成板块（仅今日显示）：勾选完成的计划停留当日，含「添加」按钮可再次加入今日计划
    const donePanel = document.getElementById('planDoneToday');
    if (donePanel) {
        if (isToday && doneToday.length) {
            donePanel.style.display = 'block';
            donePanel.innerHTML = '<div class="panel-section-title">✅ 今日已完成（' + doneToday.length + '）</div>' + doneToday.map(p => {
                const typeBtns = types.map(([val,label]) =>
                    `<span class="plan-type-btn ${p.type===val?'active type-'+val:'type-'+val}" onclick="changePlanType('${p.id}','${val}','${currentPlanDate}')">${label}</span>`
                ).join('');
                return `
                <div class="data-item plan-item plan-type-${p.type} done">
                    <div class="plan-checkbox checked" onclick="togglePlan('${p.id}','${currentPlanDate}')"></div>
                    <div class="data-item-content">
                        <div class="item-text done editable-text" contenteditable="true" onblur="saveInlineEdit(this,'plan',${p.id},'${currentPlanDate}')">${escapeHtml(p.text)}</div>
                        <div class="plan-type-bar">${typeBtns}</div>
                    </div>
                    <button class="btn-mini" onclick="reAddPlan('${currentPlanDate}','${p.id}')">＋ 添加</button>
                    <button class="btn-delete" onclick="deletePlan('${p.id}','${currentPlanDate}')">✕</button>
                </div>`;
            }).join('');
        } else { donePanel.style.display = 'none'; donePanel.innerHTML = ''; }
    }
    // 未来计划：仅查看「今日」时显示（形式与历史记录一致）
    if (isToday) renderFuturePlans();
    else { const fe = document.getElementById('planFuture'); if (fe) { fe.style.display = 'none'; fe.innerHTML = ''; } }
}

// 历史记录：显示「时间窗口已结束」的计划（一次=过创建日；一周=过第7天；长期=永不），可再次添加
function togglePlanHistory() {
    const el = document.getElementById('planHistory');
    if (el.style.display === 'none') { renderPlanHistory(); el.style.display = 'block'; }
    else el.style.display = 'none';
}
function renderPlanHistory() {
    const all = Store.getAllPlans();
    const today = Store.getDateStr();
    // 历史 = 窗口已结束 且 今天未被勾选完成（今日已完成的停留在当日板块，过一天才进历史）
    const hist = all.filter(p => !Store.isPlanActive(p, today) && !Store.isDoneToday(p, today));
    const c = document.getElementById('planHistory');
    if (!hist.length) { c.innerHTML = '<div class="empty-state"><div class="empty-text">暂无历史计划记录</div></div>'; return; }
    const groups = {};
    hist.forEach(p => { (groups[p.created] = groups[p.created] || []).push(p); });
    const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    let html = '<div class="history-toolbar"><button class="history-clear-btn" onclick="confirmClearPlanHistory()" title="清理全部历史">🗑</button></div>';
    dates.forEach(d => {
        const items = sortPlans(groups[d]);
        html += `<div class="history-date-group"><div class="history-date-label">${d}（${items.length}条）</div>`;
        items.forEach(p => {
            const done = !!(p.doneDates && p.doneDates[d]);
            html += `<div class="data-item plan-item history-item">
                <div class="plan-checkbox ${done?'checked':''}"></div>
                <div class="data-item-content"><div class="item-text ${done?'done':''}">${escapeHtml(p.text)}</div><div class="data-item-meta"><span class="data-tag plan-type-tag type-${p.type}">${planTypeLabel(p.type)}</span></div></div>
                <div class="history-item-actions">
                    <button class="btn-mini" onclick="reAddPlan('${d}', '${p.id}')">＋ 再次添加</button>
                    <button class="btn-mini btn-delete" onclick="deleteHistoryPlan('${d}', '${p.id}')">✕ 删除</button>
                </div>
            </div>`;
        });
        html += '</div>';
    });
    c.innerHTML = html;
}
function reAddPlan(srcDate, id) {
    const all = Store.getAllPlans();
    const item = all.find(p => String(p.id) === String(id));
    if (!item) return;
    Store.addPlan(item.text, item.type);
    renderPlan(); renderDashboard(); updateNavBadges();
    SyncManager.markDirty();
    showInputSuccess(document.getElementById('planInput'), '已重新添加');
}
function deleteHistoryPlan(date, id) {
    Store.deletePlan(id, date);
    renderPlanHistory(); renderPlan(); renderDashboard(); updateNavBadges();
    SyncManager.markDirty();
    showToast('已删除该历史计划');
}
function confirmClearPlanHistory() {
    showConfirm('清理全部历史计划', '将删除所有非今日的计划记录，此操作不可撤销。确定继续吗？', () => {
        Store.clearPlanHistory();
        renderPlanHistory(); renderPlan(); renderDashboard(); updateNavBadges();
        SyncManager.markDirty();
        showToast('已清理全部历史计划');
    });
}

// ==================== 收支记录 ====================
function getFinanceCats(type) {
    const s = Store.getSettings();
    if (type === 'income') return s.incomeCats || ['工资', '直播', '投资'];
    return s.expenseCats || ['学费', '伙食', '保险', '物业', '医疗'];
}
function saveFinanceCats(type, arr) {
    const s = Store.getSettings();
    if (type === 'income') s.incomeCats = arr; else s.expenseCats = arr;
    Store.saveSettings(s);
    SyncManager.markDirty();
}
function setFinanceType(type) {
    financeType = type;
    document.getElementById('typeIncomeBtn').classList.toggle('active', type === 'income');
    document.getElementById('typeExpenseBtn').classList.toggle('active', type === 'expense');
    const cats = getFinanceCats(type);
    currentFinanceCategory = cats[0] || '';
    renderFinanceCategoryChips();
}
function renderFinanceCategoryChips() {
    const cats = getFinanceCats(financeType);
    if (!currentFinanceCategory || !cats.includes(currentFinanceCategory)) currentFinanceCategory = cats[0] || '';
    const wrap = document.getElementById('financeCategoryChips');
    if (!wrap) return;
    let html = cats.map(c => {
        const sel = c === currentFinanceCategory;
        return `<span class="cat-chip ${sel ? 'active' : ''}" onclick="selectFinanceCategory('${escapeHtml(c)}')">${escapeHtml(c)}<span class="cat-del" onclick="event.stopPropagation(); deleteFinanceCategory('${escapeHtml(c)}')" title="删除分类">×</span></span>`;
    }).join('');
    html += `<span class="cat-chip cat-add" onclick="toggleAddCategory()">＋ 新增</span>`;
    wrap.innerHTML = html;
}
function selectFinanceCategory(cat) {
    currentFinanceCategory = cat;
    renderFinanceCategoryChips();
}
function toggleAddCategory() {
    const inp = document.getElementById('financeNewCat');
    if (inp.style.display === 'none') { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = ''; }
}
function confirmAddCategory() {
    const inp = document.getElementById('financeNewCat');
    const name = inp.value.trim();
    if (!name) { inp.style.display = 'none'; return; }
    if (name === '新增' || name === '分类') { showToast('该名称不可用'); inp.focus(); return; }
    const cats = getFinanceCats(financeType);
    if (cats.includes(name)) { showToast('分类已存在'); inp.focus(); return; }
    cats.push(name);
    saveFinanceCats(financeType, cats);
    currentFinanceCategory = name;
    inp.style.display = 'none'; inp.value = '';
    renderFinanceCategoryChips();
    showToast(`已新增分类：${name}`);
}
function deleteFinanceCategory(cat) {
    let cats = getFinanceCats(financeType);
    if (cats.length <= 1) { showToast('至少保留一个分类'); return; }
    cats = cats.filter(c => c !== cat);
    saveFinanceCats(financeType, cats);
    if (currentFinanceCategory === cat) currentFinanceCategory = cats[0];
    renderFinanceCategoryChips();
    showToast(`已删除分类：${cat}`);
}
function addFinance() {
    const ai = document.getElementById('financeAmount');
    const amt = parseFloat(ai.value);
    if (!amt || amt <= 0) { showToast('请输入正确金额'); return; }
    const cat = currentFinanceCategory || getFinanceCats(financeType)[0] || '其他';
    Store.addFinance(financeType, amt, '', cat);
    ai.value = '';
    renderFinance(); renderDashboard(); updateTopBarIncome(); renderWish(); updateNavBadges();
    SyncManager.markDirty();
    showInputSuccess(ai, `${financeType === 'income' ? '收入' : '支出'}已记录 💰`);
}
function deleteFinance(id) { Store.deleteFinance(id); renderFinance(); renderDashboard(); updateTopBarIncome(); renderWish(); updateNavBadges(); SyncManager.markDirty(); showToast('已删除'); }

function saveIncomeGoal() {
    const input = document.getElementById('incomeGoalInput');
    const val = parseFloat(input.value);
    if (!val || val <= 0) { showToast('请输入有效金额'); return; }
    const settings = Store.getSettings();
    settings.incomeGoal = val;
    Store.saveSettings(settings);
    renderDashboard();
    SyncManager.markDirty();
    showToast(`每日目标已设为 ¥${formatMoney(val)} 🎯`);
}

function toggleIncomeDetail() {
    const el = document.getElementById('incomeDetail');
    if (el.style.display === 'none') {
        const stats = Store.getFinanceStats();
        const dates = Object.entries(stats.incomeByDate).sort((a,b) => b[0].localeCompare(a[0]));
        el.innerHTML = dates.map(([d,a]) => `<div class="detail-row"><span>${d}</span><span style="color:var(--income-color)">+￥${formatMoney(a)}</span></div>`).join('') || '<div style="text-align:center;color:var(--text-muted)">暂无</div>';
        el.style.display = 'block';
    } else el.style.display = 'none';
}
function toggleExpenseDetail() {
    const el = document.getElementById('expenseDetail');
    if (el.style.display === 'none') {
        const stats = Store.getFinanceStats();
        const dates = Object.entries(stats.expenseByDate).sort((a,b) => b[0].localeCompare(a[0]));
        el.innerHTML = dates.map(([d,a]) => `<div class="detail-row"><span>${d}</span><span style="color:var(--expense-color)">-￥${formatMoney(a)}</span></div>`).join('') || '<div style="text-align:center;color:var(--text-muted)">暂无</div>';
        el.style.display = 'block';
    } else el.style.display = 'none';
}
function togglePeriodDetail(period) {
    const el = document.getElementById(period + 'Detail');
    if (el.style.display === 'none') {
        const days = period === 'week7' ? 7 : period === 'month30' ? 30 : 365;
        const items = Store.getIncomeByPeriod(days);
        const byDate = {};
        items.forEach(i => { byDate[i.date] = (byDate[i.date]||0) + i.amount; });
        const dates = Object.entries(byDate).sort((a,b) => b[0].localeCompare(a[0]));
        el.innerHTML = dates.map(([d,a]) => `<div class="detail-row"><span>${d}</span><span style="color:var(--income-color)">+￥${formatMoney(a)}</span></div>`).join('') || '<div style="text-align:center;color:var(--text-muted)">暂无</div>';
        el.style.display = 'block';
    } else el.style.display = 'none';
}
function toggleHistory() {
    financeHistoryOpen = !financeHistoryOpen;
    const el = document.getElementById('financeHistoryList');
    el.style.display = financeHistoryOpen ? 'block' : 'none';
    const t = document.getElementById('historyTitle');
    if (t) t.innerHTML = financeHistoryOpen ? '📅 收支日历 ▾' : '📅 收支日历 ▶';
    if (financeHistoryOpen) renderFinanceHistory();
}

function renderFinance() {
    renderFinanceCategoryChips();
    if (financeHistoryOpen) renderFinanceHistory();
    // 加载每日收入目标到输入框
    const goalInput = document.getElementById('incomeGoalInput');
    if (goalInput) {
        goalInput.value = Store.getSettings().incomeGoal || 3000;
    }
    const w7 = Store.getIncomeByPeriod(7).reduce((s,i) => s+i.amount, 0);
    const m30 = Store.getIncomeByPeriod(30).reduce((s,i) => s+i.amount, 0);
    const y1 = Store.getIncomeByPeriod(365).reduce((s,i) => s+i.amount, 0);
    document.getElementById('week7Income').textContent = `￥${formatMoney(w7)}`;
    document.getElementById('month30Income').textContent = `￥${formatMoney(m30)}`;
    document.getElementById('year1Income').textContent = `￥${formatMoney(y1)}`;

    const stats = Store.getFinanceStats();
    document.getElementById('totalIncome').textContent = `￥${formatMoney(stats.totalIncome)}`;
    document.getElementById('totalExpense').textContent = `￥${formatMoney(stats.totalExpense)}`;
    document.getElementById('totalNet').textContent = `￥${formatMoney(stats.net)}`;

    const todayList = Store.getFinanceByDate();
    const tc = document.getElementById('financeTodayList');
    if (!todayList.length) { tc.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">今天还没有收支记录</div></div>'; }
    else {
        tc.innerHTML = todayList.map(i => `
            <div class="data-item">
                <span style="font-size:1.2rem">${i.type==='income'?'📈':'📉'}</span>
                <div class="data-item-content">
                    <div class="finance-amount ${i.type}">${i.type==='income'?'+':'-'}￥${formatMoney(i.amount)}</div>
                    <div class="data-item-meta"><span class="data-tag">${i.category}</span><span class="data-time">${formatDateTime(i.time)}</span></div>
                </div>
                <button class="btn-delete" onclick="deleteFinance(${i.id})">✕</button>
            </div>`).join('');
    }
}

function renderFinanceHistory() {
    const c = document.getElementById('financeHistoryList');
    const all = Store.getFinance();
    if (!all.length) { c.innerHTML = '<div class="empty-state"><div class="empty-text">暂无收支记录</div></div>'; return; }
    // 按日期 & 月份聚合
    const map = {};
    const monthMap = {};
    all.forEach(i => {
        if (!map[i.date]) map[i.date] = { income: 0, expense: 0, entries: [] };
        map[i.date].entries.push(i);
        if (i.type === 'income') map[i.date].income += i.amount;
        else map[i.date].expense += i.amount;
        const mk = i.date.slice(0, 7);
        if (!monthMap[mk]) monthMap[mk] = { income: 0, expense: 0 };
        if (i.type === 'income') monthMap[mk].income += i.amount;
        else monthMap[mk].expense += i.amount;
    });

    // 工具栏：日/月视图切换 + 收入/支出切换
    let html = '<div class="history-toolbar"><div class="cal-controls">';
    html += '<div class="fin-cal-view">';
    html += `<button class="cal-mode-btn ${financeCalView==='day'?'active':''}" onclick="setCalView('day')">日</button>`;
    html += `<button class="cal-mode-btn ${financeCalView==='month'?'active':''}" onclick="setCalView('month')">月</button>`;
    html += '</div>';
    html += '<div class="fin-cal-mode">';
    html += `<button class="cal-mode-btn ${financeHistoryMode==='income'?'active':''}" onclick="setHistoryMode('income')">收入</button>`;
    html += `<button class="cal-mode-btn ${financeHistoryMode==='expense'?'active':''}" onclick="setHistoryMode('expense')">支出</button>`;
    html += '</div></div>';
    if (financeCalView === 'day') {
        const y = financeHistoryMonth.getFullYear();
        const m = financeHistoryMonth.getMonth();
        html += '<div class="fin-cal-nav"><button class="cal-nav-btn" onclick="changeHistoryMonth(-1)">‹</button>';
        html += `<span class="cal-month-label">${y}年${m + 1}月</span>`;
        html += '<button class="cal-nav-btn" onclick="changeHistoryMonth(1)">›</button></div>';
    }
    html += '</div>';

    // ===== 月视图：按月份列出收支合计 =====
    if (financeCalView === 'month') {
        const months = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));
        html += '<div class="fin-month-list">';
        months.forEach(mk => {
            const [yy, mm] = mk.split('-');
            const d = monthMap[mk];
            const net = d.income - d.expense;
            html += `<div class="fin-month-row" onclick="openMonth('${mk}')">
                <span class="fin-month-name">${yy}年${parseInt(mm,10)}月</span>
                <span class="fin-month-inc">收 ￥${formatMoney(d.income)}</span>
                <span class="fin-month-exp">支 ￥${formatMoney(d.expense)}</span>
                <span class="fin-month-net ${net>=0?'income-color':'expense-color'}">结余 ￥${formatMoney(net)}</span>
            </div>`;
        });
        html += '</div>';
        c.innerHTML = html;
        return;
    }

    // ===== 日视图：当月日历 =====
    const goal = Store.getSettings().incomeGoal || 0;
    const y = financeHistoryMonth.getFullYear();
    const m = financeHistoryMonth.getMonth();
    const first = new Date(y, m, 1);
    const startW = first.getDay();           // 0=周日
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = Store.getDateStr();
    const pad = n => String(n).padStart(2, '0');
    const monthInc = monthMap[`${y}-${pad(m+1)}`] ? monthMap[`${y}-${pad(m+1)}`].income : 0;
    const monthExp = monthMap[`${y}-${pad(m+1)}`] ? monthMap[`${y}-${pad(m+1)}`].expense : 0;
    html += `<div class="fin-cal-monthsum">本月 收 <b class="income-color">￥${formatMoney(monthInc)}</b> ｜ 支 <b class="expense-color">￥${formatMoney(monthExp)}</b></div>`;

    html += '<div class="fin-cal-panel">';
    html += '<div class="fin-cal">';
    ['日','一','二','三','四','五','六'].forEach(w => { html += `<div class="fin-cal-week">${w}</div>`; });
    for (let i = 0; i < startW; i++) html += '<div class="fin-cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
        const data = map[ds];
        const isToday = ds === todayStr;
        const selected = ds === financeHistorySelectedDate;
        let amtHtml = '';
        if (data) {
            if (financeHistoryMode === 'income' && data.income > 0) {
                const over = data.income > goal;
                amtHtml = `<div class="fin-cal-amt ${over?'over':'under'}">${over?'▲':'▼'}￥${formatCalAmount(data.income)}</div>`;
            } else if (financeHistoryMode === 'expense' && data.expense > 0) {
                amtHtml = `<div class="fin-cal-amt exp">￥${formatCalAmount(data.expense)}</div>`;
            }
        }
        const cls = ['fin-cal-cell'];
        if (data) cls.push('has-data');
        if (isToday) cls.push('today');
        if (selected) cls.push('selected');
        html += `<div class="${cls.join(' ')}" onclick="toggleHistoryDay('${ds}')"><div class="fin-cal-day">${d}</div>${amtHtml}</div>`;
    }
    html += '</div></div>';

    // 选中日期的明细展开（卡片式，金额可编辑，每条带删除×）
    if (financeHistorySelectedDate && map[financeHistorySelectedDate]) {
        const entries = map[financeHistorySelectedDate].entries.slice().reverse();
        html += `<div class="fin-cal-detail"><div class="fin-cal-detail-title">${financeHistorySelectedDate} 明细（${entries.length}笔）</div>`;
        entries.forEach(i => {
            const sign = i.type === 'income' ? '+' : '-';
            html += `<div class="fin-detail-card ${i.type}">
                <div class="fin-detail-head">
                    <span class="fin-detail-cat">${i.type==='income'?'📈':'📉'} ${escapeHtml(i.category)}</span>
                    <button class="fin-detail-del" onclick="deleteFinance(${i.id})" title="删除">✕</button>
                </div>
                <div class="fin-detail-amt-wrap">
                    <span class="fin-detail-sign">${sign}</span>
                    <span class="fin-detail-amt ${i.type}" contenteditable="true" data-fid="${i.id}" onblur="saveFinanceAmount(${i.id}, this)" onclick="event.stopPropagation()">${formatMoney(i.amount)}</span>
                    <span class="fin-detail-unit">元</span>
                </div>
            </div>`;
        });
        html += '</div>';
    }
    c.innerHTML = html;
}

function setCalView(view) {
    financeCalView = view;
    financeHistorySelectedDate = null;
    renderFinanceHistory();
}
function openMonth(mk) {
    const [yy, mm] = mk.split('-');
    financeHistoryMonth = new Date(parseInt(yy, 10), parseInt(mm, 10) - 1, 1);
    financeCalView = 'day';
    financeHistorySelectedDate = null;
    renderFinanceHistory();
}
function changeHistoryMonth(delta) {
    financeHistoryMonth = new Date(financeHistoryMonth.getFullYear(), financeHistoryMonth.getMonth() + delta, 1);
    financeHistorySelectedDate = null;
    renderFinanceHistory();
}
function setHistoryMode(mode) {
    financeHistoryMode = mode;
    financeHistorySelectedDate = null;
    renderFinanceHistory();
}
function toggleHistoryDay(dateStr) {
    financeHistorySelectedDate = (financeHistorySelectedDate === dateStr) ? null : dateStr;
    renderFinanceHistory();
}
function saveFinanceAmount(id, el) {
    const raw = el.textContent.replace(/[^0-9.]/g, '');
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) { showToast('请输入有效金额'); renderFinanceHistory(); return; }
    const clamped = Math.max(0, Math.min(20000000, val));
    Store.updateFinanceAmount(id, clamped);
    renderFinanceHistory(); renderFinance(); renderDashboard(); updateTopBarIncome(); renderWish(); updateNavBadges();
    SyncManager.markDirty();
    showToast('金额已更新');
}

// ==================== 年度战略 ====================
function renderStrategy() {
    const s = Store.getStrategy();
    const vis = s.visibility || { annual:true, quarterly:true, monthly:true, shortterm:true };
    document.getElementById('strategyAnnual').textContent = s.annual;
    document.getElementById('strategyQuarterly').textContent = s.quarterly;
    document.getElementById('strategyMonthly').textContent = s.monthly;
    document.getElementById('strategyShortterm').textContent = s.shortterm;
    ['annual','quarterly','monthly','shortterm'].forEach(k => {
        const btn = document.getElementById('vis-' + k);
        const block = document.querySelector(`.strategy-block[data-key="${k}"]`);
        const el = document.getElementById('strategy' + k.charAt(0).toUpperCase() + k.slice(1));
        el.setAttribute('contenteditable', 'true');
        el.classList.add('editable-text');
        el.onblur = () => saveInlineEdit(el, 'strategy', k);
        if (vis[k]) { btn.textContent = '👁 显示'; btn.classList.remove('hidden-state'); block.classList.remove('hidden-strategy'); }
        else { btn.textContent = '🚫 隐藏'; btn.classList.add('hidden-state'); block.classList.add('hidden-strategy'); }
    });
}
function editStrategy(type) {
    const s = Store.getStrategy();
    const titles = { annual:'年度大方向', quarterly:'本季度目标', monthly:'本月重点', shortterm:'近期短期方向' };
    showModal(titles[type], s[type], txt => { Store.saveStrategy(type, txt); renderStrategy(); renderDashboard(); SyncManager.markDirty(); showToast('战略已更新 🎯'); });
}
function toggleStrategyVis(type) {
    Store.toggleStrategyVisibility(type);
    renderStrategy();
    renderDashboard();
    SyncManager.markDirty();
    showToast('已切换显示状态');
}

// ==================== 心得体会 ====================
function addDiary() {
    const input = document.getElementById('diaryInput');
    const text = input.value.trim();
    if (!text && !diaryImageData.length) { showToast('请输入内容或添加图片'); return; }
    Store.addDiary(text, null, [...diaryImageData]);
    input.value = '';
    autoResizeTextarea(input);
    diaryImageData = [];
    document.getElementById('diaryImagePreview').style.display = 'none';
    document.getElementById('diaryImagePreview').innerHTML = '';
    renderDiary();
    updateNavBadges();
    SyncManager.markDirty();
    showInputSuccess(input, '心得已记录');
}
function deleteDiary(id) { Store.deleteDiary(id); renderDiary(); updateNavBadges(); SyncManager.markDirty(); showToast('已删除'); }
function switchDiaryView(view) { diaryView = view; document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view)); renderDiary(); }

function renderDiary() {
    let list = Store.getDiary();
    let title = '每日心得';
    const now = new Date();
    if (diaryView === 'week') { const w = new Date(now.getTime()-7*86400000); list = list.filter(d => new Date(d.date) >= w); title = '本周心得'; }
    else if (diaryView === 'month') { const m = new Date(now.getTime()-30*86400000); list = list.filter(d => new Date(d.date) >= m); title = '本月心得'; }
    else if (diaryView === 'year') { const ys = new Date(now.getFullYear(),0,1); list = list.filter(d => new Date(d.date) >= ys); title = '全年心得'; }

    const c = document.getElementById('diaryList');
    if (!list.length) { c.innerHTML = `<div class="empty-state"><div class="empty-icon">💭</div><div class="empty-text">${title}还没有记录</div></div>`; return; }

    const g = {};
    list.forEach(i => { if (!g[i.date]) g[i.date] = []; g[i.date].push(i); });
    let html = '';
    if (diaryView !== 'day') {
        html += `<div style="background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;border-radius:12px;padding:14px;margin-bottom:14px;text-align:center"><div style="font-size:1.05rem;font-weight:700">${title}</div><div style="font-size:0.82rem;margin-top:3px">共 ${list.length} 篇 · ${Object.keys(g).length} 天</div></div>`;
    }
    Object.keys(g).sort((a,b) => b.localeCompare(a)).forEach(d => {
        const items = g[d];
        html += `<div style="margin-bottom:10px"><div style="font-size:0.82rem;font-weight:600;color:var(--primary);margin-bottom:6px;padding-left:4px">${d}（${items.length}篇）</div>`;
        items.forEach(item => {
            html += `<div class="data-item diary-item"><div class="data-item-content">
                <div class="item-text editable-text" contenteditable="true" onblur="saveInlineEdit(this,'diary',${item.id})">${escapeHtml(item.text)}</div>`;
            if (item.images && item.images.length) {
                html += `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${item.images.map(img => `<img src="${img}" class="diary-image" onclick="window.open('${img}')">`).join('')}</div>`;
            }
            html += `<div class="data-item-meta"><span class="diary-date-badge">${formatDateTime(item.time)}</span></div></div><button class="btn-delete" onclick="deleteDiary(${item.id})">✕</button></div>`;
        });
        html += '</div>';
    });
    c.innerHTML = html;
}

function handleDiaryImage(e) {
    const files = e.target.files;
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onloadend = () => {
            diaryImageData.push(reader.result);
            renderDiaryImagePreview();
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
}
function renderDiaryImagePreview() {
    const c = document.getElementById('diaryImagePreview');
    if (!diaryImageData.length) { c.style.display = 'none'; return; }
    c.style.display = 'flex';
    c.innerHTML = diaryImageData.map((img, i) =>
        `<div style="position:relative"><img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border-color)"><button onclick="removeDiaryImage(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--income-color);color:#fff;font-size:0.7rem;display:flex;align-items:center;justify-content:center">✕</button></div>`
    ).join('');
}
function removeDiaryImage(i) { diaryImageData.splice(i, 1); renderDiaryImagePreview(); }

function exportDiaryImage() {
    let list = Store.getDiary();
    const view = diaryView; let title = '每日心得';
    const now = new Date();
    if (view === 'week') { const w = new Date(now.getTime()-7*86400000); list = list.filter(d => new Date(d.date) >= w); title = '本周心得总结'; }
    else if (view === 'month') { const m = new Date(now.getTime()-30*86400000); list = list.filter(d => new Date(d.date) >= m); title = '本月心得总结'; }
    else if (view === 'year') { const ys = new Date(now.getFullYear(),0,1); list = list.filter(d => new Date(d.date) >= ys); title = '全年心得总结'; }
    if (!list.length) { showToast('暂无心得可导出'); return; }

    const g = {};
    list.forEach(i => { if (!g[i.date]) g[i.date] = []; g[i.date].push(i); });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 800, lh = 26, pad = 40, cw = width - 2*pad - 20;
    ctx.font = '14px sans-serif';
    let th = 120;
    const allLines = {};
    Object.keys(g).sort((a,b) => b.localeCompare(a)).forEach(d => {
        th += 35; allLines[d] = [];
        g[d].forEach(item => { const ls = wrapTextLines(ctx, item.text, cw); allLines[d].push(ls); th += ls.length*lh + 15; });
        th += 10;
    });
    th += 40;
    canvas.width = width; canvas.height = Math.max(th, 300);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6c5ce7'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, width/2, 50);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#999';
    const ds = Store.getDateStr();
    ctx.fillText(`导出日期：${ds}  共${list.length}篇`, width/2, 78);
    ctx.strokeStyle = '#6c5ce7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad, 95); ctx.lineTo(width-pad, 95); ctx.stroke();
    let y = 125; ctx.textAlign = 'left';
    Object.keys(g).sort((a,b) => b.localeCompare(a)).forEach(d => {
        ctx.fillStyle = '#6c5ce7'; ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`📅 ${d}`, pad, y); y += 30;
        g[d].forEach((item, idx) => {
            ctx.fillStyle = '#333'; ctx.font = '14px sans-serif';
            allLines[d][idx].forEach((line, i) => ctx.fillText(line, pad+20, y + i*lh));
            y += allLines[d][idx].length * lh + 15;
        });
        y += 10;
    });
    ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('陈老师工作台', width-pad, canvas.height-15);
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${title}_${ds}.png`; a.click();
        URL.revokeObjectURL(url); showToast('图片已导出 📷');
    });
}
function wrapTextLines(ctx, text, maxW) {
    const lines = []; let cur = '';
    for (let i = 0; i < text.length; i++) {
        const t = cur + text[i];
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = text[i]; }
        else cur = t;
    }
    if (cur) lines.push(cur);
    return lines.length > 0 ? lines : [''];
}

// ==================== 心愿栏 ====================
function renderWish() {
    const wishes = Store.checkWishAchieved();
    const annualIncome = Store.getAnnualIncome();
    document.getElementById('annualIncomeInfo').innerHTML = `<span class="ai-label">本年度总收入</span><span class="ai-value">￥${formatMoney(annualIncome)}</span>`;
    const c = document.getElementById('wishList');
    if (!wishes.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-text">还没有心愿，添加一个吧！</div></div>'; return; }
    c.innerHTML = wishes.map(w => {
        const pct = Math.min(100, (annualIncome / w.target) * 100);
        const hue = pct < 33 ? 0 : pct < 66 ? 30 : pct < 100 ? 60 : 120;
        const color = `hsl(${hue}, 75%, 50%)`;
        return `<div class="wish-card ${w.achieved?'achieved':''}">
            <div class="wish-header">
                <div class="wish-title">${w.achieved?'🏆':''} ${escapeHtml(w.title)}</div>
                <button class="wish-delete" onclick="deleteWish(${w.id})">✕</button>
            </div>
            <div class="wish-progress-area">
                <div class="wish-progress-bar"><div class="wish-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},hsl(${hue+20},75%,55%))"></div></div>
                <div class="wish-progress-info">
                    <span>￥${formatMoney(annualIncome)} / ￥${formatMoney(w.target)}</span>
                    <span class="wish-percent">${pct.toFixed(1)}%</span>
                </div>
            </div>
            ${w.achieved ? `<div class="wish-achieved-badge">🎉 已实现！达成日期：${w.achievedDate}</div>` : `<div style="font-size:0.76rem;color:var(--text-muted);margin-top:4px">还差 ￥${formatMoney(w.target - annualIncome)} 实现心愿</div>`}
            <div class="wish-created">🕒 添加于 ${formatDateTime(w.created)}</div>
        </div>`;
    }).join('');
}
function addWish() {
    const ti = document.getElementById('wishInput');
    const ta = document.getElementById('wishTargetInput');
    const title = ti.value.trim();
    const target = parseFloat(ta.value);
    if (!title) { showToast('请输入心愿'); return; }
    if (!target || target <= 0) { showToast('请输入目标金额'); return; }
    Store.addWish(title, target);
    ti.value = ''; ta.value = '';
    autoResizeTextarea(ti);
    renderWish(); renderDashboard();
    SyncManager.markDirty();
    showInputSuccess(ti, '心愿已添加 ⭐');
}
function deleteWish(id) { Store.deleteWish(id); renderWish(); renderDashboard(); SyncManager.markDirty(); showToast('已删除'); }

// ==================== 创作灵感推荐 ====================
function preloadRecommend() {
    // 预加载热点新闻数据并渲染到隐藏的 recommendList 中
    const listEl = document.getElementById('recommendList');
    if (!listEl) return;
    listEl.innerHTML = Trending.renderSection();
    Trending.render();
}

function renderRecommend() {
    const listEl = document.getElementById('recommendList');
    listEl.innerHTML = Trending.renderSection();
    Trending.render();
}

// ==================== 标题修改 ====================
function loadAppTitle() {
    const settings = Store.getSettings();
    const title = settings.appTitle || '陈老师工作台';
    const el = document.getElementById('appTitle');
    if (el) el.textContent = title;
    document.title = title;
}

function editAppTitle() {
    const settings = Store.getSettings();
    const current = settings.appTitle || '陈老师工作台';
    const modal = document.getElementById('modalOverlay');
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-title">✏️ 修改工作台名称</div>
        <div class="modal-body">
            <textarea id="titleEditInput" class="title-edit-input" rows="1" maxlength="20" placeholder="输入新的名称..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();saveAppTitle()}">${escapeHtml(current)}</textarea>
            <div class="title-edit-hint">最多20个字符</div>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn-primary" onclick="saveAppTitle()">保存</button>
        </div>`;
    modal.classList.add('show');
    setTimeout(() => {
        const input = document.getElementById('titleEditInput');
        input.focus();
        input.select();
        autoResizeTextarea(input);
    }, 100);
}

function saveAppTitle() {
    const input = document.getElementById('titleEditInput');
    const title = input.value.trim();
    if (!title) { showToast('名称不能为空'); return; }
    const settings = Store.getSettings();
    settings.appTitle = title;
    Store.saveSettings(settings);
    const el = document.getElementById('appTitle');
    if (el) el.textContent = title;
    document.title = title;
    closeModal();
    SyncManager.markDirty();
    showToast(`已更名为「${title}」`);
}

// ==================== 专注计时器 ====================
function setTimerMode(mode) {
    timerState.mode = mode;
    document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    resetTimer();
    const presetsEl = document.getElementById('timerPresets');
    const customEl = document.getElementById('timerCustom');
    const statusEl = document.getElementById('timerStatus');
    if (mode === 'countdown') {
        if (presetsEl) presetsEl.style.display = 'flex';
        if (customEl) customEl.style.display = 'flex';
        if (statusEl) statusEl.textContent = '选择时间开始专注';
    } else {
        if (presetsEl) presetsEl.style.display = 'none';
        if (customEl) customEl.style.display = 'none';
        if (statusEl) statusEl.textContent = '点击开始即可正计时';
    }
}

function setTimerPreset(minutes) {
    timerState.duration = minutes * 60;
    timerState.elapsed = 0;
    document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    updateTimerDisplay();
    const statusEl = document.getElementById('timerStatus');
    if (statusEl) statusEl.textContent = `已设置 ${minutes} 分钟`;
}

function setTimerCustom() {
    const input = document.getElementById('timerCustomInput');
    const minutes = parseInt(input.value);
    if (!minutes || minutes < 1) { showToast('请输入有效分钟数'); return; }
    timerState.duration = minutes * 60;
    timerState.elapsed = 0;
    document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('selected'));
    updateTimerDisplay();
    const statusEl = document.getElementById('timerStatus');
    if (statusEl) statusEl.textContent = `已设置 ${minutes} 分钟`;
    input.value = '';
}

function toggleTimer() {
    if (timerState.running) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (timerState.mode === 'countdown' && timerState.duration === 0) {
        showToast('请先选择时间');
        return;
    }
    timerState.running = true;
    const btn = document.getElementById('timerStartBtn');
    if (btn) { btn.textContent = '暂停'; btn.classList.add('pause'); }
    const statusEl = document.getElementById('timerStatus');
    if (statusEl) statusEl.textContent = timerState.mode === 'countdown' ? '专注中...' : '计时中...';
    const display = document.getElementById('timerDisplay');
    if (display) display.classList.add('running');

    timerState.intervalId = setInterval(() => {
        timerState.elapsed++;
        if (timerState.mode === 'countdown') {
            if (timerState.elapsed >= timerState.duration) {
                timerState.elapsed = timerState.duration;
                finishTimer();
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function pauseTimer() {
    timerState.running = false;
    clearInterval(timerState.intervalId);
    const btn = document.getElementById('timerStartBtn');
    if (btn) { btn.textContent = '继续'; btn.classList.remove('pause'); }
    const statusEl = document.getElementById('timerStatus');
    if (statusEl) statusEl.textContent = '已暂停';
    const display = document.getElementById('timerDisplay');
    if (display) display.classList.remove('running');
}

function finishTimer() {
    clearInterval(timerState.intervalId);
    timerState.running = false;
    const btn = document.getElementById('timerStartBtn');
    if (btn) { btn.textContent = '开始'; btn.classList.remove('pause'); }
    const statusEl = document.getElementById('timerStatus');
    if (statusEl) statusEl.textContent = '🎉 时间到！专注完成！';
    const display = document.getElementById('timerDisplay');
    if (display) { display.classList.remove('running'); display.classList.add('finished'); }
    showToast('🎉 专注时间到！');
    // Vibrate on mobile
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    // Play a beep using Web Audio API
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
    setTimeout(() => { const d = document.getElementById('timerDisplay'); if (d) d.classList.remove('finished'); }, 3000);
}

function resetTimer() {
    clearInterval(timerState.intervalId);
    timerState.running = false;
    timerState.elapsed = 0;
    if (timerState.mode === 'stopwatch') timerState.duration = 0;
    const btn = document.getElementById('timerStartBtn');
    if (btn) { btn.textContent = '开始'; btn.classList.remove('pause'); }
    const statusEl = document.getElementById('timerStatus');
    if (statusEl) statusEl.textContent = timerState.mode === 'countdown' ? '选择时间开始专注' : '点击开始即可正计时';
    const display = document.getElementById('timerDisplay');
    if (display) { display.classList.remove('running'); display.classList.remove('finished'); }
    document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('selected'));
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (!el) return;
    let totalSec;
    if (timerState.mode === 'countdown') {
        totalSec = Math.max(0, timerState.duration - timerState.elapsed);
    } else {
        totalSec = timerState.elapsed;
    }
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } else {
        el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
}

// ==================== 弹窗 ====================
function showModal(title, content, onSave) {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-title">${title}</div>
        <div class="modal-body"><textarea id="modalTextarea">${escapeHtml(content)}</textarea></div>
        <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">取消</button><button class="btn-primary" id="modalSaveBtn">保存</button></div>`;
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('modalSaveBtn').onclick = () => { const t = document.getElementById('modalTextarea').value.trim(); if (t) { onSave(t); closeModal(); } };
    setTimeout(() => { const ta = document.getElementById('modalTextarea'); ta.focus(); autoResizeTextarea(ta); }, 100);
}
function closeModal(e) { if (e && e.target.id !== 'modalOverlay') return; document.getElementById('modalOverlay').classList.remove('show'); }

// ==================== 二次确认对话框 ====================
let _confirmCb = null;
function showConfirm(title, msg, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    _confirmCb = onConfirm;
    document.getElementById('confirmOverlay').classList.add('show');
}
function execConfirm() {
    const cb = _confirmCb; _confirmCb = null;
    closeConfirm();
    if (cb) cb();
}
function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('show'); }

// ==================== 工具方法 ====================
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}
// 在输入框附近显示成功提示（绿色徽章，2秒后淡出）
function showInputSuccess(inputEl, msg) {
    if (!inputEl || !inputEl.parentElement) { showToast(msg); return; }
    // 移除已有的提示
    const existing = inputEl.parentElement.querySelector('.input-success-badge');
    if (existing) existing.remove();
    // 创建提示徽章
    const badge = document.createElement('div');
    badge.className = 'input-success-badge';
    badge.innerHTML = '✓ ' + msg;
    inputEl.parentElement.appendChild(badge);
    // 强制 reflow 后添加 show 类触发动画
    void badge.offsetWidth;
    badge.classList.add('show');
    // 输入框短暂高亮
    if (inputEl.classList) {
        inputEl.classList.add('input-success-flash');
        setTimeout(() => inputEl.classList.remove('input-success-flash'), 1200);
    }
    // 2.5 秒后移除
    setTimeout(() => {
        badge.classList.remove('show');
        setTimeout(() => badge.remove(), 300);
    }, 2500);
}
function formatMoney(n) {
    if (n === 0) return '0';
    if (n < 100) return n.toFixed(2).replace(/\.?0+$/, '');
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
function formatCalAmount(n) {
    if (n === 0) return '0';
    if (n < 10000) return formatMoney(n);
    const wan = (n / 10000).toFixed(2).replace(/\.?0+$/, '');
    return wan + '万';
}
function formatDateTime(iso) {
    const d = new Date(iso), now = new Date();
    const today = Store.getDateStr(), id = Store.getDateStr(d);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    if (id === today) return `今天 ${time}`;
    const y = new Date(now.getTime() - 86400000);
    if (id === Store.getDateStr(y)) return `昨天 ${time}`;
    return `${d.getMonth()+1}月${d.getDate()}日 ${time}`;
}
function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
