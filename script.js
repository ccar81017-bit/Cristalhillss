/* Cristalhills — Supabase version
   UI and DOM structure are kept compatible with the original index.html/style.css.
   No passwords or service_role keys are stored in this file.
*/

const SUPABASE_URL = 'https://zedgouirmabujahlpbjq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1SJJwVyWmCzNy4htOLvnGA_hAZOhYXJ';

let supabaseClient = null;
let currentUser = null;
let questions = [];
let users = [];
let servers = [];
let currentServerIndex = parseInt(localStorage.getItem('cristalhills_current_server') || '0', 10);
let supabaseReady = false;

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

function cloneDefaultServer() {
    return JSON.parse(JSON.stringify(DEFAULT_SERVER));
}

function normalizeServer(row) {
    if (!row) return cloneDefaultServer();
    return {
        id: row.id,
        name: row.name || 'Cristalhills',
        status: row.status || 'online',
        description: row.description || '',
        version: row.version || '1.20.4',
        ips: Array.isArray(row.ips) ? row.ips : [],
        builds: Array.isArray(row.builds) ? row.builds : [],
        featuresTitle: row.features_title || row.featuresTitle || 'Почему ' + (row.name || 'Cristalhills') + '?',
        features: Array.isArray(row.features) ? row.features : [],
        stats: Array.isArray(row.stats) ? row.stats : []
    };
}

function serverToDb(server) {
    return {
        name: server.name,
        status: server.status,
        description: server.description,
        version: server.version,
        ips: server.ips || [],
        builds: server.builds || [],
        features_title: server.featuresTitle || '',
        features: server.features || [],
        stats: server.stats || []
    };
}

function normalizeQuestion(row) {
    return {
        id: row.id,
        userId: row.user_id,
        author: row.username || 'Игрок',
        title: row.title || '',
        category: row.category || 'other',
        text: row.description || '',
        date: row.date || new Date().toLocaleString('ru-RU'),
        answer: row.answer || null,
        answerBy: row.answer_by || null,
        answers: Array.isArray(row.answers) ? row.answers : [],
        isUrgent: !!row.is_urgent,
        closed: !!row.closed
    };
}

async function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        supabaseReady = true;
        return true;
    }
    console.error('Supabase JS library is not loaded.');
    return false;
}

async function loadCurrentUser() {
    if (!supabaseReady) return;
    const result = await supabaseClient.auth.getUser();
    if (result.error || !result.data.user) {
        currentUser = null;
        return;
    }
    await loadProfile(result.data.user);
}

async function loadProfile(authUser) {
    if (!authUser || !supabaseClient) {
        currentUser = null;
        return;
    }

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, email, rank, chief_for, helper_for, created_at, last_login')
        .eq('id', authUser.id)
        .maybeSingle();

    if (error) {
        console.error('Profile load error:', error);
        currentUser = {
            id: authUser.id,
            username: authUser.user_metadata?.username || (authUser.email ? authUser.email.split('@')[0] : 'Игрок'),
            email: authUser.email || '',
            rank: 'Игрок',
            isAdmin: false
        };
        return;
    }

    if (!data) {
        // The database trigger normally creates this row. This fallback makes the UI usable
        // if the trigger was not present when the account was created.
        const fallbackUsername = authUser.user_metadata?.username || (authUser.email ? authUser.email.split('@')[0] : 'Игрок');
        const insertResult = await supabaseClient.from('profiles').insert({
            id: authUser.id,
            username: fallbackUsername,
            email: authUser.email || '',
            rank: 'Игрок'
        }).select().single();
        if (!insertResult.error && insertResult.data) {
            currentUser = profileToUser(insertResult.data);
        } else {
            console.error('Profile create fallback error:', insertResult.error);
            currentUser = { id: authUser.id, username: fallbackUsername, email: authUser.email || '', rank: 'Игрок', isAdmin: false };
        }
        return;
    }

    currentUser = profileToUser(data);
}

function profileToUser(profile) {
    const rank = profile.rank || 'Игрок';
    return {
        id: profile.id,
        username: profile.username,
        email: profile.email || '',
        rank: rank,
        chiefFor: profile.chief_for,
        helperFor: profile.helper_for,
        regDate: formatDate(profile.created_at),
        lastLogin: formatDate(profile.last_login),
        isAdmin: rank === 'Гл.Админ' || rank === 'Мл.Админ'
    };
}

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('ru-RU');
}

async function loadServers() {
    if (!supabaseReady) return;
    const { data, error } = await supabaseClient.from('servers').select('*').order('id', { ascending: true });
    if (error) {
        console.error('Servers load error:', error);
        servers = [cloneDefaultServer()];
        return;
    }
    servers = (data || []).map(normalizeServer);
    if (servers.length === 0) servers = [cloneDefaultServer()];
    if (currentServerIndex < 0 || currentServerIndex >= servers.length) currentServerIndex = 0;
}

async function loadQuestions() {
    if (!supabaseReady) return;
    const { data, error } = await supabaseClient.from('questions').select('*').order('id', { ascending: false });
    if (error) {
        console.error('Questions load error:', error);
        questions = [];
        return;
    }
    questions = (data || []).map(normalizeQuestion);
}

async function loadUsers() {
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) {
        users = [];
        return;
    }
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, email, rank, chief_for, helper_for, created_at, last_login')
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Users load error:', error);
        users = [];
        return;
    }
    users = data || [];
}

async function refreshAll() {
    await loadCurrentUser();
    await loadServers();
    await loadQuestions();
    await loadUsers();
    updateUI();
    updateProfile();
    loadServer(currentServerIndex);
    renderQuestions();
    renderUsersList();
}

