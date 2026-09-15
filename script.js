/*
 * CRISTALHILLS — Supabase version
 *
 * ВАЖНО:
 * 1. index.html должен подключать @supabase/supabase-js@2 ДО этого файла.
 * 2. Вставь сюда свой Publishable key из Supabase.
 * 3. Secret/service_role key сюда НИКОГДА не вставляй.
 */

const SUPABASE_URL = 'https://zedgouirmabujahlpbjq.supabase.co';

// ============================================================
// ВСТАВЬ СЮДА СВОЙ PUBLISHABLE KEY
// ============================================================

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1SJJwVyWmCzNy4htOLvnGA_hAZOhYXJ';

// ============================================================
// SUPABASE CLIENT
// ============================================================

if (!window.supabase || !window.supabase.createClient) {
    console.error(
        'Supabase CDN не загружен. Проверь index.html.'
    );
}

const supabaseClient = window.supabase
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    )
    : null;


// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================

let currentUser = null;

let questions = [];

let users = [];

let servers = [];

let currentServerIndex = parseInt(
    localStorage.getItem('cristalhills_current_server') || '0',
    10
);

let currentViewQuestionId = null;

let currentAdminTab = 'servers';


// ============================================================
// НАСТРОЙКИ
// ============================================================

const DEFAULT_SERVER = {
    name: 'Cristalhills',
    status: 'online',
    description:
        'Сюжетный Minecraft сервер с уникальной атмосферой, механиками и приключениями.',
    version: '1.21.1',

    ips: [
        'play.cristalhills.ru'
    ],

    builds: [
        '1.21.1'
    ],

    featuresTitle: 'Особенности сервера',

    features: [
        {
            icon: '⚔️',
            title: 'Уникальный сюжет',
            description:
                'Погрузитесь в увлекательную историю Cristalhills.'
        },
        {
            icon: '🏗️',
            title: 'Много механик',
            description:
                'Исследуйте множество интересных механик и возможностей.'
        },
        {
            icon: '✨',
            title: 'Магия',
            description:
                'Используйте магические способности и открывайте новые возможности.'
        },
        {
            icon: '🌍',
            title: 'Большой мир',
            description:
                'Исследуйте огромный мир, полный тайн и приключений.'
        }
    ],

    stats: {
        players: '0',
        online: '0',
        version: '1.21.1'
    }
};


// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function safeJsonParse(value, fallback = null) {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn('Ошибка JSON:', error);
        return fallback;
    }
}


function normalizeServer(server) {
    if (!server) {
        return {
            ...DEFAULT_SERVER
        };
    }

    return {
        id: server.id,

        name: server.name || DEFAULT_SERVER.name,

        status: server.status || DEFAULT_SERVER.status,

        description:
            server.description ||
            DEFAULT_SERVER.description,

        version:
            server.version ||
            DEFAULT_SERVER.version,

        ips:
            Array.isArray(server.ips)
                ? server.ips
                : safeJsonParse(
                    server.ips,
                    DEFAULT_SERVER.ips
                ),

        builds:
            Array.isArray(server.builds)
                ? server.builds
                : safeJsonParse(
                    server.builds,
                    DEFAULT_SERVER.builds
                ),

        featuresTitle:
            server.features_title ||
            DEFAULT_SERVER.featuresTitle,

        features:
            Array.isArray(server.features)
                ? server.features
                : safeJsonParse(
                    server.features,
                    DEFAULT_SERVER.features
                ),

        stats:
            server.stats && typeof server.stats === 'object'
                ? server.stats
                : safeJsonParse(
                    server.stats,
                    DEFAULT_SERVER.stats
                )
    };
}


function normalizeQuestion(question) {
    if (!question) {
        return null;
    }

    return {
        ...question,

        answers:
            Array.isArray(question.answers)
                ? question.answers
                : safeJsonParse(
                    question.answers,
                    []
                ),

        is_urgent:
            question.is_urgent === true,

        closed:
            question.closed === true
    };
}


function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function getCategoryName(category) {
    const categories = {
        general: 'Общие вопросы',
        technical: 'Технические проблемы',
        gameplay: 'Игровой процесс',
        donation: 'Донат',
        bug: 'Ошибка',
        suggestion: 'Предложение',
        other: 'Другое'
    };

    return categories[category] || category || 'Другое';
}


function formatDate(date) {
    if (!date) {
        return 'Неизвестно';
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return escapeHtml(date);
    }

    return parsed.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


function getCurrentServer() {
    if (
        !servers.length ||
        currentServerIndex < 0 ||
        currentServerIndex >= servers.length
    ) {
        return null;
    }

    return servers[currentServerIndex];
}


function isAdminUser(user = currentUser) {
    if (!user) {
        return false;
    }

    return (
        user.isAdmin === true ||
        user.rank === 'Гл.Админ' ||
        user.rank === 'Мл.Админ'
    );
}


function isChief(user = currentUser) {
    return Boolean(
        user &&
        user.chiefFor !== null &&
        user.chiefFor !== undefined
    );
}


function isHelper(user = currentUser) {
    return Boolean(
        user &&
        user.helperFor !== null &&
        user.helperFor !== undefined
    );
}


function canAccessAdmin(user = currentUser) {
    if (!user) {
        return false;
    }

    return (
        isAdminUser(user) ||
        isChief(user) ||
        isHelper(user)
    );
}


function canEditServer(index, user = currentUser) {
    if (!user) {
        return false;
    }

    if (isAdminUser(user)) {
        return true;
    }

    const server = servers[index];

    if (!server) {
        return false;
    }

    if (
        user.chiefFor !== null &&
        user.chiefFor !== undefined &&
        Number(user.chiefFor) === Number(server.id)
    ) {
        return true;
    }

    if (
        user.helperFor !== null &&
        user.helperFor !== undefined &&
        Number(user.helperFor) === Number(server.id)
    ) {
        return true;
    }

    return false;
}


// ============================================================
// ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ
// ============================================================

async function loadCurrentUser() {
    if (!supabaseClient) {
        return null;
    }

    try {
        const {
            data: {
                session
            },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error(
                'Ошибка получения сессии:',
                error
            );

            return null;
        }

        if (!session || !session.user) {
            currentUser = null;

            updateUI();

            return null;
        }

        const userId = session.user.id;

        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (profileError) {
            console.error(
                'Ошибка загрузки профиля:',
                profileError
            );

            return null;
        }

        if (!profile) {
            currentUser = {
                id: userId,
                username:
                    session.user.user_metadata?.username ||
                    session.user.email?.split('@')[0] ||
                    'Игрок',
                email: session.user.email || '',
                rank: 'Игрок',
                chiefFor: null,
                helperFor: null,
                isAdmin: false
            };
        } else {
            currentUser = {
                id: profile.id,

                username:
                    profile.username ||
                    session.user.email?.split('@')[0] ||
                    'Игрок',

                email:
                    profile.email ||
                    session.user.email ||
                    '',

                rank:
                    profile.rank ||
                    'Игрок',

                chiefFor:
                    profile.chief_for ?? null,

                helperFor:
                    profile.helper_for ?? null,

                createdAt:
                    profile.created_at || null,

                lastLogin:
                    profile.last_login || null,

                isAdmin:
                    profile.rank === 'Гл.Админ' ||
                    profile.rank === 'Мл.Админ'
            };
        }

        updateUI();

        return currentUser;

    } catch (error) {
        console.error(
            'Критическая ошибка загрузки пользователя:',
            error
        );

        currentUser = null;

        updateUI();

        return null;
    }
}


// ============================================================
// ЗАГРУЗКА СЕРВЕРОВ
// ============================================================

async function loadServers() {
    if (!supabaseClient) {
        servers = [
            normalizeServer(DEFAULT_SERVER)
        ];

        return servers;
    }

    try {
        const {
            data,
            error
        } = await supabaseClient
            .from('servers')
            .select('*')
            .order('id', {
                ascending: true
            });

        if (error) {
            console.error(
                'Ошибка загрузки серверов:',
                error
            );

            servers = [
                normalizeServer(DEFAULT_SERVER)
            ];

            return servers;
        }

        servers = (data || [])
            .map(normalizeServer);

        if (!servers.length) {
            console.warn(
                'В Supabase нет серверов.'
            );

            servers = [
                normalizeServer(DEFAULT_SERVER)
            ];
        }

        if (
            currentServerIndex < 0 ||
            currentServerIndex >= servers.length
        ) {
            currentServerIndex = 0;
        }

        localStorage.setItem(
            'cristalhills_current_server',
            String(currentServerIndex)
        );

        return servers;

    } catch (error) {
        console.error(
            'Критическая ошибка загрузки серверов:',
            error
        );

        servers = [
            normalizeServer(DEFAULT_SERVER)
        ];

        return servers;
    }
}


// ============================================================
// ЗАГРУЗКА ВОПРОСОВ
// ============================================================

async function loadQuestions() {
    if (!supabaseClient) {
        questions = [];

        return questions;
    }

    try {
        const {
            data,
            error
        } = await supabaseClient
            .from('questions')
            .select('*')
            .order('id', {
                ascending: false
            });

        if (error) {
            console.error(
                'Ошибка загрузки вопросов:',
                error
            );

            questions = [];

            return questions;
        }

        questions = (data || [])
            .map(normalizeQuestion)
            .filter(Boolean);

        return questions;

    } catch (error) {
        console.error(
            'Критическая ошибка загрузки вопросов:',
            error
        );

        questions = [];

        return questions;
    }
}


// ============================================================
// ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ
// ============================================================

async function loadUsers() {
    if (!supabaseClient) {
        users = [];

        return users;
    }

    try {
        const {
            data,
            error
        } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', {
                ascending: false
            });

        if (error) {
            console.error(
                'Ошибка загрузки пользователей:',
                error
            );

            users = [];

            return users;
        }

        users = (data || []).map(profile => ({
            id: profile.id,

            username:
                profile.username || 'Игрок',

            email:
                profile.email || '',

            rank:
                profile.rank || 'Игрок',

            chiefFor:
                profile.chief_for ?? null,

            helperFor:
                profile.helper_for ?? null,

            createdAt:
                profile.created_at || null,

            lastLogin:
                profile.last_login || null,

            isAdmin:
                profile.rank === 'Гл.Админ' ||
                profile.rank === 'Мл.Админ'
        }));

        return users;

    } catch (error) {
        console.error(
            'Критическая ошибка загрузки пользователей:',
            error
        );

        users = [];

        return users;
    }
}


