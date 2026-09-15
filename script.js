/* =========================================================
   CRISTALHILLS — Supabase version
   Uses ONLY the Supabase publishable key in browser code.
   ========================================================= */

const SUPABASE_URL = 'https://zedgouirmabujahlpbjq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1SJJwVyWmCzNy4htOLvnGA_hAZOhYXJ';

let supabaseClient = null;
let currentUser = null;
let users = [];
let questions = [];
let servers = [];
let currentServerIndex = Number(localStorage.getItem('cristalhills_current_server') || 0);
let currentViewQuestionId = null;
let initialized = false;

const DEFAULT_SERVER = {
    name: 'Cristalhills',
    status: 'online',
    description: 'Cristalhills это проект, со своим сюжетом и квестами, где есть много игроков, с которыми вы можете подружиться и играть вместе, наш проект развивается и уже как год доступен для всех пользователей из разных стран, ждём вас на нашем сервере, скопируйте айпи ниже и установите сборку, так же по кнопке снизу, удачной вам игры.',
    version: '1.20.4',
    ips: [{ name: 'Основной', ip: 'play.cristalhills.net' }],
    builds: [{ name: 'Сборка', url: 'https://example.com/build.zip' }],
    featuresTitle: 'Почему Cristalhills?',
    features: [
        { icon: '📖', title: 'Сюжетные квесты', desc: 'Уникальная история с захватывающими приключениями' },
        { icon: '⚔️', title: 'PvP сражения', desc: 'Сбалансированные бои и турниры' },
        { icon: '🏰', title: 'Строительство', desc: 'Создавай замки вместе с друзьями' },
        { icon: '👥', title: 'Комьюнити', desc: 'Дружелюбное сообщество игроков' }
    ],
    stats: [
        { icon: '🎮', value: '1.20.4', label: 'Версия Minecraft' },
        { icon: '🌍', value: '3+', label: 'Регионов' },
        { icon: '📜', value: '50+', label: 'Квестов' },
        { icon: '⚡', value: '24/7', label: 'Работа сервера' }
    ]
};

function $(id) { return document.getElementById(id); }
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}
function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ru-RU');
}
function setText(id, value) { if ($(id)) $(id).textContent = value == null ? '' : String(value); }
function setError(id, value) { setText(id, value || ''); }
function isAdmin() { return !!currentUser && ['Гл.Админ', 'Мл.Админ'].includes(currentUser.rank); }
function canAccessAdmin() { return isAdmin() || Number.isInteger(currentUser?.chiefFor) || Number.isInteger(currentUser?.helperFor); }
function canEditServer(index) { return isAdmin() || currentUser?.chiefFor === index || currentUser?.helperFor === index; }
function categoryIcon(category) { return ({ technical: '🔧', gameplay: '🎮', donation: '💎', other: '❓', password: '🔑' })[category] || '❓'; }

function normalizeServer(row) {
    return {
        ...row,
        featuresTitle: row.features_title ?? row.featuresTitle ?? ('Почему ' + (row.name || 'Cristalhills') + '?'),
        ips: Array.isArray(row.ips) ? row.ips : [],
        builds: Array.isArray(row.builds) ? row.builds : [],
        features: Array.isArray(row.features) ? row.features : [],
        stats: Array.isArray(row.stats) ? row.stats : []
    };
}
function serverPayload(server) {
    return {
        name: server.name,
        status: server.status,
        description: server.description || '',
        version: server.version || '',
        ips: Array.isArray(server.ips) ? server.ips : [],
        builds: Array.isArray(server.builds) ? server.builds : [],
        features_title: server.featuresTitle || '',
        features: Array.isArray(server.features) ? server.features : [],
        stats: Array.isArray(server.stats) ? server.stats : []
    };
}

async function initSupabase() {
    if (window.supabase?.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        return true;
    }

    // Fallback if the CDN script was blocked or slow.
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    if (!window.supabase?.createClient) throw new Error('Не удалось загрузить библиотеку Supabase.');
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return true;
}

async function loadCurrentUser(session) {
    if (!session?.user) {
        currentUser = null;
        return;
    }

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id,username,email,rank,chief_for,helper_for,created_at,last_login')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        console.error('Profile load error:', error);
        currentUser = {
            id: session.user.id,
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Игрок',
            email: session.user.email || '',
            rank: 'Игрок'
        };
        return;
    }

    currentUser = data ? {
        id: data.id,
        username: data.username,
        email: data.email || session.user.email || '',
        rank: data.rank || 'Игрок',
        chiefFor: data.chief_for,
        helperFor: data.helper_for,
        createdAt: data.created_at,
        lastLogin: data.last_login
    } : {
        id: session.user.id,
        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Игрок',
        email: session.user.email || '',
        rank: 'Игрок'
    };
}