document.addEventListener('DOMContentLoaded', async function() {
    setupNavigation();
    setupForms();
    const ok = await initSupabase();
    if (!ok) {
        updateUI();
        updateProfile();
        loadServer(0);
        renderServersPage();
        return;
    }

    supabaseClient.auth.onAuthStateChange(async function(event, session) {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            if (session && session.user) await loadProfile(session.user);
            else currentUser = null;
            await loadServers();
            await loadQuestions();
            await loadUsers();
            updateUI();
            updateProfile();
            renderQuestions();
            renderServersPage();
        }
    });

    await refreshAll();
    setupRealtime();
});

function setupRealtime() {
    if (!supabaseClient) return;
    try {
        supabaseClient
            .channel('cristalhills-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, async function() {
                await loadServers();
                loadServer(currentServerIndex);
                renderServersPage();
                renderServersList();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, async function() {
                await loadQuestions();
                renderQuestions();
                renderAdminAllQuestions();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async function() {
                if (currentUser) await loadProfile({ id: currentUser.id, email: currentUser.email, user_metadata: { username: currentUser.username } });
                if (currentUser && currentUser.isAdmin) await loadUsers();
                updateUI();
                updateProfile();
                renderUsersList();
            })
            .subscribe(function(status) {
                if (status === 'CHANNEL_ERROR') console.warn('Supabase Realtime is unavailable. The site still works with normal refreshes.');
            });
    } catch (e) {
        console.warn('Realtime setup failed:', e);
    }
}

function loadServer(idx) {
    if (!servers.length) servers = [cloneDefaultServer()];
    currentServerIndex = Math.max(0, Math.min(idx, servers.length - 1));
    localStorage.setItem('cristalhills_current_server', String(currentServerIndex));
    const server = servers[currentServerIndex];
    if (!server) return;

    const currentName = document.getElementById('current-server-name');
    if (currentName) currentName.textContent = server.name;

    const heroName = document.getElementById('hero-server-name');
    if (heroName) {
        const parts = String(server.name).match(/^(.*?)([^\s]+)$/);
        if (parts && parts[1]) heroName.innerHTML = escapeHtml(parts[1]) + '<span class="highlight">' + escapeHtml(parts[2]) + '</span>';
        else heroName.textContent = server.name;
    }

    const statusEl = document.getElementById('server-status');
    const statusText = document.getElementById('status-text');
    if (statusEl && statusText) {
        statusEl.className = 'server-status ' + (server.status || 'online');
        const statusMap = { online: 'Сервер онлайн', maintenance: 'Обслуживание', offline: 'Оффлайн' };
        statusText.textContent = statusMap[server.status] || 'Сервер онлайн';
    }

    const heroDescription = document.getElementById('hero-description');
    if (heroDescription) heroDescription.textContent = server.description || '';
    const mcVersion = document.getElementById('mc-version');
    if (mcVersion) mcVersion.textContent = server.version || '';
    const featuresTitle = document.getElementById('features-title');
    if (featuresTitle) featuresTitle.textContent = server.featuresTitle || 'Почему ' + server.name + '?';

    const defaultFeatures = cloneDefaultServer().features;
    const features = Array.isArray(server.features) && server.features.length ? server.features : defaultFeatures;
    for (let i = 0; i < 4; i++) {
        const f = features[i] || { icon: '⭐', title: '', desc: '' };
        const iconEl = document.getElementById('feature-icon-' + (i + 1));
        const titleEl = document.getElementById('feature-title-' + (i + 1));
        const descEl = document.getElementById('feature-desc-' + (i + 1));
        if (iconEl) iconEl.textContent = f.icon || '⭐';
        if (titleEl) titleEl.textContent = f.title || '';
        if (descEl) descEl.textContent = f.desc || '';
    }

    const defaultStats = cloneDefaultServer().stats;
    const stats = Array.isArray(server.stats) && server.stats.length ? server.stats : defaultStats;
    for (let j = 0; j < 4; j++) {
        const s = stats[j] || { icon: '⭐', value: '', label: '' };
        const iconEl = document.getElementById('stat-icon-' + (j + 1));
        const valueEl = document.getElementById('stat-value-' + (j + 1));
        const labelEl = document.getElementById('stat-label-' + (j + 1));
        if (iconEl) iconEl.textContent = s.icon || '⭐';
        if (valueEl) valueEl.textContent = s.value || '';
        if (labelEl) labelEl.textContent = s.label || '';
    }

    const ipContainer = document.getElementById('ip-buttons');
    if (ipContainer) {
        ipContainer.innerHTML = '';
        (server.ips || []).forEach(function(item) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary btn-lg';
            btn.innerHTML = '<span class="btn-main">📋 ' + escapeHtml(item.ip || '') + '</span><span class="btn-sub">' + escapeHtml(item.name || 'IP') + '</span>';
            btn.onclick = function() { copyIP(item.ip || ''); };
            ipContainer.appendChild(btn);
        });
        (server.builds || []).forEach(function(item) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary btn-lg';
            btn.innerHTML = '<span class="btn-main">📥 ' + escapeHtml(item.name || 'Сборка') + '</span><span class="btn-sub">Скачать</span>';
            btn.onclick = function() { downloadBuild(item.url); };
            ipContainer.appendChild(btn);
        });
    }

    renderServersPage();
}