// ============================================================
// REALTIME — ОБНОВЛЕНИЕ ДАННЫХ У ВСЕХ
// ============================================================

function setupRealtime() {
    if (!supabaseClient) {
        return;
    }

    try {
        supabaseClient
            .channel('cristalhills-servers')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'servers'
                },
                async () => {
                    console.log(
                        'Получено обновление серверов.'
                    );

                    await loadServers();

                    loadServer(
                        currentServerIndex
                    );

                    renderServersPage();

                    if (
                        document
                            .getElementById('admin-page')
                            ?.classList
                            .contains('active')
                    ) {
                        renderAdminServers();
                    }
                }
            )
            .subscribe();

        supabaseClient
            .channel('cristalhills-questions')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'questions'
                },
                async () => {
                    console.log(
                        'Получено обновление вопросов.'
                    );

                    await loadQuestions();

                    if (
                        currentUser &&
                        canAccessAdmin()
                    ) {
                        renderAdminAllQuestions();
                    }

                    if (
                        document
                            .getElementById('support-page')
                            ?.classList
                            .contains('active')
                    ) {
                        renderQuestions();
                    }
                }
            )
            .subscribe();

        supabaseClient
            .channel('cristalhills-profiles')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles'
                },
                async () => {
                    console.log(
                        'Получено обновление профилей.'
                    );

                    await loadCurrentUser();

                    if (
                        currentUser &&
                        canAccessAdmin()
                    ) {
                        await loadUsers();

                        renderUsersList();
                    }
                }
            )
            .subscribe();

    } catch (error) {
        console.error(
            'Ошибка настройки Realtime:',
            error
        );
    }
}


// ============================================================
// ЗАГРУЗКА ТЕКУЩЕГО СЕРВЕРА
// ============================================================

function loadServer(index = 0) {
    if (!servers.length) {
        return;
    }

    if (
        index < 0 ||
        index >= servers.length
    ) {
        index = 0;
    }

    currentServerIndex = index;

    localStorage.setItem(
        'cristalhills_current_server',
        String(index)
    );

    const server = servers[index];

    if (!server) {
        return;
    }

    const nameElement =
        document.getElementById('server-name');

    if (nameElement) {
        nameElement.textContent =
            server.name || 'Cristalhills';
    }

    const statusElement =
        document.getElementById('server-status');

    if (statusElement) {
        statusElement.textContent =
            server.status === 'online'
                ? 'Онлайн'
                : server.status === 'offline'
                    ? 'Оффлайн'
                    : server.status;
    }

    const descriptionElement =
        document.getElementById('server-description');

    if (descriptionElement) {
        descriptionElement.textContent =
            server.description || '';
    }

    const versionElement =
        document.getElementById('server-version');

    if (versionElement) {
        versionElement.textContent =
            server.version || '';
    }

    const statsPlayers =
        document.getElementById('stat-players');

    if (statsPlayers) {
        statsPlayers.textContent =
            server.stats?.players ?? '0';
    }

    const statsOnline =
        document.getElementById('stat-online');

    if (statsOnline) {
        statsOnline.textContent =
            server.stats?.online ?? '0';
    }

    const statsVersion =
        document.getElementById('stat-version');

    if (statsVersion) {
        statsVersion.textContent =
            server.stats?.version ||
            server.version ||
            '1.21.1';
    }

    const ipContainer =
        document.getElementById('ip-buttons');

    if (ipContainer) {
        ipContainer.innerHTML = '';

        const ips =
            Array.isArray(server.ips)
                ? server.ips
                : [];

        ips.forEach(ip => {
            const button =
                document.createElement('button');

            button.className =
                'ip-button';

            button.type =
                'button';

            button.textContent =
                ip;

            button.onclick = () =>
                copyIP(ip);

            ipContainer.appendChild(
                button
            );
        });
    }

    const buildsContainer =
        document.getElementById('build-buttons');

    if (buildsContainer) {
        buildsContainer.innerHTML = '';

        const builds =
            Array.isArray(server.builds)
                ? server.builds
                : [];

        builds.forEach(build => {
            const button =
                document.createElement('button');

            button.className =
                'build-button';

            button.type =
                'button';

            button.textContent =
                build;

            buildsContainer.appendChild(
                button
            );
        });
    }

    const featuresContainer =
        document.getElementById('features-container');

    if (featuresContainer) {
        featuresContainer.innerHTML = '';

        const features =
            Array.isArray(server.features)
                ? server.features
                : [];

        features.forEach(feature => {
            const card =
                document.createElement('div');

            card.className =
                'feature-card';

            card.innerHTML = `
                <div class="feature-icon">
                    ${escapeHtml(feature.icon || '✨')}
                </div>

                <h3>
                    ${escapeHtml(feature.title || '')}
                </h3>

                <p>
                    ${escapeHtml(feature.description || '')}
                </p>
            `;

            featuresContainer.appendChild(
                card
            );
        });
    }

    const featuresTitle =
        document.getElementById('features-title');

    if (featuresTitle) {
        featuresTitle.textContent =
            server.featuresTitle ||
            'Особенности сервера';
    }
}


// ============================================================
// СТРАНИЦА СЕРВЕРОВ
// ============================================================

