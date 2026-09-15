const SUPABASE_URL =
    "https://zedgouirmabujahlpbjq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_1SJJwVyWmCzNy4htOLvnGA_hAZOhYXJ";

let supabaseClient = null;
let supabaseReady = false;

let currentUser = null;
let users = [];
let servers = [];
let questions = [];
let changelog = [];
let socialLinks = [];

let currentServerIndex = Number(
    localStorage.getItem(
        "cristalhills_current_server"
    ) || 0
);

let currentQuestionId = null;

const SOCIAL_ICONS = [
    "🔗",
    "📱",
    "💬",
    "📢",
    "🌐",
    "🎮",
    "▶️",
    "🎵",
    "📸",
    "🐦",
    "💙",
    "💜",
    "🟢",
    "🔴",
    "🟠",
    "🟣",
    "🟡",
    "⚫",
    "🟦",
    "🟪",
    "🎥",
    "📡",
    "👥",
    "⭐"
];

const DEFAULT_SERVER = {
    id: "default-cristalhills",
    name: "Cristalhills",
    status: "online",
    description:
        "Cristalhills это проект со своим сюжетом и квестами, где есть много игроков, с которыми вы можете подружиться и играть вместе, наш проект развивается и уже как год доступен для всех пользователей из разных стран, ждём вас на нашем сервере, скопируйте айпи ниже и установите сборку, так же по кнопке снизу, удачной вам игры.",
    version: "1.20.4",
    ips: [
        {
            name: "Основной",
            ip: "play.cristalhills.net"
        }
    ],
    builds: [
        {
            name: "Сборка",
            url: "https://example.com/build.zip"
        }
    ],
    featuresTitle: "Почему Cristalhills?",
    features: [
        {
            icon: "📖",
            title: "Сюжетные квесты",
            desc: "Уникальная история с захватывающими приключениями"
        },
        {
            icon: "⚔️",
            title: "PvP сражения",
            desc: "Сбалансированные бои и турниры"
        },
        {
            icon: "🏰",
            title: "Строительство",
            desc: "Создавай замки вместе с друзьями"
        },
        {
            icon: "👥",
            title: "Комьюнити",
            desc: "Дружелюбное сообщество игроков"
        }
    ],
    stats: [
        {
            icon: "🎮",
            value: "1.20.4",
            label: "Версия Minecraft"
        },
        {
            icon: "🌍",
            value: "3+",
            label: "Регионов"
        },
        {
            icon: "📜",
            value: "50+",
            label: "Квестов"
        },
        {
            icon: "⚡",
            value: "24/7",
            label: "Работа сервера"
        }
    ]
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cloneDefaultServer() {
    return clone(DEFAULT_SERVER);
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

function escapeJs(value) {
    return String(value == null ? "" : value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "")
        .replace(/\n/g, "\\n");
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("ru-RU");
}

function createServerId(name) {
    return String(name || "server")
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeServer(row) {
    const fallback = cloneDefaultServer();

    if (!row) {
        return fallback;
    }

    return {
        id: row.id || createServerId(row.name),
        name: row.name || fallback.name,
        status: row.status || "online",
        description: row.description || "",
        version: row.version || "1.20.4",
        ips: Array.isArray(row.ips)
            ? row.ips
            : fallback.ips,
        builds: Array.isArray(row.builds)
            ? row.builds
            : fallback.builds,
        featuresTitle:
            row.features_title ||
            row.featuresTitle ||
            "Почему " +
                (row.name || fallback.name) +
                "?",
        features:
            Array.isArray(row.features) &&
            row.features.length >= 4
                ? row.features.slice(0, 4)
                : fallback.features,
        stats:
            Array.isArray(row.stats) &&
            row.stats.length >= 4
                ? row.stats.slice(0, 4)
                : fallback.stats
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
        features_title: server.featuresTitle || "",
        features: server.features || [],
        stats: server.stats || []
    };
}

function normalizeQuestion(row) {
    return {
        id: row.id,
        userId: row.user_id,
        author: row.username || "Игрок",
        title: row.title || "",
        category: row.category || "other",
        text: row.description || "",
        date:
            row.date ||
            formatDate(row.created_at),
        answer: row.answer || null,
        answerBy: row.answer_by || null,
        answers: Array.isArray(row.answers)
            ? row.answers
            : [],
        isUrgent: Boolean(row.is_urgent),
        closed: Boolean(row.closed)
    };
}

function profileToUser(profile) {
    const rank = profile.rank || "Игрок";

    return {
        id: profile.id,
        username: profile.username || "Игрок",
        email: profile.email || "",
        rank: rank,
        chiefFor: profile.chief_for,
        helperFor: profile.helper_for,
        regDate: formatDate(profile.created_at),
        lastLogin: formatDate(profile.last_login),
        isAdmin:
            rank === "Гл.Админ" ||
            rank === "Мл.Админ",
        isMainAdmin: rank === "Гл.Админ"
    };
}

async function initSupabase() {
    if (
        !window.supabase ||
        !window.supabase.createClient
    ) {
        console.error(
            "Supabase JS library is not loaded"
        );

        return false;
    }

    supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );

    supabaseReady = true;
    return true;
}

async function loadProfile(authUser) {
    if (!authUser || !supabaseClient) {
        currentUser = null;
        return;
    }

    const result =
        await supabaseClient
            .from("profiles")
            .select(
                "id, username, email, rank, chief_for, helper_for, created_at, last_login"
            )
            .eq("id", authUser.id)
            .maybeSingle();

    if (result.error) {
        console.error(
            "Profile load error:",
            result.error
        );

        currentUser = {
            id: authUser.id,
            username:
                authUser.user_metadata?.username ||
                authUser.email?.split("@")[0] ||
                "Игрок",
            email: authUser.email || "",
            rank: "Игрок",
            isAdmin: false,
            isMainAdmin: false
        };

        return;
    }

    if (!result.data) {
        const username =
            authUser.user_metadata?.username ||
            authUser.email?.split("@")[0] ||
            "Игрок";

        const insertResult =
            await supabaseClient
                .from("profiles")
                .insert({
                    id: authUser.id,
                    username: username,
                    email: authUser.email || "",
                    rank: "Игрок"
                })
                .select()
                .single();

        if (
            !insertResult.error &&
            insertResult.data
        ) {
            currentUser = profileToUser(
                insertResult.data
            );
        } else {
            currentUser = {
                id: authUser.id,
                username: username,
                email: authUser.email || "",
                rank: "Игрок",
                isAdmin: false,
                isMainAdmin: false
            };
        }

        return;
    }

    currentUser = profileToUser(result.data);
}

async function loadCurrentUser() {
    if (!supabaseReady) {
        currentUser = null;
        return;
    }

    const result =
        await supabaseClient.auth.getUser();

    if (
        result.error ||
        !result.data ||
        !result.data.user
    ) {
        currentUser = null;
        return;
    }

    await loadProfile(result.data.user);
}

async function loadServers() {
    if (!supabaseReady) {
        servers = [cloneDefaultServer()];
        return;
    }

    const result =
        await supabaseClient
            .from("servers")
            .select("*")
            .order("id", {
                ascending: true
            });

    if (result.error) {
        console.error(
            "Servers load error:",
            result.error
        );

        servers = [cloneDefaultServer()];
        return;
    }

    servers = (result.data || [])
        .map(normalizeServer);

    if (!servers.length) {
        servers = [cloneDefaultServer()];
    }

    if (
        currentServerIndex < 0 ||
        currentServerIndex >= servers.length
    ) {
        currentServerIndex = 0;
    }
}

async function loadQuestions() {
    if (!supabaseReady) {
        questions = [];
        return;
    }

    const result =
        await supabaseClient
            .from("questions")
            .select("*")
            .order("id", {
                ascending: false
            });

    if (result.error) {
        console.error(
            "Questions load error:",
            result.error
        );

        questions = [];
        return;
    }

    questions = (result.data || [])
        .map(normalizeQuestion);
}

async function loadUsers() {
    if (
        !currentUser ||
        !currentUser.isAdmin ||
        !supabaseReady
    ) {
        users = [];
        return;
    }

    const result =
        await supabaseClient
            .from("profiles")
            .select(
                "id, username, email, rank, chief_for, helper_for, created_at, last_login"
            )
            .order("created_at", {
                ascending: true
            });

    if (result.error) {
        console.error(
            "Users load error:",
            result.error
        );

        users = [];
        return;
    }

    users = result.data || [];
}

async function loadChangelog() {
    if (!supabaseReady) {
        changelog = [];
        renderChangelog();
        renderAdminChangelog();
        return;
    }

    const result =
        await supabaseClient
            .from("changelog")
            .select("*")
            .order("created_at", {
                ascending: false
            });

    if (result.error) {
        console.error(
            "Changelog load error:",
            result.error
        );

        changelog = [];
    } else {
        changelog = result.data || [];
    }

    renderChangelog();
    renderAdminChangelog();
}

async function loadSocialLinks() {
    if (!supabaseReady) {
        socialLinks = [];
        renderSocialLinks();
        renderAdminSocialLinks();
        renderSocialIconPicker();
        return;
    }

    const result =
        await supabaseClient
            .from("social_links")
            .select("*")
            .order("sort_order", {
                ascending: true
            })
            .order("created_at", {
                ascending: false
            });

    if (result.error) {
        console.error(
            "Social links load error:",
            result.error
        );

        socialLinks = [];
    } else {
        socialLinks = result.data || [];
    }

    renderSocialLinks();
    renderAdminSocialLinks();
    renderSocialIconPicker();
}

async function refreshAll() {
    await loadCurrentUser();
    await loadServers();
    await loadQuestions();
    await loadUsers();
    await loadChangelog();
    await loadSocialLinks();

    updateUI();
    updateProfile();
    loadServer(currentServerIndex);
    renderQuestions();
    renderUsersList();
}

document.addEventListener(
    "DOMContentLoaded",
    function() {
        const loginForm =
            document.getElementById("login-form");

        const registerForm =
            document.getElementById("register-form");

        const forgotForm =
            document.getElementById("forgot-form");

        if (loginForm) {
            loginForm.addEventListener(
                "submit",
                handleLogin
            );
        }

        if (registerForm) {
            registerForm.addEventListener(
                "submit",
                handleRegister
            );
        }

        if (forgotForm) {
            forgotForm.addEventListener(
                "submit",
                handleForgotPassword
            );
        }
    }
);

function setupRealtime() {
    if (!supabaseClient) return;

    try {
        supabaseClient
            .channel("cristalhills-live")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "servers"
                },
                async function() {
                    await loadServers();
                    loadServer(currentServerIndex);
                    renderServersPage();
                    renderServersList();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "questions"
                },
                async function() {
                    await loadQuestions();
                    renderQuestions();
                    renderAdminAllQuestions();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "profiles"
                },
                async function() {
                    if (currentUser) {
                        await loadProfile({
                            id: currentUser.id,
                            email: currentUser.email,
                            user_metadata: {
                                username:
                                    currentUser.username
                            }
                        });
                    }

                    await loadUsers();
                    updateUI();
                    updateProfile();
                    renderUsersList();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "changelog"
                },
                async function() {
                    await loadChangelog();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "social_links"
                },
                async function() {
                    await loadSocialLinks();
                }
            )
            .subscribe(function(status) {
                if (status === "CHANNEL_ERROR") {
                    console.warn(
                        "Supabase Realtime unavailable"
                    );
                }
            });
    } catch (error) {
        console.warn(
            "Realtime setup failed:",
            error
        );
    }
}