async function loadServers() {
    const { data, error } = await supabaseClient.from('servers').select('*').order('id', { ascending: true });
    if (error) {
        console.error('Servers load error:', error);
        servers = [{ ...DEFAULT_SERVER }];
        return;
    }
    servers = (data || []).map(normalizeServer);
    if (!servers.length) servers = [{ ...DEFAULT_SERVER }];
    if (currentServerIndex < 0 || currentServerIndex >= servers.length) currentServerIndex = 0;
}

async function loadQuestions() {
    questions = [];
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from('questions').select('*').order('id', { ascending: false });
    if (error) {
        console.error('Questions load error:', error);
        return;
    }
    questions = (data || []).map(q => ({
        id: q.id,
        userId: q.user_id,
        author: q.username,
        title: q.title,
        category: q.category,
        text: q.description,
        date: q.date,
        answer: q.answer,
        answerBy: q.answer_by,
        answers: Array.isArray(q.answers) ? q.answers : [],
        isUrgent: !!q.is_urgent,
        closed: !!q.closed
    }));
}

async function loadUsers() {
    users = [];
    if (!isAdmin()) return;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id,username,email,rank,chief_for,helper_for,created_at,last_login')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Users load error:', error);
        return;
    }
    users = (data || []).map(p => ({
        id: p.id, username: p.username, email: p.email, rank: p.rank,
        chiefFor: p.chief_for, helperFor: p.helper_for,
        createdAt: p.created_at, lastLogin: p.last_login
    }));
}

function loadServer(index) {
    if (!servers.length) return;
    currentServerIndex = Math.max(0, Math.min(Number(index) || 0, servers.length - 1));
    localStorage.setItem('cristalhills_current_server', String(currentServerIndex));
    const server = servers[currentServerIndex];

    setText('current-server-name', server.name);
    const hero = $('hero-server-name');
    if (hero) {
        const name = String(server.name || 'Cristalhills');
        const match = name.match(/^(.+?)([A-Za-zА-Яа-я0-9]+)$/);
        hero.innerHTML = match ? escapeHtml(match[1]) + '<span class="highlight">' + escapeHtml(match[2]) + '</span>' : escapeHtml(name);
    }

    const status = $('server-status');
    if (status) status.className = 'server-status ' + (server.status || 'online');
    setText('status-text', ({ online: 'Сервер онлайн', maintenance: 'Обслуживание', offline: 'Оффлайн' })[server.status] || 'Сервер онлайн');
    setText('hero-description', server.description);
    setText('mc-version', server.version);
    setText('features-title', server.featuresTitle || ('Почему ' + server.name + '?'));

    const features = server.features.length ? server.features : DEFAULT_SERVER.features;
    for (let i = 0; i < 4; i++) {
        const f = features[i] || DEFAULT_SERVER.features[i];
        setText('feature-icon-' + (i + 1), f.icon || '⭐');
        setText('feature-title-' + (i + 1), f.title || '');
        setText('feature-desc-' + (i + 1), f.desc || '');
    }

    const stats = server.stats.length ? server.stats : DEFAULT_SERVER.stats;
    for (let i = 0; i < 4; i++) {
        const s = stats[i] || DEFAULT_SERVER.stats[i];
        setText('stat-icon-' + (i + 1), s.icon || '⭐');
        setText('stat-value-' + (i + 1), s.value || '');
        setText('stat-label-' + (i + 1), s.label || '');
    }

    const ipBox = $('ip-buttons');
    if (ipBox) {
        ipBox.innerHTML = '';
        (server.ips.length ? server.ips : DEFAULT_SERVER.ips).forEach(item => {
            const button = document.createElement('button');
            button.className = 'btn btn-primary btn-lg';
            button.innerHTML = '<span class="btn-main">📋 ' + escapeHtml(item.ip) + '</span><span class="btn-sub">' + escapeHtml(item.name || 'IP') + '</span>';
            button.addEventListener('click', () => copyIP(item.ip));
            ipBox.appendChild(button);
        });
        (server.builds || []).forEach(item => {
            const button = document.createElement('button');
            button.className = 'btn btn-secondary btn-lg';
            button.innerHTML = '<span class="btn-main">📥 ' + escapeHtml(item.name || 'Сборка') + '</span><span class="btn-sub">Скачать</span>';
            button.addEventListener('click', () => downloadBuild(item.url));
            ipBox.appendChild(button);
        });
    }
    renderServersPage();
}