function renderServersPage() {
    const container =
        document.getElementById(
            'servers-page-grid'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!servers.length) {
        container.innerHTML = `
            <div class="empty-state">
                Серверов пока нет.
            </div>
        `;

        return;
    }

    servers.forEach((server, index) => {
        const card =
            document.createElement('div');

        card.className =
            'server-card';

        const isCurrent =
            index === currentServerIndex;

        const statusClass =
            server.status === 'online'
                ? 'online'
                : 'offline';

        card.innerHTML = `
            <div class="server-card-header">
                <div>
                    <h3>
                        ${escapeHtml(server.name)}
                    </h3>

                    <span class="server-status ${statusClass}">
                        ${server.status === 'online'
                            ? 'Онлайн'
                            : 'Оффлайн'}
                    </span>
                </div>
            </div>

            <p class="server-card-description">
                ${escapeHtml(server.description || '')}
            </p>

            <div class="server-card-info">
                <div>
                    <span>Версия</span>
                    <strong>
                        ${escapeHtml(server.version || '')}
                    </strong>
                </div>

                <div>
                    <span>Игроков</span>
                    <strong>
                        ${escapeHtml(
                            server.stats?.online ?? '0'
                        )}
                    </strong>
                </div>
            </div>

            <div class="server-card-ips">
                ${
                    (server.ips || [])
                        .map(ip => `
                            <button
                                type="button"
                                class="ip-button"
                                onclick="copyIP('${String(ip)
                                    .replace(/'/g, "\\'")}')"
                            >
                                ${escapeHtml(ip)}
                            </button>
                        `)
                        .join('')
                }
            </div>

            <button
                type="button"
                class="btn ${
                    isCurrent
                        ? 'btn-secondary'
                        : 'btn-primary'
                } server-select-button"
                onclick="selectServer(${index})"
            >
                ${
                    isCurrent
                        ? 'Выбран'
                        : 'Выбрать сервер'
                }
            </button>
        `;

        container.appendChild(card);
    });
}


// ============================================================
// ВЫБОР СЕРВЕРА
// ============================================================

function selectServer(index) {
    if (
        index < 0 ||
        index >= servers.length
    ) {
        return;
    }

    currentServerIndex = index;

    localStorage.setItem(
        'cristalhills_current_server',
        String(index)
    );

    loadServer(index);

    renderServersPage();

    navigateTo('home');
}


// ============================================================
// КОПИРОВАНИЕ IP
// ============================================================

async function copyIP(ip) {
    if (!ip) {
        return;
    }

    try {
        await navigator.clipboard.writeText(
            ip
        );

        showNotification(
            'IP адрес скопирован!',
            'success'
        );

    } catch (error) {
        console.error(
            'Ошибка копирования:',
            error
        );

        const textarea =
            document.createElement('textarea');

        textarea.value = ip;

        textarea.style.position =
            'fixed';

        textarea.style.opacity =
            '0';

        document.body.appendChild(
            textarea
        );

        textarea.select();

        try {
            document.execCommand(
                'copy'
            );

            showNotification(
                'IP адрес скопирован!',
                'success'
            );
        } catch {
            showNotification(
                'Не удалось скопировать IP.',
                'error'
            );
        }

        textarea.remove();
    }
}


// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

function showNotification(
    message,
    type = 'info'
) {
    const old =
        document.querySelector(
            '.cristalhills-notification'
        );

    if (old) {
        old.remove();
    }

    const notification =
        document.createElement('div');

    notification.className =
        `cristalhills-notification ${type}`;

    notification.textContent =
        message;

    notification.style.position =
        'fixed';

    notification.style.top =
        '90px';

    notification.style.right =
        '20px';

    notification.style.zIndex =
        '99999';

    notification.style.padding =
        '14px 20px';

    notification.style.borderRadius =
        '10px';

    notification.style.background =
        '#151a2d';

    notification.style.border =
        '1px solid rgba(99,102,241,.3)';

    notification.style.color =
        '#f1f5f9';

    notification.style.boxShadow =
        '0 10px 30px rgba(0,0,0,.35)';

    notification.style.maxWidth =
        '350px';

    document.body.appendChild(
        notification
    );

    setTimeout(() => {
        notification.remove();
    }, 3000);
}


// ============================================================
// НАВИГАЦИЯ
// ============================================================

function setupNavigation() {
    const navLinks =
        document.querySelectorAll(
            '.nav-link'
        );

    navLinks.forEach(link => {
        link.addEventListener(
            'click',
            event => {
                event.preventDefault();

                const page =
                    link.dataset.page ||
                    link.getAttribute(
                        'href'
                    )?.replace('#', '');

                if (page) {
                    navigateTo(page);
                }
            }
        );
    });
}


function navigateTo(page) {
    if (!page) {
        return;
    }

    const pages =
        document.querySelectorAll(
            '.page'
        );

    pages.forEach(element => {
        element.classList.remove(
            'active'
        );
    });

    const target =
        document.getElementById(
            `${page}-page`
        );

    if (!target) {
        console.warn(
            `Страница "${page}" не найдена.`
        );

        return;
    }

    target.classList.add(
        'active'
    );

    const navLinks =
        document.querySelectorAll(
            '.nav-link'
        );

    navLinks.forEach(link => {
        const linkPage =
            link.dataset.page ||
            link.getAttribute(
                'href'
            )?.replace('#', '');

        link.classList.toggle(
            'active',
            linkPage === page
        );
    });

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    if (page === 'home') {
        loadServer(
            currentServerIndex
        );
    }

    if (page === 'servers') {
        renderServersPage();
    }

    if (page === 'profile') {
        updateProfile();
    }

    if (page === 'support') {
        renderQuestions();
    }

    if (page === 'admin') {
        if (!canAccessAdmin()) {
            showNotification(
                'У вас нет доступа к панели администратора.',
                'error'
            );

            navigateTo('home');

            return;
        }

        renderAdminPage();
    }

    updateUI();
}


// ============================================================
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ============================================================

function updateUI() {
    const authLink =
        document.getElementById(
            'auth-link'
        );

    const adminLink =
        document.getElementById(
            'admin-link'
        );

    const profileLink =
        document.getElementById(
            'profile-link'
        );

    if (authLink) {
        if (currentUser) {
            authLink.textContent =
                'Выйти';

            authLink.onclick = event => {
                event.preventDefault();

                logout();
            };
        } else {
            authLink.textContent =
                'Войти';

            authLink.onclick = event => {
                event.preventDefault();

                navigateTo('auth');
            };
        }
    }

    if (profileLink) {
        profileLink.style.display =
            currentUser
                ? ''
                : 'none';
    }

    if (adminLink) {
        adminLink.style.display =
            canAccessAdmin()
                ? ''
                : 'none';
    }

    const userNameElements =
        document.querySelectorAll(
            '[data-user-name]'
        );

    userNameElements.forEach(
        element => {
            element.textContent =
                currentUser?.username ||
                '';
        }
    );

    const userRankElements =
        document.querySelectorAll(
            '[data-user-rank]'
        );

    userRankElements.forEach(
        element => {
            element.textContent =
                currentUser?.rank ||
                'Игрок';
        }
    );
}


// ============================================================
// ПРОФИЛЬ
// ============================================================

function updateProfile() {
    if (!currentUser) {
        return;
    }

    const username =
        document.getElementById(
            'profile-username'
        );

    if (username) {
        username.textContent =
            currentUser.username;
    }

    const email =
        document.getElementById(
            'profile-email'
        );

    if (email) {
        email.textContent =
            currentUser.email || '';
    }

    const rank =
        document.getElementById(
            'profile-rank'
        );

    if (rank) {
        rank.textContent =
            currentUser.rank || 'Игрок';
    }

    const createdAt =
        document.getElementById(
            'profile-created'
        );

    if (createdAt) {
        createdAt.textContent =
            formatDate(
                currentUser.createdAt
            );
    }

    const deleteButton =
        document.getElementById(
            'delete-account-btn'
        );

    if (deleteButton) {
        deleteButton.style.display =
            currentUser
                ? ''
                : 'none';
    }
}


// ============================================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================================

function requireAuth() {
    if (!currentUser) {
        showNotification(
            'Сначала необходимо войти в аккаунт.',
            'error'
        );

        navigateTo('auth');

        return false;
    }

    return true;
}


// ============================================================
// ПРОВЕРКА АДМИН ДОСТУПА
// ============================================================

function requireAdmin() {
    if (!currentUser) {
        showNotification(
            'Необходимо войти в аккаунт.',
            'error'
        );

        navigateTo('auth');

        return false;
    }

    if (!canAccessAdmin()) {
        showNotification(
            'У вас нет доступа к панели администратора.',
            'error'
        );

        navigateTo('home');

        return false;
    }

    return true;
}


// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    async () => {
        console.log(
            'Cristalhills запускается...'
        );

        if (!supabaseClient) {
            console.error(
                'Supabase client не создан.'
            );

            showNotification(
                'Ошибка подключения к Supabase.',
                'error'
            );

            return;
        }

        setupNavigation();

        setupForms();

        await loadCurrentUser();

        await loadServers();

        await loadQuestions();

        if (currentUser) {
            await loadUsers();
        }

        loadServer(
            currentServerIndex
        );

        renderServersPage();

        updateUI();

        setupRealtime();

        console.log(
            'Cristalhills успешно запущен.'
        );
    }
);
// ============================================================
// НАСТРОЙКА ФОРМ
// ============================================================

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
        const el = document.getElementById(item[0]);

        if (el) {
            el.addEventListener(
                'submit',
                item[1]
            );
        }
    });
}


// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================

async function handleLogin(e) {
    e.preventDefault();

    const username =
        document
            .getElementById('login-username')
            .value
            .trim();

    const password =
        document
            .getElementById('login-password')
            .value;

    const errorEl =
        document.getElementById('login-error');

    if (errorEl) {
        errorEl.textContent = '';
    }

    if (!username || !password) {
        if (errorEl) {
            errorEl.textContent =
                '❌ Заполните все поля';
        }

        return;
    }

    try {
        const {
            data: emailData,
            error: rpcError
        } = await supabaseClient.rpc(
            'get_email_by_username',
            {
                p_username: username
            }
        );

        if (rpcError) {
            console.error(
                'Ошибка поиска пользователя:',
                rpcError
            );

            if (errorEl) {
                errorEl.textContent =
                    '❌ Ошибка входа. Проверьте настройки Supabase.';
            }

            return;
        }

        let email = null;

        if (typeof emailData === 'string') {
            email = emailData;
        } else if (Array.isArray(emailData)) {
            email =
                emailData[0]?.email || null;
        } else if (emailData) {
            email =
                emailData.email || null;
        }

        if (!email) {
            if (errorEl) {
                errorEl.textContent =
                    '❌ Пользователь не найден';
            }

            return;
        }

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error(
                'Ошибка авторизации:',
                error
            );

            if (errorEl) {
                errorEl.textContent =
                    '❌ Неверный логин или пароль';
            }

            return;
        }

        await loadCurrentUserFromSession(
            data.session
        );

        if (currentUser) {
            const now =
                new Date().toISOString();

            const {
                error: updateError
            } = await supabaseClient
                .from('profiles')
                .update({
                    last_login: now
                })
                .eq(
                    'id',
                    currentUser.id
                );

            if (updateError) {
                console.warn(
                    'Не удалось обновить время входа:',
                    updateError
                );
            }

            currentUser.lastLogin =
                formatDateTime(now);
        }

        updateUI();
        updateProfile();

        e.target.reset();

        navigateTo('profile');

    } catch (error) {
        console.error(
            'Критическая ошибка входа:',
            error
        );

        if (errorEl) {
            errorEl.textContent =
                '❌ Произошла ошибка при входе';
        }
    }
}


// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================