function renderServersPage() {
    const grid = document.getElementById('servers-page-grid');
    if (!grid) return;
    grid.innerHTML = '';
    servers.forEach(function(server, idx) {
        const card = document.createElement('div');
        card.className = 'server-page-card' + (idx === currentServerIndex ? ' active' : '');
        card.onclick = function() { loadServer(idx); navigateTo('home'); };
        const statusIcon = server.status === 'online' ? '🟢' : server.status === 'maintenance' ? '🟠' : '🔴';
        const statusName = server.status === 'online' ? 'Онлайн' : server.status === 'maintenance' ? 'Обслуживание' : 'Оффлайн';
        card.innerHTML = '<div class="server-page-header"><span class="server-page-icon">🌐</span><div class="server-page-name">' + escapeHtml(server.name) + '</div></div><div class="server-page-status">' + statusIcon + ' ' + statusName + '</div><button class="btn btn-primary server-page-btn" type="button">Выбрать</button>';
        grid.appendChild(card);
    });
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = link.dataset.page;
            if (page === 'auth') {
                navigateTo(currentUser ? 'profile' : 'auth');
            } else if (page === 'admin') {
                if (canAccessAdmin()) navigateTo('admin');
                else navigateTo(currentUser ? 'profile' : 'auth');
            } else if (page === 'servers-list') {
                renderServersPage();
                navigateTo('servers-list');
            } else if (page === 'profile' && !currentUser) {
                navigateTo('auth');
            } else {
                navigateTo(page);
            }
        });
    });
}

function canAccessAdmin() {
    if (!currentUser) return false;
    return !!currentUser.isAdmin || currentUser.chiefFor !== null && currentUser.chiefFor !== undefined || currentUser.helperFor !== null && currentUser.helperFor !== undefined;
}

function canEditServer(idx) {
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    if (currentUser.chiefFor !== null && currentUser.chiefFor !== undefined && Number(currentUser.chiefFor) === idx) return true;
    if (currentUser.helperFor !== null && currentUser.helperFor !== undefined && Number(currentUser.helperFor) === idx) return true;
    return false;
}

function navigateTo(page) {
    const target = document.getElementById(page + '-page');
    if (!target) return;
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-link').forEach(function(l) { l.classList.remove('active'); });
    target.classList.add('active');
    const activeLink = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('active');
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
    const forms = [
        ['login-form', handleLogin],
        ['register-form', handleRegister],
        ['question-form', handleQuestionSubmit],
        ['forgot-form', handleForgotPassword],
        ['promote-form', handlePromote],
        ['add-server-form', handleAddServer],
        ['assign-role-form', handleAssignRole]
    ];
    forms.forEach(function(item) {
        const form = document.getElementById(item[0]);
        if (form) form.addEventListener('submit', item[1]);
    });
}

async function handleLogin(e) {
    e.preventDefault();
    if (!supabaseReady) return;
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!username || !password) {
        errorEl.textContent = '❌ Заполните все поля';
        return;
    }

    const rpc = await supabaseClient.rpc('get_email_by_username', { p_username: username });
    if (rpc.error) {
        console.error('Username lookup error:', rpc.error);
        errorEl.textContent = '❌ Ошибка подключения к базе данных';
        return;
    }
    if (!rpc.data) {
        errorEl.textContent = '❌ Пользователь не найден';
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: rpc.data, password: password });
    if (error) {
        errorEl.textContent = error.message && /email not confirmed/i.test(error.message)
            ? '❌ Подтвердите email и попробуйте снова'
            : '❌ Неверный логин или пароль';
        return;
    }

    await loadProfile(data.user);
    if (currentUser) {
        await supabaseClient.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', currentUser.id);
        currentUser.lastLogin = new Date().toLocaleString('ru-RU');
    }
    updateUI();
    updateProfile();
    e.target.reset();
    navigateTo('profile');
}

async function handleRegister(e) {
    e.preventDefault();
    if (!supabaseReady) return;
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    errorEl.textContent = '';
    successEl.textContent = '';

    if (username.length < 3) { errorEl.textContent = '❌ Ник должен содержать минимум 3 символа'; return; }
    if (password !== confirmPassword) { errorEl.textContent = '❌ Пароли не совпадают'; return; }
    if (password.length < 4) { errorEl.textContent = '❌ Минимум 4 символа'; return; }

    const existing = await supabaseClient.rpc('get_email_by_username', { p_username: username });
    if (existing.error) {
        console.error('Username check error:', existing.error);
        errorEl.textContent = '❌ Не удалось проверить ник';
        return;
    }
    if (existing.data) { errorEl.textContent = '❌ Ник занят'; return; }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: username } }
    });

    if (error) {
        console.error('Registration error:', error);
        if (/already registered|already exists/i.test(error.message || '')) errorEl.textContent = '❌ Этот email уже зарегистрирован';
        else errorEl.textContent = '❌ ' + (error.message || 'Не удалось зарегистрироваться');
        return;
    }

    e.target.reset();
    if (data.session) {
        await loadProfile(data.user);
        successEl.textContent = '✅ Аккаунт создан! Вы вошли в систему.';
        updateUI();
        updateProfile();
        setTimeout(function() { navigateTo('profile'); }, 500);
    } else {
        successEl.textContent = '✅ Аккаунт создан! Проверьте email и подтвердите регистрацию, затем войдите.';
        setTimeout(function() { showLogin(); }, 3500);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    if (!supabaseReady) return;
    const username = document.getElementById('forgot-username').value.trim();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    errorEl.textContent = '';
    successEl.textContent = '';

    const rpc = await supabaseClient.rpc('get_email_by_username', { p_username: username });
    if (rpc.error || !rpc.data || rpc.data.toLowerCase() !== email) {
        errorEl.textContent = '❌ Ник и email не совпадают';
        return;
    }

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (error) {
        console.error('Password reset error:', error);
        errorEl.textContent = '❌ ' + error.message;
        return;
    }
    successEl.textContent = '✅ Ссылка для восстановления отправлена на email.';
    e.target.reset();
}

