const ADMINS = [
    {
        username: "nullkotek",
        password: "garte454",
        rank: "Гл.Админ",
        isAdmin: true,
        isMainAdmin: true
    },
    {
        username: "kisyna123",
        password: "ks%43",
        rank: "Мл.Админ",
        isAdmin: true,
        isMainAdmin: false
    },
    {
        username: "hazbi0002",
        password: "hz2@a",
        rank: "Мл.Админ",
        isAdmin: true,
        isMainAdmin: false
    }
];

const DEFAULT_SERVERS = [
    {
        id: "cristalhills",
        name: "Cristalhills",
        status: "online",
        description:
            "Cristalhills — проект со своим сюжетом и квестами, где есть много игроков, с которыми вы можете подружиться и играть вместе.",
        version: "1.20.4",
        ips: [
            {
                name: "Основной",
                ip: "play.cristalhills.net"
            }
        ],
        builds: [],
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
    },
    {
];

let currentUser = null;
let users = [];
let servers = [];
let currentServerIndex = 0;

document.addEventListener("DOMContentLoaded", function() {
    if (isUnsupportedDevice()) {
        blockUnsupportedDevice();
        return;
    }

    initializeSite();
});

function isUnsupportedDevice() {
    const userAgent =
        navigator.userAgent ||
        navigator.vendor ||
        window.opera ||
        "";

    const mobileByUserAgent =
        /android/i.test(userAgent) ||
        /webos/i.test(userAgent) ||
        /iphone/i.test(userAgent) ||
        /ipad/i.test(userAgent) ||
        /ipod/i.test(userAgent) ||
        /blackberry/i.test(userAgent) ||
        /iemobile/i.test(userAgent) ||
        /opera mini/i.test(userAgent) ||
        /windows phone/i.test(userAgent);

    const mobileByScreen =
        window.matchMedia("(max-width: 700px)").matches;

    const tabletByScreen =
        window.matchMedia("(min-width: 701px) and (max-width: 1100px)")
            .matches;

    return mobileByUserAgent || mobileByScreen || tabletByScreen;
}

function blockUnsupportedDevice() {
    const unsupported = document.getElementById("unsupported-device");
    const content = document.getElementById("site-content");

    if (unsupported) {
        unsupported.style.display = "flex";
    }

    if (content) {
        content.style.display = "none";
    }

    document.documentElement.classList.add(
        "unsupported-device-page"
    );
}

function initializeSite() {
    loadUsers();
    loadCurrentUser();
    loadServers();
    setupNavigation();
    setupForms();
    setupBrandButton();
    updateUI();
    updateProfile();
    loadServer(currentServerIndex);
    renderServersPage();
    renderServersList();
}

function loadUsers() {
    const savedUsers =
        localStorage.getItem("cristalhills_users");

    if (!savedUsers) {
        users = [];
        return;
    }

    try {
        const parsed = JSON.parse(savedUsers);
        users = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        users = [];
        localStorage.removeItem("cristalhills_users");
    }
}

function loadCurrentUser() {
    const saved =
        localStorage.getItem("cristalhills_current");

    if (!saved) {
        currentUser = null;
        return;
    }

    try {
        currentUser = JSON.parse(saved);
    } catch (error) {
        currentUser = null;
        localStorage.removeItem("cristalhills_current");
    }
}

function loadServers() {
    const savedServers =
        localStorage.getItem("cristalhills_servers");

    if (!savedServers) {
        servers = cloneServers(DEFAULT_SERVERS);
    } else {
        try {
            const parsed = JSON.parse(savedServers);

            servers = Array.isArray(parsed)
                ? parsed.map(normalizeServer)
                : cloneServers(DEFAULT_SERVERS);
        } catch (error) {
            servers = cloneServers(DEFAULT_SERVERS);
        }
    }

    const savedIndex = parseInt(
        localStorage.getItem("cristalhills_current_server"),
        10
    );

    if (
        Number.isInteger(savedIndex) &&
        savedIndex >= 0 &&
        savedIndex < servers.length
    ) {
        currentServerIndex = savedIndex;
    } else {
        currentServerIndex = 0;
    }
}

function cloneServers(list) {
    return JSON.parse(JSON.stringify(list));
}

function normalizeServer(server) {
    const fallback = DEFAULT_SERVERS[0];

    return {
        ...fallback,
        ...server,
        id: server.id || createServerId(server.name),
        name: server.name || fallback.name,
        status: server.status || "online",
        description: server.description || "",
        version: server.version || "1.20.4",
        ips: Array.isArray(server.ips) ? server.ips : [],
        builds: Array.isArray(server.builds) ? server.builds : [],
        featuresTitle:
            server.featuresTitle ||
            "Почему " + (server.name || fallback.name) + "?",
        features:
            Array.isArray(server.features) &&
            server.features.length >= 4
                ? server.features.slice(0, 4)
                : cloneServers([fallback])[0].features,
        stats:
            Array.isArray(server.stats) &&
            server.stats.length >= 4
                ? server.stats.slice(0, 4)
                : cloneServers([fallback])[0].stats
    };
}

function createServerId(name) {
    return String(name || "server")
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}

function saveServers() {
    localStorage.setItem(
        "cristalhills_servers",
        JSON.stringify(servers)
    );
}

function setupBrandButton() {
    const brand = document.getElementById("brand-button");

    if (!brand) return;

    brand.addEventListener("click", function() {
        navigateTo("home");
    });

    brand.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.key === " ") {
            navigateTo("home");
        }
    });
}