async function handleRegister(e) {
    e.preventDefault();

    const username =
        document
            .getElementById('register-username')
            .value
            .trim();

    const email =
        document
            .getElementById('register-email')
            .value
            .trim();

    const password =
        document
            .getElementById('register-password')
            .value;

    const confirm =
        document
            .getElementById('register-confirm')
            .value;

    const errorEl =
        document.getElementById(
            'register-error'
        );

    const successEl =
        document.getElementById(
            'register-success'
        );

    if (errorEl) {
        errorEl.textContent = '';
    }

    if (successEl) {
        successEl.textContent = '';
    }

    if (!username || !email || !password) {
        if (errorEl) {
            errorEl.textContent =
                '❌ Заполните все поля';
        }

        return;
    }

    if (password !== confirm) {
        if (errorEl) {
            errorEl.textContent =
                '❌ Пароли не совпадают';
        }

        return;
    }

    if (password.length < 6) {
        if (errorEl) {
            errorEl.textContent =
                '❌ Минимум 6 символов';
        }

        return;
    }

    try {
        // Проверяем, существует ли такой ник
        const {
            data: existingUsername,
            error: usernameError
        } = await supabaseClient.rpc(
            'get_email_by_username',
            {
                p_username: username
            }
        );

        if (usernameError) {
            console.error(
                usernameError
            );

            if (errorEl) {
                errorEl.textContent =
                    '❌ Не удалось проверить ник';
            }

            return;
        }

        if (existingUsername) {
            if (errorEl) {
                errorEl.textContent =
                    '❌ Ник уже занят';
            }

            return;
        }

        const {
            data,
            error
        } = await supabaseClient.auth.signUp({
            email: email,
            password: password,

            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) {
            console.error(
                'Ошибка регистрации:',
                error
            );

            if (errorEl) {
                errorEl.textContent =
                    '❌ ' +
                    translateAuthError(
                        error.message
                    );
            }

            return;
        }

        e.target.reset();

        if (data.session) {
            await loadCurrentUserFromSession(
                data.session
            );

            updateUI();
            updateProfile();

            if (successEl) {
                successEl.textContent =
                    '✅ Аккаунт успешно создан!';
            }

            setTimeout(
                function () {
                    if (successEl) {
                        successEl.textContent =
                            '';
                    }

                    navigateTo(
                        'profile'
                    );
                },
                1500
            );

        } else {
            if (successEl) {
                successEl.textContent =
                    '✅ Аккаунт создан! Проверьте email для подтверждения регистрации.';
            }

            setTimeout(
                function () {
                    showLogin();

                    if (successEl) {
                        successEl.textContent =
                            '';
                    }
                },
                3500
            );
        }

    } catch (error) {
        console.error(
            'Критическая ошибка регистрации:',
            error
        );

        if (errorEl) {
            errorEl.textContent =
                '❌ Ошибка регистрации';
        }
    }
}


// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================================

async function handleForgotPassword(e) {
    e.preventDefault();

    const username =
        document
            .getElementById('forgot-username')
            .value
            .trim();

    const email =
        document
            .getElementById('forgot-email')
            .value
            .trim();

    const errorEl =
        document.getElementById(
            'forgot-error'
        );

    const successEl =
        document.getElementById(
            'forgot-success'
        );

    if (errorEl) {
        errorEl.textContent = '';
    }

    if (successEl) {
        successEl.textContent = '';
    }

    if (!username || !email) {
        if (errorEl) {
            errorEl.textContent =
                '❌ Заполните все поля';
        }

        return;
    }

    try {
        const {
            data: storedEmail,
            error: lookupError
        } = await supabaseClient.rpc(
            'get_email_by_username',
            {
                p_username: username
            }
        );

        if (
            lookupError ||
            !storedEmail
        ) {
            if (errorEl) {
                errorEl.textContent =
                    '❌ Пользователь не найден';
            }

            return;
        }

        if (
            String(storedEmail)
                .toLowerCase() !==
            email.toLowerCase()
        ) {
            if (errorEl) {
                errorEl.textContent =
                    '❌ Данные не совпадают';
            }

            return;
        }

        const redirectTo =
            window.location.origin +
            window.location.pathname;

        const {
            error
        } =
            await supabaseClient.auth
                .resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            redirectTo
                    }
                );

        if (error) {
            console.error(
                error
            );

            if (errorEl) {
                errorEl.textContent =
                    '❌ ' +
                    translateAuthError(
                        error.message
                    );
            }

            return;
        }

        e.target.reset();

        if (successEl) {
            successEl.textContent =
                '✅ Письмо для сброса пароля отправлено на email.';
        }

    } catch (error) {
        console.error(
            'Ошибка восстановления пароля:',
            error
        );

        if (errorEl) {
            errorEl.textContent =
                '❌ Не удалось восстановить пароль';
        }
    }
}


// ============================================================
// ПЕРЕВОД ОШИБОК SUPABASE
// ============================================================

function translateAuthError(message) {
    if (!message) {
        return 'Произошла ошибка';
    }

    const text =
        String(message).toLowerCase();

    if (
        text.includes(
            'user already registered'
        )
    ) {
        return 'Email уже зарегистрирован';
    }

    if (
        text.includes(
            'invalid login credentials'
        )
    ) {
        return 'Неверный логин или пароль';
    }

    if (
        text.includes(
            'password should be at least'
        )
    ) {
        return 'Пароль слишком короткий';
    }

    if (
        text.includes(
            'email not confirmed'
        )
    ) {
        return 'Подтвердите email';
    }

    if (
        text.includes(
            'rate limit'
        )
    ) {
        return 'Слишком много попыток. Попробуйте позже.';
    }

    return message;
}


// ============================================================
// ПЕРЕКЛЮЧЕНИЕ ФОРМ АВТОРИЗАЦИИ
// ============================================================

function showLogin() {
    const login =
        document.getElementById(
            'login-form'
        );

    const register =
        document.getElementById(
            'register-form'
        );

    const forgot =
        document.getElementById(
            'forgot-form'
        );

    if (login) {
        login.style.display =
            '';
    }

    if (register) {
        register.style.display =
            'none';
    }

    if (forgot) {
        forgot.style.display =
            'none';
    }
}


function showRegister() {
    const login =
        document.getElementById(
            'login-form'
        );

    const register =
        document.getElementById(
            'register-form'
        );

    const forgot =
        document.getElementById(
            'forgot-form'
        );

    if (login) {
        login.style.display =
            'none';
    }

    if (register) {
        register.style.display =
            '';
    }

    if (forgot) {
        forgot.style.display =
            'none';
    }
}


function showForgotPassword() {
    const login =
        document.getElementById(
            'login-form'
        );

    const register =
        document.getElementById(
            'register-form'
        );

    const forgot =
        document.getElementById(
            'forgot-form'
        );

    if (login) {
        login.style.display =
            'none';
    }

    if (register) {
        register.style.display =
            'none';
    }

    if (forgot) {
        forgot.style.display =
            '';
    }
}


// ============================================================
// АДМИНИСТРАТОР — НАЗНАЧЕНИЕ РОЛИ
// ============================================================

async function handlePromote(e) {
    e.preventDefault();

    if (
        !currentUser ||
        !currentUser.isAdmin
    ) {
        alert(
            '⛔ Нет доступа'
        );

        return;
    }

    const username =
        document
            .getElementById(
                'promote-username'
            )
            .value
            .trim();

    const newRank =
        document
            .getElementById(
                'promote-rank'
            )
            .value;

    const user =
        users.find(
            function (u) {
                return (
                    u.username
                        .toLowerCase() ===
                    username.toLowerCase()
                );
            }
        );

    if (!user) {
        alert(
            '❌ Пользователь не найден'
        );

        return;
    }

    const {
        error
    } =
        await supabaseClient
            .from('profiles')
            .update({
                rank: newRank,
                chief_for: null,
                helper_for: null
            })
            .eq(
                'id',
                user.id
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось изменить роль: ' +
            error.message
        );

        return;
    }

    closePromoteModal();

    await loadUsers();

    renderUsersList();

    alert(
        '✅ Роль изменена'
    );
}


// ============================================================
// НАЗНАЧЕНИЕ ГЛАВЫ / ПОМОЩНИКА
// ============================================================

async function handleAssignRole(e) {
    e.preventDefault();

    if (
        !currentUser ||
        !currentUser.isAdmin
    ) {
        alert(
            '⛔ Только администратор может назначать роли'
        );

        return;
    }

    const username =
        document
            .getElementById(
                'assign-username'
            )
            .value
            .trim();

    const serverId =
        Number(
            document
                .getElementById(
                    'assign-server'
                )
                .value
        );

    const role =
        document
            .getElementById(
                'assign-role'
            )
            .value;

    const user =
        users.find(
            function (u) {
                return (
                    u.username
                        .toLowerCase() ===
                    username.toLowerCase()
                );
            }
        );

    if (!user) {
        alert(
            '❌ Пользователь не найден'
        );

        return;
    }

    const update = {
        chief_for:
            role === 'chief'
                ? serverId
                : null,

        helper_for:
            role === 'helper'
                ? serverId
                : null
    };

    const {
        error
    } =
        await supabaseClient
            .from('profiles')
            .update(
                update
            )
            .eq(
                'id',
                user.id
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось назначить роль: ' +
            error.message
        );

        return;
    }

    closeAssignModal();

    await loadUsers();

    renderUsersList();

    alert(
        '✅ Назначен!'
    );
}


// ============================================================
// ДОБАВЛЕНИЕ СЕРВЕРА
// ============================================================

