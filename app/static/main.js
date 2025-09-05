// my_flask_app/app/static/main.js

import { showSection, showToast, setLoginState, clearChat } from "./ui.js";
import { initSocket, sendMessage, endChat, disconnectSocket } from "./socket.js";
import { handleLogin, handleRegister, handleLogout } from "./auth.js";

let socket = null;
let currentUser = null;
let currentChatPartnerId = null;

document.addEventListener("DOMContentLoaded", () => {
  // Wire auth forms and logout button
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    // Use auth.js login, and then initialize socket on success
    await handleLogin(e);
    // After login, get user data from setLoginState or adjust auth.js to export user
    // For demo assume auth.js sets currentUser globally or you adjust accordingly
    currentUser = window.currentUser || null;
    if (currentUser) {
      socket = initSocket(window.location.origin, currentUser, {
        private_message: ({ sender, message }) => {
          import("./ui.js").then(({ appendMessage }) => appendMessage(sender, message));
        },
        request_received: ({ from }) => {
          const accept = confirm(`User ${from} wants to chat. Accept?`);
          socket.emit("request_response", { accepted: accept, to: from });
          if (accept) {
            currentChatPartnerId = from;
            import("./ui.js").then(({ showSection, clearChat }) => {
              showSection("chatSection");
              clearChat();
              const chatUser = document.getElementById("currentChatUser");
              if (chatUser) chatUser.textContent = from;
              document.getElementById("chatWindow").style.display = "block";
              document.getElementById("chatWithBox").style.display = "block";
              const reportBtn = document.getElementById("reportChatBtn");
              if (reportBtn) reportBtn.style.display = "inline-block";
            });
          }
        },
        disconnect: () => {
          import("./ui.js").then(({ showToast }) => showToast("Disconnected from chat server.", "error"));
        },
        chat_ended_notice: ({ from }) => {
          import("./ui.js").then(({ appendMessage, showToast }) => {
            appendMessage("system", `User ${from} has left the chat`);
            showToast(`User ${from} ended chat`, "info");
          });
          currentChatPartnerId = null;
          if (document.getElementById("currentChatUser")) document.getElementById("currentChatUser").textContent = "";
          document.getElementById("chatWindow").style.display = "none";
          document.getElementById("chatWithBox").style.display = "none";
          const reportBtn = document.getElementById("reportChatBtn");
          if (reportBtn) reportBtn.style.display = "none";
          document.getElementById("targetUserId").value = "";
        },
        request_result: ({ status, by }) => {
          import("./ui.js").then(({ showToast, showSection, clearChat }) => {
            if (status === "accepted") {
              currentChatPartnerId = by;
              if (document.getElementById("currentChatUser")) document.getElementById("currentChatUser").textContent = by;
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
    }
  });

  document.getElementById("registerForm").addEventListener("submit", handleRegister);
  document.getElementById("logoutButton").addEventListener("click", () => {
    handleLogout();
    if (socket) {
      disconnectSocket();
      socket = null;
      currentChatPartnerId = null;
      currentUser = null;
      clearChat();
      showSection("loginForm");
    }
  });

  // SPA Navigation Buttons
  document.getElementById("navDashboard").addEventListener("click", () => showSection("dashboardSection"));
  document.getElementById("navChat").addEventListener("click", () => showSection("chatSection"));
  document.getElementById("navUsers").addEventListener("click", () => showSection("usersSection"));
  document.getElementById("navAdmin").addEventListener("click", () => showSection("adminSection"));
  document.getElementById("navAccount").addEventListener("click", () => showSection("accountSection"));

  // Start Chat Button
  document.getElementById("startChatBtn").addEventListener("click", () => {
    const targetId = document.getElementById("targetUserId").value.trim();
    if (!targetId) {
      showToast("Please enter a Chat ID.", "error");
      return;
    }
    if (targetId === currentUser?.chat_id) {
      showToast("You cannot chat with yourself.", "error");
      return;
    }
    if (!socket) {
      showToast("Socket connection not established.", "error");
      return;
    }
    socket.emit("message_request", { target: targetId });
    showToast(`Request sent to ${targetId}`, "info");
  });

  // Chat Send Button
  document.getElementById("chatSendBtn").addEventListener("click", () => {
    const input = document.getElementById("chatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentChatPartnerId || !socket) return;
    sendMessage(currentChatPartnerId, text);
    import("./ui.js").then(({ appendMessage }) => appendMessage("You", text));
    input.value = "";
  });

  // End Chat Button
  document.getElementById("endChatBtn").addEventListener("click", () => {
    if (currentChatPartnerId && socket) {
      sendMessage(currentChatPartnerId, `[System] ${currentUser?.username} has ended the chat.`);
      endChat(currentChatPartnerId);
    }
    currentChatPartnerId = null;
    clearChat();
    document.getElementById("chatInput").value = "";
    document.getElementById("chatWithBox").style.display = "none";
    document.getElementById("chatWindow").style.display = "none";
    const reportBtn = document.getElementById("reportChatBtn");
    if (reportBtn) reportBtn.style.display = "none";
    document.getElementById("targetUserId").value = "";
    showToast("Chat ended.", "info");
  });

  // Toggle Registration Section Button
  const toggleRegisterBtn = document.getElementById("toggleRegister");
  if (toggleRegisterBtn) {
    toggleRegisterBtn.addEventListener("click", () => {
      import("./ui.js").then(({ toggleRegistrationSection }) => {
        const registerSection = document.getElementById("registerSection");
        toggleRegistrationSection(registerSection.style.display === "none");
      });
    });
  }
});