function renderServersPage() {
    const grid = $('servers-page-grid');
    if (!grid) return;
    grid.innerHTML = '';

    servers.forEach((server, index) => {
        const card = document.createElement('div');
        card.className = 'server-page-card' + (index === currentServerIndex ? ' active' : '');
        card.innerHTML =
            '<div class="server-page-header"><span class="server-page-icon">🌐</span><div class="server-page-name">' + escapeHtml(server.name) + '</div></div>' +
            '<div class="server-page-status">' + (server.status === 'online' ? '🟢 Онлайн' : server.status === 'maintenance' ? '🟠 Обслуживание' : '🔴 Оффлайн') + '</div>' +
            '<button type="button" class="btn btn-primary server-page-btn">Выбрать</button>';
        card.addEventListener('click', () => {
            loadServer(index);
            navigateTo('home');
        });
        grid.appendChild(card);
    });
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const page = link.dataset.page;
            if (page === 'auth') navigateTo(currentUser ? 'profile' : 'auth');
            else if (page === 'admin') {
                if (canAccessAdmin()) navigateTo('admin'); else alert('⛔ Нет доступа');
            } else {
                navigateTo(page);
            }
        });
    });
}

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = $(page + '-page');
    if (!target) return;
    target.classList.add('active');
    const link = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (link) link.classList.add('active');

    if (page === 'support') renderQuestions();
    if (page === 'profile') updateProfile();
    if (page === 'admin' && canAccessAdmin()) {
        renderServersList();
        loadAdminSettings();
        renderUsersList();
        renderAdminAllQuestions();
    }
}

function setupForms() {
    const bindings = [
        ['login-form', handleLogin],
        ['register-form', handleRegister],
        ['forgot-form', handleForgotPassword],
        ['question-form', handleQuestionSubmit],
        ['promote-form', handlePromote],
        ['assign-role-form', handleAssignRole],
        ['add-server-form', handleAddServer]
    ];
    bindings.forEach(([id, handler]) => {
        const form = $(id);
        if (form) form.addEventListener('submit', handler);
    });
}

async function findEmailByUsername(username) {
    const { data, error } = await supabaseClient.rpc('get_email_by_username', { p_username: username });
    if (error) throw error;
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data[0]?.email || data[0] || null;
    if (data && typeof data === 'object') return data.email || null;
    return null;
}

async function handleLogin(event) {
    event.preventDefault();
    setError('login-error', '');
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    if (!username || !password) return setError('login-error', 'Введите логин и пароль.');

    try {
        const email = await findEmailByUsername(username);
        if (!email) return setError('login-error', 'Пользователь с таким логином не найден.');
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadCurrentUser(data.session);
        if (currentUser) {
            await supabaseClient.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', currentUser.id);
            currentUser.lastLogin = new Date().toISOString();
        }
        updateUI();
        updateProfile();
        $('login-form').reset();
        navigateTo('profile');
    } catch (error) {
        console.error('Login error:', error);
        const message = String(error.message || 'Не удалось войти.');
        setError('login-error', message.includes('Invalid login credentials') ? 'Неверный логин или пароль.' : message);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    setError('register-error', '');
    setError('register-success', '');

    const username = $('register-username').value.trim();
    const email = $('register-email').value.trim();
    const password = $('register-password').value;
    const confirm = $('register-confirm').value;

    if (!/^[A-Za-zА-Яа-яЁё0-9_\-]{3,24}$/.test(username)) return setError('register-error', 'Логин: 3–24 символа, только буквы, цифры, _ или -.');
    if (!email) return setError('register-error', 'Введите email.');
    if (password.length < 4) return setError('register-error', 'Пароль должен содержать минимум 4 символа.');
    if (password !== confirm) return setError('register-error', 'Пароли не совпадают.');

    try {
        const existingEmail = await findEmailByUsername(username);
        if (existingEmail) return setError('register-error', 'Такой логин уже занят.');

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });
        if (error) throw error;

        $('register-form').reset();
        if (data.session) {
            await loadCurrentUser(data.session);
            updateUI();
            updateProfile();
            navigateTo('profile');
        } else {
            setError('register-success', '✅ Аккаунт создан. Если в Supabase включено подтверждение email, подтвердите почту и затем войдите.');
        }
    } catch (error) {
        console.error('Registration error:', error);
        let message = error.message || 'Ошибка регистрации.';
        if (message.toLowerCase().includes('already registered')) message = 'Этот email уже зарегистрирован.';
        setError('register-error', message);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    setError('forgot-error', '');
    setError('forgot-success', '');
    const username = $('forgot-username').value.trim();
    const emailInput = $('forgot-email').value.trim();
    if (!username || !emailInput) return setError('forgot-error', 'Введите логин и email.');

    try {
        const email = await findEmailByUsername(username);
        if (!email) return setError('forgot-error', 'Пользователь с таким логином не найден.');
        if (email.toLowerCase() !== emailInput.toLowerCase()) return setError('forgot-error', 'Email не совпадает с аккаунтом.');
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
        if (error) throw error;
        setError('forgot-success', '✅ Письмо для восстановления отправлено.');
    } catch (error) {
        console.error('Password reset error:', error);
        setError('forgot-error', error.message || 'Не удалось отправить письмо.');
    }
}