async function handlePromote(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) return;
    const username = document.getElementById('promote-username').value.trim();
    const newRank = document.getElementById('promote-rank').value;
    const target = users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); });
    if (!target) { alert('❌ Пользователь не найден'); return; }

    const { error } = await supabaseClient.from('profiles').update({ rank: newRank }).eq('id', target.id);
    if (error) { alert('❌ Не удалось изменить роль: ' + error.message); return; }
    closePromoteModal();
    await loadUsers();
    renderUsersList();
    alert('✅ Роль назначена!');
}

async function handleAssignRole(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) return;
    const username = document.getElementById('assign-username').value.trim();
    const serverIdx = parseInt(document.getElementById('assign-server').value, 10);
    const role = document.getElementById('assign-role').value;
    const target = users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); });
    if (!target) { alert('❌ Пользователь не найден'); return; }

    const patch = { chief_for: null, helper_for: null };
    if (role === 'chief') patch.chief_for = serverIdx;
    if (role === 'helper') patch.helper_for = serverIdx;
    const { error } = await supabaseClient.from('profiles').update(patch).eq('id', target.id);
    if (error) { alert('❌ Не удалось назначить: ' + error.message); return; }
    closeAssignModal();
    await loadUsers();
    renderUsersList();
    alert('✅ Назначен!');
}

async function handleAddServer(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) return;
    const name = document.getElementById('new-server-name').value.trim();
    if (!name) return;

    const base = cloneDefaultServer();
    base.name = name;
    base.description = 'Сервер ' + name;
    base.featuresTitle = 'Почему ' + name + '?';
    base.ips = [{ name: 'IP', ip: 'play.' + name.toLowerCase().replace(/\s/g, '') + '.net' }];

    const { data, error } = await supabaseClient.from('servers').insert(serverToDb(base)).select().single();
    if (error) { alert('❌ Не удалось создать ветку: ' + error.message); return; }
    servers.push(normalizeServer(data));
    closeAddServerModal();
    renderServersList();
    renderServersPage();
    alert('✅ Создано: ' + name);
}

async function logout() {
    if (supabaseReady) await supabaseClient.auth.signOut();
    currentUser = null;
    users = [];
    updateUI();
    updateProfile();
    navigateTo('home');
}

function updateUI() {
    const authLink = document.getElementById('auth-link');
    const adminLink = document.getElementById('admin-panel-link');
    const deleteBtn = document.getElementById('delete-account-btn');
    const supportAdmin = document.getElementById('admin-panel');

    if (currentUser) {
        // There is already a dedicated "Профиль" link. Hide the login link after login
        // so the navigation never shows two profile items.
        if (authLink) authLink.style.display = 'none';
        if (adminLink) adminLink.style.display = canAccessAdmin() ? 'flex' : 'none';
        if (deleteBtn) deleteBtn.style.display = currentUser.isAdmin ? 'none' : 'inline-flex';
        if (supportAdmin) supportAdmin.style.display = currentUser.isAdmin ? 'block' : 'none';
    } else {
        if (authLink) {
            authLink.style.display = 'flex';
            authLink.innerHTML = '<span class="nav-icon">🔑</span> Войти';
            authLink.dataset.page = 'auth';
        }
        if (adminLink) adminLink.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        if (supportAdmin) supportAdmin.style.display = 'none';
    }
}

function updateProfile() {
    const usernameEl = document.getElementById('profile-username');
    const rankEl = document.getElementById('profile-rank');
    const avatarEl = document.getElementById('profile-avatar-letter');
    const emailEl = document.getElementById('profile-email');
    const regDateEl = document.getElementById('profile-reg-date');
    const lastLoginEl = document.getElementById('profile-last-login');

    if (currentUser) {
        if (usernameEl) usernameEl.textContent = currentUser.username;
        if (rankEl) rankEl.textContent = currentUser.rank || 'Игрок';
        if (avatarEl) avatarEl.textContent = (currentUser.username || 'G').charAt(0).toUpperCase();
        if (emailEl) emailEl.textContent = currentUser.email || 'не указан';
        if (regDateEl) regDateEl.textContent = currentUser.regDate || '-';
        if (lastLoginEl) lastLoginEl.textContent = currentUser.lastLogin || '-';
    } else {
        if (usernameEl) usernameEl.textContent = 'Гость';
        if (rankEl) rankEl.textContent = 'Игрок';
        if (avatarEl) avatarEl.textContent = 'G';
        if (emailEl) emailEl.textContent = 'не указан';
        if (regDateEl) regDateEl.textContent = '-';
        if (lastLoginEl) lastLoginEl.textContent = '-';
    }
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.admin-tab-btn').forEach(function(b) { b.classList.remove('active'); });
    const tab = document.getElementById('admin-tab-' + tabName);
    if (tab) tab.classList.add('active');
    const btn = document.querySelector('.admin-tab-btn[onclick="switchAdminTab(\'' + tabName + '\')"]');
    if (btn) btn.classList.add('active');
    if (tabName === 'servers') renderServersList();
    if (tabName === 'settings') loadAdminSettings();
    if (tabName === 'users') renderUsersList();
    if (tabName === 'questions') renderAdminAllQuestions();
}