function setupBrandButton() {
    const brand =
        document.getElementById("brand-button");

    if (!brand) return;

    brand.addEventListener(
        "click",
        function() {
            navigateTo("home");
        }
    );

    brand.addEventListener(
        "keydown",
        function(event) {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                navigateTo("home");
            }
        }
    );
}

function setupNavigation() {
    document
        .querySelectorAll(".nav-link")
        .forEach(function(link) {
            link.addEventListener(
                "click",
                function(event) {
                    event.preventDefault();

                    const page =
                        link.dataset.page;

                    if (page === "auth") {
                        navigateTo(
                            currentUser
                                ? "profile"
                                : "auth"
                        );

                        return;
                    }

                    if (
                        page === "admin" &&
                        !canAccessAdmin()
                    ) {
                        navigateTo(
                            currentUser
                                ? "profile"
                                : "auth"
                        );

                        return;
                    }

                    navigateTo(page);
                }
            );
        });
}

function canAccessAdmin() {
    if (!currentUser) return false;

    return Boolean(
        currentUser.isAdmin ||
        currentUser.chiefFor !== null &&
        currentUser.chiefFor !== undefined ||
        currentUser.helperFor !== null &&
        currentUser.helperFor !== undefined
    );
}

function canEditServer(index) {
    if (!currentUser) return false;

    if (currentUser.isMainAdmin === true) {
        return true;
    }

    if (
        currentUser.chiefFor !== null &&
        currentUser.chiefFor !== undefined &&
        Number(currentUser.chiefFor) === Number(index)
    ) {
        return true;
    }

    if (
        currentUser.helperFor !== null &&
        currentUser.helperFor !== undefined &&
        Number(currentUser.helperFor) === Number(index)
    ) {
        return true;
    }

    return false;
}

