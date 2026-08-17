/**
 * 数据层 - localStorage 持久化 + 云端同步
 */

const Store = {
    KEYS: {
        inspiration: 'wb_inspiration',
        plans: 'wb_plans',
        finance: 'wb_finance',
        strategy: 'wb_strategy',
        diary: 'wb_diary',
        monkey: 'wb_monkey',
        wish: 'wb_wish',
        settings: 'wb_settings'
    },

    get(key) {
        try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; }
        catch (e) { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (e) { return false; }
    },

    // ====== 灵感记录（含语音） ======
    getInspirations() { return this.get(this.KEYS.inspiration) || []; },
    addInspiration(text, tag, voiceData) {
        const list = this.getInspirations();
        list.unshift({ id: Date.now(), text, tag: tag || '通用', voice: voiceData || null, time: new Date().toISOString() });
        this.set(this.KEYS.inspiration, list);
        return list;
    },
    deleteInspiration(id) {
        let list = this.getInspirations().filter(i => i.id !== id);
        this.set(this.KEYS.inspiration, list);
        return list;
    },
    updateInspiration(id, text) {
        const list = this.getInspirations();
        const item = list.find(i => i.id === id);
        if (item) { item.text = text; this.set(this.KEYS.inspiration, list); }
        return list;
    },
    setInspirationTag(id, tag) {
        const list = this.getInspirations();
        const item = list.find(i => i.id === id);
        if (item) { item.tag = tag; this.set(this.KEYS.inspiration, list); }
        return list;
    },

    // ====== 每日计划（基于时间标签的窗口模型）======
    // 计划以扁平数组存储，每条含 created(创建日期) 与 type(一次/一周/长期)
    // 今日是否显示由「时间窗口」+「完成状态」决定：
    //   once(一次) : 未完成则一直显示（顺延至后续每天），完成后才归入历史
    //   week(一周) : 0 <= (当天-created) <= 6  → 持续到第 7 天 24:00，之后归入历史
    //   long(长期) : 永远显示
    // 切换标签会立即改变窗口。完成状态按「天」记录(doneDates)，recurring 类型每天重新可勾选。
    getAllPlans() {
        const raw = this.get(this.KEYS.plans);
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return this.migratePlans(raw);
        return [];
    },
    // 兼容旧版：日期分桶 {date:[plan]} → 扁平数组（按 文本+类型 去重，合并完成日期，保留最早创建日）
    migratePlans(oldDict) {
        const map = {};
        Object.keys(oldDict).forEach(d => {
            (oldDict[d] || []).forEach(p => {
                const type = p.type || 'once';
                const created = p.created || d;
                const key = ((p.text || '').trim()) + '|' + type;
                if (!map[key]) map[key] = { id: p.id, text: p.text, type, created, doneDates: {} };
                if (p.done) map[key].doneDates[d] = true;
                if (created < map[key].created) map[key].created = created;
            });
        });
        const flat = Object.values(map);
        this.set(this.KEYS.plans, flat);
        return flat;
    },
    getPlans(date) { return this.getActivePlans(date); },
    getActivePlans(date) {
        const d = date || this.getDateStr();
        return this.getAllPlans()
            .filter(p => this.isPlanActive(p, d) && !this.isDoneToday(p, d))
            .map(p => ({ ...p, done: false }));
    },
    // 今日已完成：显示「今天被勾选完成」的计划，停留在当日区块，过一天后归入历史
    getCompletedTodayPlans(date) {
        const d = date || this.getDateStr();
        return this.getAllPlans()
            .filter(p => this.isDoneToday(p, d))
            .map(p => ({ ...p, done: true }));
    },
    isPlanActive(plan, date) {
        const type = plan.type || 'once';
        if (type === 'long') return true;
        const created = plan.created || date;
        const days = this._daysBetween(created, date);
        if (type === 'week') return days >= 0 && days <= 6;
        // once（及其它）：未完成则一直显示（顺延到后续每天），完成后才归入历史
        return !(plan.doneDates && Object.keys(plan.doneDates).some(d => plan.doneDates[d]));
    },
    isDoneToday(plan, date) {
        return !!(plan.doneDates && plan.doneDates[date]);
    },
    addPlan(text, type, date) {
        const all = this.getAllPlans();
        const d = date || this.getDateStr();
        all.unshift({ id: Date.now() + Math.random(), text, type: type || 'once', created: d, doneDates: {} });
        this.set(this.KEYS.plans, all);
        return all;
    },
    // 每日计划滚动：新版基于时间标签窗口，无需复制对象到每天，仅确保旧数据迁移
    rolloverPlans() { this.getAllPlans(); },
    _daysBetween(a, b) {
        const da = new Date(a + 'T00:00:00');
        const db = new Date(b + 'T00:00:00');
        return Math.round((db - da) / 86400000);
    },
    togglePlan(id, date) {
        const all = this.getAllPlans();
        const d = date || this.getDateStr();
        const p = all.find(p => String(p.id) === String(id));
        if (p) {
            p.doneDates = p.doneDates || {};
            if (p.doneDates[d]) delete p.doneDates[d]; else p.doneDates[d] = true;
            p.done = !!p.doneDates[d];
        }
        this.set(this.KEYS.plans, all);
        return all;
    },
    updatePlanText(id, text, date) {
        const all = this.getAllPlans();
        const p = all.find(p => String(p.id) === String(id));
        if (p) { p.text = text; this.set(this.KEYS.plans, all); }
        return all;
    },
    deletePlan(id, date) {
        const all = this.getAllPlans();
        const filtered = all.filter(p => String(p.id) !== String(id));
        this.set(this.KEYS.plans, filtered);
        return filtered;
    },
    clearPlanHistory() {
        const all = this.getAllPlans();
        const today = this.getDateStr();
        const kept = all.filter(p => this.isPlanActive(p, today));
        this.set(this.KEYS.plans, kept);
        return kept;
    },
    setPlanType(id, type, date) {
        const all = this.getAllPlans();
        const p = all.find(p => String(p.id) === String(id));
        if (p) p.type = type;
        this.set(this.KEYS.plans, all);
        return all;
    },

    // ====== 收支记录 ======
    getFinance() { return this.get(this.KEYS.finance) || []; },
    getFinanceByDate(date) {
        const d = date || this.getDateStr();
        return this.getFinance().filter(i => i.date === d);
    },
    addFinance(type, amount, note, category) {
        const list = this.getFinance();
        list.unshift({ id: Date.now(), type, amount: parseFloat(amount), note: note || '', category: category || '其他', date: this.getDateStr(), time: new Date().toISOString() });
        this.set(this.KEYS.finance, list);
        return list;
    },
    deleteFinance(id) {
        let list = this.getFinance().filter(i => i.id !== id);
        this.set(this.KEYS.finance, list);
        return list;
    },
    updateFinanceAmount(id, amount) {
        const list = this.getFinance();
        const item = list.find(i => i.id === id);
        if (!item) return;
        item.amount = Math.max(0, Math.min(20000000, parseFloat(amount) || 0));
        this.set(this.KEYS.finance, list);
        return item;
    },
    clearFinanceHistory() {
        const list = this.getFinance();
        const today = this.getDateStr();
        const kept = list.filter(i => i.date === today);
        this.set(this.KEYS.finance, kept);
        return list.length - kept.length;
    },
    getFinanceStats() {
        const list = this.getFinance();
        let income = 0, expense = 0;
        const incomeByDate = {}, expenseByDate = {};
        list.forEach(i => {
            if (i.type === 'income') { income += i.amount; incomeByDate[i.date] = (incomeByDate[i.date] || 0) + i.amount; }
            else { expense += i.amount; expenseByDate[i.date] = (expenseByDate[i.date] || 0) + i.amount; }
        });
        return { totalIncome: income, totalExpense: expense, net: income - expense, incomeByDate, expenseByDate };
    },
    getIncomeByPeriod(days) {
        const list = this.getFinance();
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const startStr = this.getDateStr(startDate);
        return list.filter(i => i.type === 'income' && i.date >= startStr);
    },
    getTodayIncome() {
        return this.getFinanceByDate().filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
    },
    getTodayExpense() {
        return this.getFinanceByDate().filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    },
    getAnnualIncome() {
        const now = new Date();
        const yearStart = this.getDateStr(new Date(now.getFullYear(), 0, 1));
        return this.getFinance().filter(i => i.type === 'income' && i.date >= yearStart).reduce((s, i) => s + i.amount, 0);
    },

    // ====== 年度战略（含可见性） ======
    getStrategy() {
        const saved = this.get(this.KEYS.strategy);
        return saved || {
            annual: '深耕教辅领域，打造个人品牌IP矩阵\n年营收突破百万，粉丝量达到50万',
            quarterly: '搭建短视频内容矩阵，日更3条\n建立私域流量池，社群人数突破5000',
            monthly: '完成小学全科目学习方法系列视频\n教辅带货单月GMV突破20万',
            shortterm: '本周重点：录制5条数学学习方法视频\n联系3家出版社谈合作',
            visibility: { annual: true, quarterly: true, monthly: true, shortterm: true }
        };
    },
    saveStrategy(type, content) {
        const s = this.getStrategy();
        s[type] = content;
        this.set(this.KEYS.strategy, s);
        return s;
    },
    toggleStrategyVisibility(type) {
        const s = this.getStrategy();
        if (!s.visibility) s.visibility = { annual: true, quarterly: true, monthly: true, shortterm: true };
        s.visibility[type] = !s.visibility[type];
        this.set(this.KEYS.strategy, s);
        return s;
    },

    // ====== 心得体会（含语音+图片） ======
    getDiary() { return this.get(this.KEYS.diary) || []; },
    addDiary(text, voiceData, imageData) {
        const list = this.getDiary();
        list.unshift({ id: Date.now(), text, voice: voiceData || null, images: imageData || [], date: this.getDateStr(), time: new Date().toISOString() });
        this.set(this.KEYS.diary, list);
        return list;
    },
    deleteDiary(id) {
        let list = this.getDiary().filter(i => i.id !== id);
        this.set(this.KEYS.diary, list);
        return list;
    },
    updateDiaryText(id, text) {
        const list = this.getDiary();
        const item = list.find(i => i.id === id);
        if (item) { item.text = text; this.set(this.KEYS.diary, list); }
        return list;
    },

    // ====== 心愿栏 ======
    getWishes() { return this.get(this.KEYS.wish) || []; },
    addWish(title, target) {
        const list = this.getWishes();
        list.unshift({ id: Date.now(), title, target: parseFloat(target), achieved: false, achievedDate: null, created: new Date().toISOString() });
        this.set(this.KEYS.wish, list);
        return list;
    },
    deleteWish(id) {
        let list = this.getWishes().filter(w => w.id !== id);
        this.set(this.KEYS.wish, list);
        return list;
    },
    checkWishAchieved() {
        const list = this.getWishes();
        const annualIncome = this.getAnnualIncome();
        let changed = false;
        list.forEach(w => {
            if (!w.achieved && annualIncome >= w.target) {
                w.achieved = true;
                w.achievedDate = this.getDateStr();
                changed = true;
            }
        });
        if (changed) this.set(this.KEYS.wish, list);
        return list;
    },

    // ====== 猴子养成 ======
    getMonkey() {
        return this.get(this.KEYS.monkey) || {
            equipped: {}, inventory: [], lotteryCount: 0, totalIncome: 0,
            lastCheckDate: null, accumulatedLottery: 0, usedLottery: 0
        };
    },
    saveMonkey(data) { this.set(this.KEYS.monkey, data); return data; },

    // ====== 设置（主题+皮肤） ======
    getSettings() {
        return this.get(this.KEYS.settings) || { theme: 'light', skin: 'macaron', incomeGoal: 3000, incomeCats: ['工资', '直播', '投资'], expenseCats: ['学费', '伙食', '保险', '物业', '医疗'] };
    },
    saveSettings(settings) { this.set(this.KEYS.settings, settings); return settings; },

    // ====== 工具方法 ======
    getDateStr(date) {
        if (date instanceof Date) {
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }
        if (typeof date === 'string') return date;
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
    },

    exportAll() {
        const data = {};
        Object.values(this.KEYS).forEach(k => { data[k] = this.get(k); });
        return data;
    },
    importAll(data) {
        Object.keys(data).forEach(k => {
            if (data[k] !== null && data[k] !== undefined) this.set(k, data[k]);
        });
        return true;
    }
};

