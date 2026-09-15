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