async function handleAddServer(e) {
    e.preventDefault();

    if (
        !currentUser ||
        !currentUser.isAdmin
    ) {
        alert(
            '⛔ Только администратор может создавать ветки'
        );

        return;
    }

    const name =
        document
            .getElementById(
                'new-server-name'
            )
            .value
            .trim();

    if (!name) {
        return;
    }

    const cleanName =
        name
            .toLowerCase()
            .replace(
                /\s/g,
                ''
            );

    const server = {
        name: name,

        status: 'online',

        description:
            'Сервер ' + name,

        version: '1.20.4',

        ips: [
            {
                name: 'IP',
                ip:
                    'play.' +
                    cleanName +
                    '.net'
            }
        ],

        builds: [
            {
                name: 'Сборка',
                url:
                    'https://example.com/build.zip'
            }
        ],

        features_title:
            'Почему ' +
            name +
            '?',

        features: [
            {
                icon: '📖',
                title:
                    'Сюжетные квесты',
                desc:
                    'Уникальная история'
            },
            {
                icon: '⚔️',
                title:
                    'PvP сражения',
                desc:
                    'Сбалансированные бои'
            },
            {
                icon: '🏰',
                title:
                    'Строительство',
                desc:
                    'Создавай замки'
            },
            {
                icon: '👥',
                title:
                    'Комьюнити',
                desc:
                    'Дружелюбные игроки'
            }
        ],

        stats: [
            {
                icon: '🎮',
                value: '1.20.4',
                label:
                    'Версия Minecraft'
            },
            {
                icon: '🌍',
                value: '3+',
                label:
                    'Регионов'
            },
            {
                icon: '📜',
                value: '50+',
                label:
                    'Квестов'
            },
            {
                icon: '⚡',
                value: '24/7',
                label:
                    'Работа сервера'
            }
        ]
    };

    const {
        data,
        error
    } =
        await supabaseClient
            .from('servers')
            .insert(
                server
            )
            .select()
            .single();

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось создать ветку: ' +
            error.message
        );

        return;
    }

    closeAddServerModal();

    await loadServers();

    const newIndex =
        servers.findIndex(
            function (s) {
                return (
                    String(s.id) ===
                    String(data.id)
                );
            }
        );

    currentServerIndex =
        newIndex >= 0
            ? newIndex
            : 0;

    loadServer(
        currentServerIndex
    );

    renderServersList();

    renderServersPage();

    alert(
        '✅ Создано: ' +
        name
    );
}


// ============================================================
// ВЫХОД
// ============================================================

async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error(
            'Ошибка выхода:',
            error
        );
    }

    currentUser = null;

    questions = [];

    users = [];

    updateUI();

    updateProfile();

    navigateTo('home');
}
// ============================================================
// ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ИЗ SESSION
// ============================================================

async function loadCurrentUserFromSession(session) {
    if (!session || !session.user) {
        currentUser = null;
        updateUI();
        return null;
    }

    const authUser = session.user;

    try {
        const {
            data: profile,
            error
        } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

        if (error) {
            console.error(
                'Ошибка загрузки профиля:',
                error
            );

            currentUser = {
                id: authUser.id,
                username:
                    authUser.user_metadata?.username ||
                    authUser.email?.split('@')[0] ||
                    'Игрок',
                email:
                    authUser.email || '',
                rank: 'Игрок',
                chiefFor: null,
                helperFor: null,
                isAdmin: false
            };

            updateUI();

            return currentUser;
        }

        if (!profile) {
            currentUser = {
                id: authUser.id,
                username:
                    authUser.user_metadata?.username ||
                    authUser.email?.split('@')[0] ||
                    'Игрок',
                email:
                    authUser.email || '',
                rank: 'Игрок',
                chiefFor: null,
                helperFor: null,
                isAdmin: false
            };

            updateUI();

            return currentUser;
        }

        currentUser = {
            id: profile.id,

            username:
                profile.username ||
                authUser.email?.split('@')[0] ||
                'Игрок',

            email:
                profile.email ||
                authUser.email ||
                '',

            rank:
                profile.rank ||
                'Игрок',

            chiefFor:
                profile.chief_for ?? null,

            helperFor:
                profile.helper_for ?? null,

            createdAt:
                profile.created_at || null,

            lastLogin:
                profile.last_login || null,

            isAdmin:
                profile.rank === 'Гл.Админ' ||
                profile.rank === 'Мл.Админ'
        };

        updateUI();

        return currentUser;

    } catch (error) {
        console.error(
            'Ошибка загрузки пользователя:',
            error
        );

        return null;
    }
}


// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ДАТА
// ============================================================

function formatDateTime(date) {
    if (!date) {
        return '';
    }

    const parsed =
        new Date(date);

    if (Number.isNaN(
        parsed.getTime()
    )) {
        return '';
    }

    return parsed.toLocaleString(
        'ru-RU',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    );
}


// ============================================================
// ВОПРОСЫ — СОЗДАНИЕ
// ============================================================

async function handleQuestionSubmit(e) {
    e.preventDefault();

    if (!requireAuth()) {
        return;
    }

    const titleEl =
        document.getElementById(
            'question-title'
        );

    const categoryEl =
        document.getElementById(
            'question-category'
        );

    const descriptionEl =
        document.getElementById(
            'question-description'
        );

    const urgentEl =
        document.getElementById(
            'question-urgent'
        );

    const title =
        titleEl
            ? titleEl.value.trim()
            : '';

    const category =
        categoryEl
            ? categoryEl.value
            : 'other';

    const description =
        descriptionEl
            ? descriptionEl.value.trim()
            : '';

    const isUrgent =
        urgentEl
            ? urgentEl.checked
            : false;

    if (!title || !description) {
        alert(
            '❌ Заполните заголовок и описание'
        );

        return;
    }

    try {
        const question = {
            user_id:
                currentUser.id,

            username:
                currentUser.username,

            title:
                title,

            category:
                category,

            description:
                description,

            date:
                new Date().toISOString(),

            answer:
                null,

            answer_by:
                null,

            answers:
                [],

            is_urgent:
                isUrgent,

            closed:
                false
        };

        const {
            data,
            error
        } =
            await supabaseClient
                .from('questions')
                .insert(question)
                .select()
                .single();

        if (error) {
            console.error(
                'Ошибка создания вопроса:',
                error
            );

            alert(
                '❌ Не удалось отправить вопрос: ' +
                error.message
            );

            return;
        }

        questions.unshift(
            normalizeQuestion(data)
        );

        closeQuestionModal();

        e.target.reset();

        renderQuestions();

        showNotification(
            'Вопрос успешно отправлен!',
            'success'
        );

    } catch (error) {
        console.error(
            'Критическая ошибка:',
            error
        );

        alert(
            '❌ Произошла ошибка'
        );
    }
}


// ============================================================
// ОТРИСОВКА ВОПРОСОВ ИГРОКА
// ============================================================