async function logout() {
    try { await supabaseClient?.auth.signOut(); } catch (error) { console.error(error); }
    currentUser = null;
    users = [];
    questions = [];
    updateUI();
    navigateTo('home');
}

function updateUI() {
    const authLink = $('auth-link');
    if (authLink) {
        authLink.innerHTML = currentUser ? '<span class="nav-icon">👤</span> Профиль' : '<span class="nav-icon">🔑</span> Войти';
    }
    const adminLink = $('admin-panel-link');
    if (adminLink) adminLink.style.display = canAccessAdmin() ? '' : 'none';
    const letter = $('profile-avatar-letter');
    if (letter) letter.textContent = (currentUser?.username || 'Г').charAt(0).toUpperCase();
    setText('profile-username', currentUser?.username || 'Гость');
    setText('profile-rank', currentUser?.rank || 'Игрок');
    const deleteButton = $('delete-account-btn');
    if (deleteButton) deleteButton.style.display = currentUser && !isAdmin() ? '' : 'none';
    const supportAdmin = $('admin-panel');
    if (supportAdmin) supportAdmin.style.display = isAdmin() ? '' : 'none';
}

function updateProfile() {
    if (!currentUser) return;
    setText('profile-username', currentUser.username);
    setText('profile-rank', currentUser.rank || 'Игрок');
    setText('profile-email', currentUser.email || 'не указан');
    setText('profile-reg-date', formatDate(currentUser.createdAt));
    setText('profile-last-login', formatDate(currentUser.lastLogin));
    setText('profile-avatar-letter', (currentUser.username || 'A').charAt(0).toUpperCase());
}

function renderServersList() {
    const container = $('servers-list');
    if (!container) return;
    container.innerHTML = '';
    servers.forEach((server, index) => {
        const row = document.createElement('div');
        row.className = 'server-card' + (index === currentServerIndex ? ' active' : '');
        row.innerHTML = '<div><strong>' + escapeHtml(server.name) + '</strong><div class="question-details">' + escapeHtml(server.status) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-secondary btn-sm">Выбрать</button>' +
            (isAdmin() && servers.length > 1 ? '<button type="button" class="btn btn-danger btn-sm">Удалить</button>' : '') + '</div>';
        row.querySelector('.btn-secondary').addEventListener('click', () => { loadServer(index); renderServersList(); loadAdminSettings(); });
        const deleteButton = row.querySelector('.btn-danger');
        if (deleteButton) deleteButton.addEventListener('click', () => deleteServer(index));
        container.appendChild(row);
    });
}

function switchToServer(index) { loadServer(index); renderServersList(); }

async function deleteServer(index) {
    if (!isAdmin() || servers.length <= 1) return;
    if (!confirm('Удалить эту ветку сервера?')) return;
    const server = servers[index];
    if (server.id) {
        const { error } = await supabaseClient.from('servers').delete().eq('id', server.id);
        if (error) return alert('❌ ' + error.message);
    }
    await loadServers();
    currentServerIndex = 0;
    loadServer(0);
    renderServersList();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.admin-tab-btn').forEach(button => {
        if ((button.getAttribute('onclick') || '').includes("'" + tab + "'")) button.classList.add('active');
    });
    const content = $('admin-tab-' + tab);
    if (content) content.classList.add('active');
    if (tab === 'users') renderUsersList();
    if (tab === 'questions') renderAdminAllQuestions();
    if (tab === 'settings') loadAdminSettings();
}

function loadAdminSettings() {
    const server = servers[currentServerIndex];
    if (!server) return;
    if ($('admin-status')) $('admin-status').value = server.status || 'online';
    if ($('admin-description')) $('admin-description').value = server.description || '';
    if ($('admin-version')) $('admin-version').value = server.version || '';
    if ($('admin-features-title')) $('admin-features-title').value = server.featuresTitle || '';
    renderAdminIps();
    renderAdminBuilds();
    renderAdminFeaturesCustom();
    renderAdminStatsCustom();
}

