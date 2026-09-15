/*
 * CRISTALHILLS — FULL SCRIPT
 * Minecraft server website + Supabase
 *
 * ВАЖНО:
 * 1. Этот файл рассчитан на оригинальный index.html и style.css Cristalhills.
 * 2. Пароли и service_role key здесь НЕ хранятся.
 * 3. Publishable key можно использовать в браузере.
 */

const SUPABASE_URL = 'https://zedgouirmabujahlpbjq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1SJJwVyWmCzNy4htOLvnGA_hAZOhYXJ';

let supabaseClient = null;
let currentUser = null;
let questions = [];
let users = [];
let servers = [];
let currentServerIndex = Number.parseInt(localStorage.getItem('cristalhills_current_server') || '0', 10);
if (!Number.isInteger(currentServerIndex) || currentServerIndex < 0) currentServerIndex = 0;

window.currentViewQuestionId = null;

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

/* =========================
   БАЗОВЫЕ УТИЛИТЫ
========================= */

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function escapeJs(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ru-RU');
}

function showError(id, message) {
    const element = document.getElementById(id);
    if (element) element.textContent = message || '';
}

function showSuccess(id, message) {
    const element = document.getElementById(id);
    if (element) element.textContent = message || '';
}

function getCategoryName(category) {
    const map = {
        technical: '🔧',
        gameplay: '🎮',
        donation: '💎',
        other: '❓',
        password: '🔑'
    };
    return map[category] || category || '❓';
}

function isAdmin() {
    return !!currentUser && (currentUser.rank === 'Гл.Админ' || currentUser.rank === 'Мл.Админ');
}

function canAccessAdmin() {
    if (!currentUser) return false;
    return isAdmin() || Number.isInteger(currentUser.chiefFor) || Number.isInteger(currentUser.helperFor);
}

function canEditServer(index) {
    if (!currentUser) return false;
    if (isAdmin()) return true;
    return currentUser.chiefFor === index || currentUser.helperFor === index;
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

/* =========================
   SUPABASE
========================= */

function getSupabase() {
    if (!supabaseClient) {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Supabase не загрузился. Проверьте подключение Supabase CDN в index.html.');
        }
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );
    }
    return supabaseClient;
}

function mapServer(row) {
    return {
        id: row.id,
        name: row.name || 'Без названия',
        status: row.status || 'offline',
        description: row.description || '',
        version: row.version || '',
        ips: normalizeArray(row.ips),
        builds: normalizeArray(row.builds),
        featuresTitle: row.features_title || row.featuresTitle || '',
        features: normalizeArray(row.features),
        stats: normalizeArray(row.stats),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function serverPayload(server) {
    return {
        name: server.name || 'Без названия',
        status: server.status || 'offline',
        description: server.description || '',
        version: server.version || '',
        ips: normalizeArray(server.ips),
        builds: normalizeArray(server.builds),
        features_title: server.featuresTitle || '',
        features: normalizeArray(server.features),
        stats: normalizeArray(server.stats),
        updated_at: new Date().toISOString()
    };
}

async function loadServers() {
    const client = getSupabase();
    const result = await client
        .from('servers')
        .select('*')
        .order('id', { ascending: true });

    if (result.error) {
        console.error('Ошибка загрузки servers:', result.error);
        servers = [JSON.parse(JSON.stringify(DEFAULT_SERVER))];
        currentServerIndex = 0;
        return false;
    }

    servers = (result.data || []).map(mapServer);

    if (!servers.length) {
        // Локальная демонстрационная ветка только для отображения.
        // Она не считается записью Supabase и не сохраняется сама.
        servers = [JSON.parse(JSON.stringify(DEFAULT_SERVER))];
    }

    if (currentServerIndex >= servers.length) currentServerIndex = 0;
    if (currentServerIndex < 0) currentServerIndex = 0;
    localStorage.setItem('cristalhills_current_server', String(currentServerIndex));
    return true;
}

function mapQuestion(row) {
    return {
        id: row.id,
        userId: row.user_id,
        author: row.username || 'Неизвестный',
        title: row.title || 'Без названия',
        category: row.category || 'other',
        text: row.description || '',
        date: row.date || row.created_at || '',
        answer: row.answer || null,
        answerBy: row.answer_by || null,
        answers: normalizeArray(row.answers),
        isUrgent: !!row.is_urgent,
        closed: !!row.closed
    };
}

async function loadQuestions() {
    if (!currentUser) {
        questions = [];
        return true;
    }

    const client = getSupabase();
    const result = await client
        .from('questions')
        .select('*')
        .order('id', { ascending: false });

    if (result.error) {
        console.error('Ошибка загрузки questions:', result.error);
        return false;
    }

    questions = (result.data || []).map(mapQuestion);
    return true;
}

async function loadUsers() {
    if (!isAdmin()) {
        users = [];
        return true;
    }

    const client = getSupabase();
    const result = await client
        .from('profiles')
        .select('id,username,email,rank,chief_for,helper_for,created_at,last_login')
        .order('created_at', { ascending: false });

    if (result.error) {
        console.error('Ошибка загрузки profiles:', result.error);
        users = [];
        return false;
    }

    users = (result.data || []).map(profile => ({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        rank: profile.rank || 'Игрок',
        chiefFor: profile.chief_for,
        helperFor: profile.helper_for,
        createdAt: profile.created_at,
        lastLogin: profile.last_login
    }));

    return true;
}

async function loadCurrentUserFromSession(session) {
    if (!session || !session.user) {
        currentUser = null;
        return;
    }

    const client = getSupabase();
    const result = await client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

    if (result.error) {
        console.error('Ошибка загрузки профиля:', result.error);
        currentUser = {
            id: session.user.id,
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Игрок',
            email: session.user.email || '',
            rank: 'Игрок',
            chiefFor: null,
            helperFor: null,
            createdAt: session.user.created_at,
            lastLogin: session.user.last_sign_in_at
        };
        return;
    }

    if (result.data) {
        currentUser = {
            id: result.data.id,
            username: result.data.username,
            email: result.data.email || session.user.email || '',
            rank: result.data.rank || 'Игрок',
            chiefFor: result.data.chief_for,
            helperFor: result.data.helper_for,
            createdAt: result.data.created_at,
            lastLogin: result.data.last_login || session.user.last_sign_in_at
        };
    } else {
        currentUser = {
            id: session.user.id,
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Игрок',
            email: session.user.email || '',
            rank: 'Игрок',
            chiefFor: null,
            helperFor: null,
            createdAt: session.user.created_at,
            lastLogin: session.user.last_sign_in_at
        };
    }
}

/* =========================
   ИНИЦИАЛИЗАЦИЯ
========================= */

async function initialize() {
    setupNavigation();
    setupForms();
    updateUI();
    updateProfile();

    const client = getSupabase();
    const sessionResult = await client.auth.getSession();
    if (sessionResult.error) console.error('getSession:', sessionResult.error);

    await loadCurrentUserFromSession(sessionResult.data?.session || null);
    await loadServers();
    await loadQuestions();
    await loadUsers();

    updateUI();
    updateProfile();
    loadServer(currentServerIndex);
    renderServersPage();
    renderQuestions();

    if (canAccessAdmin()) {
        renderServersList();
        loadAdminSettings();
        renderUsersList();
        renderAdminAllQuestions();
    }

    setupRealtime();
}

document.addEventListener('DOMContentLoaded', function () {
    initialize().catch(function (error) {
        console.error('Критическая ошибка инициализации:', error);
        alert('Не удалось загрузить данные сайта. Обновите страницу и проверьте F12 → Console.');
    });
});

function setupRealtime() {
    const client = getSupabase();

    client
        .channel('cristalhills-servers')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'servers' },
            async function () {
                await loadServers();
                loadServer(currentServerIndex);
                renderServersPage();
                if (canAccessAdmin()) renderServersList();
            }
        )
        .subscribe();

    client
        .channel('cristalhills-questions')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'questions' },
            async function () {
                if (!currentUser) return;
                await loadQuestions();
                renderQuestions();
                if (canAccessAdmin()) renderAdminAllQuestions();
            }
        )
        .subscribe();

    client
        .channel('cristalhills-profiles')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            async function () {
                if (!currentUser) return;
                const sessionResult = await client.auth.getSession();
                await loadCurrentUserFromSession(sessionResult.data?.session || null);
                await loadUsers();
                updateUI();
                updateProfile();
            }
        )
        .subscribe();

    client.auth.onAuthStateChange(function (event, session) {
        // Не делаем тяжёлые запросы непосредственно внутри callback,
        // чтобы не создавать цепочки auth-lock.
        setTimeout(async function () {
            try {
                if (event === 'SIGNED_OUT' || !session) {
                    currentUser = null;
                    questions = [];
                    users = [];
                    updateUI();
                    updateProfile();
                    return;
                }

                await loadCurrentUserFromSession(session);
                await loadQuestions();
                await loadUsers();
                updateUI();
                updateProfile();
                renderQuestions();
            } catch (error) {
                console.error('Auth state error:', error);
            }
        }, 0);
    });
}