function navigateTo(page) {
    const target =
        document.getElementById(page + "-page");

    if (!target) return;

    document
        .querySelectorAll(".page")
        .forEach(function(item) {
            item.classList.remove("active");
        });

    document
        .querySelectorAll(".nav-link")
        .forEach(function(item) {
            item.classList.remove("active");
        });

    target.classList.add("active");

    const activeLink =
        document.querySelector(
            '.nav-link[data-page="' + page + '"]'
        );

    if (activeLink) {
        activeLink.classList.add("active");
    }

    if (page === "support") {
        renderQuestions();
    }

    if (page === "profile") {
        updateProfile();
    }

    if (page === "admin" && canAccessAdmin()) {
        renderServersList();
        loadAdminSettings();
        renderUsersList();
        renderAdminAllQuestions();
        renderAdminChangelog();
        renderAdminSocialLinks();
        renderSocialIconPicker();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function setupForms() {
    const forms = [
        ["login-form", handleLogin],
        ["register-form", handleRegister],
        ["forgot-form", handleForgotPassword],
        ["question-form", handleQuestionSubmit],
        ["promote-form", handlePromote],
        ["add-server-form", handleAddServer],
        ["assign-role-form", handleAssignRole],
        ["changelog-form", handleChangelogSubmit],
        ["social-form", handleSocialSubmit]
    ];

    forms.forEach(function(item) {
        const form =
            document.getElementById(item[0]);

        if (form) {
            form.addEventListener(
                "submit",
                item[1]
            );
        }
    });
}

    forms.forEach(function(item) {
        const form =
            document.getElementById(item[0]);

        if (form) {
            form.addEventListener(
                "submit",
                item[1]
            );
        }
    });

async function handleLogin(event) {
    event.preventDefault();

    const errorElement =
        document.getElementById("login-error");

    errorElement.textContent = "";

    if (!supabaseReady || !supabaseClient) {
        errorElement.textContent =
            "❌ Supabase ещё не загрузился";
        return;
    }

    const username =
        document
            .getElementById("login-username")
            .value
            .trim();

    const password =
        document
            .getElementById("login-password")
            .value;

    if (!username || !password) {
        errorElement.textContent =
            "❌ Заполните все поля";
        return;
    }

    try {
        const lookup =
            await supabaseClient.rpc(
                "get_email_by_username",
                {
                    p_username: username
                }
            );

        if (lookup.error) {
            console.error(
                "Ошибка поиска email:",
                lookup.error
            );

            errorElement.textContent =
                "❌ Ошибка базы данных: " +
                lookup.error.message;

            return;
        }

        if (!lookup.data) {
            errorElement.textContent =
                "❌ Пользователь не найден";
            return;
        }

        const result =
            await supabaseClient.auth
                .signInWithPassword({
                    email: lookup.data,
                    password: password
                });

        if (result.error) {
            console.error(
                "Ошибка входа:",
                result.error
            );

            if (
                /email not confirmed/i.test(
                    result.error.message || ""
                )
            ) {
                errorElement.textContent =
                    "❌ Подтвердите email";
            } else {
                errorElement.textContent =
                    "❌ Неверный логин или пароль";
            }

            return;
        }

        await loadProfile(result.data.user);

        if (currentUser) {
            await supabaseClient
                .from("profiles")
                .update({
                    last_login:
                        new Date().toISOString()
                })
                .eq("id", currentUser.id);
        }

        updateUI();
        updateProfile();
        renderUsersList();

        event.target.reset();
        navigateTo("profile");
    } catch (error) {
        console.error(
            "Критическая ошибка входа:",
            error
        );

        errorElement.textContent =
            "❌ Ошибка подключения к серверу";
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const errorElement =
        document.getElementById("register-error");

    const successElement =
        document.getElementById(
            "register-success"
        );

    errorElement.textContent = "";
    successElement.textContent = "";

    if (!supabaseReady || !supabaseClient) {
        errorElement.textContent =
            "❌ Supabase ещё не загрузился";
        return;
    }

    const username =
        document
            .getElementById("register-username")
            .value
            .trim();

    const email =
        document
            .getElementById("register-email")
            .value
            .trim()
            .toLowerCase();

    const password =
        document
            .getElementById("register-password")
            .value;

    const confirmation =
        document
            .getElementById("register-confirm")
            .value;

    if (username.length < 3) {
        errorElement.textContent =
            "❌ Ник должен содержать минимум 3 символа";
        return;
    }

    if (password !== confirmation) {
        errorElement.textContent =
            "❌ Пароли не совпадают";
        return;
    }

    if (password.length < 4) {
        errorElement.textContent =
            "❌ Минимум 4 символа";
        return;
    }

    try {
        const existing =
            await supabaseClient.rpc(
                "get_email_by_username",
                {
                    p_username: username
                }
            );

        if (existing.error) {
            errorElement.textContent =
                "❌ Не удалось проверить ник";
            return;
        }

        if (existing.data) {
            errorElement.textContent =
                "❌ Такой ник уже занят";
            return;
        }

        const result =
            await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

        if (result.error) {
            console.error(
                "Ошибка регистрации:",
                result.error
            );

            errorElement.textContent =
                "❌ " + result.error.message;

            return;
        }

        event.target.reset();

        if (result.data.session) {
            await loadProfile(result.data.user);

            successElement.textContent =
                "✅ Аккаунт создан";

            updateUI();
            updateProfile();

            setTimeout(function() {
                navigateTo("profile");
            }, 700);
        } else {
            successElement.textContent =
                "✅ Подтвердите email и войдите";
        }
    } catch (error) {
        console.error(
            "Критическая ошибка регистрации:",
            error
        );

        errorElement.textContent =
            "❌ Ошибка подключения к серверу";
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();

    const errorElement =
        document.getElementById("forgot-error");

    const successElement =
        document.getElementById(
            "forgot-success"
        );

    errorElement.textContent = "";
    successElement.textContent = "";

    if (!supabaseReady || !supabaseClient) {
        errorElement.textContent =
            "❌ Supabase ещё не загрузился";
        return;
    }

    const username =
        document
            .getElementById("forgot-username")
            .value
            .trim();

    const email =
        document
            .getElementById("forgot-email")
            .value
            .trim()
            .toLowerCase();

    if (!username || !email) {
        errorElement.textContent =
            "❌ Заполните все поля";
        return;
    }

    try {
        const lookup =
            await supabaseClient.rpc(
                "get_email_by_username",
                {
                    p_username: username
                }
            );

        if (
            lookup.error ||
            !lookup.data ||
            lookup.data.toLowerCase() !== email
        ) {
            errorElement.textContent =
                "❌ Ник и email не совпадают";
            return;
        }

        const redirectUrl =
            window.location.origin +
            window.location.pathname;

        const result =
            await supabaseClient.auth
                .resetPasswordForEmail(
                    email,
                    {
                        redirectTo: redirectUrl
                    }
                );

        if (result.error) {
            errorElement.textContent =
                "❌ " + result.error.message;
            return;
        }

        successElement.textContent =
            "✅ Ссылка отправлена на email";

        event.target.reset();
    } catch (error) {
        console.error(
            "Ошибка восстановления:",
            error
        );

        errorElement.textContent =
            "❌ Ошибка подключения к серверу";
    }
}

async function handlePromote(event) {
    event.preventDefault();

    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        return;
    }

    const username =
        document
            .getElementById("promote-username")
            .value
            .trim();

    const rank =
        document.getElementById("promote-rank")
            .value;

    const target =
        users.find(function(item) {
            return (
                String(item.username).toLowerCase() ===
                username.toLowerCase()
            );
        });

    if (!target) {
        alert("❌ Пользователь не найден");
        return;
    }

    const result =
        await supabaseClient
            .from("profiles")
            .update({
                rank: rank
            })
            .eq("id", target.id);

    if (result.error) {
        alert(
            "❌ Не удалось изменить роль: " +
            result.error.message
        );
        return;
    }

    closePromoteModal();
    await loadUsers();
    renderUsersList();
}

async function handleAssignRole(event) {
    event.preventDefault();

    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        return;
    }

    const username =
        document
            .getElementById("assign-username")
            .value
            .trim();

    const serverIndex =
        Number(
            document
                .getElementById("assign-server")
                .value
        );

    const role =
        document
            .getElementById("assign-role")
            .value;

    const target =
        users.find(function(item) {
            return (
                String(item.username).toLowerCase() ===
                username.toLowerCase()
            );
        });

    if (!target) {
        alert("❌ Пользователь не найден");
        return;
    }

    const patch = {
        chief_for: null,
        helper_for: null
    };

    if (role === "chief") {
        patch.chief_for = serverIndex;
    }

    if (role === "helper") {
        patch.helper_for = serverIndex;
    }

    const result =
        await supabaseClient
            .from("profiles")
            .update(patch)
            .eq("id", target.id);

    if (result.error) {
        alert(
            "❌ Не удалось назначить: " +
            result.error.message
        );
        return;
    }

    closeAssignModal();
    await loadUsers();
    renderUsersList();
}

async function handleAddServer(event) {
    event.preventDefault();

    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        return;
    }

    const name =
        document
            .getElementById("new-server-name")
            .value
            .trim();

    if (!name) return;

    const server =
        cloneDefaultServer();

    server.name = name;
    server.id = createServerId(name);
    server.description = "Сервер " + name;
    server.featuresTitle =
        "Почему " + name + "?";

    const result =
        await supabaseClient
            .from("servers")
            .insert(serverToDb(server))
            .select()
            .single();

    if (result.error) {
        alert(
            "❌ Не удалось создать сервер: " +
            result.error.message
        );
        return;
    }

    servers.push(normalizeServer(result.data));

    closeAddServerModal();
    renderServersList();
    renderServersPage();
    event.target.reset();
}

async function logout() {
    if (supabaseReady) {
        await supabaseClient.auth.signOut();
    }

    currentUser = null;
    users = [];

    updateUI();
    updateProfile();
    navigateTo("home");
}

function updateUI() {
    const authLink =
        document.getElementById("auth-link");

    const adminLink =
        document.getElementById(
            "admin-panel-link"
        );

    const deleteButton =
        document.getElementById(
            "delete-account-btn"
        );

    const adminPanel =
        document.getElementById("admin-panel");

    if (currentUser) {
        if (authLink) {
            authLink.style.display = "none";
        }

        if (adminLink) {
            adminLink.style.display =
                canAccessAdmin()
                    ? "flex"
                    : "none";
        }

        if (deleteButton) {
            deleteButton.style.display =
                currentUser.isAdmin
                    ? "none"
                    : "inline-flex";
        }

        if (adminPanel) {
            adminPanel.style.display =
                currentUser.isAdmin
                    ? "block"
                    : "none";
        }
    } else {
        if (authLink) {
            authLink.style.display = "flex";
            authLink.innerHTML =
                '<span class="nav-icon">🔑</span> Войти';
            authLink.dataset.page = "auth";
        }

        if (adminLink) {
            adminLink.style.display = "none";
        }

        if (deleteButton) {
            deleteButton.style.display = "inline-flex";
        }

        if (adminPanel) {
            adminPanel.style.display = "none";
        }
    }
}

function updateProfile() {
    const username =
        document.getElementById(
            "profile-username"
        );

    const rank =
        document.getElementById(
            "profile-rank"
        );

    const avatar =
        document.getElementById(
            "profile-avatar-letter"
        );

    const email =
        document.getElementById(
            "profile-email"
        );

    const regDate =
        document.getElementById(
            "profile-reg-date"
        );

    const lastLogin =
        document.getElementById(
            "profile-last-login"
        );

    if (!currentUser) {
        username.textContent = "Гость";
        rank.textContent = "Игрок";
        avatar.textContent = "G";
        email.textContent = "не указан";
        regDate.textContent = "-";
        lastLogin.textContent = "-";
        return;
    }

    username.textContent =
        currentUser.username;

    rank.textContent =
        currentUser.rank || "Игрок";

    avatar.textContent =
        (currentUser.username || "G")
            .charAt(0)
            .toUpperCase();

    email.textContent =
        currentUser.email || "не указан";

    regDate.textContent =
        currentUser.regDate || "-";

    lastLogin.textContent =
        currentUser.lastLogin || "-";
}

function loadServer(index) {
    if (!servers.length) {
        servers = [cloneDefaultServer()];
    }

    currentServerIndex =
        Math.max(
            0,
            Math.min(index, servers.length - 1)
        );

    localStorage.setItem(
        "cristalhills_current_server",
        String(currentServerIndex)
    );

    const server =
        normalizeServer(
            servers[currentServerIndex]
        );

    const name =
        document.getElementById(
            "current-server-name"
        );

    const heroName =
        document.getElementById(
            "hero-server-name"
        );

    const status =
        document.getElementById(
            "server-status"
        );

    const statusText =
        document.getElementById(
            "status-text"
        );

    const description =
        document.getElementById(
            "hero-description"
        );

    const featuresTitle =
        document.getElementById(
            "features-title"
        );

    if (name) {
        name.textContent = server.name;
    }

    if (heroName) {
        heroName.textContent = server.name;
    }

    if (description) {
        description.textContent =
            server.description;
    }

    if (featuresTitle) {
        featuresTitle.textContent =
            server.featuresTitle;
    }

    if (status) {
        status.className =
            "server-status " + server.status;
    }

    if (statusText) {
        const statusNames = {
            online: "Сервер онлайн",
            maintenance: "Обслуживание",
            offline: "Оффлайн"
        };

        statusText.textContent =
            statusNames[server.status] ||
            "Сервер онлайн";
    }

    renderFeatures(server.features);
    renderStats(server.stats);
    renderServerButtons(server);
    renderServersPage();
    renderServersList();
}

function renderFeatures(features) {
    for (let i = 0; i < 4; i++) {
        const item =
            features[i] || {
                icon: "⭐",
                title: "",
                desc: ""
            };

        const icon =
            document.getElementById(
                "feature-icon-" + (i + 1)
            );

        const title =
            document.getElementById(
                "feature-title-" + (i + 1)
            );

        const description =
            document.getElementById(
                "feature-desc-" + (i + 1)
            );

        if (icon) {
            icon.textContent =
                item.icon || "⭐";
        }

        if (title) {
            title.textContent =
                item.title || "";
        }

        if (description) {
            description.textContent =
                item.desc || "";
        }
    }
}

function renderStats(stats) {
    for (let i = 0; i < 4; i++) {
        const item =
            stats[i] || {
                icon: "⭐",
                value: "",
                label: ""
            };

        const icon =
            document.getElementById(
                "stat-icon-" + (i + 1)
            );

        const value =
            document.getElementById(
                "stat-value-" + (i + 1)
            );

        const label =
            document.getElementById(
                "stat-label-" + (i + 1)
            );

        if (icon) {
            icon.textContent =
                item.icon || "⭐";
        }

        if (value) {
            value.textContent =
                item.value || "";
        }

        if (label) {
            label.textContent =
                item.label || "";
        }
    }
}

function renderServerButtons(server) {
    const container =
        document.getElementById(
            "ip-buttons"
        );

    if (!container) return;

    container.innerHTML = "";

    (server.ips || []).forEach(function(item) {
        const button =
            document.createElement("button");

        button.className =
            "btn btn-primary btn-lg";

        const main =
            document.createElement("span");

        main.className = "btn-main";
        main.textContent =
            "📋 " + (item.ip || "");

        const sub =
            document.createElement("span");

        sub.className = "btn-sub";
        sub.textContent =
            item.name || "IP";

        button.appendChild(main);
        button.appendChild(sub);

        button.addEventListener(
            "click",
            function() {
                copyIP(item.ip || "");
            }
        );

        container.appendChild(button);
    });

    (server.builds || []).forEach(function(item) {
        const button =
            document.createElement("button");

        button.className =
            "btn btn-secondary btn-lg";

        const main =
            document.createElement("span");

        main.className = "btn-main";
        main.textContent =
            "📥 " + (item.name || "Сборка");

        const sub =
            document.createElement("span");

        sub.className = "btn-sub";
        sub.textContent = "Скачать";

        button.appendChild(main);
        button.appendChild(sub);

        button.addEventListener(
            "click",
            function() {
                downloadBuild(item.url);
            }
        );

        container.appendChild(button);
    });
}

function renderServersPage() {
    const grid =
        document.getElementById(
            "servers-page-grid"
        );

    if (!grid) return;

    grid.innerHTML = "";

    servers.forEach(function(server, index) {
        const card =
            document.createElement("article");

        card.className =
            "server-page-card" +
            (index === currentServerIndex
                ? " active"
                : "");

        const header =
            document.createElement("div");

        header.className =
            "server-page-header";

        const icon =
            document.createElement("span");

        icon.className =
            "server-page-icon";

        icon.textContent = "🌐";

        const name =
            document.createElement("div");

        name.className =
            "server-page-name";

        name.textContent =
            server.name;

        header.appendChild(icon);
        header.appendChild(name);

        const status =
            document.createElement("div");

        status.className =
            "server-page-status";

        status.textContent =
            getStatusIcon(server.status) +
            " " +
            getStatusName(server.status);

        const button =
            document.createElement("button");

        button.className =
            "btn btn-primary server-page-btn";

        button.textContent =
            "Выбрать";

        button.addEventListener(
            "click",
            function(event) {
                event.stopPropagation();
                loadServer(index);
                navigateTo("home");
            }
        );

        card.appendChild(header);
        card.appendChild(status);
        card.appendChild(button);

        card.addEventListener(
            "click",
            function() {
                loadServer(index);
                navigateTo("home");
            }
        );

        grid.appendChild(card);
    });
}

function renderServersList() {
    const container =
        document.getElementById(
            "servers-list"
        );

    if (!container) return;

    container.innerHTML = "";

    servers.forEach(function(server, index) {
        if (!canEditServer(index)) return;

        const card =
            document.createElement("article");

        card.className =
            "server-card" +
            (index === currentServerIndex
                ? " active"
                : "");

        card.innerHTML =
            '<div class="server-info">' +
            '<span class="server-icon">🌐</span>' +
            "<div>" +
            '<div class="server-name">' +
            escapeHtml(server.name) +
            "</div>" +
            '<div class="server-status-text">' +
            getStatusIcon(server.status) +
            " " +
            getStatusName(server.status) +
            "</div>" +
            "</div>" +
            "</div>" +
            '<div class="server-actions">' +
            '<button class="btn btn-primary btn-sm" ' +
            'onclick="switchToServer(' +
            index +
            ')">Выбрать</button>' +
            (
                currentUser &&
                currentUser.isMainAdmin &&
                index !== 0
                    ? '<button class="btn btn-danger btn-sm" onclick="deleteServer(' +
                      index +
                      ')">🗑️</button>'
                    : ""
            ) +
            "</div>";

        container.appendChild(card);
    });
}

function loadAdminSettings() {
    const server =
        servers[currentServerIndex];

    if (!server) return;

    document.getElementById(
        "admin-status"
    ).value = server.status;

    document.getElementById(
        "admin-description"
    ).value = server.description;

    document.getElementById(
        "admin-version"
    ).value = server.version;

    document.getElementById(
        "admin-features-title"
    ).value = server.featuresTitle;

    renderAdminIps();
    renderAdminBuilds();
    renderAdminFeatures();
    renderAdminStats();
}

function renderAdminIps() {
    const container =
        document.getElementById(
            "admin-ips-list"
        );

    if (!container) return;

    container.innerHTML = "";

    const server =
        servers[currentServerIndex];

    (server.ips || []).forEach(function(item, index) {
        const row =
            document.createElement("div");

        row.innerHTML =
            '<input class="form-input" data-ip-name="' +
            index +
            '" value="' +
            escapeHtml(item.name || "") +
            '" placeholder="Название">' +

            '<input class="form-input" data-ip-value="' +
            index +
            '" value="' +
            escapeHtml(item.ip || "") +
            '" placeholder="IP">' +

            '<button class="btn btn-danger btn-sm" type="button" onclick="removeIp(' +
            index +
            ')">🗑️</button>';

        container.appendChild(row);
    });
}

function renderAdminBuilds() {
    const container =
        document.getElementById(
            "admin-builds-list"
        );

    if (!container) return;

    container.innerHTML = "";

    const server =
        servers[currentServerIndex];

    (server.builds || []).forEach(function(item, index) {
        const row =
            document.createElement("div");

        row.innerHTML =
            '<input class="form-input" data-build-name="' +
            index +
            '" value="' +
            escapeHtml(item.name || "") +
            '" placeholder="Название">' +

            '<input class="form-input" data-build-url="' +
            index +
            '" value="' +
            escapeHtml(item.url || "") +
            '" placeholder="Ссылка">' +

            '<button class="btn btn-danger btn-sm" type="button" onclick="removeBuild(' +
            index +
            ')">🗑️</button>';

        container.appendChild(row);
    });
}

function renderAdminFeatures() {
    const container =
        document.getElementById(
            "admin-features-custom"
        );

    if (!container) return;

    container.innerHTML = "";

    const server =
        servers[currentServerIndex];

    for (let i = 0; i < 4; i++) {
        const item =
            server.features[i] || {
                icon: "⭐",
                title: "",
                desc: ""
            };

        const row =
            document.createElement("div");

        row.innerHTML =
            "<span>" +
            (i + 1) +
            ".</span>" +

            '<input class="form-input" id="f-icon-' +
            i +
            '" value="' +
            escapeHtml(item.icon) +
            '" placeholder="Иконка">' +

            '<input class="form-input" id="f-title-' +
            i +
            '" value="' +
            escapeHtml(item.title) +
            '" placeholder="Название">' +

            '<input class="form-input" id="f-desc-' +
            i +
            '" value="' +
            escapeHtml(item.desc) +
            '" placeholder="Описание">';

        container.appendChild(row);
    }
}

function renderAdminStats() {
    const container =
        document.getElementById(
            "admin-stats-custom"
        );

    if (!container) return;

    container.innerHTML = "";

    const server =
        servers[currentServerIndex];

    for (let i = 0; i < 4; i++) {
        const item =
            server.stats[i] || {
                icon: "⭐",
                value: "",
                label: ""
            };

        const row =
            document.createElement("div");

        row.innerHTML =
            "<span>" +
            (i + 1) +
            ".</span>" +

            '<input class="form-input" id="s-icon-' +
            i +
            '" value="' +
            escapeHtml(item.icon) +
            '" placeholder="Иконка">' +

            '<input class="form-input" id="s-value-' +
            i +
            '" value="' +
            escapeHtml(item.value) +
            '" placeholder="Значение">' +

            '<input class="form-input" id="s-label-' +
            i +
            '" value="' +
            escapeHtml(item.label) +
            '" placeholder="Подпись">';

        container.appendChild(row);
    }
}

async function saveAdminSettings() {
    if (
        !currentUser ||
        !canEditServer(currentServerIndex) ||
        !supabaseReady
    ) {
        alert("❌ Недостаточно прав");
        return;
    }

    const server =
        servers[currentServerIndex];

    server.status =
        document.getElementById(
            "admin-status"
        ).value;

    server.description =
        document.getElementById(
            "admin-description"
        ).value.trim();

    server.version =
        document.getElementById(
            "admin-version"
        ).value.trim();

    server.featuresTitle =
        document.getElementById(
            "admin-features-title"
        ).value.trim();

    const ipRows =
        document.querySelectorAll(
            "#admin-ips-list > div"
        );

    server.ips =
        Array.from(ipRows).map(function(row) {
            return {
                name: row.querySelector(
                    "[data-ip-name]"
                ).value.trim(),

                ip: row.querySelector(
                    "[data-ip-value]"
                ).value.trim()
            };
        });

    const buildRows =
        document.querySelectorAll(
            "#admin-builds-list > div"
        );

    server.builds =
        Array.from(buildRows).map(function(row) {
            return {
                name: row.querySelector(
                    "[data-build-name]"
                ).value.trim(),

                url: row.querySelector(
                    "[data-build-url]"
                ).value.trim()
            };
        });

    server.features = [];

    for (let i = 0; i < 4; i++) {
        server.features.push({
            icon: document.getElementById(
                "f-icon-" + i
            ).value.trim(),

            title: document.getElementById(
                "f-title-" + i
            ).value.trim(),

            desc: document.getElementById(
                "f-desc-" + i
            ).value.trim()
        });
    }

    server.stats = [];

    for (let i = 0; i < 4; i++) {
        server.stats.push({
            icon: document.getElementById(
                "s-icon-" + i
            ).value.trim(),

            value: document.getElementById(
                "s-value-" + i
            ).value.trim(),

            label: document.getElementById(
                "s-label-" + i
            ).value.trim()
        });
    }

    const result =
        await supabaseClient
            .from("servers")
            .update(serverToDb(server))
            .eq("id", server.id)
            .select()
            .single();

    if (result.error) {
        alert(
            "❌ Не удалось сохранить: " +
            result.error.message
        );
        return;
    }

    servers[currentServerIndex] =
        normalizeServer(result.data);

    loadServer(currentServerIndex);
    renderServersList();

    const message =
        document.getElementById(
            "admin-save-msg"
        );

    if (message) {
        message.textContent =
            "✅ Сохранено для всех пользователей";

        setTimeout(function() {
            message.textContent = "";
        }, 3000);
    }
}

function renderUsersList() {
    const container =
        document.getElementById(
            "users-list"
        );

    if (!container) return;

    container.innerHTML = "";

    if (
        !currentUser ||
        !currentUser.isAdmin
    ) {
        return;
    }

    users.forEach(function(user) {
        const card =
            document.createElement("div");

        card.className =
            "user-card" +
            (
                user.rank === "Гл.Админ" ||
                user.rank === "Мл.Админ"
                    ? " admin"
                    : ""
            );

        card.innerHTML =
            '<div class="user-row">' +
            '<span class="user-label">👤</span>' +
            '<span class="user-value">' +
            escapeHtml(user.username) +
            "</span>" +
            "</div>" +

            '<div class="user-row">' +
            '<span class="user-label">📧</span>' +
            '<span class="user-value">' +
            escapeHtml(user.email || "-") +
            "</span>" +
            "</div>" +

            '<div class="user-row">' +
            '<span class="user-label">🏷️</span>' +
            '<span class="user-value">' +
            escapeHtml(user.rank || "Игрок") +
            "</span>" +
            "</div>";

        if (
            currentUser.isMainAdmin &&
            currentUser.id !== user.id
        ) {
            const actions =
                document.createElement("div");

            actions.className =
                "user-actions";

            actions.innerHTML =
                '<button class="btn btn-primary btn-sm" onclick="openAssignModal(\'' +
                escapeJs(user.username) +
                "')\">🎯</button>" +

                '<button class="btn btn-secondary btn-sm" onclick="openPromoteModal(\'' +
                escapeJs(user.username) +
                "')\">👑</button>";

            card.appendChild(actions);
        }

        container.appendChild(card);
    });
}

function filterUsers() {
    const input =
        document.getElementById(
            "user-search"
        );

    const value =
        input
            ? input.value.trim().toLowerCase()
            : "";

    document
        .querySelectorAll(
            "#users-list .user-card"
        )
        .forEach(function(card) {
            card.style.display =
                !value ||
                card.textContent
                    .toLowerCase()
                    .includes(value)
                    ? ""
                    : "none";
        });
}

function renderQuestions() {
    const list =
        document.getElementById(
            "questions-list"
        );

    const adminList =
        document.getElementById(
            "admin-questions-list"
        );

    if (!list || !adminList) return;

    const mine =
        currentUser
            ? questions.filter(function(item) {
                return (
                    item.userId === currentUser.id ||
                    item.author === currentUser.username
                );
            })
            : [];

    list.innerHTML =
        mine.length
            ? ""
            : '<div class="question-item placeholder">📭</div>';

    adminList.innerHTML =
        questions.length
            ? ""
            : '<div class="question-item placeholder">📥</div>';

    mine
        .filter(function(item) {
            return !item.closed;
        })
        .forEach(function(item) {
            list.appendChild(
                createQuestionCard(item)
            );
        });

    if (currentUser && currentUser.isAdmin) {
        questions
            .filter(function(item) {
                return !item.closed;
            })
            .forEach(function(item) {
                adminList.appendChild(
                    createQuestionCard(item)
                );
            });
    }
}

function renderAdminAllQuestions() {
    const container =
        document.getElementById(
            "admin-all-questions"
        );

    if (!container) return;

    container.innerHTML = "";

    questions.forEach(function(item) {
        container.appendChild(
            createQuestionCard(item)
        );
    });
}

function createQuestionCard(item) {
    const card =
        document.createElement("div");

    card.className =
        "question-item";

    if (item.isUrgent) {
        card.classList.add("urgent");
    }

    if (item.closed) {
        card.classList.add("closed");
    }

    const answered =
        Boolean(item.answer) ||
        (
            item.answers &&
            item.answers.length > 0
        );

    const statusClass =
        item.closed
            ? "status-closed"
            : answered
                ? "status-answered"
                : "status-open";

    const statusText =
        item.closed
            ? "✅"
            : answered
                ? "💬"
                : "⏳";

    card.innerHTML =
        '<div class="question-row">' +
        '<div class="question-title">' +
        escapeHtml(item.title) +
        "</div>" +
        '<span class="status ' +
        statusClass +
        '">' +
        statusText +
        "</span>" +
        "</div>" +

        '<div class="question-details">' +
        escapeHtml(item.author) +
        " • " +
        escapeHtml(item.date) +
        "</div>";

    card.addEventListener(
        "click",
        function() {
            openQuestionView(item.id);
        }
    );

    return card;
}

function renderChangelog() {
    const container =
        document.getElementById(
            "changelog-list"
        );

    if (!container) return;

    container.innerHTML = "";

    if (!changelog.length) {
        container.innerHTML =
            '<div class="changelog-empty">' +
            "Пока нет опубликованных изменений." +
            "</div>";

        return;
    }

    changelog.forEach(function(item) {
        const article =
            document.createElement("article");

        article.className =
            "changelog-item";

        article.innerHTML =
            '<div class="changelog-item-title">' +
            escapeHtml(item.title) +
            "</div>" +

            '<div class="changelog-item-description">' +
            escapeHtml(item.description) +
            "</div>" +

            '<div class="changelog-item-date">' +
            formatDate(item.created_at) +
            "</div>";

        container.appendChild(article);
    });
}

function renderAdminChangelog() {
    const container =
        document.getElementById(
            "admin-changelog-list"
        );

    if (!container) return;

    container.innerHTML = "";

    if (!changelog.length) {
        container.innerHTML =
            '<div class="changelog-empty">' +
            "Изменений пока нет." +
            "</div>";

        return;
    }

    changelog.forEach(function(item) {
        const row =
            document.createElement("div");

        row.className =
            "admin-changelog-item";

        row.innerHTML =
            '<div class="admin-changelog-content">' +
            '<div class="admin-changelog-title">' +
            escapeHtml(item.title) +
            "</div>" +

            '<div class="admin-changelog-description">' +
            escapeHtml(item.description) +
            "</div>" +

            '<div class="admin-changelog-date">' +
            formatDate(item.created_at) +
            "</div>" +
            "</div>" +

            '<div class="admin-changelog-actions">' +
            '<button class="btn btn-secondary btn-sm" onclick="editChangelog(' +
            item.id +
            ')">Изменить</button>' +

            '<button class="btn btn-danger btn-sm" onclick="deleteChangelog(' +
            item.id +
            ')">Удалить</button>' +
            "</div>";

        container.appendChild(row);
    });
}

async function handleChangelogSubmit(event) {
    event.preventDefault();

    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        alert(
            "❌ Только главный администратор может изменять список изменений"
        );
        return;
    }

    const title =
        document.getElementById(
            "changelog-title"
        ).value.trim();

    const description =
        document.getElementById(
            "changelog-description"
        ).value.trim();

    const editId =
        document.getElementById(
            "changelog-edit-id"
        ).value;

    let result;

    if (editId) {
        result = await supabaseClient
            .from("changelog")
            .update({
                title: title,
                description: description,
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", Number(editId));
    } else {
        result = await supabaseClient
            .from("changelog")
            .insert({
                title: title,
                description: description
            });
    }

    if (result.error) {
        alert(
            "❌ Не удалось сохранить изменение: " +
            result.error.message
        );
        return;
    }

    resetChangelogForm();
    await loadChangelog();

    const message =
        document.getElementById(
            "changelog-save-message"
        );

    if (message) {
        message.textContent =
            "✅ Список изменений обновлён";

        setTimeout(function() {
            message.textContent = "";
        }, 3000);
    }
}

function editChangelog(id) {
    const item =
        changelog.find(function(change) {
            return Number(change.id) === Number(id);
        });

    if (!item) return;

    document.getElementById(
        "changelog-edit-id"
    ).value = item.id;

    document.getElementById(
        "changelog-title"
    ).value = item.title || "";

    document.getElementById(
        "changelog-description"
    ).value = item.description || "";

    document
        .getElementById("changelog-form")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}

async function deleteChangelog(id) {
    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        alert(
            "❌ Только главный администратор может удалять изменения"
        );
        return;
    }

    if (!confirm("Удалить это изменение?")) {
        return;
    }

    const result =
        await supabaseClient
            .from("changelog")
            .delete()
            .eq("id", Number(id));

    if (result.error) {
        alert(
            "❌ Не удалось удалить изменение: " +
            result.error.message
        );
        return;
    }

    await loadChangelog();
}

function resetChangelogForm() {
    const form =
        document.getElementById(
            "changelog-form"
        );

    if (form) {
        form.reset();
    }

    document.getElementById(
        "changelog-edit-id"
    ).value = "";
}

function renderSocialLinks() {
    const container =
        document.getElementById(
            "social-links-list"
        );

    if (!container) return;

    container.innerHTML = "";

    if (!socialLinks.length) {
        container.innerHTML =
            '<div class="social-empty">' +
            "Социальные сети пока не добавлены." +
            "</div>";

        return;
    }

    socialLinks.forEach(function(item) {
        const link =
            document.createElement("a");

        link.className =
            "social-link-card";

        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        link.style.setProperty(
            "--social-color",
            item.color || "#6366f1"
        );

        link.innerHTML =
            '<span class="social-link-icon">' +
            escapeHtml(item.icon || "🔗") +
            "</span>" +

            '<span class="social-link-content">' +
            '<span class="social-link-title">' +
            escapeHtml(item.title || "Соцсеть") +
            "</span>" +

            '<span class="social-link-url">' +
            escapeHtml(item.url || "") +
            "</span>" +
            "</span>";

        container.appendChild(link);
    });
}

function renderAdminSocialLinks() {
    const container =
        document.getElementById(
            "admin-social-list"
        );

    if (!container) return;

    container.innerHTML = "";

    if (!socialLinks.length) {
        container.innerHTML =
            '<div class="social-empty">' +
            "Социальные сети пока не добавлены." +
            "</div>";

        return;
    }

    socialLinks.forEach(function(item) {
        const row =
            document.createElement("div");

        row.className =
            "admin-social-item";

        row.style.setProperty(
            "--social-color",
            item.color || "#6366f1"
        );

        row.innerHTML =
            '<div class="admin-social-info">' +
            '<span class="admin-social-icon">' +
            escapeHtml(item.icon || "🔗") +
            "</span>" +

            '<div class="admin-social-text">' +
            '<div class="admin-social-title">' +
            escapeHtml(item.title || "Соцсеть") +
            "</div>" +

            '<div class="admin-social-url">' +
            escapeHtml(item.url || "") +
            "</div>" +
            "</div>" +
            "</div>" +

            '<div class="admin-social-actions">' +
            '<button class="btn btn-secondary btn-sm" onclick="editSocialLink(' +
            item.id +
            ')">Изменить</button>' +

            '<button class="btn btn-danger btn-sm" onclick="deleteSocialLink(' +
            item.id +
            ')">Удалить</button>' +
            "</div>";

        container.appendChild(row);
    });
}

function renderSocialIconPicker() {
    const container =
        document.getElementById(
            "social-icon-picker"
        );

    if (!container) return;

    container.innerHTML = "";

    const selected =
        document.getElementById(
            "social-icon"
        ).value || "🔗";

    SOCIAL_ICONS.forEach(function(icon) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "social-icon-option";

        button.textContent = icon;
        button.title = "Выбрать " + icon;

        if (icon === selected) {
            button.classList.add("selected");
        }

        button.addEventListener(
            "click",
            function() {
                selectSocialIcon(icon);
            }
        );

        container.appendChild(button);
    });

    updateSelectedSocialIcon();
}