function renderAdminIps() {
    const container = $('admin-ips-list'); if (!container) return;
    container.innerHTML = '';
    (servers[currentServerIndex]?.ips || []).forEach((item, index) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap';
        row.innerHTML = '<input class="form-input" data-field="name" value="' + escapeHtml(item.name || '') + '" placeholder="Название" style="flex:1;min-width:120px">' +
            '<input class="form-input" data-field="ip" value="' + escapeHtml(item.ip || '') + '" placeholder="IP" style="flex:2;min-width:180px">' +
            '<button type="button" class="btn btn-danger">🗑️</button>';
        row.querySelector('button').addEventListener('click', () => removeIp(index));
        container.appendChild(row);
    });
}
function renderAdminBuilds() {
    const container = $('admin-builds-list'); if (!container) return;
    container.innerHTML = '';
    (servers[currentServerIndex]?.builds || []).forEach((item, index) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap';
        row.innerHTML = '<input class="form-input" data-field="name" value="' + escapeHtml(item.name || '') + '" placeholder="Название" style="flex:1;min-width:120px">' +
            '<input class="form-input" data-field="url" value="' + escapeHtml(item.url || '') + '" placeholder="Ссылка" style="flex:2;min-width:180px">' +
            '<button type="button" class="btn btn-danger">🗑️</button>';
        row.querySelector('button').addEventListener('click', () => removeBuild(index));
        container.appendChild(row);
    });
}
function renderAdminFeaturesCustom() {
    const container = $('admin-features-custom'); if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const item = servers[currentServerIndex]?.features?.[i] || DEFAULT_SERVER.features[i];
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:70px 1fr 1.5fr;gap:8px;margin-bottom:8px';
        row.innerHTML = '<input class="form-input" id="f-icon-' + i + '" value="' + escapeHtml(item.icon || '') + '">' +
            '<input class="form-input" id="f-title-' + i + '" value="' + escapeHtml(item.title || '') + '" placeholder="Заголовок">' +
            '<input class="form-input" id="f-desc-' + i + '" value="' + escapeHtml(item.desc || '') + '" placeholder="Описание">';
        container.appendChild(row);
    }
}
function renderAdminStatsCustom() {
    const container = $('admin-stats-custom'); if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const item = servers[currentServerIndex]?.stats?.[i] || DEFAULT_SERVER.stats[i];
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:70px 1fr 1.5fr;gap:8px;margin-bottom:8px';
        row.innerHTML = '<input class="form-input" id="s-icon-' + i + '" value="' + escapeHtml(item.icon || '') + '">' +
            '<input class="form-input" id="s-value-' + i + '" value="' + escapeHtml(item.value || '') + '" placeholder="Значение">' +
            '<input class="form-input" id="s-label-' + i + '" value="' + escapeHtml(item.label || '') + '" placeholder="Подпись">';
        container.appendChild(row);
    }
}
function addNewIpField() { if (!canEditServer(currentServerIndex)) return; servers[currentServerIndex].ips.push({ name: 'IP', ip: '' }); renderAdminIps(); }
function addNewBuildField() { if (!canEditServer(currentServerIndex)) return; servers[currentServerIndex].builds.push({ name: 'Сборка', url: '' }); renderAdminBuilds(); }
function removeIp(index) { if (!canEditServer(currentServerIndex)) return; servers[currentServerIndex].ips.splice(index, 1); renderAdminIps(); }
function removeBuild(index) { if (!canEditServer(currentServerIndex)) return; servers[currentServerIndex].builds.splice(index, 1); renderAdminBuilds(); }

async function saveAdminSettings() {
    if (!canEditServer(currentServerIndex)) return alert('⛔ Нет доступа');
    const server = servers[currentServerIndex];
    server.status = $('admin-status').value;
    server.description = $('admin-description').value.trim();
    server.version = $('admin-version').value.trim();
    server.featuresTitle = $('admin-features-title').value.trim();
    server.ips = [...document.querySelectorAll('#admin-ips-list > div')].map(row => ({
        name: row.querySelector('[data-field="name"]').value.trim(),
        ip: row.querySelector('[data-field="ip"]').value.trim()
    })).filter(x => x.ip);
    server.builds = [...document.querySelectorAll('#admin-builds-list > div')].map(row => ({
        name: row.querySelector('[data-field="name"]').value.trim(),
        url: row.querySelector('[data-field="url"]').value.trim()
    })).filter(x => x.url);
    server.features = Array.from({ length: 4 }, (_, i) => ({
        icon: $('f-icon-' + i)?.value || '⭐', title: $('f-title-' + i)?.value || '', desc: $('f-desc-' + i)?.value || ''
    }));
    server.stats = Array.from({ length: 4 }, (_, i) => ({
        icon: $('s-icon-' + i)?.value || '⭐', value: $('s-value-' + i)?.value || '', label: $('s-label-' + i)?.value || ''
    }));

    if (!server.id) return alert('Эта демонстрационная ветка ещё не создана в Supabase. Нажмите «+ Добавить ветку», если нужна запись в общей базе.');
    const { error } = await supabaseClient.from('servers').update(serverPayload(server)).eq('id', server.id);
    if (error) return alert('❌ ' + error.message);
    setText('admin-save-msg', '✅ Сохранено');
    await loadServers();
    loadServer(currentServerIndex);
    renderServersList();
    setTimeout(() => setText('admin-save-msg', ''), 3000);
}