function renderServersList() {
    const container = document.getElementById('servers-list');
    if (!container) return;
    container.innerHTML = '';
    servers.forEach(function(server, idx) {
        if (!canEditServer(idx)) return;
        const card = document.createElement('div');
        card.className = 'server-card' + (idx === currentServerIndex ? ' active' : '');
        const statusIcon = server.status === 'online' ? '🟢' : server.status === 'maintenance' ? '🟠' : '🔴';
        const canDelete = currentUser && currentUser.isAdmin && idx !== 0;
        card.innerHTML = '<div class="server-info"><span class="server-icon">🌐</span><div><div class="server-name">' + escapeHtml(server.name) + '</div><div class="server-status-text">' + statusIcon + ' ' + escapeHtml(server.status) + '</div></div></div><div class="server-actions"><button class="btn btn-primary btn-sm" onclick="switchToServer(' + idx + ')">OK</button>' + (canDelete ? '<button class="btn btn-danger btn-sm" onclick="deleteServer(' + idx + ')">🗑️</button>' : '') + '</div>';
        container.appendChild(card);
    });
}

function switchToServer(idx) {
    loadServer(idx);
    renderServersList();
}

async function deleteServer(idx) {
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) return;
    if (servers.length <= 1) { alert('⚠️ Нельзя удалить последний сервер'); return; }
    const server = servers[idx];
    if (!server || !server.id) { alert('⚠️ Этот сервер ещё не сохранён в базе'); return; }
    if (!confirm('⚠️ Удалить ветку "' + server.name + '"?')) return;

    const { error } = await supabaseClient.from('servers').delete().eq('id', server.id);
    if (error) { alert('❌ Не удалось удалить: ' + error.message); return; }
    servers.splice(idx, 1);
    if (currentServerIndex >= servers.length) currentServerIndex = 0;
    loadServer(currentServerIndex);
    renderServersList();
    renderServersPage();
}

function loadAdminSettings() {
    const server = servers[currentServerIndex];
    if (!server) return;
    const status = document.getElementById('admin-status');
    const desc = document.getElementById('admin-description');
    const version = document.getElementById('admin-version');
    const title = document.getElementById('admin-features-title');
    if (status) status.value = server.status || 'online';
    if (desc) desc.value = server.description || '';
    if (version) version.value = server.version || '';
    if (title) title.value = server.featuresTitle || 'Почему ' + server.name + '?';
    renderAdminIps();
    renderAdminBuilds();
    renderAdminFeaturesCustom();
    renderAdminStatsCustom();
}

function renderAdminIps() {
    const container = document.getElementById('admin-ips-list');
    if (!container) return;
    container.innerHTML = '';
    const server = servers[currentServerIndex];
    (server.ips || []).forEach(function(item, idx) {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px';
        div.innerHTML = '<input type="text" class="form-input" value="' + escapeHtml(item.name || '') + '" data-idx="' + idx + '" data-field="name" style="flex:1;"><input type="text" class="form-input" value="' + escapeHtml(item.ip || '') + '" data-idx="' + idx + '" data-field="ip" style="flex:1;"><button class="btn btn-danger" type="button" onclick="removeIp(' + idx + ')">🗑️</button>';
        container.appendChild(div);
    });
}

function renderAdminBuilds() {
    const container = document.getElementById('admin-builds-list');
    if (!container) return;
    container.innerHTML = '';
    const server = servers[currentServerIndex];
    (server.builds || []).forEach(function(item, idx) {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px';
        div.innerHTML = '<input type="text" class="form-input" value="' + escapeHtml(item.name || '') + '" data-idx="' + idx + '" data-field="name" style="flex:1;"><input type="text" class="form-input" value="' + escapeHtml(item.url || '') + '" data-idx="' + idx + '" data-field="url" style="flex:1;"><button class="btn btn-danger" type="button" onclick="removeBuild(' + idx + ')">🗑️</button>';
        container.appendChild(div);
    });
}

function renderAdminFeaturesCustom() {
    const container = document.getElementById('admin-features-custom');
    if (!container) return;
    container.innerHTML = '';
    const server = servers[currentServerIndex];
    const features = server.features || [];
    for (let i = 0; i < 4; i++) {
        const f = features[i] || { icon: '⭐', title: '', desc: '' };
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '8px'; div.style.marginBottom = '8px'; div.style.alignItems = 'center';
        div.innerHTML = '<span style="min-width:20px;">' + (i + 1) + '.</span><input type="text" class="form-input" value="' + escapeHtml(f.icon || '') + '" id="f-icon-' + i + '" style="width:50px;" placeholder="📖"><input type="text" class="form-input" value="' + escapeHtml(f.title || '') + '" id="f-title-' + i + '" style="flex:1;" placeholder="Название"><input type="text" class="form-input" value="' + escapeHtml(f.desc || '') + '" id="f-desc-' + i + '" style="flex:2;" placeholder="Описание">';
        container.appendChild(div);
    }
}

function renderAdminStatsCustom() {
    const container = document.getElementById('admin-stats-custom');
    if (!container) return;
    container.innerHTML = '';
    const server = servers[currentServerIndex];
    const stats = server.stats || [];
    for (let i = 0; i < 4; i++) {
        const s = stats[i] || { icon: '⭐', value: '', label: '' };
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '8px'; div.style.marginBottom = '8px'; div.style.alignItems = 'center';
        div.innerHTML = '<span style="min-width:20px;">' + (i + 1) + '.</span><input type="text" class="form-input" value="' + escapeHtml(s.icon || '') + '" id="s-icon-' + i + '" style="width:50px;" placeholder="🎮"><input type="text" class="form-input" value="' + escapeHtml(s.value || '') + '" id="s-value-' + i + '" style="width:80px;" placeholder="1.20.4"><input type="text" class="form-input" value="' + escapeHtml(s.label || '') + '" id="s-label-' + i + '" style="flex:1;" placeholder="Версия">';
        container.appendChild(div);
    }
}