function selectSocialIcon(icon) {
    const input =
        document.getElementById(
            "social-icon"
        );

    if (input) {
        input.value = icon;
    }

    document
        .querySelectorAll(
            ".social-icon-option"
        )
        .forEach(function(button) {
            button.classList.toggle(
                "selected",
                button.textContent === icon
            );
        });

    updateSelectedSocialIcon();
}

function updateSelectedSocialIcon() {
    const input =
        document.getElementById(
            "social-icon"
        );

    const label =
        document.getElementById(
            "selected-social-icon"
        );

    if (input && label) {
        label.textContent =
            "Выбрано: " + (input.value || "🔗");
    }
}

async function handleSocialSubmit(event) {
    event.preventDefault();

    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        alert(
            "❌ Только главный администратор может изменять соцсети"
        );
        return;
    }

    const title =
        document.getElementById(
            "social-title"
        ).value.trim();

    const url =
        document.getElementById(
            "social-url"
        ).value.trim();

    const icon =
        document.getElementById(
            "social-icon"
        ).value || "🔗";

    const color =
        document.getElementById(
            "social-color"
        ).value || "#6366f1";

    const editId =
        document.getElementById(
            "social-edit-id"
        ).value;

    if (!title || !url) {
        alert(
            "Заполните название и ссылку"
        );
        return;
    }

    let result;

    if (editId) {
        result = await supabaseClient
            .from("social_links")
            .update({
                title: title,
                url: url,
                icon: icon,
                color: color,
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", Number(editId));
    } else {
        result = await supabaseClient
            .from("social_links")
            .insert({
                title: title,
                url: url,
                icon: icon,
                color: color,
                sort_order: socialLinks.length
            });
    }

    if (result.error) {
        alert(
            "❌ Не удалось сохранить соцсеть: " +
            result.error.message
        );
        return;
    }

    resetSocialForm();
    await loadSocialLinks();

    const message =
        document.getElementById(
            "social-save-message"
        );

    if (message) {
        message.textContent =
            "✅ Соцсеть сохранена";

        setTimeout(function() {
            message.textContent = "";
        }, 3000);
    }
}

function editSocialLink(id) {
    const item =
        socialLinks.find(function(link) {
            return Number(link.id) === Number(id);
        });

    if (!item) return;

    document.getElementById(
        "social-edit-id"
    ).value = item.id;

    document.getElementById(
        "social-title"
    ).value = item.title || "";

    document.getElementById(
        "social-url"
    ).value = item.url || "";

    document.getElementById(
        "social-color"
    ).value = item.color || "#6366f1";

    selectSocialIcon(item.icon || "🔗");

    document
        .getElementById("social-form")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}

async function deleteSocialLink(id) {
    if (
        !currentUser ||
        currentUser.isMainAdmin !== true ||
        !supabaseReady
    ) {
        alert(
            "❌ Только главный администратор может удалять соцсети"
        );
        return;
    }

    if (!confirm("Удалить эту соцсеть?")) {
        return;
    }

    const result =
        await supabaseClient
            .from("social_links")
            .delete()
            .eq("id", Number(id));

    if (result.error) {
        alert(
            "❌ Не удалось удалить соцсеть: " +
            result.error.message
        );
        return;
    }

    await loadSocialLinks();
}

function resetSocialForm() {
    const form =
        document.getElementById(
            "social-form"
        );

    if (form) {
        form.reset();
    }

    document.getElementById(
        "social-edit-id"
    ).value = "";

    document.getElementById(
        "social-icon"
    ).value = "🔗";

    document.getElementById(
        "social-color"
    ).value = "#6366f1";

    selectSocialIcon("🔗");
}

function switchAdminTab(tabName) {
    document
        .querySelectorAll(".admin-tab-content")
        .forEach(function(item) {
            item.classList.remove("active");
        });

    document
        .querySelectorAll(".admin-tab-btn")
        .forEach(function(item) {
            item.classList.remove("active");
        });

    const tab =
        document.getElementById(
            "admin-tab-" + tabName
        );

    if (tab) {
        tab.classList.add("active");
    }

    document
        .querySelectorAll(".admin-tab-btn")
        .forEach(function(button) {
            if (
                button.getAttribute("onclick") ===
                "switchAdminTab('" +
                tabName +
                "')"
            ) {
                button.classList.add("active");
            }
        });

    if (tabName === "servers") {
        renderServersList();
    }

    if (tabName === "settings") {
        loadAdminSettings();
    }

    if (tabName === "users") {
        renderUsersList();
    }

    if (tabName === "questions") {
        renderAdminAllQuestions();
    }

    if (tabName === "changelog") {
        renderAdminChangelog();
    }

    if (tabName === "socials") {
        renderAdminSocialLinks();
        renderSocialIconPicker();
    }
}

function showNewQuestionModal() {
    if (!currentUser) {
        alert("⚠️ Войдите");
        navigateTo("auth");
        return;
    }

    document
        .getElementById("new-question-modal")
        .classList.add("show");
}

function closeModal() {
    document
        .getElementById("new-question-modal")
        .classList.remove("show");
}

function openQuestionView(id) {
    const item =
        questions.find(function(question) {
            return String(question.id) ===
                String(id);
        });

    if (!item) return;

    currentQuestionId = item.id;

    document.getElementById(
        "view-question-title"
    ).textContent = item.title;

    document.getElementById(
        "view-question-author"
    ).textContent = item.author;

    document.getElementById(
        "view-question-date"
    ).textContent = item.date;

    document.getElementById(
        "view-question-category"
    ).textContent =
        getCategoryName(item.category);

    document.getElementById(
        "view-question-text"
    ).textContent = item.text;

    document
        .getElementById(
            "view-question-status-badge"
        )
        .classList.toggle(
            "show",
            item.isUrgent
        );

    const answers =
        document.getElementById(
            "view-question-answers"
        );

    answers.innerHTML = "";

    if (
        item.answers &&
        item.answers.length
    ) {
        item.answers.forEach(function(answer) {
            const node =
                document.createElement("div");

            node.className = "answer-item";

            node.innerHTML =
                '<div class="answer-meta">' +
                escapeHtml(answer.by || "") +
                "</div>" +
                "<div>" +
                escapeHtml(answer.text || "") +
                "</div>";

            answers.appendChild(node);
        });
    } else if (item.answer) {
        const node =
            document.createElement("div");

        node.className = "answer-item";

        node.innerHTML =
            '<div class="answer-meta">' +
            escapeHtml(
                item.answerBy || "Админ"
            ) +
            "</div>" +
            "<div>" +
            escapeHtml(item.answer) +
            "</div>";

        answers.appendChild(node);
    } else {
        answers.innerHTML =
            '<p class="no-answer">⏳ Ответов пока нет</p>';
    }

    const adminForm =
        document.getElementById(
            "admin-answer-form"
        );

    const playerSection =
        document.getElementById(
            "player-complete-section"
        );

    if (currentUser && currentUser.isAdmin) {
        adminForm.style.display = "block";
        playerSection.style.display = "none";
    } else if (
        currentUser &&
        item.userId === currentUser.id &&
        !item.closed
    ) {
        adminForm.style.display = "none";
        playerSection.style.display = "block";
    } else {
        adminForm.style.display = "none";
        playerSection.style.display = "none";
    }

    document
        .getElementById("view-question-modal")
        .classList.add("show");
}

function closeViewModal() {
    document
        .getElementById("view-question-modal")
        .classList.remove("show");

    renderQuestions();
}

function changePassword() {
    alert(
        "Функция смены пароля использует Supabase Auth."
    );
}

function deleteAccount() {
    alert(
        "Удаление пользователя Auth необходимо выполнять через Edge Function."
    );
}

function downloadBuild(url) {
    if (url) {
        window.open(
            url,
            "_blank",
            "noopener"
        );
    }
}

function getCategoryName(category) {
    const map = {
        technical: "🔧",
        gameplay: "🎮",
        donation: "💎",
        other: "❓",
        password: "🔑"
    };

    return map[category] || category;
}

function getStatusIcon(status) {
    if (status === "maintenance") return "🟠";
    if (status === "offline") return "🔴";
    return "🟢";
}

function getStatusName(status) {
    if (status === "maintenance") {
        return "Обслуживание";
    }

    if (status === "offline") {
        return "Оффлайн";
    }

    return "Онлайн";
}

function copyIP(ip) {
    if (!ip) return;

    const done = function() {
        const message =
            document.getElementById(
                "ip-copy-msg"
            );

        if (!message) return;

        message.textContent =
            "✅ IP скопирован: " + ip;

        setTimeout(function() {
            message.textContent = "";
        }, 4000);
    };

    if (
        navigator.clipboard &&
        window.isSecureContext
    ) {
        navigator.clipboard
            .writeText(ip)
            .then(done)
            .catch(function() {
                fallbackCopy(ip, done);
            });
    } else {
        fallbackCopy(ip, done);
    }
}

function fallbackCopy(text, callback) {
    const textarea =
        document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        document.execCommand("copy");
    } catch (error) {
        console.warn(error);
    }

    document.body.removeChild(textarea);
    callback();
}