async function handleAddServer(event) {
    event.preventDefault();
    if (!isAdmin()) return alert('⛔ Нет доступа');
    const name = $('new-server-name').value.trim();
    if (!name) return;
    const payload = serverPayload({ ...DEFAULT_SERVER, name });
    const { data, error } = await supabaseClient.from('servers').insert(payload).select().single();
    if (error) return alert('❌ ' + error.message);
    $('add-server-form').reset();
    closeAddServerModal();
    await loadServers();
    const index = servers.findIndex(s => String(s.id) === String(data.id));
    loadServer(index >= 0 ? index : 0);
    renderServersList();
}

function showAddServerModal() { if (isAdmin()) $('add-server-modal').classList.add('show'); else alert('⛔ Нет доступа'); }
function closeAddServerModal() { $('add-server-modal')?.classList.remove('show'); $('add-server-form')?.reset(); }

async function handlePromote(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const username = $('promote-username').value;
    const rank = $('promote-rank').value;
    const target = users.find(user => user.username === username);
    if (!target) return;
    const { error } = await supabaseClient.from('profiles').update({ rank, chief_for: null, helper_for: null }).eq('id', target.id);
    if (error) return alert('❌ ' + error.message);
    closePromoteModal();
    await loadUsers();
    renderUsersList();
}
function openPromoteModal(username) { if (isAdmin()) { $('promote-username').value = username; $('promote-modal').classList.add('show'); } }
function closePromoteModal() { $('promote-modal')?.classList.remove('show'); }

async function handleAssignRole(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const username = $('assign-username').value;
    const serverIndex = Number($('assign-server').value);
    const role = $('assign-role').value;
    const target = users.find(user => user.username === username);
    if (!target) return;
    const patch = role === 'chief' ? { chief_for: serverIndex, helper_for: null } : { helper_for: serverIndex, chief_for: null };
    const { error } = await supabaseClient.from('profiles').update(patch).eq('id', target.id);
    if (error) return alert('❌ ' + error.message);
    closeAssignModal();
    await loadUsers();
    renderUsersList();
}
function openAssignModal(username) {
    if (!isAdmin()) return;
    $('assign-username').value = username;
    const select = $('assign-server');
    select.innerHTML = '';
    servers.forEach((server, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = server.name;
        select.appendChild(option);
    });
    $('assign-role-modal').classList.add('show');
}
function closeAssignModal() { $('assign-role-modal')?.classList.remove('show'); }