function addNewIpField() {
    const server = servers[currentServerIndex];
    if (!server) return;
    server.ips = server.ips || [];
    server.ips.push({ name: 'IP', ip: 'play.example.com' });
    renderAdminIps();
}

function addNewBuildField() {
    const server = servers[currentServerIndex];
    if (!server) return;
    server.builds = server.builds || [];
    server.builds.push({ name: 'Сборка', url: 'https://example.com/build.zip' });
    renderAdminBuilds();
}

function removeIp(idx) {
    const server = servers[currentServerIndex];
    if (!server) return;
    if ((server.ips || []).length <= 1) { alert('⚠️ Должен остаться хотя бы один IP'); return; }
    server.ips.splice(idx, 1);
    renderAdminIps();
}

function removeBuild(idx) {
    const server = servers[currentServerIndex];
    if (!server) return;
    if ((server.builds || []).length <= 1) { alert('⚠️ Должна остаться хотя бы одна сборка'); return; }
    server.builds.splice(idx, 1);
    renderAdminBuilds();
}

async function saveAdminSettings() {
    if (!currentUser || !canAccessAdmin() || !supabaseReady) return;
    const server = servers[currentServerIndex];
    if (!server) return;

    server.status = document.getElementById('admin-status').value;
    server.description = document.getElementById('admin-description').value.trim();
    server.version = document.getElementById('admin-version').value.trim();
    server.featuresTitle = document.getElementById('admin-features-title').value.trim();

    const ipInputs = document.querySelectorAll('#admin-ips-list input');
    const newIps = [];
    for (let i = 0; i < ipInputs.length; i += 2) {
        if (ipInputs[i] && ipInputs[i + 1]) newIps.push({ name: ipInputs[i].value.trim(), ip: ipInputs[i + 1].value.trim() });
    }
    server.ips = newIps;

    const buildInputs = document.querySelectorAll('#admin-builds-list input');
    const newBuilds = [];
    for (let j = 0; j < buildInputs.length; j += 2) {
        if (buildInputs[j] && buildInputs[j + 1]) newBuilds.push({ name: buildInputs[j].value.trim(), url: buildInputs[j + 1].value.trim() });
    }
    server.builds = newBuilds;

    const newFeatures = [];
    for (let k = 0; k < 4; k++) {
        const icon = document.getElementById('f-icon-' + k);
        const title = document.getElementById('f-title-' + k);
        const desc = document.getElementById('f-desc-' + k);
        if (icon && title && desc) newFeatures.push({ icon: icon.value.trim(), title: title.value.trim(), desc: desc.value.trim() });
    }
    server.features = newFeatures;

    const newStats = [];
    for (let m = 0; m < 4; m++) {
        const icon = document.getElementById('s-icon-' + m);
        const value = document.getElementById('s-value-' + m);
        const label = document.getElementById('s-label-' + m);
        if (icon && value && label) newStats.push({ icon: icon.value.trim(), value: value.value.trim(), label: label.value.trim() });
    }
    server.stats = newStats;

    if (!server.id) {
        const { data, error } = await supabaseClient.from('servers').insert(serverToDb(server)).select().single();
        if (error) { alert('❌ Не удалось сохранить сервер: ' + error.message); return; }
        servers[currentServerIndex] = normalizeServer(data);
    } else {
        const { data, error } = await supabaseClient.from('servers').update(serverToDb(server)).eq('id', server.id).select().single();
        if (error) { alert('❌ Не удалось сохранить: ' + error.message); return; }
        if (data) servers[currentServerIndex] = normalizeServer(data);
    }

    loadServer(currentServerIndex);
    renderServersList();
    const msgEl = document.getElementById('admin-save-msg');
    if (msgEl) {
        msgEl.textContent = '✅ Сохранено!';
        setTimeout(function() { msgEl.textContent = ''; }, 3000);
    }
}

function renderUsersList() {
    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = '';
    if (!currentUser || !currentUser.isAdmin) return;
    users.forEach(function(u) {
        const isCurrentUser = currentUser && currentUser.id === u.id;
        const card = document.createElement('div');
        card.className = 'user-card' + (u.rank === 'Гл.Админ' || u.rank === 'Мл.Админ' ? ' admin' : '');
        card.dataset.username = String(u.username || '').toLowerCase();
        let roleText = u.rank || 'Игрок';
        if (u.chief_for !== null && u.chief_for !== undefined && servers[u.chief_for]) roleText = '👑 Главный за ' + servers[u.chief_for].name;
        else if (u.helper_for !== null && u.helper_for !== undefined && servers[u.helper_for]) roleText = '🔹 Помощник ' + servers[u.helper_for].name;
        let actionsHtml = '';
        if (!isCurrentUser) {
            actionsHtml = '<div class="user-actions"><button class="btn btn-primary btn-sm" onclick="openAssignModal(\'' + escapeJs(u.username) + '\')">🎯</button><button class="btn btn-secondary btn-sm" onclick="openPromoteModal(\'' + escapeJs(u.username) + '\')">👑</button></div>';
        }
        card.innerHTML = '<div class="user-row"><span class="user-label">👤</span><span class="user-value">' + escapeHtml(u.username) + '</span></div><div class="user-row"><span class="user-label">📧</span><span class="user-value">' + escapeHtml(u.email || '-') + '</span></div><div class="user-row"><span class="user-label">🏷️</span><span class="user-value">' + escapeHtml(roleText) + '</span></div>' + actionsHtml;
        container.appendChild(card);
    });
}