/* =========================
   СЕРВЕР
========================= */

function loadServer(index) {
    if (!servers.length) return;

    let idx = Number(index);
    if (!Number.isInteger(idx)) idx = 0;
    idx = Math.max(0, Math.min(idx, servers.length - 1));

    currentServerIndex = idx;
    localStorage.setItem('cristalhills_current_server', String(idx));

    const server = servers[idx];
    if (!server) return;

    const currentServerName = document.getElementById('current-server-name');
    if (currentServerName) currentServerName.textContent = server.name;

    const heroName = document.getElementById('hero-server-name');
    if (heroName) {
        // Не вставляем сырые данные сервера через innerHTML.
        // Для сохранения оригинального визуального эффекта выделяем последнюю часть.
        const safeName = String(server.name || 'Cristalhills');
        const match = safeName.match(/^(.+?)([A-Za-zА-Яа-я0-9]+)$/);
        if (match && match[1]) {
            heroName.innerHTML = escapeHtml(match[1]) + '<span class="highlight">' + escapeHtml(match[2]) + '</span>';
        } else {
            heroName.textContent = safeName;
        }
    }

    const statusEl = document.getElementById('server-status');
    const statusText = document.getElementById('status-text');
    if (statusEl && statusText) {
        statusEl.className = 'server-status ' + (server.status || 'offline');
        const statusMap = {
            online: 'Сервер онлайн',
            maintenance: 'Обслуживание',
            offline: 'Оффлайн'
        };
        statusText.textContent = statusMap[server.status] || 'Оффлайн';
    }

    const setText = function (id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value == null ? '' : String(value);
    };

    setText('hero-description', server.description);
    setText('mc-version', server.version);
    setText('features-title', server.featuresTitle || 'Почему ' + server.name + '?');

    const defaultFeatures = DEFAULT_SERVER.features;
    const features = normalizeArray(server.features);
    for (let i = 0; i < 4; i++) {
        const feature = features[i] || defaultFeatures[i];
        setText('feature-icon-' + (i + 1), feature.icon || '⭐');
        setText('feature-title-' + (i + 1), feature.title || '');
        setText('feature-desc-' + (i + 1), feature.desc || '');
    }

    const defaultStats = DEFAULT_SERVER.stats;
    const stats = normalizeArray(server.stats);
    for (let i = 0; i < 4; i++) {
        const stat = stats[i] || defaultStats[i];
        setText('stat-icon-' + (i + 1), stat.icon || '⭐');
        setText('stat-value-' + (i + 1), stat.value || '');
        setText('stat-label-' + (i + 1), stat.label || '');
    }

    const ipContainer = document.getElementById('ip-buttons');
    if (ipContainer) {
        ipContainer.innerHTML = '';

        normalizeArray(server.ips).forEach(function (item) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-primary btn-lg';
            button.innerHTML =
                '<span class="btn-main">📋 ' + escapeHtml(item.ip || '') + '</span>' +
                '<span class="btn-sub">' + escapeHtml(item.name || 'IP') + '</span>';
            button.addEventListener('click', function () {
                copyIP(item.ip || '');
            });
            ipContainer.appendChild(button);
        });

        normalizeArray(server.builds).forEach(function (item) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-secondary btn-lg';
            button.innerHTML =
                '<span class="btn-main">📥 ' + escapeHtml(item.name || 'Сборка') + '</span>' +
                '<span class="btn-sub">Скачать</span>';
            button.addEventListener('click', function () {
                downloadBuild(item.url || '');
            });
            ipContainer.appendChild(button);
        });
    }

    renderServersPage();
}

function renderServersPage() {
    const grid = document.getElementById('servers-page-grid');
    if (!grid) return;

    grid.innerHTML = '';

    servers.forEach(function (server, index) {
        const card = document.createElement('div');
        card.className = 'server-page-card' + (index === currentServerIndex ? ' active' : '');

        const statusIcon = server.status === 'online'
            ? '🟢'
            : server.status === 'maintenance'
                ? '🟠'
                : '🔴';

        const statusText = server.status === 'online'
            ? 'Онлайн'
            : server.status === 'maintenance'
                ? 'Обслуживание'
                : 'Оффлайн';

        card.innerHTML =
            '<div class="server-page-header">' +
                '<span class="server-page-icon">🌐</span>' +
                '<div class="server-page-name">' + escapeHtml(server.name) + '</div>' +
            '</div>' +
            '<div class="server-page-status">' + statusIcon + ' ' + statusText + '</div>' +
            '<button type="button" class="btn btn-primary server-page-btn">Выбрать</button>';

        card.addEventListener('click', function () {
            loadServer(index);
            navigateTo('home');
        });

        grid.appendChild(card);
    });
}