function renderUsersList() {
    const container = $('users-list'); if (!container) return;
    container.innerHTML = '';
    if (!users.length) {
        container.innerHTML = '<div class="question-item placeholder"><p>Нет пользователей или нет доступа к списку.</p></div>';
        return;
    }
    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        const serverRole = Number.isInteger(user.chiefFor) ? ' • 👑 Сервер ' + (user.chiefFor + 1) : Number.isInteger(user.helperFor) ? ' • 🔹 Сервер ' + (user.helperFor + 1) : '';
        card.innerHTML = '<div class="user-info"><div class="user-name">' + escapeHtml(user.username) + '</div><div class="user-value">' + escapeHtml((user.rank || 'Игрок') + serverRole) + '</div><div class="user-value">' + escapeHtml(user.email || '') + '</div></div>' +
            (user.id !== currentUser?.id ? '<div class="user-actions"><button type="button" class="btn btn-secondary btn-sm">Назначить</button><button type="button" class="btn btn-primary btn-sm">Повысить</button></div>' : '');
        const buttons = card.querySelectorAll('button');
        if (buttons[0]) buttons[0].addEventListener('click', () => openAssignModal(user.username));
        if (buttons[1]) buttons[1].addEventListener('click', () => openPromoteModal(user.username));
        container.appendChild(card);
    });
}
function filterUsers() {
    const query = ($('user-search')?.value || '').toLowerCase();
    document.querySelectorAll('#users-list .user-card').forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

function renderQuestions() {
    const list = $('questions-list');
    const admin = $('admin-questions-list');
    if (list) {
        list.innerHTML = '';
        const mine = currentUser ? questions.filter(q => q.userId === currentUser.id || q.author === currentUser.username) : [];
        const open = mine.filter(q => !q.closed);
        if (!open.length) list.innerHTML = '<div class="question-item placeholder"><p>📭 Нет ваших открытых вопросов</p></div>';
        open.forEach(q => list.appendChild(createQuestionCard(q)));
    }
    if (admin) {
        admin.innerHTML = '';
        const open = isAdmin() ? questions.filter(q => !q.closed) : [];
        if (!open.length) admin.innerHTML = '<div class="question-item placeholder"><p>Нет открытых вопросов</p></div>';
        open.forEach(q => admin.appendChild(createQuestionCard(q)));
    }
}
function renderAdminAllQuestions() {
    const container = $('admin-all-questions'); if (!container) return;
    container.innerHTML = '';
    if (!questions.length) { container.innerHTML = '<div class="question-item placeholder"><p>Нет вопросов</p></div>'; return; }
    questions.forEach(q => container.appendChild(createQuestionCard(q)));
}
function createQuestionCard(q) {
    const card = document.createElement('div');
    card.className = 'question-item' + (q.isUrgent ? ' urgent' : '') + (q.closed ? ' closed' : '');
    const answered = q.answer || q.answers?.length;
    card.innerHTML = '<div class="question-row"><div class="question-title">' + escapeHtml(q.title) + '</div><span class="status ' + (q.closed ? 'status-closed' : answered ? 'status-answered' : 'status-open') + '">' + (q.closed ? '✅' : answered ? '💬' : '⏳') + '</span></div>' +
        '<div class="question-details">' + escapeHtml(q.author || 'Игрок') + ' • ' + escapeHtml(formatDate(q.date)) + ' • ' + categoryIcon(q.category) + '</div>';
    card.addEventListener('click', () => openQuestionView(q.id));
    return card;
}
function showNewQuestionModal() {
    if (!currentUser) { alert('⚠️ Войдите в аккаунт'); navigateTo('auth'); return; }
    $('new-question-modal').classList.add('show');
}
function closeModal() { $('new-question-modal')?.classList.remove('show'); }

async function handleQuestionSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;
    const title = $('question-title').value.trim();
    const category = $('question-category').value;
    const description = $('question-text').value.trim();
    if (!title || !description) return;
    const row = {
        user_id: currentUser.id, username: currentUser.username, title, category,
        description, date: new Date().toISOString(), answer: null, answer_by: null,
        answers: [], is_urgent: category === 'password', closed: false
    };
    const { error } = await supabaseClient.from('questions').insert(row);
    if (error) return alert('❌ ' + error.message);
    $('question-form').reset();
    closeModal();
    await loadQuestions();
    renderQuestions();
}

function openQuestionView(id) {
    const question = questions.find(q => String(q.id) === String(id));
    if (!question) return;
    setText('view-question-title', question.title);
    setText('view-question-author', question.author);
    setText('view-question-date', formatDate(question.date));
    setText('view-question-category', categoryIcon(question.category));
    setText('view-question-text', question.text);

    const answers = $('view-question-answers');
    if (answers) {
        answers.innerHTML = '';
        (question.answers || []).forEach(answer => {
            const item = document.createElement('div');
            item.className = 'answer-item';
            item.innerHTML = '<div class="answer-meta">' + escapeHtml(answer.by || 'Админ') + '</div><div>' + escapeHtml(answer.text || '') + '</div>';
            answers.appendChild(item);
        });
        if (!question.answers?.length && question.answer) {
            const item = document.createElement('div');
            item.className = 'answer-item';
            item.innerHTML = '<div class="answer-meta">' + escapeHtml(question.answerBy || 'Админ') + '</div><div>' + escapeHtml(question.answer) + '</div>';
            answers.appendChild(item);
        }
        if (!answers.children.length) answers.innerHTML = '<p class="no-answer">⏳ Ответов пока нет</p>';
    }

    const urgent = $('view-question-status-badge');
    if (urgent) {
        urgent.textContent = question.isUrgent ? 'Срочно' : '';
        urgent.classList.toggle('show', !!question.isUrgent);
    }
    if ($('admin-answer-form')) $('admin-answer-form').style.display = isAdmin() && !question.closed ? 'block' : 'none';
    if ($('player-complete-section')) $('player-complete-section').style.display = currentUser && question.userId === currentUser.id && !question.closed ? 'block' : 'none';
    currentViewQuestionId = question.id;
    $('view-question-modal').classList.add('show');
}
function closeViewModal() { $('view-question-modal')?.classList.remove('show'); currentViewQuestionId = null; renderQuestions(); }

