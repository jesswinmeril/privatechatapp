// my_flask_app/app/static/main.js

import { showToast, setLoginState, showSection, clearChat, toggleRegistrationSection } from "./ui.js";
import { apiFetchWithRefresh } from "./api.js";
import { handleLogin, handleRegister, handleLogout } from "./auth.js";
import { initSocket, sendMessage, endChat, disconnectSocket } from "./socket.js";
import { 
  setCurrentUser, getCurrentUser, 
  setSocket, getSocket, 
  setCurrentChatId, getCurrentChatId 
} from './state.js';

async function initializeApp() {
  const token = localStorage.getItem("access_token");
  if (token) {
    try {
      const userResp = await apiFetchWithRefresh("/users");
      if (userResp && userResp.users && userResp.users.length > 0) {
        setCurrentUser(userResp.users[0]);
        setLoginState(true, getCurrentUser());
        await setupSocket();
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
  setCurrentUser(null);
  setSocket(null);
  setCurrentChatId(null);
  setLoginState(false);
  showSection("loginForm");
}

async function setupSocket() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const socketInstance = initSocket(window.location.origin, currentUser, {
    private_message: ({ sender, message }) => {
      import("./ui.js").then(({ appendMessage }) => appendMessage(sender, message));
    },
    request_received: ({ from }) => {
      const socket = getSocket();
      if (confirm(`User ${from} wants to chat. Accept?`)) {
        socket.emit("request_response", { accepted: true, to: from });
        setCurrentChatId(from);
        import("./ui.js").then(({ showSection, clearChat }) => {
          showSection("chatSection");
          clearChat();
          const chatUserElem = document.getElementById("currentChatUser");
          if (chatUserElem) chatUserElem.textContent = from;
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
      setCurrentChatId(null);
      resetChatUI();
    },
    request_result: ({ status, by }) => {
      import("./ui.js").then(({ showToast, showSection, clearChat }) => {
        if (status === "accepted") {
          setCurrentChatId(by);
          document.getElementById("currentChatUser").textContent = by;
          showSection("chatSection");
          clearChat();
          document.getElementById("chatWindow").style.display = "block";
          document.getElementById("chatWithBox").style.display = "block";
          const reportBtn = document.getElementById("reportChatBtn");
          if (reportBtn) reportBtn.style.display = "inline-block";
          showToast(`Chat request accepted by ${by}`, "success");
        } else if (status === "rejected") {
          showToast(`User ${by} rejected your chat request.`, "error");
        } else if (status === "offline") {
          showToast("User is offline. Try again later.", "error");
        }
      });
    }
  });

  setSocket(socketInstance);
}

function resetChatUI() {
  document.getElementById("currentChatUser").textContent = "";
  document.getElementById("chatWindow").style.display = "none";
  document.getElementById("chatWithBox").style.display = "none";
  const reportBtn = document.getElementById("reportChatBtn");
  if (reportBtn) reportBtn.style.display = "none";
  document.getElementById("targetUserId").value = "";
  clearChat();
}

async function loadUsersList() {
  const listElem = document.getElementById("allUsersList");
  if (!listElem) return;
  listElem.textContent = "Loading...";

  try {
    const resp = await apiFetchWithRefresh("/all_users");
    if (!resp.users || resp.users.length === 0) {
      listElem.textContent = "No users found.";
      return;
    }

    const currentUser = getCurrentUser();
    const isMasterAdmin = currentUser?.is_master_admin;
    const myUsername = currentUser?.username?.trim().toLowerCase() || "";
    console.log({ currentUser, isMasterAdmin, myUsername });

    let html = "<table><thead><tr><th>Username</th><th>Role</th><th>Action</th><th>Change Role</th></tr></thead><tbody>";

    resp.users.forEach(user => {
      const username = (user.username || "").trim().toLowerCase();
      const isAdmin = user.role === "admin";
      const canDelete = !user.is_master_admin && username !== myUsername;
      const canPromoteDemote = isMasterAdmin && !user.is_master_admin && username !== myUsername;

      const deleteBtnHtml = canDelete
        ? `<button class="deleteUserBtn" data-username="${username}">Delete</button>`
        : `<button disabled style="opacity:0.5; cursor:not-allowed;">Delete</button>`;

      const promoteBtnHtml = canPromoteDemote
        ? `<button class="promoteBtn ${isAdmin ? 'demote' : 'promote'}" data-username="${username}">${
          isAdmin ? "Demote" : "Promote"
        }</button>`
        : "Not allowed";
      console.log({ canDelete, canPromoteDemote, isAdmin, username, myUsername, isMasterAdmin });

      html += `
        <tr>
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>${deleteBtnHtml}</td>
          <td>${promoteBtnHtml}</td>
        </tr>`;
    });

    html += "</tbody></table>";
    listElem.innerHTML = html;

    // Attach event listeners for delete
    document.querySelectorAll(".deleteUserBtn").forEach(btn => {
      if (!btn.disabled) {
        btn.addEventListener("click", function() {
          const username = this.dataset.username;
          if (confirm(`Delete user '${username}'?`)) {
            apiFetchWithRefresh("/delete_user", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username })
            }).then(() => {
              showToast("User deleted.", "success");
              loadUsersList();
            }).catch(() => {
              showToast("Failed to delete user.", "error");
            });
          }
        });
      }
    });

    // Attach event listeners for promote/demote
    document.querySelectorAll(".promoteBtn").forEach(btn => {
      btn.addEventListener("click", function() {
        const username = this.dataset.username;
        const action = this.textContent.trim().toLowerCase();
        const newRole = action === "promote" ? "admin" : "user";
        if (confirm(`Change role of ${username} to ${newRole}?`)) {
          apiFetchWithRefresh("/change_role", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, role: newRole })
          }).then(res => {
            if (res.message) {
              showToast(res.message, "success");
              loadUsersList();
            } else {
              showToast(res.error || "Failed to change role", "error");
            }
          }).catch(() => {
            showToast("Failed to change role", "error");
          });
        }
      });
    });

  } catch (err) {
    listElem.textContent = "Failed to load users.";
    console.error("Error loading users:", err);
  }
}