function filterUsers() {
    const input = document.getElementById('user-search');
    const value = input ? input.value.trim().toLowerCase() : '';
    document.querySelectorAll('#users-list .user-card').forEach(function(card) {
        card.style.display = !value || (card.dataset.username || '').includes(value) ? '' : 'none';
    });
}

function openAssignModal(username) {
    document.getElementById('assign-username').value = username;
    const select = document.getElementById('assign-server');
    select.innerHTML = '';
    servers.forEach(function(s, idx) {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
    document.getElementById('assign-role-modal').classList.add('show');
}

function closeAssignModal() { document.getElementById('assign-role-modal').classList.remove('show'); }
function openPromoteModal(username) { document.getElementById('promote-username').value = username; document.getElementById('promote-modal').classList.add('show'); }
function closePromoteModal() { document.getElementById('promote-modal').classList.remove('show'); }
function showAddServerModal() { document.getElementById('add-server-modal').classList.add('show'); }
function closeAddServerModal() { document.getElementById('add-server-modal').classList.remove('show'); document.getElementById('add-server-form').reset(); }

function renderAdminAllQuestions() {
    const container = document.getElementById('admin-all-questions');
    if (!container) return;
    container.innerHTML = '';
    const allQuestions = questions.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    if (allQuestions.length === 0) { container.innerHTML = '<div class="question-item placeholder"><p>Нет вопросов</p></div>'; return; }
    allQuestions.forEach(function(q) { container.appendChild(createQuestionCard(q)); });
}

function downloadBuild(url) { if (url) window.open(url, '_blank', 'noopener'); }

function renderQuestions() {
    const list = document.getElementById('questions-list');
    const adminList = document.getElementById('admin-questions-list');
    if (!list || !adminList) return;
    const myQuestions = currentUser ? questions.filter(function(q) { return q.userId === currentUser.id || q.author === currentUser.username; }) : [];
    const allQuestions = questions.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    list.innerHTML = myQuestions.length ? '' : '<div class="question-item placeholder"><p>📭</p></div>';
    adminList.innerHTML = allQuestions.length ? '' : '<div class="question-item placeholder"><p>📥</p></div>';
    myQuestions.forEach(function(q) { if (!q.closed) list.appendChild(createQuestionCard(q)); });
    if (currentUser && currentUser.isAdmin) allQuestions.filter(function(q) { return !q.closed; }).forEach(function(q) { adminList.appendChild(createQuestionCard(q)); });
}

function createQuestionCard(q) {
    const card = document.createElement('div');
    card.className = 'question-item';
    if (q.isUrgent) card.classList.add('urgent');
    if (q.closed) card.classList.add('closed');
    const answered = !!q.answer || (q.answers && q.answers.length > 0);
    const statusClass = q.closed ? 'status-closed' : (answered ? 'status-answered' : 'status-open');
    const statusText = q.closed ? '✅' : (answered ? '💬' : '⏳');
    card.innerHTML = '<div class="question-row"><div class="question-title">' + escapeHtml(q.title) + '</div><span class="status ' + statusClass + '">' + statusText + '</span></div><div class="question-details">' + escapeHtml(q.author) + ' • ' + escapeHtml(q.date) + '</div>';
    card.onclick = function() { openQuestionView(q.id); };
    return card;
}

function showNewQuestionModal() {
    if (!currentUser) { alert('⚠️ Войдите'); navigateTo('auth'); return; }
    document.getElementById('new-question-modal').classList.add('show');
}
function closeModal() { document.getElementById('new-question-modal').classList.remove('show'); }

async function handleQuestionSubmit(e) {
    e.preventDefault();
    if (!currentUser || !supabaseReady) return;
    const title = document.getElementById('question-title').value.trim();
    const category = document.getElementById('question-category').value;
    const text = document.getElementById('question-text').value.trim();
    if (!title || !text) return;

    const row = {
        user_id: currentUser.id,
        username: currentUser.username,
        title: title,
        category: category,
        description: text,
        date: new Date().toLocaleString('ru-RU'),
        answer: null,
        answer_by: null,
        answers: [],
        is_urgent: category === 'password',
        closed: false
    };
    const { error } = await supabaseClient.from('questions').insert(row);
    if (error) { alert('❌ Не удалось отправить вопрос: ' + error.message); return; }
    closeModal();
    e.target.reset();
    await loadQuestions();
    renderQuestions();
}

function openQuestionView(id) {
    const q = questions.find(function(x) { return String(x.id) === String(id); });
    if (!q) return;
    document.getElementById('view-question-title').textContent = q.title;
    document.getElementById('view-question-author').textContent = q.author;
    document.getElementById('view-question-date').textContent = q.date;
    document.getElementById('view-question-category').textContent = getCategoryName(q.category);
    document.getElementById('view-question-text').textContent = q.text;
    document.getElementById('view-question-status-badge').classList.toggle('show', q.isUrgent);
    const answersList = document.getElementById('view-question-answers');
    answersList.innerHTML = '';
    if (q.answers && q.answers.length > 0) {
        q.answers.forEach(function(ans) {
            const div = document.createElement('div');
            div.className = 'answer-item';
            div.innerHTML = '<div class="answer-meta">' + escapeHtml(ans.by || '') + '</div><div>' + escapeHtml(ans.text || '') + '</div>';
            answersList.appendChild(div);
        });
    } else if (q.answer) {
        const div = document.createElement('div');
        div.className = 'answer-item';
        div.innerHTML = '<div class="answer-meta">' + escapeHtml(q.answerBy || 'Админ') + '</div><div>' + escapeHtml(q.answer) + '</div>';
        answersList.appendChild(div);
    } else {
        answersList.innerHTML = '<p class="no-answer">⏳</p>';
    }

    const answerForm = document.getElementById('admin-answer-form');
    const playerComplete = document.getElementById('player-complete-section');
    if (currentUser && currentUser.isAdmin) {
        answerForm.style.display = 'block';
        playerComplete.style.display = 'none';
    } else if (currentUser && q.userId === currentUser.id && !q.closed) {
        answerForm.style.display = 'none';
        playerComplete.style.display = 'block';
    } else {
        answerForm.style.display = 'none';
        playerComplete.style.display = 'none';
    }
    document.getElementById('view-question-modal').classList.add('show');
    window.currentViewQuestionId = q.id;
}

function closeViewModal() {
    document.getElementById('view-question-modal').classList.remove('show');
    renderQuestions();
}

async function submitAnswer() {
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) return;
    const text = document.getElementById('answer-text').value.trim();
    const id = window.currentViewQuestionId;
    if (!text || !id) return;
    const q = questions.find(function(x) { return String(x.id) === String(id); });
    if (!q) return;
    const answers = Array.isArray(q.answers) ? q.answers.slice() : [];
    answers.push({ text: text, by: currentUser.username, date: new Date().toLocaleString('ru-RU') });
    const { error } = await supabaseClient.from('questions').update({ answers: answers, answer: text, answer_by: currentUser.username }).eq('id', q.id);
    if (error) { alert('❌ Не удалось отправить ответ: ' + error.message); return; }
    document.getElementById('answer-text').value = '';
    await loadQuestions();
    openQuestionView(id);
}

async function completeQuestion() {
    if (!currentUser || !currentUser.isAdmin || !supabaseReady) return;
    const id = window.currentViewQuestionId;
    if (!id) return;
    const { error } = await supabaseClient.from('questions').update({ closed: true }).eq('id', id);
    if (error) { alert('❌ Не удалось закрыть вопрос: ' + error.message); return; }
    await loadQuestions();
    closeViewModal();
}

async function playerCompleteQuestion() {
    if (!currentUser || !supabaseReady) return;
    const id = window.currentViewQuestionId;
    const q = questions.find(function(x) { return String(x.id) === String(id); });
    if (!q || q.userId !== currentUser.id) return;
    const { error } = await supabaseClient.from('questions').update({ closed: true }).eq('id', id);
    if (error) { alert('❌ Не удалось закрыть вопрос: ' + error.message); return; }
    await loadQuestions();
    closeViewModal();
}

function showForgotPassword() {
    document.getElementById('forgot-card').style.display = 'block';
    const loginCard = document.querySelector('#auth-page .auth-card:not(#register-card):not(#forgot-card)');
    if (loginCard) loginCard.style.display = 'none';
    document.getElementById('register-card').style.display = 'none';
}
function showRegister() {
    document.getElementById('register-card').style.display = 'block';
    const loginCard = document.querySelector('#auth-page .auth-card:not(#register-card):not(#forgot-card)');
    if (loginCard) loginCard.style.display = 'none';
    document.getElementById('forgot-card').style.display = 'none';
}
function showLogin() {
    document.getElementById('register-card').style.display = 'none';
    document.getElementById('forgot-card').style.display = 'none';
    const loginCard = document.querySelector('#auth-page .auth-card:not(#register-card):not(#forgot-card)');
    if (loginCard) loginCard.style.display = 'block';
}

async function changePassword() {
    if (!currentUser || !supabaseReady) return;
    const newPass = prompt('🔑 Новый пароль:');
    if (!newPass || newPass.length < 4) { if (newPass !== null) alert('❌ Минимум 4 символа'); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    if (error) { alert('❌ ' + error.message); return; }
    alert('✅ Пароль изменён');
}

async function deleteAccount() {
    if (!currentUser) return;
    alert('ℹ️ Полное удаление аккаунта Auth нельзя безопасно выполнить из браузера. Для выхода используйте кнопку «Выйти».');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function escapeJs(text) {
    return String(text == null ? '' : text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '\\n');
}

function getCategoryName(cat) {
    const map = { technical: '🔧', gameplay: '🎮', donation: '💎', other: '❓', password: '🔑' };
    return map[cat] || cat;
}

function copyIP(ip) {
    if (!ip) return;
    const done = function() {
        const msg = document.getElementById('ip-copy-msg');
        if (msg) {
            msg.textContent = '✅ IP скопирован: ' + ip;
            setTimeout(function() { msg.textContent = ''; }, 4000);
        }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ip).then(done).catch(function() { fallbackCopy(ip, done); });
    } else fallbackCopy(ip, done);
}

function fallbackCopy(text, callback) {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.appendChild(input);
    input.focus(); input.select();
    try { document.execCommand('copy'); } catch (e) {}
    input.remove();
    callback();
}

Object.assign(window, {
    navigateTo,
    switchAdminTab,
    switchToServer,
    deleteServer,
    addNewIpField,
    addNewBuildField,
    removeIp,
    removeBuild,
    saveAdminSettings,
    filterUsers,
    openAssignModal,
    closeAssignModal,
    openPromoteModal,
    closePromoteModal,
    showAddServerModal,
    closeAddServerModal,
    showNewQuestionModal,
    closeModal,
    openQuestionView,
    closeViewModal,
    submitAnswer,
    completeQuestion,
    playerCompleteQuestion,
    showForgotPassword,
    showRegister,
    showLogin,
    changePassword,
    deleteAccount,
    logout,
    copyIP,
    downloadBuild
});