/**
 * 云端同步管理器 - 使用 jsonblob.com 实现跨设备同步
 */
const SyncManager = {
    SYNC_KEY: 'wb_sync_code',
    SYNC_TIME_KEY: 'wb_sync_time',
    API_BASE: 'https://jsonblob.com/api/jsonBlob',
    pushTimer: null,
    pullTimer: null,
    isSyncing: false,

    init() {
        const code = this.getSyncCode();
        if (code) {
            this.updateSyncUI('connected');
            // 延迟拉取，避免页面加载时阻塞
            setTimeout(() => this.pullSync(), 2000);
            // 定时拉取
            this.pullTimer = setInterval(() => this.pullSync(), 60000);
        }
    },

    getSyncCode() {
        return localStorage.getItem(this.SYNC_KEY);
    },

    setSyncCode(code) {
        localStorage.setItem(this.SYNC_KEY, code);
    },

    clearSyncCode() {
        localStorage.removeItem(this.SYNC_KEY);
        localStorage.removeItem(this.SYNC_TIME_KEY);
    },

    // 创建同步空间
    async createSync() {
        try {
            const data = this.collectData();
            const resp = await fetch(this.API_BASE, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.status === 201) {
                const location = resp.headers.get('Location') || '';
                const code = location.split('/').pop();
                if (code) {
                    this.setSyncCode(code);
                    localStorage.setItem(this.SYNC_TIME_KEY, Date.now().toString());
                    this.updateSyncUI('connected');
                    if (this.pullTimer) clearInterval(this.pullTimer);
                    this.pullTimer = setInterval(() => this.pullSync(), 60000);
                    showToast('云存档已创建 ✅ 同步码：' + code + '\n请在其他设备输入此同步码连接');
                    return true;
                }
            }
            showToast('创建失败 (HTTP ' + resp.status + ')');
            return false;
        } catch (e) {
            console.error('createSync error:', e);
            showToast('网络错误，创建失败 ❌ ' + (e.message || ''));
            return false;
        }
    },

    // 连接到已有同步空间
    async connectSync() {
        const input = document.getElementById('syncCodeInput');
        if (!input || !input.value.trim()) {
            showToast('请输入同步码');
            return;
        }
        const code = input.value.trim();
        showToast('正在连接...');
        try {
            const resp = await fetch(`${this.API_BASE}/${code}`, { mode: 'cors', cache: 'no-cache' });
            if (resp.ok) {
                const remoteData = await resp.json();
                this.setSyncCode(code);
                // 完全替换本地数据（第一次连接，获取云端完整数据）
                this.fullReplaceFromRemote(remoteData);
                localStorage.setItem(this.SYNC_TIME_KEY, Date.now().toString());
                this.updateSyncUI('connected');
                if (this.pullTimer) clearInterval(this.pullTimer);
                this.pullTimer = setInterval(() => this.pullSync(), 60000);
                showToast('连接成功 ✅ 已获取云端' + this.countRecords(remoteData) + '条记录');
                if (typeof renderAll === 'function') renderAll();
                if (typeof updateNavBadges === 'function') updateNavBadges();
                input.value = '';
            } else if (resp.status === 404) {
                showToast('同步码无效或已过期 ❌');
            } else {
                showToast('连接失败 (HTTP ' + resp.status + ') ❌');
            }
        } catch (e) {
            console.error('connectSync error:', e);
            showToast('网络错误，连接失败 ❌ ' + (e.message || ''));
        }
    },

    // 推送数据到云端
    async pushSync() {
        const code = this.getSyncCode();
        if (!code || this.isSyncing) return false;
        this.isSyncing = true;
        let success = false;
        try {
            const data = this.collectData();
            const resp = await fetch(`${this.API_BASE}/${code}`, {
                method: 'PUT',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                localStorage.setItem(this.SYNC_TIME_KEY, Date.now().toString());
                success = true;
            } else if (resp.status === 404) {
                this.clearSyncCode();
                this.updateSyncUI('disconnected');
                showToast('云存档已过期，请重新创建');
            }
        } catch (e) {
            console.error('pushSync error:', e);
        }
        this.isSyncing = false;
        return success;
    },

    // 从云端拉取数据（force=true 时强制拉取，不受时间戳限制）
    async pullSync(force) {
        const code = this.getSyncCode();
        if (!code || this.isSyncing) return false;
        this.isSyncing = true;
        let updated = false;
        try {
            const resp = await fetch(`${this.API_BASE}/${code}`, { mode: 'cors', cache: 'no-cache' });
            if (resp.ok) {
                const remoteData = await resp.json();
                const remoteTime = remoteData._syncTimestamp || 0;
                const localTime = parseInt(localStorage.getItem(this.SYNC_TIME_KEY) || '0');
                // 强制拉取，或远程数据比本地新时应用
                if (force || remoteTime > localTime) {
                    this.applyRemoteData(remoteData);
                    localStorage.setItem(this.SYNC_TIME_KEY, remoteTime.toString());
                    if (typeof renderAll === 'function') renderAll();
                    if (typeof updateNavBadges === 'function') updateNavBadges();
                    updated = true;
                }
            } else if (resp.status === 404) {
                // Blob已过期，用本地数据重新创建
                this.clearSyncCode();
                this.updateSyncUI('disconnected');
                showToast('同步空间已过期，请重新创建');
            }
        } catch (e) {
            console.error('pullSync error:', e);
        }
        this.isSyncing = false;
        return updated;
    },

    // 收集本地数据
    collectData() {
        const data = Store.exportAll();
        data._syncTimestamp = Date.now();
        data._device = navigator.userAgent.substring(0, 50);
        return data;
    },

    // 应用远程数据到本地（智能合并，不丢失本地数据）
    applyRemoteData(remoteData) {
        if (!remoteData || typeof remoteData !== 'object') return;
        Object.keys(Store.KEYS).forEach(k => {
            const storageKey = Store.KEYS[k];  // 实际的 localStorage 键名，如 'wb_inspiration'
            if (remoteData[storageKey] === undefined || remoteData[storageKey] === null) return;
            const localData = Store.get(storageKey);

            // 本地没有该数据，直接用远程
            if (localData === null || localData === undefined) {
                Store.set(storageKey, remoteData[storageKey]);
                return;
            }

            // 数组类型：按ID合并去重
            if (Array.isArray(localData) && Array.isArray(remoteData[storageKey])) {
                Store.set(storageKey, this.mergeById(localData, remoteData[storageKey]));
                return;
            }

            // plans 是按日期分组的对象：合并日期键
            if (k === 'plans' && typeof localData === 'object' && typeof remoteData[storageKey] === 'object') {
                const merged = Object.assign({}, localData);
                Object.keys(remoteData[storageKey]).forEach(date => {
                    if (!merged[date]) {
                        merged[date] = remoteData[storageKey][date];
                    } else {
                        // 合并同一天的待办（按ID去重）
                        merged[date] = this.mergeById(localData[date] || [], remoteData[storageKey][date] || []);
                    }
                });
                Store.set(storageKey, merged);
                return;
            }

            // 其他对象类型（strategy/settings/monkey）：用远程覆盖
            Store.set(storageKey, remoteData[storageKey]);
        });
    },

    // 完全替换本地数据（用于"从云端下载/恢复"——云端数据完全覆盖本地）
    fullReplaceFromRemote(remoteData) {
        if (!remoteData || typeof remoteData !== 'object') return;
        Object.keys(Store.KEYS).forEach(k => {
            const storageKey = Store.KEYS[k];
            if (remoteData[storageKey] !== undefined && remoteData[storageKey] !== null) {
                Store.set(storageKey, remoteData[storageKey]);
            }
        });
    },

    // 按ID合并两个数组，去重（远程优先，本地补充）
    mergeById(local, remote) {
        if (!Array.isArray(local)) return remote || [];
        if (!Array.isArray(remote)) return local;
        const map = new Map();
        // 先放远程数据
        remote.forEach(item => {
            const id = (item && item.id !== undefined) ? item.id : JSON.stringify(item);
            map.set(id, item);
        });
        // 再放本地数据（远程已有的不覆盖）
        local.forEach(item => {
            const id = (item && item.id !== undefined) ? item.id : JSON.stringify(item);
            if (!map.has(id)) map.set(id, item);
        });
        return Array.from(map.values());
    },

    // 手动同步（先拉取云端最新数据，再推送本地数据）
    async manualSync() {
        const code = this.getSyncCode();
        if (!code) { showToast('请先创建或连接同步'); return; }
        // 清除待推送定时器，避免冲突
        if (this.pushTimer) { clearTimeout(this.pushTimer); this.pushTimer = null; }
        showToast('正在双向同步...');
        // 1. 先拉取云端最新数据（强制，不受时间戳限制）
        const pulled = await this.pullSync(true);
        // 2. 再推送合并后的本地数据到云端
        const pushed = await this.pushSync();
        if (pulled && pushed) {
            showToast('双向同步完成 ✅ 已获取最新数据');
        } else if (pushed) {
            showToast('双向同步完成 ✅ 本地已是最新');
        } else {
            showToast('同步失败，请检查网络后重试 ⚠️');
        }
    },

    // 上传到云端（本设备数据 → 覆盖云端）
    async uploadToCloud() {
        const code = this.getSyncCode();
        if (!code) { showToast('请先创建云存档'); return; }
        if (this.pushTimer) { clearTimeout(this.pushTimer); this.pushTimer = null; }
        if (this.isSyncing) { showToast('正在同步中，请稍候...'); return; }
        this.isSyncing = true;
        showToast('正在上传到云端...');
        try {
            const data = this.collectData();
            const resp = await fetch(`${this.API_BASE}/${code}`, {
                method: 'PUT',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                localStorage.setItem(this.SYNC_TIME_KEY, Date.now().toString());
                this.updateSyncTime();
                showToast('已上传到云端 ✅ 共' + this.countRecords(data) + '条记录');
            } else if (resp.status === 404) {
                this.clearSyncCode();
                this.updateSyncUI('disconnected');
                showToast('云存档已过期，请重新创建 ❌');
            } else {
                showToast('上传失败 (HTTP ' + resp.status + ') ❌');
            }
        } catch (e) {
            console.error('uploadToCloud error:', e);
            showToast('网络错误，上传失败 ❌ ' + (e.message || ''));
        }
        this.isSyncing = false;
    },

    // 从云端下载（云端数据 → 完全覆盖本地，像存档恢复一样）
    async downloadFromCloud() {
        const code = this.getSyncCode();
        if (!code) { showToast('请先连接云存档'); return; }
        if (this.isSyncing) { showToast('正在同步中，请稍候...'); return; }
        this.isSyncing = true;
        showToast('正在从云端下载...');
        try {
            const resp = await fetch(`${this.API_BASE}/${code}`, { mode: 'cors', cache: 'no-cache' });
            if (resp.ok) {
                const remoteData = await resp.json();
                // 完全替换本地数据（存档恢复模式）
                this.fullReplaceFromRemote(remoteData);
                localStorage.setItem(this.SYNC_TIME_KEY, Date.now().toString());
                if (typeof renderAll === 'function') renderAll();
                if (typeof updateNavBadges === 'function') updateNavBadges();
                this.updateSyncTime();
                showToast('已从云端恢复 ✅ 共' + this.countRecords(remoteData) + '条记录');
            } else if (resp.status === 404) {
                this.clearSyncCode();
                this.updateSyncUI('disconnected');
                showToast('云存档不存在或已过期 ❌');
            } else {
                showToast('下载失败 (HTTP ' + resp.status + ') ❌');
            }
        } catch (e) {
            console.error('downloadFromCloud error:', e);
            showToast('网络错误，下载失败 ❌ ' + (e.message || ''));
        }
        this.isSyncing = false;
    },

    // 测试云端连接
    async testConnection() {
        const code = this.getSyncCode();
        if (!code) { showToast('请先连接云存档'); return; }
        showToast('正在测试连接...');
        try {
            const resp = await fetch(`${this.API_BASE}/${code}`, { mode: 'cors', cache: 'no-cache' });
            if (resp.ok) {
                const data = await resp.json();
                const count = this.countRecords(data);
                const time = data._syncTimestamp ? new Date(data._syncTimestamp).toLocaleString('zh-CN') : '未知';
                showToast('连接正常 ✅ 云端' + count + '条记录，更新于' + time);
            } else if (resp.status === 404) {
                showToast('云存档不存在或已过期 ❌ 请重新创建');
            } else {
                showToast('连接异常 (HTTP ' + resp.status + ') ❌');
            }
        } catch (e) {
            console.error('testConnection error:', e);
            showToast('连接失败 ❌ ' + (e.message || ''));
        }
    },

    // 统计记录数
    countRecords(data) {
        let count = 0;
        if (data.wb_inspiration && Array.isArray(data.wb_inspiration)) count += data.wb_inspiration.length;
        if (data.wb_finance && Array.isArray(data.wb_finance)) count += data.wb_finance.length;
        if (data.wb_diary && Array.isArray(data.wb_diary)) count += data.wb_diary.length;
        if (data.wb_wish && Array.isArray(data.wb_wish)) count += data.wb_wish.length;
        if (data.wb_plans && typeof data.wb_plans === 'object') {
            Object.values(data.wb_plans).forEach(arr => { if (Array.isArray(arr)) count += arr.length; });
        }
        return count;
    },

    // 更新同步时间显示
    updateSyncTime() {
        const time = localStorage.getItem(this.SYNC_TIME_KEY);
        const el = document.getElementById('syncLastTime');
        if (el && time) {
            const d = new Date(parseInt(time));
            el.textContent = '⏰ 上次同步：' + d.toLocaleString('zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
        } else if (el) {
            el.textContent = '尚未同步';
        }
    },

    // 断开同步
    disconnect() {
        this.clearSyncCode();
        if (this.pullTimer) { clearInterval(this.pullTimer); this.pullTimer = null; }
        this.updateSyncUI('disconnected');
        showToast('已断开同步');
    },

    // 复制同步码
    copySyncCode() {
        const code = this.getSyncCode();
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                showToast('同步码已复制 ✅');
            }).catch(() => {
                // 降级方案
                const ta = document.createElement('textarea');
                ta.value = code;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast('同步码已复制 ✅');
            });
        }
    },

    // 标记数据已修改，延迟推送（推送前先拉取，避免覆盖云端新数据）
    markDirty() {
        if (this.pushTimer) clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(async () => {
            await this.pullSync();
            await this.pushSync();
        }, 3000);
    },

    // 更新同步UI
    updateSyncUI(status) {
        const statusEl = document.getElementById('syncStatus');
        const connectedSection = document.getElementById('syncConnectedSection');
        const codeDisplay = document.getElementById('syncCodeDisplay');
        const code = this.getSyncCode();

        if (status === 'connected' && code) {
            if (statusEl) statusEl.className = 'sync-status connected';
            if (statusEl) statusEl.textContent = '✅ 已连接云存档（同步码：' + code + '）';
            if (connectedSection) connectedSection.style.display = 'block';
            if (codeDisplay) codeDisplay.textContent = code;
            this.updateSyncTime();
        } else {
            if (statusEl) statusEl.className = 'sync-status disconnected';
            if (statusEl) statusEl.textContent = '⚠️ 未连接云存档';
            if (connectedSection) connectedSection.style.display = 'none';
        }
    }
};