function renderQuestions() {
    const container =
        document.getElementById(
            'questions-list'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!currentUser) {
        container.innerHTML = `
            <div class="empty-state">
                Войдите в аккаунт, чтобы просматривать свои обращения.
            </div>
        `;

        return;
    }

    const myQuestions =
        questions.filter(
            function (question) {
                return (
                    question.user_id ===
                    currentUser.id
                );
            }
        );

    if (!myQuestions.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>У вас пока нет вопросов</h3>
                <p>
                    Если у вас возникла проблема,
                    создайте обращение в поддержку.
                </p>
            </div>
        `;

        return;
    }

    myQuestions.forEach(
        function (question) {
            container.appendChild(
                createQuestionCard(
                    question
                )
            );
        }
    );
}


// ============================================================
// КАРТОЧКА ВОПРОСА
// ============================================================

function createQuestionCard(question) {
    const card =
        document.createElement('div');

    card.className =
        'question-card';

    if (question.is_urgent) {
        card.classList.add(
            'urgent'
        );
    }

    const closedClass =
        question.closed
            ? 'closed'
            : 'open';

    const closedText =
        question.closed
            ? 'Закрыт'
            : 'Открыт';

    const answers =
        Array.isArray(
            question.answers
        )
            ? question.answers
            : [];

    card.innerHTML = `
        <div class="question-card-header">

            <div>
                <h3>
                    ${escapeHtml(
                        question.title
                    )}
                </h3>

                <div class="question-meta">

                    <span>
                        ${escapeHtml(
                            getCategoryName(
                                question.category
                            )
                        )}
                    </span>

                    <span>
                        ${formatDate(
                            question.date
                        )}
                    </span>

                </div>
            </div>

            <span class="question-status ${closedClass}">
                ${closedText}
            </span>

        </div>

        ${
            question.is_urgent
                ? `
                    <div class="question-urgent">
                        ⚠️ Срочное обращение
                    </div>
                `
                : ''
        }

        <p class="question-description">
            ${escapeHtml(
                question.description
            )}
        </p>

        ${
            answers.length
                ? `
                    <div class="question-answers">

                        <h4>
                            Ответы
                        </h4>

                        ${answers.map(
                            function (answer) {
                                return `
                                    <div class="question-answer">

                                        <div class="answer-header">

                                            <strong>
                                                ${escapeHtml(
                                                    answer.username ||
                                                    answer.answer_by ||
                                                    'Администратор'
                                                )}
                                            </strong>

                                            <span>
                                                ${formatDate(
                                                    answer.date
                                                )}
                                            </span>

                                        </div>

                                        <p>
                                            ${escapeHtml(
                                                answer.text ||
                                                answer.answer ||
                                                ''
                                            )}
                                        </p>

                                    </div>
                                `;
                            }
                        ).join('')}

                    </div>
                `
                : question.answer
                    ? `
                        <div class="question-answer">

                            <div class="answer-header">
                                <strong>
                                    ${escapeHtml(
                                        question.answer_by ||
                                        'Администратор'
                                    )}
                                </strong>
                            </div>

                            <p>
                                ${escapeHtml(
                                    question.answer
                                )}
                            </p>

                        </div>
                    `
                    : `
                        <div class="question-no-answer">
                            ⏳ Ожидает ответа администратора
                        </div>
                    `
        }

        <div class="question-actions">

            <button
                type="button"
                class="btn btn-secondary"
                onclick="openQuestionView(${question.id})"
            >
                Подробнее
            </button>

            ${
                !question.closed
                    ? `
                        <button
                            type="button"
                            class="btn btn-danger"
                            onclick="playerCompleteQuestion(${question.id})"
                        >
                            Закрыть вопрос
                        </button>
                    `
                    : ''
            }

        </div>
    `;

    return card;
}


// ============================================================
// ОТКРЫТИЕ ВОПРОСА
// ============================================================

function openQuestionView(id) {
    const question =
        questions.find(
            function (q) {
                return (
                    Number(q.id) ===
                    Number(id)
                );
            }
        );

    if (!question) {
        return;
    }

    currentViewQuestionId =
        question.id;

    const modal =
        document.getElementById(
            'question-view-modal'
        );

    if (!modal) {
        console.warn(
            'Модальное окно question-view-modal не найдено.'
        );

        return;
    }

    const title =
        document.getElementById(
            'view-question-title'
        );

    if (title) {
        title.textContent =
            question.title;
    }

    const category =
        document.getElementById(
            'view-question-category'
        );

    if (category) {
        category.textContent =
            getCategoryName(
                question.category
            );
    }

    const description =
        document.getElementById(
            'view-question-description'
        );

    if (description) {
        description.textContent =
            question.description;
    }

    const date =
        document.getElementById(
            'view-question-date'
        );

    if (date) {
        date.textContent =
            formatDate(
                question.date
            );
    }

    const answer =
        document.getElementById(
            'view-question-answer'
        );

    if (answer) {
        answer.innerHTML =
            '';

        const answers =
            Array.isArray(
                question.answers
            )
                ? question.answers
                : [];

        if (answers.length) {
            answer.innerHTML =
                answers
                    .map(
                        function (item) {
                            return `
                                <div class="question-answer">

                                    <strong>
                                        ${escapeHtml(
                                            item.username ||
                                            item.answer_by ||
                                            'Администратор'
                                        )}
                                    </strong>

                                    <small>
                                        ${formatDate(
                                            item.date
                                        )}
                                    </small>

                                    <p>
                                        ${escapeHtml(
                                            item.text ||
                                            item.answer ||
                                            ''
                                        )}
                                    </p>

                                </div>
                            `;
                        }
                    )
                    .join('');
        } else if (question.answer) {
            answer.innerHTML = `
                <div class="question-answer">

                    <strong>
                        ${escapeHtml(
                            question.answer_by ||
                            'Администратор'
                        )}
                    </strong>

                    <p>
                        ${escapeHtml(
                            question.answer
                        )}
                    </p>

                </div>
            `;
        } else {
            answer.innerHTML = `
                <p>
                    Ответа пока нет.
                </p>
            `;
        }
    }

    modal.classList.add(
        'active'
    );
}


// ============================================================
// ОТВЕТ НА ВОПРОС
// ============================================================

async function submitAnswer(questionId, answerText) {
    if (!requireAdmin()) {
        return false;
    }

    if (!answerText || !answerText.trim()) {
        return false;
    }

    const question =
        questions.find(
            function (q) {
                return (
                    Number(q.id) ===
                    Number(questionId)
                );
            }
        );

    if (!question) {
        return false;
    }

    const answers =
        Array.isArray(
            question.answers
        )
            ? [...question.answers]
            : [];

    answers.push({
        username:
            currentUser.username,

        answer_by:
            currentUser.username,

        text:
            answerText.trim(),

        date:
            new Date().toISOString()
    });

    const {
        error
    } =
        await supabaseClient
            .from('questions')
            .update({
                answer:
                    answerText.trim(),

                answer_by:
                    currentUser.username,

                answers:
                    answers
            })
            .eq(
                'id',
                question.id
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось отправить ответ: ' +
            error.message
        );

        return false;
    }

    question.answer =
        answerText.trim();

    question.answer_by =
        currentUser.username;

    question.answers =
        answers;

    renderQuestions();

    if (canAccessAdmin()) {
        renderAdminAllQuestions();
    }

    showNotification(
        'Ответ отправлен.',
        'success'
    );

    return true;
}


// ============================================================
// ЗАВЕРШЕНИЕ ВОПРОСА АДМИНОМ
// ============================================================

async function completeQuestion(questionId) {
    if (!requireAdmin()) {
        return;
    }

    const {
        error
    } =
        await supabaseClient
            .from('questions')
            .update({
                closed:
                    true
            })
            .eq(
                'id',
                questionId
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось закрыть вопрос: ' +
            error.message
        );

        return;
    }

    const question =
        questions.find(
            function (q) {
                return (
                    Number(q.id) ===
                    Number(questionId)
                );
            }
        );

    if (question) {
        question.closed =
            true;
    }

    renderQuestions();
    renderAdminAllQuestions();

    showNotification(
        'Вопрос закрыт.',
        'success'
    );
}


// ============================================================
// ЗАВЕРШЕНИЕ ВОПРОСА ИГРОКОМ
// ============================================================

async function playerCompleteQuestion(questionId) {
    if (!requireAuth()) {
        return;
    }

    const question =
        questions.find(
            function (q) {
                return (
                    Number(q.id) ===
                    Number(questionId)
                );
            }
        );

    if (!question) {
        return;
    }

    if (
        question.user_id !==
        currentUser.id
    ) {
        alert(
            '⛔ Вы не можете закрыть этот вопрос.'
        );

        return;
    }

    if (
        !confirm(
            'Закрыть это обращение?'
        )
    ) {
        return;
    }

    const {
        error
    } =
        await supabaseClient
            .from('questions')
            .update({
                closed:
                    true
            })
            .eq(
                'id',
                questionId
            )
            .eq(
                'user_id',
                currentUser.id
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось закрыть вопрос: ' +
            error.message
        );

        return;
    }

    question.closed =
        true;

    renderQuestions();

    showNotification(
        'Обращение закрыто.',
        'success'
    );
}


// ============================================================
// АДМИН-ПАНЕЛЬ
// ============================================================

function renderAdminPage() {
    if (!canAccessAdmin()) {
        return;
    }

    renderAdminServers();

    renderUsersList();

    renderAdminAllQuestions();

    populateServerSelects();
}


// ============================================================
// СЕРВЕРЫ В АДМИНКЕ
// ============================================================

function renderAdminServers() {
    const container =
        document.getElementById(
            'admin-servers-list'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    servers.forEach(
        function (server, index) {
            const canEdit =
                canEditServer(
                    index
                );

            const card =
                document.createElement(
                    'div'
                );

            card.className =
                'admin-server-card';

            card.innerHTML = `
                <div class="admin-server-header">

                    <div>
                        <h3>
                            ${escapeHtml(
                                server.name
                            )}
                        </h3>

                        <span>
                            ID: ${server.id ?? index}
                        </span>
                    </div>

                    <span class="server-status ${
                        server.status === 'online'
                            ? 'online'
                            : 'offline'
                    }">
                        ${
                            server.status === 'online'
                                ? 'Онлайн'
                                : 'Оффлайн'
                        }
                    </span>

                </div>

                <p>
                    ${escapeHtml(
                        server.description || ''
                    )}
                </p>

                <div class="admin-server-actions">

                    <button
                        type="button"
                        class="btn btn-primary"
                        ${
                            canEdit
                                ? ''
                                : 'disabled'
                        }
                        onclick="openServerSettings(${index})"
                    >
                        ⚙️ Настройки
                    </button>

                    ${
                        isAdminUser()
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    onclick="deleteServer(${server.id})"
                                >
                                    🗑️ Удалить
                                </button>
                            `
                            : ''
                    }

                </div>
            `;

            container.appendChild(
                card
            );
        }
    );
}


// ============================================================
// НАСТРОЙКИ СЕРВЕРА
// ============================================================

function openServerSettings(index) {
    if (
        !canEditServer(index)
    ) {
        alert(
            '⛔ У вас нет прав для редактирования этого сервера.'
        );

        return;
    }

    const server =
        servers[index];

    if (!server) {
        return;
    }

    currentServerIndex =
        index;

    const modal =
        document.getElementById(
            'server-settings-modal'
        );

    if (!modal) {
        return;
    }

    const name =
        document.getElementById(
            'settings-server-name'
        );

    if (name) {
        name.value =
            server.name || '';
    }

    const status =
        document.getElementById(
            'settings-server-status'
        );

    if (status) {
        status.value =
            server.status || 'online';
    }

    const description =
        document.getElementById(
            'settings-server-description'
        );

    if (description) {
        description.value =
            server.description || '';
    }

    const version =
        document.getElementById(
            'settings-server-version'
        );

    if (version) {
        version.value =
            server.version || '';
    }

    const ips =
        document.getElementById(
            'settings-server-ips'
        );

    if (ips) {
        ips.value =
            Array.isArray(server.ips)
                ? server.ips
                    .map(
                        function (ip) {
                            return typeof ip === 'string'
                                ? ip
                                : ip.ip || '';
                        }
                    )
                    .join('\n')
                : '';
    }

    const builds =
        document.getElementById(
            'settings-server-builds'
        );

    if (builds) {
        builds.value =
            Array.isArray(server.builds)
                ? server.builds
                    .map(
                        function (build) {
                            return typeof build === 'string'
                                ? build
                                : build.url || '';
                        }
                    )
                    .join('\n')
                : '';
    }

    modal.classList.add(
        'active'
    );
}