function createServerId(name) {
    return String(name || "server")
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}

function openAssignModal(username) {
    document.getElementById(
        "assign-username"
    ).value = username;

    const select =
        document.getElementById(
            "assign-server"
        );

    select.innerHTML = "";

    servers.forEach(function(server, index) {
        const option =
            document.createElement("option");

        option.value = index;
        option.textContent = server.name;

        select.appendChild(option);
    });

    document
        .getElementById("assign-role-modal")
        .classList.add("show");
}

function closeAssignModal() {
    document
        .getElementById("assign-role-modal")
        .classList.remove("show");
}

function openPromoteModal(username) {
    document.getElementById(
        "promote-username"
    ).value = username;

    document
        .getElementById("promote-modal")
        .classList.add("show");
}

function closePromoteModal() {
    document
        .getElementById("promote-modal")
        .classList.remove("show");
}

function showAddServerModal() {
    document
        .getElementById("add-server-modal")
        .classList.add("show");
}

function closeAddServerModal() {
    document
        .getElementById("add-server-modal")
        .classList.remove("show");
}

function addNewIpField() {
    const server =
        servers[currentServerIndex];

    if (!server) return;

    server.ips.push({
        name: "Новый IP",
        ip: "play.example.com"
    });

    renderAdminIps();
}

function addNewBuildField() {
    const server =
        servers[currentServerIndex];

    if (!server) return;

    server.builds.push({
        name: "Новая сборка",
        url: "https://example.com"
    });

    renderAdminBuilds();
}

function removeIp(index) {
    const server =
        servers[currentServerIndex];

    if (!server) return;

    if (server.ips.length <= 1) {
        alert(
            "⚠️ Должен остаться хотя бы один IP"
        );
        return;
    }

    server.ips.splice(index, 1);
    renderAdminIps();
}

function removeBuild(index) {
    const server =
        servers[currentServerIndex];

    if (!server) return;

    server.builds.splice(index, 1);
    renderAdminBuilds();
}

function getCategoryName(category) {
    const map = {
        technical: "🔧",
        gameplay: "🎮",
        donation: "💎",
        other: "❓",
        password: "🔑"
    };

    return map[category] || category;
}

function escapeJs(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
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
    downloadBuild,
    editChangelog,
    deleteChangelog,
    resetChangelogForm,
    selectSocialIcon,
    editSocialLink,
    deleteSocialLink,
    resetSocialForm
});
