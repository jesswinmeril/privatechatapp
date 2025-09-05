// main.js

import { showToast, setLoginState, showSection, clearChat, toggleRegistrationSection } from "./ui.js";
import { apiFetchWithRefresh } from "./api.js";
import { handleLogin, handleRegister, handleLogout } from "./auth.js";
import { initSocket, sendMessage, endChat, disconnectSocket } from "./socket.js";

let socket = null;
let currentUser = null;
let currentChatId = null;

async function initializeApp() {
  const token = localStorage.getItem("access_token");

  if (token) {
    try {
      const userResp = await apiFetchWithRefresh("/users");
      if (userResp && userResp.users && userResp.users.length > 0) {
        currentUser = userResp.users[0];
        setLoginState(true, currentUser);
        setupSocket();
      } else {
        resetToLogin();
      }
    } catch {
      resetToLogin();
    }
  } else {
    resetToLogin();
  }
}

function resetToLogin() {
  localStorage.clear();
  setLoginState(false);
  showSection("loginForm");
}

function setupSocket() {
  if (!currentUser) return;

  socket = initSocket(window.location.origin, currentUser, {
    private_message: ({ sender, message }) => {
      import("./ui.js").then(({ appendMessage }) => appendMessage(sender, message));
    },
    request_received: ({ from }) => {
      if (confirm(`User ${from} wants to chat. Accept?`)) {
        socket.emit("request_response", { accepted: true, to: from });
        currentChatId = from;
        import("./ui.js").then(({ showSection, clearChat }) => {
          showSection("chat");
          clearChat();
          document.getElementById("currentChatUser").textContent = from;
          document.getElementById("chatWindow").style.display = "block";
          document.getElementById("chatWithBox").style.display = "block";
          const reportBtn = document.getElementById("reportChatBtn");
          if (reportBtn) reportBtn.style.display = "inline-block";
        });
      } else {
        socket.emit("request_response", { accepted: false, to: from });
      }
    },
    disconnect: () => {
      import("./ui.js").then(({ showToast }) => showToast("Disconnected from chat server.", "error"));
    },
    chat_ended_notice: ({ from }) => {
      import("./ui.js").then(({ appendMessage, showToast }) => {
        appendMessage("system", `User ${from} has left the chat`);
        showToast(`Chat ended by ${from}`, "info");
      });
      currentChatId = null;
      resetChatUI();
    },
    request_result: ({ status, by }) => {
      import("./ui.js").then(({ showToast, showSection, clearChat }) => {
        if (status === "accepted") {
          currentChatId = by;
          document.getElementById("currentChatUser").textContent = by;
          showSection("chat");
          clearChat();
          document.getElementById("chatWindow").style.display = "block";
          document.getElementById("chatWithBox").style.display = "block";
          const reportBtn = document.getElementById("reportChatBtn");
          if (reportBtn) reportBtn.style.display = "inline-block";
          showToast(`Chat request accepted by ${by}`, "success");
        } else if (status === "rejected") {
          showToast(`User ${by} rejected your chat request.`, "error");
        } else if (status === "offline") {
          showToast("User is offline. Try again later", "error");
        }
      });
    }
  });
}

function resetChatUI() {
  document.getElementById("currentChatUser").textContent = "";
  document.getElementById("chatWindow").style.display = "none";
  document.getElementById("chatWithBox").style.display = "none";
  const reportBtn = document.getElementById("reportChatBtn");
  if (reportBtn) reportBtn.style.display = "none";
  document.getElementById("targetChatId").value = "";
  clearChat();
}

async function loadUsersList() {
  const listElem = document.getElementById("usersList");
  if (!listElem) return;
  listElem.textContent = "Loading...";
  try {
    const resp = await apiFetchWithRefresh("/all_users");
    if (!resp.users || resp.users.length === 0) {
      listElem.textContent = "No users found.";
      return;
    }
    // Build HTML table, add event listeners for action buttons
    let html = "<table><thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead><tbody>";
    for (const user of resp.users) {
      html += `<tr><td>${user.username}</td><td>${user.role}</td><td>Actions here</td></tr>`;
    }
    html += "</tbody></table>";
    listElem.innerHTML = html;
    // TODO: Add listeners for delete/promote buttons here
  } catch {
    listElem.textContent = "Failed to load users.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApp();

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    await handleLogin(e);
    currentUser = window.currentUser || null;
    if (currentUser) setupSocket();
  });

  document.getElementById("registerForm").addEventListener("submit", handleRegister);

  document.getElementById("logoutButton").addEventListener("click", () => {
    handleLogout();
    if (socket) {
      disconnectSocket();
      socket = null;
      currentUser = null;
      currentChatId = null;
      resetChatUI();
      showSection("loginForm");
    }
  });

  document.getElementById("navDashboard").addEventListener("click", () => showSection("dashboard"));
  document.getElementById("navChat").addEventListener("click", () => showSection("chat"));
  document.getElementById("navUsers").addEventListener("click", () => {
    showSection("users");
    loadUsersList();
  });
  document.getElementById("navAdmin").addEventListener("click", () => showSection("admin"));
  document.getElementById("navAccount").addEventListener("click", () => showSection("account"));

  document.getElementById("startChatBtn").addEventListener("click", () => {
    const targetId = document.getElementById("targetChatId").value.trim();
    if (!targetId) return showToast("Enter a chat ID", "error");
    if (targetId === currentUser?.chat_id) return showToast("Can't chat with yourself", "error");
    if (!socket) return showToast("Not connected", "error");
    socket.emit("request_sent", { target: targetId });
    showToast(`Request sent to ${targetId}`, "info");
  });

  document.getElementById("chatSendBtn").addEventListener("click", () => {
    const input = document.getElementById("chatInput");
    if (!input) return;
    const msg = input.value.trim();
    if (!msg || !currentChatId || !socket) return;
    sendMessage(currentChatId, msg);
    import("./ui.js").then(({ appendMessage }) => appendMessage("You", msg));
    input.value = "";
  });

  document.getElementById("endChatBtn").addEventListener("click", () => {
    if (!currentChatId || !socket) return;
    sendMessage(currentChatId, `[System] ${currentUser?.username} left chat`);
    endChat(currentChatId);
    currentChatId = null;
    resetChatUI();
    showToast("Chat ended", "info");
  });

  // Toggle Registration display
  const toggleRegBtn = document.getElementById("toggleRegister");
  if (toggleRegBtn) {
    toggleRegBtn.addEventListener("click", () => {
      import("./ui.js").then(({ toggleRegistrationSection }) => {
        const regSection = document.getElementById("registerSection");
        toggleRegistrationSection(regSection.style.display === "none");
      });
    });
  }
});
