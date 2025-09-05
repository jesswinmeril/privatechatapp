// my_flask_app/app/static/ui.js

// Show toast message with auto-dismiss
export function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => container.removeChild(toast), 500);
    }, 3000);
}

// Show only the given SPA section by id, hide rest
export function showSection(sectionId) {
    document.querySelectorAll(".spa-section").forEach(el => {
        el.style.display = (el.id === sectionId) ? "block" : "none";
    });
}

// Append a chat message in the chat window
export function appendMessage(sender, message) {
    const msgBox = document.getElementById("chatMessages");
    if (!msgBox) return;
    const entry = document.createElement("div");

    if (sender === "system") {
        entry.innerHTML = `<em>${message}</em>`;
        entry.style.color = "#6b7280";
    } else {
        entry.textContent = `${sender}: ${message}`;
    }

    msgBox.appendChild(entry);
    msgBox.scrollTop = msgBox.scrollHeight;
}

// Update the UI state based on login status and user data
export function setLoginState(isLoggedIn, userData = null) {
    const loginForm = document.getElementById("loginForm");
    const toggleRegister = document.getElementById("toggleRegister");
    const navBar = document.getElementById("navBar");
    const dashboardSection = document.getElementById("dashboardSection");
    const badge = document.getElementById("masterAdminBadge");
    const navUsers = document.getElementById("navUsers");
    const navAdmin = document.getElementById("navAdmin");

    if (!loginForm || !toggleRegister || !navBar || !dashboardSection) return;

    loginForm.style.display = isLoggedIn ? "none" : "block";
    toggleRegister.style.display = isLoggedIn ? "none" : "inline-block";
    navBar.style.display = isLoggedIn ? "flex" : "none";

    if (isLoggedIn && userData) {
        document.getElementById("dashboardUsername").textContent = userData.username || "";
        document.getElementById("dashboardRole").textContent = userData.role || "";
        document.getElementById("dashboardUserId").textContent = userData.chat_id || "[unknown]";

        const isAdmin = userData.role === "admin";
        if (navUsers) navUsers.style.display = isAdmin ? "inline-block" : "none";
        if (navAdmin) navAdmin.style.display = isAdmin ? "inline-block" : "none";

        if (badge) badge.textContent = userData.is_master_admin ? "(Master Admin)" : "";

        showSection("dashboardSection");
    } else {
        document.querySelectorAll(".spa-section").forEach(el => el.style.display = "none");
        navBar.style.display = "none";
    }
}

// Clear chat messages from chat window
export function clearChat() {
    const msgBox = document.getElementById("chatMessages");
    if (msgBox) msgBox.innerHTML = "";
}

// Show or hide the registration section and toggle the "Create Account"/"Back to login" button text
export function toggleRegistrationSection(show) {
    const registerSection = document.getElementById("registerSection");
    const toggleRegister = document.getElementById("toggleRegister");
    const loginForm = document.getElementById("loginForm");

    if (!registerSection || !toggleRegister || !loginForm) return;

    registerSection.style.display = show ? "block" : "none";
    loginForm.style.display = show ? "none" : "block";
    toggleRegister.textContent = show ? "Back to login" : "Create Account";
}

// Helper to enable/disable buttons
export function setButtonEnabled(buttonId, enabled) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.disabled = !enabled;
}