function setupNavigation() {
    document.querySelectorAll(".nav-link").forEach(function(link) {
        link.addEventListener("click", function(event) {
            event.preventDefault();

            const page = link.dataset.page;

            if (page === "auth") {
                navigateTo(currentUser ? "profile" : "auth");
            } else if (
                page === "admin" &&
                currentUser &&
                currentUser.isAdmin
            ) {
                navigateTo("admin");
            } else {
                navigateTo(page);
            }
        });
    });
}

function navigateTo(page) {
    document.querySelectorAll(".page").forEach(function(item) {
        item.classList.remove("active");
    });

    const target = document.getElementById(page + "-page");

    if (!target) return;

    target.classList.add("active");

    document.querySelectorAll(".nav-link").forEach(function(link) {
        link.classList.toggle(
            "active",
            link.dataset.page === page
        );
    });

    if (page === "profile") {
        updateProfile();
    }

    if (page === "servers-list") {
        renderServersPage();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function setupForms() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const logoutButton = document.getElementById("logout-button");
    const registerLink = document.getElementById("show-register-link");
    const loginLink = document.getElementById("show-login-link");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    if (registerLink) {
        registerLink.addEventListener("click", function(event) {
            event.preventDefault();
            showRegister();
        });
    }

    if (loginLink) {
        loginLink.addEventListener("click", function(event) {
            event.preventDefault();
            showLogin();
        });
    }
}

function handleLogin(event) {
    event.preventDefault();

    const username =
        document.getElementById("login-username").value.trim();

    const password =
        document.getElementById("login-password").value;

    const error =
        document.getElementById("login-error");

    const admin = ADMINS.find(function(item) {
        return (
            item.username === username &&
            item.password === password
        );
    });

    const user = users.find(function(item) {
        return (
            item.username === username &&
            item.password === password
        );
    });

    if (admin) {
        currentUser = {
            ...admin,
            isAdmin: true,
            email: admin.username + "@admin.net",
            regDate: "-",
            lastLogin: new Date().toLocaleString()
        };
    } else if (user) {
        currentUser = {
            ...user,
            isAdmin: false,
            lastLogin: new Date().toLocaleString()
        };
    } else {
        if (error) {
            error.textContent =
                "❌ Неверный логин или пароль";
        }

        return;
    }

    localStorage.setItem(
        "cristalhills_current",
        JSON.stringify(currentUser)
    );

    updateUI();
    updateProfile();
    navigateTo("profile");

    event.target.reset();
}

function handleRegister(event) {
    event.preventDefault();

    const username =
        document.getElementById("register-username")
            .value.trim();

    const email =
        document.getElementById("register-email")
            .value.trim();

    const password =
        document.getElementById("register-password").value;

    const confirm =
        document.getElementById("register-confirm").value;

    const error =
        document.getElementById("register-error");

    const success =
        document.getElementById("register-success");

    if (password !== confirm) {
        error.textContent = "❌ Пароли не совпадают";
        return;
    }

    if (password.length < 4) {
        error.textContent = "❌ Минимум 4 символа";
        return;
    }

    const usernameExists =
        ADMINS.some(function(item) {
            return item.username === username;
        }) ||
        users.some(function(item) {
            return item.username === username;
        });

    if (usernameExists) {
        error.textContent =
            "❌ Такое имя пользователя уже занято";
        return;
    }

    users.push({
        username: username,
        email: email,
        password: password,
        rank: "Игрок",
        regDate: new Date().toLocaleDateString(),
        lastLogin: new Date().toLocaleString()
    });

    localStorage.setItem(
        "cristalhills_users",
        JSON.stringify(users)
    );

    error.textContent = "";
    success.textContent = "✅ Аккаунт создан";

    event.target.reset();

    setTimeout(function() {
        showLogin();
        success.textContent = "";
    }, 1500);
}

function updateUI() {
    const authLink =
        document.getElementById("auth-link");

    const adminLink =
        document.getElementById("admin-panel-link");

    if (currentUser) {
        authLink.innerHTML =
            '<span class="nav-icon">👤</span><span>' +
            currentUser.username +
            "</span>";

        authLink.dataset.page = "profile";
    } else {
        authLink.innerHTML =
            '<span class="nav-icon">🔑</span><span>Войти</span>';

        authLink.dataset.page = "auth";
    }

    if (adminLink) {
        adminLink.style.display =
            currentUser && currentUser.isAdmin
                ? "flex"
                : "none";
    }
}

function updateProfile() {
    const username =
        document.getElementById("profile-username");

    const rank =
        document.getElementById("profile-rank");

    const avatar =
        document.getElementById("profile-avatar-letter");

    const email =
        document.getElementById("profile-email");

    const regDate =
        document.getElementById("profile-reg-date");

    const lastLogin =
        document.getElementById("profile-last-login");

    if (!currentUser) {
        username.textContent = "Гость";
        rank.textContent = "Игрок";
        avatar.textContent = "G";
        email.textContent = "не указан";
        regDate.textContent = "-";
        lastLogin.textContent = "-";
        return;
    }

    username.textContent = currentUser.username;
    rank.textContent = currentUser.rank || "Игрок";
    avatar.textContent =
        currentUser.username.charAt(0).toUpperCase();
    email.textContent = currentUser.email || "не указан";
    regDate.textContent = currentUser.regDate || "-";
    lastLogin.textContent = currentUser.lastLogin || "-";
}

function logout() {
    currentUser = null;
    localStorage.removeItem("cristalhills_current");

    updateUI();
    updateProfile();
    navigateTo("home");
}

function showRegister() {
    const loginCard =
        document.getElementById("login-card");

    const registerCard =
        document.getElementById("register-card");

    loginCard.style.display = "none";
    registerCard.style.display = "block";
}

function showLogin() {
    const loginCard =
        document.getElementById("login-card");

    const registerCard =
        document.getElementById("register-card");

    loginCard.style.display = "block";
    registerCard.style.display = "none";
}

function loadServer(index) {
    if (!servers.length) return;

    if (index < 0 || index >= servers.length) {
        index = 0;
    }

    currentServerIndex = index;

    localStorage.setItem(
        "cristalhills_current_server",
        String(currentServerIndex)
    );

    const server =
        normalizeServer(servers[currentServerIndex]);

    document.getElementById(
        "current-server-name"
    ).textContent = server.name;

    document.getElementById(
        "hero-server-name"
    ).textContent = server.name;

    document.getElementById(
        "hero-description"
    ).textContent = server.description;

    document.getElementById(
        "features-title"
    ).textContent = server.featuresTitle;

    const statusElement =
        document.getElementById("server-status");

    statusElement.className =
        "server-status " + server.status;

    const statusNames = {
        online: "Сервер онлайн",
        maintenance: "Обслуживание",
        offline: "Оффлайн"
    };

    document.getElementById(
        "status-text"
    ).textContent =
        statusNames[server.status] || "Сервер онлайн";

    renderFeatures(server.features);
    renderStats(server.stats);
    renderServerButtons(server);
    renderServersPage();
    renderServersList();
}

function renderFeatures(features) {
    for (let i = 0; i < 4; i++) {
        const item = features[i];

        document.getElementById(
            "feature-icon-" + (i + 1)
        ).textContent = item.icon || "⭐";

        document.getElementById(
            "feature-title-" + (i + 1)
        ).textContent = item.title || "";

        document.getElementById(
            "feature-desc-" + (i + 1)
        ).textContent = item.desc || "";
    }
}

function renderStats(stats) {
    for (let i = 0; i < 4; i++) {
        const item = stats[i];

        document.getElementById(
            "stat-icon-" + (i + 1)
        ).textContent = item.icon || "⭐";

        document.getElementById(
            "stat-value-" + (i + 1)
        ).textContent = item.value || "";

        document.getElementById(
            "stat-label-" + (i + 1)
        ).textContent = item.label || "";
    }
}

function renderServerButtons(server) {
    const container =
        document.getElementById("ip-buttons");

    container.innerHTML = "";

    server.ips.forEach(function(item) {
        const button = document.createElement("button");
        button.className = "btn btn-primary btn-lg";

        const main = document.createElement("span");
        main.className = "btn-main";
        main.textContent = "📋 " + item.ip;

        const sub = document.createElement("span");
        sub.className = "btn-sub";
        sub.textContent = item.name;

        button.appendChild(main);
        button.appendChild(sub);

        button.addEventListener("click", function() {
            copyIP(item.ip);
        });

        container.appendChild(button);
    });

    server.builds.forEach(function(item) {
        const button = document.createElement("button");
        button.className = "btn btn-secondary btn-lg";

        const main = document.createElement("span");
        main.className = "btn-main";
        main.textContent = "📥 " + item.name;

        const sub = document.createElement("span");
        sub.className = "btn-sub";
        sub.textContent = "Скачать";

        button.appendChild(main);
        button.appendChild(sub);

        button.addEventListener("click", function() {
            window.open(item.url, "_blank", "noopener");
        });

        container.appendChild(button);
    });
}

function renderServersPage() {
    const grid =
        document.getElementById("servers-page-grid");

    if (!grid) return;

    grid.innerHTML = "";

    servers.forEach(function(server, index) {
        const card = document.createElement("article");

        card.className =
            "server-page-card" +
            (index === currentServerIndex
                ? " active"
                : "");

        const header = document.createElement("div");
        header.className = "server-page-header";

        const icon = document.createElement("span");
        icon.className = "server-page-icon";
        icon.textContent = "🌐";

        const name = document.createElement("div");
        name.className = "server-page-name";
        name.textContent = server.name;

        header.appendChild(icon);
        header.appendChild(name);

        const status = document.createElement("div");
        status.className = "server-page-status";
        status.textContent =
            getStatusIcon(server.status) +
            " " +
            getStatusName(server.status);

        const button = document.createElement("button");
        button.className =
            "btn btn-primary server-page-btn";
        button.textContent = "Выбрать";

        button.addEventListener("click", function(event) {
            event.stopPropagation();
            loadServer(index);
            navigateTo("home");
        });

        card.appendChild(header);
        card.appendChild(status);
        card.appendChild(button);

        card.addEventListener("click", function() {
            loadServer(index);
            navigateTo("home");
        });

        grid.appendChild(card);
    });
}

function renderServersList() {
    const container =
        document.getElementById("servers-list");

    if (!container) return;

    container.innerHTML = "";

    servers.forEach(function(server, index) {
        const card = document.createElement("article");
        card.className =
            "server-card" +
            (index === currentServerIndex
                ? " active"
                : "");

        const info = document.createElement("div");
        info.className = "server-info";

        const icon = document.createElement("span");
        icon.className = "server-icon";
        icon.textContent = "🌐";

        const text = document.createElement("div");

        const name = document.createElement("div");
        name.className = "server-name";
        name.textContent = server.name;

        const status = document.createElement("div");
        status.className = "server-status-text";
        status.textContent =
            getStatusIcon(server.status) +
            " " +
            getStatusName(server.status);

        text.appendChild(name);
        text.appendChild(status);

        info.appendChild(icon);
        info.appendChild(text);

        const actions = document.createElement("div");
        actions.className = "server-actions";

        const button = document.createElement("button");
        button.className = "btn btn-primary btn-sm";
        button.textContent = "Выбрать";

        button.addEventListener("click", function() {
            loadServer(index);
            navigateTo("home");
        });

        actions.appendChild(button);

        card.appendChild(info);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

function getStatusIcon(status) {
    if (status === "maintenance") return "🟠";
    if (status === "offline") return "🔴";
    return "🟢";
}

function getStatusName(status) {
    if (status === "maintenance") return "Обслуживание";
    if (status === "offline") return "Оффлайн";
    return "Онлайн";
}

function copyIP(ip) {
    const message =
        document.getElementById("ip-copy-msg");

    function showMessage(text) {
        if (!message) return;

        message.textContent = text;

        setTimeout(function() {
            message.textContent = "";
        }, 3000);
    }

    if (
        navigator.clipboard &&
        window.isSecureContext
    ) {
        navigator.clipboard
            .writeText(ip)
            .then(function() {
                showMessage("✅ IP скопирован: " + ip);
            })
            .catch(function() {
                fallbackCopy(ip, showMessage);
            });
    } else {
        fallbackCopy(ip, showMessage);
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
        callback("✅ IP скопирован: " + text);
    } catch (error) {
        callback("IP: " + text);
    }

    document.body.removeChild(textarea);
}