/* =========================
   НАВИГАЦИЯ
========================= */

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(function (link) {
        if (link.dataset.bound === 'true') return;
        link.dataset.bound = 'true';

        link.addEventListener('click', function (event) {
            event.preventDefault();

            const page = link.dataset.page;

            if (page === 'auth') {
                navigateTo(currentUser ? 'profile' : 'auth');
                return;
            }

            if (page === 'profile' && !currentUser) {
                navigateTo('auth');
                return;
            }

            if (page === 'admin') {
                if (canAccessAdmin()) navigateTo('admin');
                else alert('⛔ Нет доступа к админ-панели.');
                return;
            }

            if (page === 'servers-list') {
                renderServersPage();
                navigateTo('servers-list');
                return;
            }

            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    const target = document.getElementById(page + '-page');
    if (!target) return;

    document.querySelectorAll('.page').forEach(function (element) {
        element.classList.remove('active');
    });

    document.querySelectorAll('.nav-link').forEach(function (element) {
        element.classList.remove('active');
    });

    target.classList.add('active');

    const activeLink = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('active');

    if (page === 'support') {
        renderQuestions();
    }

    if (page === 'profile') {
        updateProfile();
    }

    if (page === 'admin') {
        if (!canAccessAdmin()) {
            navigateTo('auth');
            return;
        }
        renderServersList();
        loadAdminSettings();
        renderUsersList();
        renderAdminAllQuestions();
    }
}

/* =========================
   ФОРМЫ / АВТОРИЗАЦИЯ
========================= */

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

    forms.forEach(function (item) {
        const form = document.getElementById(item[0]);
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';
        form.addEventListener('submit', item[1]);
    });
}

async function getEmailByUsername(username) {
    const client = getSupabase();
    const result = await client.rpc('get_email_by_username', {
        p_username: username
    });

    if (result.error) throw result.error;

    // SQL-функция возвращает text. Эта обработка также переживёт
    // старый вариант функции, если он вдруг возвращает массив/объект.
    if (typeof result.data === 'string') return result.data;
    if (Array.isArray(result.data)) {
        if (typeof result.data[0] === 'string') return result.data[0];
        return result.data[0]?.email || null;
    }
    if (result.data && typeof result.data === 'object') {
        return result.data.email || null;
    }
    return null;
}

async function handleLogin(event) {
    event.preventDefault();

    showError('login-error', '');

    const username = document.getElementById('login-username')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';

    if (!username || !password) {
        showError('login-error', '❌ Введите логин и пароль.');
        return;
    }

    try {
        const email = await getEmailByUsername(username);

        if (!email) {
            showError('login-error', '❌ Пользователь с таким логином не найден.');
            return;
        }

        const client = getSupabase();
        const result = await client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (result.error) throw result.error;
        if (!result.data?.session) {
            showError('login-error', '❌ Не удалось создать сессию.');
            return;
        }

        await loadCurrentUserFromSession(result.data.session);

        // Обновляем last_login. Если RLS запрещает этот UPDATE,
        // сам вход всё равно не ломаем.
        if (currentUser?.id) {
            const loginUpdate = await client
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('id', currentUser.id);

            if (loginUpdate.error) {
                console.warn('Не удалось обновить last_login:', loginUpdate.error);
            } else {
                currentUser.lastLogin = new Date().toISOString();
            }
        }

        await loadCurrentUserFromSession(result.data.session);
        await loadQuestions();
        await loadUsers();

        updateUI();
        updateProfile();
        renderQuestions();
        document.getElementById('login-form')?.reset();
        navigateTo('profile');
    } catch (error) {
        console.error('Ошибка входа:', error);

        let message = error?.message || 'Не удалось войти.';
        if (/invalid login credentials/i.test(message)) {
            message = '❌ Неверный логин или пароль.';
        }
        if (/email not confirmed/i.test(message)) {
            message = '❌ Подтвердите email через письмо от Supabase.';
        }

        showError('login-error', message);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    showError('register-error', '');
    showSuccess('register-success', '');

    const username = document.getElementById('register-username')?.value.trim() || '';
    const email = document.getElementById('register-email')?.value.trim() || '';
    const password = document.getElementById('register-password')?.value || '';
    const confirm = document.getElementById('register-confirm')?.value || '';

    if (!/^[A-Za-zА-Яа-яЁё0-9_\-]{3,24}$/.test(username)) {
        showError('register-error', '❌ Ник: 3–24 символа, только буквы, цифры, _ или -.');
        return;
    }

    if (password.length < 4) {
        showError('register-error', '❌ Пароль должен содержать минимум 4 символа.');
        return;
    }

    if (password !== confirm) {
        showError('register-error', '❌ Пароли не совпадают.');
        return;
    }

    try {
        const existingEmail = await getEmailByUsername(username);
        if (existingEmail) {
            showError('register-error', '❌ Такой ник уже занят.');
            return;
        }

        const client = getSupabase();
        const result = await client.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (result.error) throw result.error;

        document.getElementById('register-form')?.reset();

        if (result.data?.session) {
            await loadCurrentUserFromSession(result.data.session);
            await loadQuestions();
            await loadUsers();
            updateUI();
            updateProfile();
            showSuccess('register-success', '✅ Регистрация успешна!');
            navigateTo('profile');
        } else {
            showSuccess(
                'register-success',
                '✅ Аккаунт создан. Проверьте почту, подтвердите email и затем войдите.'
            );
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showError('register-error', '❌ ' + (error?.message || 'Ошибка регистрации.'));
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();

    showError('forgot-error', '');
    showSuccess('forgot-success', '');

    const username = document.getElementById('forgot-username')?.value.trim() || '';
    const enteredEmail = document.getElementById('forgot-email')?.value.trim().toLowerCase() || '';

    if (!username || !enteredEmail) {
        showError('forgot-error', '❌ Заполните ник и email.');
        return;
    }

    try {
        const realEmail = await getEmailByUsername(username);

        if (!realEmail) {
            showError('forgot-error', '❌ Пользователь не найден.');
            return;
        }

        if (String(realEmail).toLowerCase() !== enteredEmail) {
            showError('forgot-error', '❌ Ник и email не совпадают.');
            return;
        }

        const client = getSupabase();
        const result = await client.auth.resetPasswordForEmail(realEmail, {
            redirectTo: window.location.origin + window.location.pathname
        });

        if (result.error) throw result.error;

        showSuccess('forgot-success', '✅ Письмо для восстановления отправлено на вашу почту.');
        document.getElementById('forgot-form')?.reset();
    } catch (error) {
        console.error('Ошибка восстановления:', error);
        showError('forgot-error', '❌ ' + (error?.message || 'Не удалось отправить письмо.'));
    }
}

function showLogin() {
    const loginCard = document.querySelector('#auth-page .auth-card:first-of-type');
    const registerCard = document.getElementById('register-card');
    const forgotCard = document.getElementById('forgot-card');

    if (loginCard) loginCard.style.display = 'block';
    if (registerCard) registerCard.style.display = 'none';
    if (forgotCard) forgotCard.style.display = 'none';
}

function showRegister() {
    const loginCard = document.querySelector('#auth-page .auth-card:first-of-type');
    const registerCard = document.getElementById('register-card');
    const forgotCard = document.getElementById('forgot-card');

    if (loginCard) loginCard.style.display = 'none';
    if (registerCard) registerCard.style.display = 'block';
    if (forgotCard) forgotCard.style.display = 'none';
}

function showForgotPassword() {
    const loginCard = document.querySelector('#auth-page .auth-card:first-of-type');
    const registerCard = document.getElementById('register-card');
    const forgotCard = document.getElementById('forgot-card');

    if (loginCard) loginCard.style.display = 'none';
    if (registerCard) registerCard.style.display = 'none';
    if (forgotCard) forgotCard.style.display = 'block';
}

/* =========================
   UI / ПРОФИЛЬ
========================= */

function updateUI() {
    const authLink = document.getElementById('auth-link');
    const adminLink = document.getElementById('admin-panel-link');
    const deleteButton = document.getElementById('delete-account-btn');
    const supportAdminPanel = document.getElementById('admin-panel');

    if (currentUser) {
        // В оригинальном HTML уже есть отдельная ссылка "Профиль".
        // Поэтому auth-link скрываем после входа — это убирает дубль "Профиль".
        if (authLink) {
            authLink.style.display = 'none';
            authLink.innerHTML = '<span class="nav-icon">👤</span>Профиль';
            authLink.dataset.page = 'profile';
        }

        if (adminLink) {
            adminLink.style.display = canAccessAdmin() ? 'flex' : 'none';
        }

        if (supportAdminPanel) {
            supportAdminPanel.style.display = isAdmin() ? 'block' : 'none';
        }

        if (deleteButton) {
            deleteButton.style.display = isAdmin() ? 'none' : 'inline-flex';
        }
    } else {
        if (authLink) {
            authLink.style.display = 'flex';
            authLink.innerHTML = '<span class="nav-icon">🔑</span>Войти';
            authLink.dataset.page = 'auth';
        }

        if (adminLink) adminLink.style.display = 'none';
        if (supportAdminPanel) supportAdminPanel.style.display = 'none';
        if (deleteButton) deleteButton.style.display = 'inline-flex';
    }
}

function updateProfile() {
    const usernameEl = document.getElementById('profile-username');
    const rankEl = document.getElementById('profile-rank');
    const avatarEl = document.getElementById('profile-avatar-letter');
    const emailEl = document.getElementById('profile-email');
    const regDateEl = document.getElementById('profile-reg-date');
    const lastLoginEl = document.getElementById('profile-last-login');

    if (!currentUser) {
        if (usernameEl) usernameEl.textContent = 'Гость';
        if (rankEl) rankEl.textContent = 'Игрок';
        if (avatarEl) avatarEl.textContent = 'G';
        if (emailEl) emailEl.textContent = 'не указан';
        if (regDateEl) regDateEl.textContent = '-';
        if (lastLoginEl) lastLoginEl.textContent = '-';
        return;
    }

    if (usernameEl) usernameEl.textContent = currentUser.username || 'Игрок';
    if (rankEl) rankEl.textContent = currentUser.rank || 'Игрок';
    if (avatarEl) avatarEl.textContent = String(currentUser.username || 'И')[0].toUpperCase();
    if (emailEl) emailEl.textContent = currentUser.email || 'не указан';
    if (regDateEl) regDateEl.textContent = formatDate(currentUser.createdAt);
    if (lastLoginEl) lastLoginEl.textContent = formatDate(currentUser.lastLogin);
}

async function logout() {
    try {
        const client = getSupabase();
        const result = await client.auth.signOut();
        if (result.error) console.error('Ошибка выхода:', result.error);
    } finally {
        currentUser = null;
        questions = [];
        users = [];
        updateUI();
        updateProfile();
        navigateTo('home');
    }
}

async function changePassword() {
    if (!currentUser) {
        alert('⚠️ Сначала войдите в аккаунт.');
        return;
    }

    const newPassword = prompt('🔑 Введите новый пароль:');
    if (newPassword === null) return;

    if (newPassword.length < 4) {
        alert('❌ Пароль должен содержать минимум 4 символа.');
        return;
    }

    try {
        const client = getSupabase();
        const result = await client.auth.updateUser({ password: newPassword });
        if (result.error) throw result.error;
        alert('✅ Пароль успешно изменён.');
    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        alert('❌ ' + (error?.message || 'Не удалось изменить пароль.'));
    }
}

async function deleteAccount() {
    if (!currentUser || isAdmin()) return;

    if (!confirm('⚠️ Удалить аккаунт? Это действие нельзя отменить.')) return;

    // Удалять auth.users напрямую из браузера нельзя: для этого нужен service_role.
    // Поэтому пока безопасно выходим из аккаунта.
    alert('⚠️ Полное удаление аккаунта будет подключено отдельной серверной функцией Supabase. Сейчас выполняется безопасный выход.');
    await logout();
}

/* =========================
   АДМИНКА — ВКЛАДКИ И СЕРВЕРЫ
========================= */

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(function (tab) {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.admin-tab-btn').forEach(function (button) {
        button.classList.remove('active');
    });

    const tab = document.getElementById('admin-tab-' + tabName);
    if (tab) tab.classList.add('active');

    const buttons = document.querySelectorAll('.admin-tab-btn');
    buttons.forEach(function (button) {
        const onclick = button.getAttribute('onclick') || '';
        if (onclick.includes("'" + tabName + "'")) {
            button.classList.add('active');
        }
    });

    if (tabName === 'servers') renderServersList();
    if (tabName === 'settings') loadAdminSettings();
    if (tabName === 'users') renderUsersList();
    if (tabName === 'questions') renderAdminAllQuestions();
}

function renderServersList() {
    const container = document.getElementById('servers-list');
    if (!container) return;

    container.innerHTML = '';

    let visibleCount = 0;

    servers.forEach(function (server, index) {
        if (!canEditServer(index)) return;
        visibleCount++;

        const card = document.createElement('div');
        card.className = 'server-card' + (index === currentServerIndex ? ' active' : '');

        const statusIcon = server.status === 'online'
            ? '🟢'
            : server.status === 'maintenance'
                ? '🟠'
                : '🔴';

        card.innerHTML =
            '<div class="server-info">' +
                '<span class="server-icon">🌐</span>' +
                '<div>' +
                    '<div class="server-name">' + escapeHtml(server.name) + '</div>' +
                    '<div class="server-status-text">' + statusIcon + ' ' + escapeHtml(server.status || 'offline') + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="server-actions"></div>';

        const actions = card.querySelector('.server-actions');

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'btn btn-primary btn-sm';
        selectButton.textContent = 'Выбрать';
        selectButton.addEventListener('click', function () {
            switchToServer(index);
        });
        actions.appendChild(selectButton);

        if (isAdmin() && servers.length > 1) {
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.textContent = '🗑️';
            deleteButton.addEventListener('click', function () {
                deleteServer(index);
            });
            actions.appendChild(deleteButton);
        }

        container.appendChild(card);
    });

    if (!visibleCount) {
        container.innerHTML = '<div class="question-item placeholder"><p>Нет доступных веток для управления</p></div>';
    }
}

function switchToServer(index) {
    if (!servers[index]) return;
    loadServer(index);
    renderServersList();
}

async function deleteServer(index) {
    if (!isAdmin()) {
        alert('⛔ Нет доступа.');
        return;
    }

    if (servers.length <= 1) {
        alert('⚠️ Нельзя удалить последнюю ветку.');
        return;
    }

    const server = servers[index];
    if (!server) return;

    if (!confirm('⚠️ Удалить ветку «' + server.name + '»?')) return;

    if (!server.id) {
        alert('⚠️ Эта демонстрационная ветка ещё не сохранена в Supabase.');
        return;
    }

    const client = getSupabase();
    const result = await client
        .from('servers')
        .delete()
        .eq('id', server.id);

    if (result.error) {
        alert('❌ ' + result.error.message);
        return;
    }

    currentServerIndex = 0;
    await loadServers();
    loadServer(currentServerIndex);
    renderServersList();
    renderServersPage();
}

function loadAdminSettings() {
    const server = servers[currentServerIndex];
    if (!server) return;

    const setValue = function (id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value == null ? '' : String(value);
    };

    setValue('admin-status', server.status);
    setValue('admin-description', server.description);
    setValue('admin-version', server.version);
    setValue('admin-features-title', server.featuresTitle || 'Почему ' + server.name + '?');

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
    if (!server) return;

    normalizeArray(server.ips).forEach(function (item, index) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '10px';
        row.style.marginBottom = '10px';

        row.innerHTML =
            '<input type="text" class="form-input" value="' + escapeHtml(item.name || '') + '" data-field="name" style="flex:1;">' +
            '<input type="text" class="form-input" value="' + escapeHtml(item.ip || '') + '" data-field="ip" style="flex:1;">' +
            '<button type="button" class="btn btn-danger">🗑️</button>';

        const button = row.querySelector('button');
        if (button) button.addEventListener('click', function () { removeIp(index); });

        container.appendChild(row);
    });
}

function renderAdminBuilds() {
    const container = document.getElementById('admin-builds-list');
    if (!container) return;

    container.innerHTML = '';
    const server = servers[currentServerIndex];
    if (!server) return;

    normalizeArray(server.builds).forEach(function (item, index) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '10px';
        row.style.marginBottom = '10px';

        row.innerHTML =
            '<input type="text" class="form-input" value="' + escapeHtml(item.name || '') + '" data-field="name" style="flex:1;">' +
            '<input type="text" class="form-input" value="' + escapeHtml(item.url || '') + '" data-field="url" style="flex:1;">' +
            '<button type="button" class="btn btn-danger">🗑️</button>';

        const button = row.querySelector('button');
        if (button) button.addEventListener('click', function () { removeBuild(index); });

        container.appendChild(row);
    });
}

function renderAdminFeaturesCustom() {
    const container = document.getElementById('admin-features-custom');
    if (!container) return;

    container.innerHTML = '';
    const server = servers[currentServerIndex];
    if (!server) return;

    const features = normalizeArray(server.features);

    for (let i = 0; i < 4; i++) {
        const feature = features[i] || { icon: '⭐', title: '', desc: '' };
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        row.style.alignItems = 'center';

        row.innerHTML =
            '<span style="min-width:20px;">' + (i + 1) + '.</span>' +
            '<input type="text" class="form-input" value="' + escapeHtml(feature.icon || '') + '" id="f-icon-' + i + '" style="width:70px;" placeholder="📖">' +
            '<input type="text" class="form-input" value="' + escapeHtml(feature.title || '') + '" id="f-title-' + i + '" style="flex:1;" placeholder="Название">' +
            '<input type="text" class="form-input" value="' + escapeHtml(feature.desc || '') + '" id="f-desc-' + i + '" style="flex:2;" placeholder="Описание">';

        container.appendChild(row);
    }
}

function renderAdminStatsCustom() {
    const container = document.getElementById('admin-stats-custom');
    if (!container) return;

    container.innerHTML = '';
    const server = servers[currentServerIndex];
    if (!server) return;

    const stats = normalizeArray(server.stats);

    for (let i = 0; i < 4; i++) {
        const stat = stats[i] || { icon: '⭐', value: '', label: '' };
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        row.style.alignItems = 'center';

        row.innerHTML =
            '<span style="min-width:20px;">' + (i + 1) + '.</span>' +
            '<input type="text" class="form-input" value="' + escapeHtml(stat.icon || '') + '" id="s-icon-' + i + '" style="width:70px;" placeholder="🎮">' +
            '<input type="text" class="form-input" value="' + escapeHtml(stat.value || '') + '" id="s-value-' + i + '" style="width:100px;" placeholder="Значение">' +
            '<input type="text" class="form-input" value="' + escapeHtml(stat.label || '') + '" id="s-label-' + i + '" style="flex:1;" placeholder="Подпись">';

        container.appendChild(row);
    }
}

function addNewIpField() {
    if (!canEditServer(currentServerIndex)) return;
    const server = servers[currentServerIndex];
    if (!server) return;

    if (!Array.isArray(server.ips)) server.ips = [];
    server.ips.push({ name: 'IP', ip: 'play.example.com' });
    renderAdminIps();
}

function addNewBuildField() {
    if (!canEditServer(currentServerIndex)) return;
    const server = servers[currentServerIndex];
    if (!server) return;

    if (!Array.isArray(server.builds)) server.builds = [];
    server.builds.push({ name: 'Сборка', url: 'https://example.com/build.zip' });
    renderAdminBuilds();
}

function removeIp(index) {
    if (!canEditServer(currentServerIndex)) return;

    const server = servers[currentServerIndex];
    if (!server || !Array.isArray(server.ips)) return;

    if (server.ips.length <= 1) {
        alert('⚠️ Должен остаться хотя бы один IP.');
        return;
    }

    server.ips.splice(index, 1);
    renderAdminIps();
}

function removeBuild(index) {
    if (!canEditServer(currentServerIndex)) return;

    const server = servers[currentServerIndex];
    if (!server || !Array.isArray(server.builds)) return;

    if (server.builds.length <= 1) {
        alert('⚠️ Должна остаться хотя бы одна сборка.');
        return;
    }

    server.builds.splice(index, 1);
    renderAdminBuilds();
}

async function saveAdminSettings() {
    if (!canEditServer(currentServerIndex)) {
        alert('⛔ Нет доступа к этому серверу.');
        return;
    }

    const server = servers[currentServerIndex];
    if (!server) return;

    server.status = document.getElementById('admin-status')?.value || 'offline';
    server.description = document.getElementById('admin-description')?.value.trim() || '';
    server.version = document.getElementById('admin-version')?.value.trim() || '';
    server.featuresTitle = document.getElementById('admin-features-title')?.value.trim() || ('Почему ' + server.name + '?');

    const ipRows = document.querySelectorAll('#admin-ips-list > div');
    server.ips = Array.from(ipRows).map(function (row) {
        return {
            name: row.querySelector('[data-field="name"]')?.value.trim() || 'IP',
            ip: row.querySelector('[data-field="ip"]')?.value.trim() || ''
        };
    }).filter(function (item) {
        return item.ip;
    });

    if (!server.ips.length) {
        alert('⚠️ Добавьте хотя бы один IP.');
        return;
    }

    const buildRows = document.querySelectorAll('#admin-builds-list > div');
    server.builds = Array.from(buildRows).map(function (row) {
        return {
            name: row.querySelector('[data-field="name"]')?.value.trim() || 'Сборка',
            url: row.querySelector('[data-field="url"]')?.value.trim() || ''
        };
    }).filter(function (item) {
        return item.url;
    });

    if (!server.builds.length) {
        alert('⚠️ Добавьте хотя бы одну ссылку на сборку.');
        return;
    }

    server.features = Array.from({ length: 4 }, function (_, index) {
        return {
            icon: document.getElementById('f-icon-' + index)?.value.trim() || '⭐',
            title: document.getElementById('f-title-' + index)?.value.trim() || '',
            desc: document.getElementById('f-desc-' + index)?.value.trim() || ''
        };
    });

    server.stats = Array.from({ length: 4 }, function (_, index) {
        return {
            icon: document.getElementById('s-icon-' + index)?.value.trim() || '⭐',
            value: document.getElementById('s-value-' + index)?.value.trim() || '',
            label: document.getElementById('s-label-' + index)?.value.trim() || ''
        };
    });

    if (!server.id) {
        alert('⚠️ Эта ветка пока существует только как демонстрационная. Создайте её через «+ Добавить ветку».');
        return;
    }

    try {
        const client = getSupabase();
        const result = await client
            .from('servers')
            .update(serverPayload(server))
            .eq('id', server.id);

        if (result.error) throw result.error;

        const message = document.getElementById('admin-save-msg');
        if (message) {
            message.textContent = '✅ Сохранено!';
            setTimeout(function () { message.textContent = ''; }, 3000);
        }

        await loadServers();
        loadServer(currentServerIndex);
        renderServersList();
    } catch (error) {
        console.error('Ошибка сохранения сервера:', error);
        alert('❌ ' + (error?.message || 'Не удалось сохранить настройки.'));
    }
}

async function handleAddServer(event) {
    event.preventDefault();

    if (!isAdmin()) {
        alert('⛔ Только администратор может создавать ветки.');
        return;
    }

    const name = document.getElementById('new-server-name')?.value.trim() || '';
    if (!name) return;

    const newServer = {
        ...JSON.parse(JSON.stringify(DEFAULT_SERVER)),
        name: name,
        featuresTitle: 'Почему ' + name + '?'
    };

    try {
        const client = getSupabase();
        const result = await client
            .from('servers')
            .insert(serverPayload(newServer))
            .select()
            .single();

        if (result.error) throw result.error;

        await loadServers();

        const newIndex = servers.findIndex(function (server) {
            return String(server.id) === String(result.data.id);
        });

        if (newIndex >= 0) loadServer(newIndex);

        closeAddServerModal();
        renderServersList();
        renderServersPage();
        alert('✅ Ветка «' + name + '» создана.');
    } catch (error) {
        console.error('Ошибка создания сервера:', error);
        alert('❌ ' + (error?.message || 'Не удалось создать ветку.'));
    }
}

function showAddServerModal() {
    if (!isAdmin()) {
        alert('⛔ Нет доступа.');
        return;
    }
    document.getElementById('add-server-modal')?.classList.add('show');
}

function closeAddServerModal() {
    document.getElementById('add-server-modal')?.classList.remove('show');
    document.getElementById('add-server-form')?.reset();
}

/* =========================
   ПОЛЬЗОВАТЕЛИ / РОЛИ
========================= */

function renderUsersList() {
    const container = document.getElementById('users-list');
    if (!container) return;

    container.innerHTML = '';

    if (!isAdmin()) return;

    if (!users.length) {
        container.innerHTML = '<div class="question-item placeholder"><p>Нет пользователей</p></div>';
        return;
    }

    users.forEach(function (user) {
        const card = document.createElement('div');
        card.className = 'user-card' + (user.rank === 'Гл.Админ' || user.rank === 'Мл.Админ' ? ' admin' : '');
        card.dataset.username = String(user.username || '').toLowerCase();

        let roleText = user.rank || 'Игрок';

        if (Number.isInteger(user.chiefFor) && servers[user.chiefFor]) {
            roleText += ' • 👑 Главный за ' + servers[user.chiefFor].name;
        } else if (Number.isInteger(user.helperFor) && servers[user.helperFor]) {
            roleText += ' • 🔹 Помощник ' + servers[user.helperFor].name;
        }

        const isCurrentUser = currentUser && user.id === currentUser.id;

        card.innerHTML =
            '<div class="user-row"><span class="user-label">👤</span><span class="user-value">' + escapeHtml(user.username) + '</span></div>' +
            '<div class="user-row"><span class="user-label">📧</span><span class="user-value">' + escapeHtml(user.email || '-') + '</span></div>' +
            '<div class="user-row"><span class="user-label">🏷️</span><span class="user-value">' + escapeHtml(roleText) + '</span></div>' +
            '<div class="user-row"><span class="user-label">📅</span><span class="user-value">' + escapeHtml(formatDate(user.createdAt)) + '</span></div>' +
            '<div class="user-actions"></div>';

        const actions = card.querySelector('.user-actions');

        if (!isCurrentUser) {
            const assignButton = document.createElement('button');
            assignButton.type = 'button';
            assignButton.className = 'btn btn-primary btn-sm';
            assignButton.textContent = '🎯 Назначить';
            assignButton.addEventListener('click', function () {
                openAssignModal(user.username);
            });
            actions.appendChild(assignButton);

            const promoteButton = document.createElement('button');
            promoteButton.type = 'button';
            promoteButton.className = 'btn btn-secondary btn-sm';
            promoteButton.textContent = '👑 Роль';
            promoteButton.addEventListener('click', function () {
                openPromoteModal(user.username);
            });
            actions.appendChild(promoteButton);
        }

        container.appendChild(card);
    });
}

function filterUsers() {
    const input = document.getElementById('user-search');
    const query = (input?.value || '').trim().toLowerCase();

    document.querySelectorAll('#users-list .user-card').forEach(function (card) {
        card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

function openAssignModal(username) {
    if (!isAdmin()) return;

    const usernameInput = document.getElementById('assign-username');
    const serverSelect = document.getElementById('assign-server');
    const modal = document.getElementById('assign-role-modal');

    if (usernameInput) usernameInput.value = username;
    if (!serverSelect || !modal) return;

    serverSelect.innerHTML = '';

    servers.forEach(function (server, index) {
        if (!server.id) return;
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = server.name;
        serverSelect.appendChild(option);
    });

    modal.classList.add('show');
}

function closeAssignModal() {
    document.getElementById('assign-role-modal')?.classList.remove('show');
}

function openPromoteModal(username) {
    if (!isAdmin()) return;
    const input = document.getElementById('promote-username');
    if (input) input.value = username;
    document.getElementById('promote-modal')?.classList.add('show');
}

function closePromoteModal() {
    document.getElementById('promote-modal')?.classList.remove('show');
}

async function handlePromote(event) {
    event.preventDefault();

    if (!isAdmin()) return;

    const username = document.getElementById('promote-username')?.value || '';
    const rank = document.getElementById('promote-rank')?.value || 'Игрок';
    const target = users.find(function (user) { return user.username === username; });

    if (!target) {
        alert('❌ Пользователь не найден.');
        return;
    }

    try {
        const client = getSupabase();
        const result = await client
            .from('profiles')
            .update({
                rank: rank,
                chief_for: null,
                helper_for: null
            })
            .eq('id', target.id);

        if (result.error) throw result.error;

        closePromoteModal();
        await loadUsers();
        renderUsersList();
        alert('✅ Роль пользователя изменена.');
    } catch (error) {
        console.error('Ошибка назначения роли:', error);
        alert('❌ ' + (error?.message || 'Не удалось изменить роль.'));
    }
}

async function handleAssignRole(event) {
    event.preventDefault();

    if (!isAdmin()) return;

    const username = document.getElementById('assign-username')?.value || '';
    const serverIndex = Number.parseInt(document.getElementById('assign-server')?.value || '-1', 10);
    const role = document.getElementById('assign-role')?.value || 'chief';
    const target = users.find(function (user) { return user.username === username; });

    if (!target || !servers[serverIndex]) {
        alert('❌ Пользователь или сервер не найден.');
        return;
    }

    const patch = role === 'chief'
        ? { chief_for: serverIndex, helper_for: null }
        : { helper_for: serverIndex, chief_for: null };

    try {
        const client = getSupabase();
        const result = await client
            .from('profiles')
            .update(patch)
            .eq('id', target.id);

        if (result.error) throw result.error;

        closeAssignModal();
        await loadUsers();
        renderUsersList();
        alert('✅ Назначение сохранено.');
    } catch (error) {
        console.error('Ошибка назначения:', error);
        alert('❌ ' + (error?.message || 'Не удалось назначить роль.'));
    }
}

/* =========================
   ПОДДЕРЖКА / ВОПРОСЫ
========================= */

function renderAdminAllQuestions() {
    const container = document.getElementById('admin-all-questions');
    if (!container) return;

    container.innerHTML = '';

    const allQuestions = questions.slice().sort(function (a, b) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (!allQuestions.length) {
        container.innerHTML = '<div class="question-item placeholder"><p>Нет вопросов</p></div>';
        return;
    }

    allQuestions.forEach(function (question) {
        container.appendChild(createQuestionCard(question));
    });
}

function renderQuestions() {
    const list = document.getElementById('questions-list');
    const adminList = document.getElementById('admin-questions-list');

    if (!list) return;

    const myQuestions = currentUser
        ? questions.filter(function (question) {
            return question.author === currentUser.username;
        })
        : [];

    list.innerHTML = '';

    const openMine = myQuestions.filter(function (question) {
        return !question.closed;
    });

    if (!openMine.length) {
        list.innerHTML = '<div class="question-item placeholder"><p>📭 Здесь будут ваши вопросы</p></div>';
    } else {
        openMine.forEach(function (question) {
            list.appendChild(createQuestionCard(question));
        });
    }

    if (adminList) {
        adminList.innerHTML = '';

        if (!isAdmin()) {
            adminList.parentElement.style.display = 'none';
        } else {
            adminList.parentElement.style.display = '';
            const openQuestions = questions.filter(function (question) {
                return !question.closed;
            });

            if (!openQuestions.length) {
                adminList.innerHTML = '<div class="question-item placeholder"><p>📥 Нет открытых вопросов</p></div>';
            } else {
                openQuestions.forEach(function (question) {
                    adminList.appendChild(createQuestionCard(question));
                });
            }
        }
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'question-item';

    if (question.isUrgent) card.classList.add('urgent');
    if (question.closed) card.classList.add('closed');

    const answered = !!question.answer || (Array.isArray(question.answers) && question.answers.length > 0);
    const statusClass = question.closed
        ? 'status-closed'
        : answered
            ? 'status-answered'
            : 'status-open';

    const statusText = question.closed ? '✅' : answered ? '💬' : '⏳';

    card.innerHTML =
        '<div class="question-row">' +
            '<div class="question-title">' + escapeHtml(question.title) + '</div>' +
            '<span class="status ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
        '<div class="question-details">' +
            escapeHtml(question.author) + ' • ' + escapeHtml(formatDate(question.date)) +
        '</div>';

    card.addEventListener('click', function () {
        openQuestionView(question.id);
    });

    return card;
}

function showNewQuestionModal() {
    if (!currentUser) {
        alert('⚠️ Сначала войдите в аккаунт.');
        navigateTo('auth');
        return;
    }

    document.getElementById('new-question-modal')?.classList.add('show');
}

function closeModal() {
    document.getElementById('new-question-modal')?.classList.remove('show');
}

async function handleQuestionSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        alert('⚠️ Сначала войдите в аккаунт.');
        return;
    }

    const title = document.getElementById('question-title')?.value.trim() || '';
    const category = document.getElementById('question-category')?.value || 'other';
    const text = document.getElementById('question-text')?.value.trim() || '';

    if (!title || !text) {
        alert('⚠️ Заполните заголовок и описание.');
        return;
    }

    const row = {
        user_id: currentUser.id,
        username: currentUser.username,
        title: title,
        category: category,
        description: text,
        date: new Date().toISOString(),
        answer: null,
        answer_by: null,
        answers: [],
        is_urgent: category === 'password',
        closed: false
    };

    try {
        const client = getSupabase();
        const result = await client
            .from('questions')
            .insert(row);

        if (result.error) throw result.error;

        document.getElementById('question-form')?.reset();
        closeModal();
        await loadQuestions();
        renderQuestions();
    } catch (error) {
        console.error('Ошибка создания вопроса:', error);
        alert('❌ ' + (error?.message || 'Не удалось отправить вопрос.'));
    }
}

function openQuestionView(id) {
    const question = questions.find(function (item) {
        return String(item.id) === String(id);
    });

    if (!question) return;

    const setText = function (elementId, value) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value == null ? '' : String(value);
    };

    setText('view-question-title', question.title);
    setText('view-question-author', question.author);
    setText('view-question-date', formatDate(question.date));
    setText('view-question-category', getCategoryName(question.category));
    setText('view-question-text', question.text);

    const urgentBadge = document.getElementById('view-question-status-badge');
    if (urgentBadge) urgentBadge.classList.toggle('show', !!question.isUrgent);

    const answersList = document.getElementById('view-question-answers');
    if (answersList) {
        answersList.innerHTML = '';

        const answers = normalizeArray(question.answers);

        answers.forEach(function (answer) {
            const item = document.createElement('div');
            item.className = 'answer-item';
            item.innerHTML =
                '<div class="answer-meta">' + escapeHtml(answer.by || 'Админ') + '</div>' +
                '<div>' + escapeHtml(answer.text || '') + '</div>';
            answersList.appendChild(item);
        });

        if (!answers.length && question.answer) {
            const item = document.createElement('div');
            item.className = 'answer-item';
            item.innerHTML =
                '<div class="answer-meta">' + escapeHtml(question.answerBy || 'Админ') + '</div>' +
                '<div>' + escapeHtml(question.answer) + '</div>';
            answersList.appendChild(item);
        }

        if (!answers.length && !question.answer) {
            answersList.innerHTML = '<p class="no-answer">⏳ Ответа пока нет</p>';
        }
    }

    const answerForm = document.getElementById('admin-answer-form');
    const playerComplete = document.getElementById('player-complete-section');

    if (isAdmin() && !question.closed) {
        if (answerForm) answerForm.style.display = 'block';
        if (playerComplete) playerComplete.style.display = 'none';
    } else if (
        currentUser &&
        question.author === currentUser.username &&
        !question.closed
    ) {
        if (answerForm) answerForm.style.display = 'none';
        if (playerComplete) playerComplete.style.display = 'block';
    } else {
        if (answerForm) answerForm.style.display = 'none';
        if (playerComplete) playerComplete.style.display = 'none';
    }

    window.currentViewQuestionId = question.id;
    document.getElementById('view-question-modal')?.classList.add('show');
}

function closeViewModal() {
    document.getElementById('view-question-modal')?.classList.remove('show');
    renderQuestions();
}

async function submitAnswer() {
    if (!isAdmin()) return;

    const id = window.currentViewQuestionId;
    const text = document.getElementById('answer-text')?.value.trim() || '';
    const question = questions.find(function (item) {
        return String(item.id) === String(id);
    });

    if (!question || !text) return;

    const answers = normalizeArray(question.answers).slice();
    answers.push({
        text: text,
        by: currentUser.username,
        date: new Date().toISOString()
    });

    try {
        const client = getSupabase();
        const result = await client
            .from('questions')
            .update({
                answers: answers,
                answer: text,
                answer_by: currentUser.username
            })
            .eq('id', question.id);

        if (result.error) throw result.error;

        const answerInput = document.getElementById('answer-text');
        if (answerInput) answerInput.value = '';

        await loadQuestions();
        openQuestionView(id);
    } catch (error) {
        console.error('Ошибка ответа:', error);
        alert('❌ ' + (error?.message || 'Не удалось отправить ответ.'));
    }
}

async function completeQuestion() {
    if (!isAdmin()) return;

    const id = window.currentViewQuestionId;
    if (!id) return;

    try {
        const client = getSupabase();
        const result = await client
            .from('questions')
            .update({ closed: true })
            .eq('id', id);

        if (result.error) throw result.error;

        await loadQuestions();
        closeViewModal();
    } catch (error) {
        console.error('Ошибка закрытия вопроса:', error);
        alert('❌ ' + (error?.message || 'Не удалось закрыть вопрос.'));
    }
}

async function playerCompleteQuestion() {
    if (!currentUser) return;

    const id = window.currentViewQuestionId;
    const question = questions.find(function (item) {
        return String(item.id) === String(id);
    });

    if (!question || question.author !== currentUser.username) return;

    try {
        const client = getSupabase();
        const result = await client
            .from('questions')
            .update({ closed: true })
            .eq('id', question.id);

        if (result.error) throw result.error;

        await loadQuestions();
        closeViewModal();
    } catch (error) {
        console.error('Ошибка закрытия вопроса игроком:', error);
        alert('❌ ' + (error?.message || 'Не удалось закрыть вопрос.'));
    }
}

/* =========================
   КНОПКИ / ПРОЧЕЕ
========================= */

function downloadBuild(url) {
    if (!url) {
        alert('❌ Ссылка на сборку не указана.');
        return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyIP(ip) {
    if (!ip) return;

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(ip);
        } else {
            throw new Error('Clipboard API недоступен');
        }

        const message = document.getElementById('ip-copy-msg');
        if (message) {
            message.textContent = '✅ IP скопирован: ' + ip;
            setTimeout(function () {
                message.textContent = '';
            }, 4000);
        }
    } catch (error) {
        prompt('Скопируйте IP:', ip);
    }
}

/* =========================
   ГЛОБАЛЬНЫЕ ФУНКЦИИ
   Нужны для onclick из index.html
========================= */

Object.assign(window, {
    navigateTo,
    switchAdminTab,
    switchToServer,
    deleteServer,
    loadAdminSettings,
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
