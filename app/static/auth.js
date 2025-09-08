// my_flask_app/app/static/auth.js

import { apiFetchWithRefresh } from "./api.js";
import { showToast, setLoginState, clearChat, showSection } from "./ui.js";
import { initSocket } from "./socket.js";
import { setCurrentUser, getCurrentUser, setSocket, getSocket, setCurrentChatPartnerId, getCurrentChatPartnerId } from './state.js';

/**
 * Handles login form submission
 * @param {Event} event
 */
export function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!username || !password) {
    showToast("Please provide username and password.", "error");
    return;
  }

  fetch(`/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(async (data) => {
      if (data.access_token && data.refresh_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        // Fetch user info
        return apiFetchWithRefresh(`/users`);
      } else {
        throw new Error(data.error || "Login failed");
      }
    })
    .then(({ users }) => {
      const user = users?.[0] ?? null;
      if (!user) throw new Error("User information missing");

      setCurrentUser(user);
      showToast("Login successful!", "success");
      setLoginState(true, user);

      // Init socket connection & events
      const socketInstance = initSocket(window.location.origin, user, {
        "private_message": handlePrivateMessage,
        "request_received": handleRequestReceived,
        "disconnect": handleDisconnect,
        "chat_ended_notice": handleChatEnded,
        "request_result": handleRequestResult,
      });
      setSocket(socketInstance);
    })
    .catch((error) => {
      showToast(error.message || "Login error", "error");
      setCurrentUser(null);
      setLoginState(false);
    });
}

function handlePrivateMessage({ sender, message }) {
  import("./ui.js").then(({ appendMessage }) => appendMessage(sender, message));
}

function handleRequestReceived({ from }) {
  const socket = getSocket();
  if (confirm(`User ${from} wants to chat. Accept?`)) {
    socket.emit("request_response", { accepted: true, to: from });
    setCurrentChatPartnerId(from);

    import("./ui.js").then(({ showSection, clearChat }) => {
      showSection("chatSection");
      clearChat();
      const chatUserElem = document.getElementById("currentChatUser");
      if (chatUserElem) chatUserElem.textContent = from;
      document.getElementById("chatWindow").style.display = "block";
      document.getElementById("chatWithBox").style.display = "block";
      document.getElementById("chatMessages").innerHTML = "";
      const reportBtn = document.getElementById("reportChatBtn");
      if (reportBtn) reportBtn.style.display = "inline-block";
    });
  } else {
    socket.emit("request_response", { accepted: false, to: from });
  }
}

function handleDisconnect() {
  import("./ui.js").then(({ showToast }) => showToast("Disconnected from chat server.", "error"));
}

function handleChatEnded({ from }) {
  setCurrentChatPartnerId(null);
  import("./ui.js").then(({ appendMessage, showToast }) => {
    appendMessage("system", `User ${from} has left the chat`);
    showToast(`User ${from} ended chat`, "info");
  });
  
  const chatUserElem = document.getElementById("currentChatUser");
  if (chatUserElem) chatUserElem.textContent = "";
  document.getElementById("chatWindow").style.display = "none";
  document.getElementById("chatWithBox").style.display = "none";
  const reportBtn = document.getElementById("reportChatBtn");
  if (reportBtn) reportBtn.style.display = "none";
  document.getElementById("targetUserId").value = "";
}

function handleRequestResult({ status, by }) {
  import("./ui.js").then(({ showToast, showSection, clearChat }) => {
    if (status === "accepted") {
      setCurrentChatPartnerId(by);
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

export function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("regUsername")?.value.trim();
  const password = document.getElementById("regPassword")?.value;

  if (!username || !password) {
    showToast("Please fill username and password", "error");
    return;
  }

  fetch(`/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (data.message) {
        showToast("Registration successful!", "success");
        import("./ui.js").then(({ setLoginState }) => setLoginState(false));
      } else {
        throw new Error(data.error || "Registration failed");
      }
    })
    .catch((err) => {
      showToast(err.message || "Registration error", "error");
    });
}

export function handleLogout() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    import("./ui.js").then(({ setLoginState, showToast }) => {
      setLoginState(false);
      showToast("Logged out", "success");
    });
    return;
  }
  fetch(`/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${refreshToken}` },
  })
    .then(() => {
      localStorage.clear();
      setCurrentUser(null);
      setCurrentChatPartnerId(null);
      setSocket(null);
      import("./ui.js").then(({ setLoginState, showToast }) => {
        setLoginState(false);
        showToast("Logged out successfully", "success");
      });
    })
    .catch(() => {
      localStorage.clear();
      setCurrentUser(null);
      setCurrentChatPartnerId(null);
      setSocket(null);
      import("./ui.js").then(({ setLoginState, showToast }) => {
        setLoginState(false);
        showToast("Logged out (with error)", "success");
      });
    });
}