// Event listeners and initializers
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    await handleLogin(e);
    if (getCurrentUser()) await setupSocket();
  });

  document.getElementById("registerForm").addEventListener("submit", handleRegister);

  document.getElementById("logoutButton").addEventListener("click", () => {
    handleLogout();
    const socket = getSocket();
    if (socket) {
      disconnectSocket();
      setSocket(null);
    }
    setCurrentUser(null);
    setCurrentChatId(null);
    resetChatUI();
    showSection("loginForm");
  });

  document.getElementById("navDashboard").addEventListener("click", () => showSection("dashboardSection"));
  document.getElementById("navChat").addEventListener("click", () => showSection("chatSection"));
  document.getElementById("navUsers").addEventListener("click", () => {
    showSection("usersSection");
    loadUsersList();
  });
  document.getElementById("navAdmin").addEventListener("click", () => showSection("adminSection"));
  document.getElementById("navAccount").addEventListener("click", () => showSection("accountSection"));

  document.getElementById("startChatBtn").addEventListener("click", () => {
    const targetId = document.getElementById("targetUserId").value.trim();
    const currentUser = getCurrentUser();
    const socket = getSocket();

    if (!targetId) return showToast("Enter a chat ID", "error");
    if (targetId === currentUser?.chat_id) return showToast("Can't chat with yourself", "error");
    if (!socket) return showToast("Not connected", "error");

    socket.emit("message_request", { target: targetId });
    showToast(`Request sent to ${targetId}`, "info");
  });

  document.getElementById("chatSendBtn").addEventListener("click", () => {
    const input = document.getElementById("chatInput");
    const currentChatId = getCurrentChatId();
    const socket = getSocket();

    if (!input) return;
    const msg = input.value.trim();
    if (!msg || !currentChatId || !socket) return;
    sendMessage(currentChatId, msg);
    import("./ui.js").then(({ appendMessage }) => appendMessage("You", msg));
    input.value = "";
  });

  document.getElementById("endChatBtn").addEventListener("click", () => {
    const currentChatId = getCurrentChatId();
    const currentUser = getCurrentUser();
    const socket = getSocket();

    if (!currentChatId || !socket) return;
    sendMessage(currentChatId, `[System] ${currentUser?.username} left chat`);
    endChat(currentChatId);
    setCurrentChatId(null);
    resetChatUI();
    showToast("Chat ended", "info");
  });

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