async function submitAnswer() {
    if (!isAdmin()) return;
    const question = questions.find(q => String(q.id) === String(currentViewQuestionId));
    const text = $('answer-text').value.trim();
    if (!question || !text) return;
    const answers = Array.isArray(question.answers) ? [...question.answers] : [];
    answers.push({ text, by: currentUser.username, date: new Date().toISOString() });
    const { error } = await supabaseClient.from('questions').update({ answers, answer: text, answer_by: currentUser.username }).eq('id', question.id);
    if (error) return alert('❌ ' + error.message);
    $('answer-text').value = '';
    await loadQuestions();
    openQuestionView(question.id);
}
async function completeQuestion() {
    if (!isAdmin() || currentViewQuestionId == null) return;
    const { error } = await supabaseClient.from('questions').update({ closed: true }).eq('id', currentViewQuestionId);
    if (error) return alert('❌ ' + error.message);
    await loadQuestions(); closeViewModal();
}
async function playerCompleteQuestion() {
    const question = questions.find(q => String(q.id) === String(currentViewQuestionId));
    if (!question || !currentUser || question.userId !== currentUser.id) return;
    const { error } = await supabaseClient.from('questions').update({ closed: true }).eq('id', question.id);
    if (error) return alert('❌ ' + error.message);
    await loadQuestions(); closeViewModal();
}

function showRegister() { $('register-card').style.display = 'block'; $('forgot-card').style.display = 'none'; document.querySelector('#auth-page .auth-card:first-of-type').style.display = 'none'; }
function showLogin() { $('register-card').style.display = 'none'; $('forgot-card').style.display = 'none'; document.querySelector('#auth-page .auth-card:first-of-type').style.display = 'block'; }
function showForgotPassword() { $('register-card').style.display = 'none'; $('forgot-card').style.display = 'block'; document.querySelector('#auth-page .auth-card:first-of-type').style.display = 'none'; }

async function changePassword() {
    if (!currentUser) return;
    const password = prompt('🔑 Новый пароль:');
    if (!password) return;
    if (password.length < 4) return alert('Пароль должен содержать минимум 4 символа.');
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) alert('❌ ' + error.message); else alert('✅ Пароль изменён.');
}
async function deleteAccount() {
    if (!currentUser || isAdmin()) return;
    if (!confirm('Удалить аккаунт?')) return;
    alert('Для полного удаления auth-пользователя нужна серверная функция Supabase. Сейчас безопасно выполняется выход из аккаунта.');
    await logout();
}
function downloadBuild(url) { if (url) window.open(url, '_blank', 'noopener,noreferrer'); }
function copyIP(ip) {
    if (!ip) return;
    const done = () => { setText('ip-copy-msg', '✅ IP скопирован: ' + ip); setTimeout(() => setText('ip-copy-msg', ''), 4000); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ip).then(done).catch(() => prompt('Скопируйте IP:', ip));
    else prompt('Скопируйте IP:', ip);
}

function setupRealtime() {
    supabaseClient.channel('cristalhills-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, async () => { await loadServers(); loadServer(currentServerIndex); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, async () => { if (currentUser) { await loadQuestions(); renderQuestions(); renderAdminAllQuestions(); } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => { if (currentUser) { const { data: { session } } = await supabaseClient.auth.getSession(); await loadCurrentUser(session); await loadUsers(); updateUI(); updateProfile(); } })
        .subscribe();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        await loadCurrentUser(session);
        await loadQuestions();
        await loadUsers();
        updateUI();
        updateProfile();
    });
}

async function initialize() {
    if (initialized) return;
    initialized = true;
    await initSupabase();
    setupNavigation();
    setupForms();

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) console.error('Session error:', error);
    await loadCurrentUser(data?.session);
    await loadServers();
    await loadQuestions();
    await loadUsers();
    updateUI();
    updateProfile();
    loadServer(currentServerIndex);
    renderServersPage();
    setupRealtime();
}

Object.assign(window, {
    navigateTo, logout, showRegister, showLogin, showForgotPassword,
    switchAdminTab, switchToServer, deleteServer, loadAdminSettings,
    addNewIpField, addNewBuildField, removeIp, removeBuild, saveAdminSettings,
    filterUsers, openAssignModal, closeAssignModal, openPromoteModal, closePromoteModal,
    showAddServerModal, closeAddServerModal, showNewQuestionModal, closeModal,
    openQuestionView, closeViewModal, submitAnswer, completeQuestion,
    playerCompleteQuestion, changePassword, deleteAccount, downloadBuild, copyIP
});

document.addEventListener('DOMContentLoaded', () => {
    initialize().catch(error => {
        console.error('Cristalhills initialization error:', error);
        const message = document.createElement('div');
        message.style.cssText = 'position:fixed;left:20px;right:20px;bottom:20px;z-index:99999;padding:16px;border-radius:12px;background:#181b2b;color:#fff;border:1px solid #ef4444;font-family:Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)';
        message.textContent = 'Ошибка запуска сайта: ' + (error.message || error);
        document.body.appendChild(message);
    });
});