// ============================================================
// СОХРАНЕНИЕ НАСТРОЕК СЕРВЕРА
// ============================================================

async function saveAdminSettings(e) {
    if (e) {
        e.preventDefault();
    }

    const index =
        currentServerIndex;

    if (
        !canEditServer(index)
    ) {
        alert(
            '⛔ Нет прав для изменения сервера.'
        );

        return;
    }

    const server =
        servers[index];

    if (!server) {
        return;
    }

    const name =
        document.getElementById(
            'settings-server-name'
        )?.value.trim();

    const status =
        document.getElementById(
            'settings-server-status'
        )?.value;

    const description =
        document.getElementById(
            'settings-server-description'
        )?.value.trim();

    const version =
        document.getElementById(
            'settings-server-version'
        )?.value.trim();

    const ipsText =
        document.getElementById(
            'settings-server-ips'
        )?.value || '';

    const buildsText =
        document.getElementById(
            'settings-server-builds'
        )?.value || '';

    const ips =
        ipsText
            .split('\n')
            .map(
                function (item) {
                    return item.trim();
                }
            )
            .filter(Boolean);

    const builds =
        buildsText
            .split('\n')
            .map(
                function (item) {
                    return item.trim();
                }
            )
            .filter(Boolean);

    const update = {
        name:
            name || server.name,

        status:
            status || server.status,

        description:
            description || '',

        version:
            version || '',

        ips:
            ips,

        builds:
            builds
    };

    const {
        error
    } =
        await supabaseClient
            .from('servers')
            .update(update)
            .eq(
                'id',
                server.id
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось сохранить настройки: ' +
            error.message
        );

        return;
    }

    Object.assign(
        server,
        normalizeServer({
            ...server,
            ...update
        })
    );

    closeServerSettings();

    loadServer(
        currentServerIndex
    );

    renderServersPage();

    renderAdminServers();

    showNotification(
        'Настройки сохранены!',
        'success'
    );
}


// ============================================================
// УДАЛЕНИЕ СЕРВЕРА
// ============================================================

async function deleteServer(serverId) {
    if (!isAdminUser()) {
        alert(
            '⛔ Только администратор может удалить сервер.'
        );

        return;
    }

    if (
        !confirm(
            'Вы действительно хотите удалить этот сервер?'
        )
    ) {
        return;
    }

    const {
        error
    } =
        await supabaseClient
            .from('servers')
            .delete()
            .eq(
                'id',
                serverId
            );

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось удалить сервер: ' +
            error.message
        );

        return;
    }

    await loadServers();

    currentServerIndex =
        Math.min(
            currentServerIndex,
            Math.max(
                servers.length - 1,
                0
            )
        );

    loadServer(
        currentServerIndex
    );

    renderServersPage();

    renderAdminServers();

    populateServerSelects();

    showNotification(
        'Сервер удалён.',
        'success'
    );
}


// ============================================================
// СПИСОК ПОЛЬЗОВАТЕЛЕЙ
// ============================================================

function renderUsersList() {
    const container =
        document.getElementById(
            'users-list'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!users.length) {
        container.innerHTML = `
            <div class="empty-state">
                Пользователей пока нет.
            </div>
        `;

        return;
    }

    users.forEach(
        function (user) {
            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'user-admin-card';

            const serverChief =
                servers.find(
                    function (server) {
                        return (
                            Number(server.id) ===
                            Number(user.chiefFor)
                        );
                    }
                );

            const serverHelper =
                servers.find(
                    function (server) {
                        return (
                            Number(server.id) ===
                            Number(user.helperFor)
                        );
                    }
                );

            let roleText =
                user.rank || 'Игрок';

            if (serverChief) {
                roleText +=
                    ' — Глава: ' +
                    serverChief.name;
            }

            if (serverHelper) {
                roleText +=
                    ' — Помощник: ' +
                    serverHelper.name;
            }

            item.innerHTML = `
                <div class="user-admin-info">

                    <strong>
                        ${escapeHtml(
                            user.username
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            user.email || ''
                        )}
                    </span>

                    <span>
                        Роль:
                        ${escapeHtml(
                            roleText
                        )}
                    </span>

                    <span>
                        Регистрация:
                        ${formatDate(
                            user.createdAt
                        )}
                    </span>

                </div>

                ${
                    isAdminUser()
                        ? `
                            <div class="user-admin-actions">

                                <button
                                    type="button"
                                    class="btn btn-secondary"
                                    onclick="openPromoteModal('${String(
                                        user.username
                                    ).replace(
                                        /'/g,
                                        "\\'"
                                    )}')"
                                >
                                    Роль
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-secondary"
                                    onclick="openAssignModal('${String(
                                        user.username
                                    ).replace(
                                        /'/g,
                                        "\\'"
                                    )}')"
                                >
                                    Назначить
                                </button>

                            </div>
                        `
                        : ''
                }
            `;

            container.appendChild(
                item
            );
        }
    );
}


// ============================================================
// ВОПРОСЫ В АДМИНКЕ
// ============================================================

function renderAdminAllQuestions() {
    const container =
        document.getElementById(
            'admin-questions-list'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!questions.length) {
        container.innerHTML = `
            <div class="empty-state">
                Вопросов пока нет.
            </div>
        `;

        return;
    }

    questions.forEach(
        function (question) {
            const card =
                document.createElement(
                    'div'
                );

            card.className =
                'admin-question-card';

            card.innerHTML = `
                <div>

                    <h3>
                        ${escapeHtml(
                            question.title
                        )}
                    </h3>

                    <p>
                        Игрок:
                        <strong>
                            ${escapeHtml(
                                question.username
                            )}
                        </strong>
                    </p>

                    <p>
                        Категория:
                        ${escapeHtml(
                            getCategoryName(
                                question.category
                            )
                        )}
                    </p>

                    <p>
                        ${escapeHtml(
                            question.description
                        )}
                    </p>

                    <small>
                        ${formatDate(
                            question.date
                        )}
                    </small>

                    <span class="question-status ${
                        question.closed
                            ? 'closed'
                            : 'open'
                    }">
                        ${
                            question.closed
                                ? 'Закрыт'
                                : 'Открыт'
                        }
                    </span>

                </div>

                <div class="admin-question-actions">

                    <button
                        type="button"
                        class="btn btn-primary"
                        onclick="openAdminQuestion(${question.id})"
                    >
                        Открыть
                    </button>

                    ${
                        !question.closed
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    onclick="completeQuestion(${question.id})"
                                >
                                    Закрыть
                                </button>
                            `
                            : ''
                    }

                </div>
            `;

            container.appendChild(
                card
            );
        }
    );
}


// ============================================================
// ОТКРЫТИЕ ВОПРОСА В АДМИНКЕ
// ============================================================

function openAdminQuestion(questionId) {
    const question =
        questions.find(
            function (q) {
                return (
                    Number(q.id) ===
                    Number(questionId)
                );
            }
        );

    if (!question) {
        return;
    }

    currentViewQuestionId =
        question.id;

    const modal =
        document.getElementById(
            'admin-question-modal'
        );

    if (!modal) {
        // Если отдельного админского окна нет,
        // используем обычное окно просмотра.
        openQuestionView(
            question.id
        );

        return;
    }

    const title =
        document.getElementById(
            'admin-question-title'
        );

    if (title) {
        title.textContent =
            question.title;
    }

    const user =
        document.getElementById(
            'admin-question-user'
        );

    if (user) {
        user.textContent =
            question.username;
    }

    const description =
        document.getElementById(
            'admin-question-description'
        );

    if (description) {
        description.textContent =
            question.description;
    }

    const answer =
        document.getElementById(
            'admin-question-answer'
        );

    if (answer) {
        answer.value =
            '';
    }

    modal.classList.add(
        'active'
    );
}


// ============================================================
// ОТПРАВКА ОТВЕТА ИЗ АДМИНСКОГО ОКНА
// ============================================================

async function submitAdminAnswer() {
    if (!currentViewQuestionId) {
        return;
    }

    const textarea =
        document.getElementById(
            'admin-question-answer'
        );

    if (!textarea) {
        return;
    }

    const text =
        textarea.value.trim();

    if (!text) {
        alert(
            'Введите ответ.'
        );

        return;
    }

    const success =
        await submitAnswer(
            currentViewQuestionId,
            text
        );

    if (success) {
        textarea.value = '';

        closeAdminQuestionModal();
    }
}


// ============================================================
// ВКЛАДКИ АДМИНКИ
// ============================================================

function switchAdminTab(tab) {
    if (!requireAdmin()) {
        return;
    }

    currentAdminTab =
        tab;

    const tabs =
        document.querySelectorAll(
            '.admin-tab'
        );

    tabs.forEach(
        function (button) {
            const buttonTab =
                button.dataset.tab;

            button.classList.toggle(
                'active',
                buttonTab === tab
            );
        }
    );

    const sections =
        document.querySelectorAll(
            '.admin-section'
        );

    sections.forEach(
        function (section) {
            const sectionTab =
                section.dataset.tab;

            section.style.display =
                sectionTab === tab
                    ? ''
                    : 'none';
        }
    );

    if (tab === 'servers') {
        renderAdminServers();
    }

    if (tab === 'users') {
        renderUsersList();
    }

    if (tab === 'questions') {
        renderAdminAllQuestions();
    }
}


// ============================================================
// SELECT СЕРВЕРОВ
// ============================================================

function populateServerSelects() {
    const selects =
        document.querySelectorAll(
            '[data-server-select]'
        );

    selects.forEach(
        function (select) {
            const current =
                select.value;

            select.innerHTML = `
                <option value="">
                    Выберите сервер
                </option>
            `;

            servers.forEach(
                function (server) {
                    const option =
                        document.createElement(
                            'option'
                        );

                    option.value =
                        server.id;

                    option.textContent =
                        server.name;

                    select.appendChild(
                        option
                    );
                }
            );

            if (current) {
                select.value =
                    current;
            }
        }
    );

    const assignServer =
        document.getElementById(
            'assign-server'
        );

    if (assignServer) {
        const current =
            assignServer.value;

        assignServer.innerHTML = `
            <option value="">
                Выберите сервер
            </option>
        `;

        servers.forEach(
            function (server) {
                const option =
                    document.createElement(
                        'option'
                    );

                option.value =
                    server.id;

                option.textContent =
                    server.name;

                assignServer.appendChild(
                    option
                );
            }
        );

        if (current) {
            assignServer.value =
                current;
        }
    }
}


// ============================================================
// ИЗМЕНЕНИЕ ПАРОЛЯ
// ============================================================

async function changePassword(e) {
    if (e) {
        e.preventDefault();
    }

    if (!requireAuth()) {
        return;
    }

    const password =
        document.getElementById(
            'new-password'
        )?.value;

    const confirmPassword =
        document.getElementById(
            'confirm-password'
        )?.value;

    if (!password) {
        alert(
            'Введите новый пароль.'
        );

        return;
    }

    if (password.length < 6) {
        alert(
            'Пароль должен содержать минимум 6 символов.'
        );

        return;
    }

    if (
        password !==
        confirmPassword
    ) {
        alert(
            'Пароли не совпадают.'
        );

        return;
    }

    const {
        error
    } =
        await supabaseClient.auth
            .updateUser({
                password:
                    password
            });

    if (error) {
        console.error(
            error
        );

        alert(
            '❌ Не удалось изменить пароль: ' +
            error.message
        );

        return;
    }

    if (e?.target) {
        e.target.reset();
    }

    showNotification(
        'Пароль успешно изменён!',
        'success'
    );
}


// ============================================================
// УДАЛЕНИЕ АККАУНТА
// ============================================================

async function deleteAccount() {
    if (!requireAuth()) {
        return;
    }

    if (
        !confirm(
            'Вы действительно хотите удалить аккаунт?'
        )
    ) {
        return;
    }

    /*
     * В браузере нельзя безопасно удалять auth.users
     * через service_role key.
     *
     * Поэтому здесь удаляем доступ пользователя
     * из текущей сессии.
     *
     * Полное удаление auth.users позже лучше
     * сделать через Supabase Edge Function.
     */

    try {
        const {
            error
        } =
            await supabaseClient.auth.signOut();

        if (error) {
            console.error(
                error
            );

            alert(
                '❌ Не удалось выйти из аккаунта.'
            );

            return;
        }

        currentUser = null;

        questions = [];

        users = [];

        updateUI();

        navigateTo(
            'home'
        );

        showNotification(
            'Вы вышли из аккаунта.',
            'success'
        );

    } catch (error) {
        console.error(
            error
        );

        alert(
            '❌ Произошла ошибка.'
        );
    }
}


// ============================================================
// МОДАЛЬНЫЕ ОКНА
// ============================================================

function openQuestionModal() {
    if (!requireAuth()) {
        return;
    }

    const modal =
        document.getElementById(
            'question-modal'
        );

    if (modal) {
        modal.classList.add(
            'active'
        );
    }
}


function closeQuestionModal() {
    const modal =
        document.getElementById(
            'question-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }
}


function closeQuestionView() {
    const modal =
        document.getElementById(
            'question-view-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }

    currentViewQuestionId =
        null;
}


function openPromoteModal(username = '') {
    if (!isAdminUser()) {
        return;
    }

    const modal =
        document.getElementById(
            'promote-modal'
        );

    if (!modal) {
        return;
    }

    const input =
        document.getElementById(
            'promote-username'
        );

    if (input) {
        input.value =
            username;
    }

    modal.classList.add(
        'active'
    );
}


function closePromoteModal() {
    const modal =
        document.getElementById(
            'promote-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }
}


function openAssignModal(username = '') {
    if (!isAdminUser()) {
        return;
    }

    const modal =
        document.getElementById(
            'assign-role-modal'
        );

    if (!modal) {
        return;
    }

    const input =
        document.getElementById(
            'assign-username'
        );

    if (input) {
        input.value =
            username;
    }

    populateServerSelects();

    modal.classList.add(
        'active'
    );
}


function closeAssignModal() {
    const modal =
        document.getElementById(
            'assign-role-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }
}


function openAddServerModal() {
    if (!isAdminUser()) {
        return;
    }

    const modal =
        document.getElementById(
            'add-server-modal'
        );

    if (modal) {
        modal.classList.add(
            'active'
        );
    }
}


function closeAddServerModal() {
    const modal =
        document.getElementById(
            'add-server-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }
}


function closeServerSettings() {
    const modal =
        document.getElementById(
            'server-settings-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }
}


function closeAdminQuestionModal() {
    const modal =
        document.getElementById(
            'admin-question-modal'
        );

    if (modal) {
        modal.classList.remove(
            'active'
        );
    }

    currentViewQuestionId =
        null;
}


// ============================================================
// ЗАКРЫТИЕ МОДАЛОК ПО КЛИКУ ВНЕ ОКНА
// ============================================================

document.addEventListener(
    'click',
    function (event) {
        if (
            event.target.classList.contains(
                'modal'
            )
        ) {
            event.target.classList.remove(
                'active'
            );
        }
    }
);


// ============================================================
// SUPABASE AUTH STATE
// ============================================================

if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(
        async function (
            event,
            session
        ) {
            console.log(
                'Auth event:',
                event
            );

            if (
                event ===
                'SIGNED_IN'
            ) {
                await loadCurrentUserFromSession(
                    session
                );

                await loadQuestions();

                if (currentUser) {
                    await loadUsers();
                }

                updateUI();
                updateProfile();
            }

            if (
                event ===
                'SIGNED_OUT'
            ) {
                currentUser = null;

                questions = [];

                users = [];

                updateUI();
            }

            if (
                event ===
                'PASSWORD_RECOVERY'
            ) {
                showNotification(
                    'Введите новый пароль.',
                    'info'
                );
            }
        }
    );
}


// ============================================================
// ESC — ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
// ============================================================

document.addEventListener(
    'keydown',
    function (event) {
        if (
            event.key !==
            'Escape'
        ) {
            return;
        }

        const modals =
            document.querySelectorAll(
                '.modal.active'
            );

        modals.forEach(
            function (modal) {
                modal.classList.remove(
                    'active'
                );
            }
        );

        currentViewQuestionId =
            null;
    }
);


// ============================================================
// ОБРАБОТКА ССЫЛОК С ХЕШЕМ
// ============================================================

function handleHashNavigation() {
    const hash =
        window.location.hash
            .replace(
                '#',
                ''
            )
            .trim();

    if (!hash) {
        return;
    }

    const allowedPages = [
        'home',
        'servers',
        'support',
        'profile',
        'admin',
        'auth'
    ];

    if (
        allowedPages.includes(
            hash
        )
    ) {
        navigateTo(
            hash
        );
    }
}

window.addEventListener(
    'hashchange',
    handleHashNavigation
);


// ============================================================
// ПОДДЕРЖКА ПЕРЕКЛЮЧЕНИЯ LOGIN/REGISTER
// ============================================================

window.showLogin =
    showLogin;

window.showRegister =
    showRegister;

window.showForgotPassword =
    showForgotPassword;


// ============================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML onclick
// ============================================================

window.navigateTo =
    navigateTo;

window.loadServer =
    loadServer;

window.selectServer =
    selectServer;

window.copyIP =
    copyIP;

window.logout =
    logout;

window.openQuestionModal =
    openQuestionModal;

window.closeQuestionModal =
    closeQuestionModal;

window.closeQuestionView =
    closeQuestionView;

window.openPromoteModal =
    openPromoteModal;

window.closePromoteModal =
    closePromoteModal;

window.openAssignModal =
    openAssignModal;

window.closeAssignModal =
    closeAssignModal;

window.openAddServerModal =
    openAddServerModal;

window.closeAddServerModal =
    closeAddServerModal;

window.openServerSettings =
    openServerSettings;

window.closeServerSettings =
    closeServerSettings;

window.saveAdminSettings =
    saveAdminSettings;

window.deleteServer =
    deleteServer;

window.completeQuestion =
    completeQuestion;

window.playerCompleteQuestion =
    playerCompleteQuestion;

window.openQuestionView =
    openQuestionView;

window.openAdminQuestion =
    openAdminQuestion;

window.submitAdminAnswer =
    submitAdminAnswer;

window.switchAdminTab =
    switchAdminTab;

window.changePassword =
    changePassword;

window.deleteAccount =
    deleteAccount;


// ============================================================
// ФИНАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================================

handleHashNavigation();

console.log(
    '%cCristalhills',
    'font-size: 20px; font-weight: bold;'
);

console.log(
    'Supabase version loaded.'
);
