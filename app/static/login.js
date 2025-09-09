// my_flask_app/app/static/login.js

let socket = null;
let currentChatPartnerId = null;
const BASE_URL = window.location.origin; 

function setLoginState(isLoggedIn, userData = null) {
  document.getElementById("loginForm").style.display = isLoggedIn ? "none" : "block";
  document.getElementById("toggleRegister").style.display = isLoggedIn ? "none" : "inline-block";
  document.getElementById("navBar").style.display = isLoggedIn ? "flex" : "none";

  if (isLoggedIn && userData) {
    document.getElementById("dashboardUsername").textContent = userData.username || "";
    document.getElementById("dashboardRole").textContent = userData.role || "";
    document.getElementById("dashboardUserId").textContent = userData.chat_id || "[unknown]";
    
    console.log("User data:", userData);

    const isAdmin = userData.role === "admin";
    document.getElementById("navUsers").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("navAdmin").style.display = isAdmin ? "inline-block" : "none";
  
    const badge = document.getElementById("masterAdminBadge")
    if (badge) {
      badge.textContent = userData.is_master_admin ? "(Master Admin)" : "";
    }

    showSection("dashboardSection");
  } else {
    document.querySelectorAll(".spa-section").forEach(el => el.style.display = "none");
    document.getElementById("navBar").style.display = "none";
  }
}

function fetchUsernameByChatId(chatId) {
  // Returns a Promise that resolves with { username, ... }, or null if not found
  return apiFetchWithRefresh(`${BASE_URL}/all_users`)
    .then(data => {
      if (data.users && data.users.length > 0) {
        return data.users.find(user => user.chat_id === chatId) || null;
      }
      return null;
    });
}

function showSection(sectionId) {
  document.querySelectorAll(".spa-section").forEach((el) => {
    el.style.display = (el.id === sectionId) ? "block" : "none";
  });
}

function apiFetchWithRefresh(url, options = {}, retried = false) {
  if (!options.headers) options.headers = {};
  const access_token = localStorage.getItem("access_token");
  if (access_token) options.headers["Authorization"] = "Bearer " + access_token;

  return fetch(url, options).then(async (res) => {
    if ((res.status === 401 || res.status === 422) && !retried) {
      const refresh_token = localStorage.getItem("refresh_token");
      console.log(refresh_token);
      if (!refresh_token) throw new Error("Missing refresh token");

      const refreshRes = await fetch(`${BASE_URL}/token/refresh`, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + refresh_token,
          "Content-Type": "application/json",
        },
      });

      const refreshData = await refreshRes.json();
      console.log("Refresh response:", refreshData);
      if (refreshData.access_token) {
        localStorage.setItem("access_token", refreshData.access_token);
        options.headers["Authorization"] = "Bearer " + refreshData.access_token;
        return fetch(url, options).then(r => r.json().catch(() => ({})));
      } else {
        throw new Error("Token refresh failed");
      }
    } else {
      return res.json();
    }
  });
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => container.removeChild(toast), 500);
  }, 3000);
}

function appendMessage(sender, message) {
  const msgBox = document.getElementById("chatMessages");
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
// Initialize Bootstrap modal instance globally
let reportModal;
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById('reportModal');
  console.log("Modal element:", modalEl);
  if (modalEl) {
    reportModal = new bootstrap.Modal(modalEl);
  }

  const reportBtn = document.getElementById("reportChatBtn")
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      console.log("reportChatBtn")
      if (reportModal) {
        // Clear previous input
        console.log(reportModal)
        document.getElementById('reportReasonInput').value = '';
        reportModal.show();
      }
    });
  }
  const submitBtn = document.getElementById("submitReportBtn")
  if (submitBtn) {
    console.log(submitBtn)
    submitBtn.addEventListener("click", () => {
      const reason = document.getElementById('reportReasonInput').value.trim();
      if (!reason) {
        showToast("Please enter a report reason.", "error");
        return;
      }
      if (socket && currentChatPartnerId) {
        const chatLog = document.getElementById("chatMessages").innerText;
        socket.emit("report_user", {
          reporter_id: document.getElementById("dashboardUserId").textContent,
          reported_id: currentChatPartnerId,
          reason,
          chat_log: chatLog,
        });
        showToast("Report submitted. Thank you!", "info");
        reportModal.hide();
      } else {
        showToast("No active chat or socket connection.", "error");
      }
    });
  }
  const access_token = localStorage.getItem("access_token");
  if (access_token) {
    apiFetchWithRefresh(`${BASE_URL}/users`)
      .then(userinfo => {
        const user = userinfo.users?.[0];
        setLoginState(true, user || { username: "User", role: "" });
      })
      .catch(() => {
        localStorage.clear();
        setLoginState(false);
        showToast("Session expired. Please log in again.", "error");
      });
  } else {
    setLoginState(false);
  }

  // Login
  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then(res => res.ok ? res.json() : Promise.reject({ error: `HTTP ${res.status}` }))
      .then(data => {
        if (data.access_token && data.refresh_token) {
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          return apiFetchWithRefresh(`${BASE_URL}/users`);
        } else {
          throw new Error(data.error || "Login failed");
        }
      })
      .then(info => {
        const user = info.users?.[0];
        showToast("Login successful!", "success");
        setLoginState(true, user || { username: "User", role: "" });

        window.isMasterAdmin = !!user.is_master_admin;

        // Connect to socket AFTER login
        socket = io(BASE_URL);  // or whatever your server hostname is

        socket.on("connect", () => {
          socket.emit("identify", { chat_id: user.chat_id });
        });

        // Place all listeners right after socket is initialized
        socket.on("private_message", ({ sender, message }) => {
          appendMessage(sender, message);
        });

        socket.on("request_received", ({ from }) => {
          const accept = confirm(`User ${from} wants to chat. Accept?`);
          socket.emit("request_response", {
            accepted: accept,
            to: from
          });

          if (accept) {
            currentChatPartnerId = from;
            document.getElementById("currentChatUser").textContent = from;
            document.getElementById("chatWithBox").style.display = "block";
            document.getElementById("chatWindow").style.display = "block";
            document.getElementById("reportChatBtn").style.display = "inline-block";
            document.getElementById("chatMessages").innerHTML = "";
            showSection("chatSection");
            showToast(`Chat started with ${from}`, "success");
          }
        });

        socket.on("disconnect", () => {
          showToast("Disconnected from chat server.", "error");
        });

        socket.on("chat_ended_notice", ({ from }) => {
          appendMessage("system", `User ${from} has ended the chat.`);

          // Gracefully end the session
          currentChatPartnerId = null;
          document.getElementById("chatWithBox").style.display = "none";
          document.getElementById("chatWindow").style.display = "none";
          document.getElementById("reportChatBtn").style.display = "none";
          document.getElementById("targetUserId").value = "";

          showToast(`User ${from} ended the chat.`, "info");
        });


        socket.on("request_result", ({ status, by }) => {
          if (status === "accepted") {
            currentChatPartnerId = by;
            document.getElementById("currentChatUser").textContent = by;
            document.getElementById("chatWithBox").style.display = "block";
            document.getElementById("chatWindow").style.display = "block";
            document.getElementById("reportChatBtn").style.display = "inline-block";
            document.getElementById("chatMessages").innerHTML = "";
            showSection("chatSection");
            showToast(`Chat request accepted by ${by}`, "success");
          } else if (status === "rejected") {
            showToast(`User ${by} rejected your chat request.`, "error");
          } else if (status === "offline") {
            showToast("User is offline. Try again later.", "error");
          }
        });
      })
      .catch(err => {showToast(err.message, "error")
        console.log("Login error:", err);
      });
  });

  // Register toggle
  const toggleRegister = document.getElementById("toggleRegister");
  const registerSection = document.getElementById("registerSection");
  toggleRegister.addEventListener("click", function () {
    const show = registerSection.style.display === "none";
    registerSection.style.display = show ? "block" : "none";
    document.getElementById("loginForm").style.display = show ? "none" : "block";
    toggleRegister.textContent = show ? "Back to login" : "Create an account";
  });

  // Register submit
  document.getElementById("registerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const username = document.getElementById("regUsername").value;
    const password = document.getElementById("regPassword").value;

    fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then(res => res.ok ? res.json() : Promise.reject({ error: `HTTP ${res.status}` }))
      .then(data => {
        if (data.message) {
          showToast("Registered successfully!", "success");
          registerSection.style.display = "none";
          document.getElementById("loginForm").style.display = "block";
          toggleRegister.textContent = "Create an account";
          document.getElementById("username").value = username;
          document.getElementById("password").value = "";
        } else {
          showToast("Registration failed: " + (data.error || "Unknown error"), "error");
        }
      })
      .catch((err) => {showToast("Failed to register.", "error")
        console.log("Registration error:", err);
      });
  });

  document.getElementById("logoutButton").addEventListener("click", () => {
    const access_token = localStorage.getItem("access_token");
    if (!access_token) {
      setLoginState(false);
      showToast("Logged out.", "success");
      return;
    }
    apiFetchWithRefresh(`${BASE_URL}/logout`, { method: "POST" })
      .finally(() => {
        localStorage.clear();
        setLoginState(false);
        showToast("Logged out successfully.", "success");
      });
  });

  // SPA navigation
  document.getElementById("navDashboard").addEventListener("click", () => {
    showSection("dashboardSection");
  });

  const navChat = document.getElementById("navChat");
  if (navChat) {
    navChat.addEventListener("click", () => showSection("chatSection"));
  }

  document.getElementById("navAdmin").addEventListener("click", () => {
    showSection("adminSection");

    const reportItems = document.getElementById("reportItems");
    if (!reportItems) return;
    reportItems.textContent = "Loading reports...";

    apiFetchWithRefresh(`${BASE_URL}/all_reports`)
      .then(reportData => {
        if (!reportData.reports || reportData.reports.length === 0) {
          reportItems.textContent = "No reports found.";
          return;
        }

        // Also fetch all users so we can map chat_id -> username and ban/mute status
        apiFetchWithRefresh(`${BASE_URL}/all_users`)
          .then(userData => {
            const users = userData.users || [];

            let html = `
              <table>
              <tr>
                <th>ID</th>
                <th>Reporter</th>
                <th>Reported Chat ID</th>
                <th>Reported Username</th>
                <th>Time</th>
                <th>Reason</th>
                <th>Chat Log</th>
                <th>Actions</th>
              </tr>`;

            reportData.reports.forEach(r => {
              const reportedUser = users.find(u => u.chat_id === r.reported_id);
              const reportedUsername = reportedUser ? reportedUser.username : "[Unknown]";
              const isBanned = reportedUser ? reportedUser.is_banned : 0;
              const isMuted = reportedUser ? reportedUser.is_muted : 0;

              html += `
                <tr>
                  <td>${r.id}</td>
                  <td>${r.reporter_id}</td>
                  <td>${r.reported_id}</td>
                  <td>${reportedUsername}</td>
                  <td>${r.timestamp}</td>
                  <td>${r.reason}</td>
                  <td>${r.chat_log ? r.chat_log.replace(/\n/g, "<br>") : ""}</td>
                  <td>
                    ${reportedUser 
                      ? `<button class="banUserBtn" data-username="${reportedUsername}">${isBanned ? "Unban" : "Ban"}</button>
                        <button class="muteUserBtn" data-username="${reportedUsername}">${isMuted ? "Unmute" : "Mute"}</button>`
                      : `<span style="color:#888;">No actions</span>`}
                  </td>
                </tr>`;
            });

            html += "</table>";
            reportItems.innerHTML = html;

            // Attach Ban/Unban handlers
            document.querySelectorAll(".banUserBtn").forEach(btn => {
              btn.addEventListener("click", function() {
                const username = this.dataset.username;
                const action = this.textContent.trim().toLowerCase();
                const url = action === "ban" ? "ban_user" : "unban_user";
                if (confirm(`Are you sure you want to ${action} '${username}'?`)) {
                  apiFetchWithRefresh(`${BASE_URL}/${url}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username })
                  })
                  .then(res => {
                    showToast(res.message || res.error || "Unexpected response", res.error ? "error" : "success");
                  })
                  .catch(err => {
                    console.error(err);
                    showToast("Failed to process request", "error");
                  });
                }
              });
            });

            // Attach Mute/Unmute handlers
            document.querySelectorAll(".muteUserBtn").forEach(btn => {
              btn.addEventListener("click", function() {
                const username = this.dataset.username;
                const action = this.textContent.trim().toLowerCase();
                const url = action === "mute" ? "mute_user" : "unmute_user";
                if (confirm(`Are you sure you want to ${action} '${username}'?`)) {
                  apiFetchWithRefresh(`${BASE_URL}/${url}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username })
                  })
                  .then(res => {
                    showToast(res.message || res.error || "Unexpected response", res.error ? "error" : "success");
                  })
                  .catch(err => {
                    console.error(err);
                    showToast("Failed to process request", "error");
                  });
                }
              });
            });

          });
      })
      .catch(() => {
        reportItems.textContent = "Error loading reports.";
      });
  });


  document.getElementById("navAccount").addEventListener("click", () => {
    showSection("accountSection");
  });
  
  document.getElementById("navUsers").addEventListener("click", () => {
    
    showSection("usersSection");

    const allUsersList = document.getElementById("allUsersList");
    allUsersList.innerHTML = "Loading...";

    apiFetchWithRefresh(`${BASE_URL}/all_users`)
      .then((data) => {
        console.log("Fetched users:", data.users);
        if (data.users && data.users.length > 0) {
          let html = "<table><tr><th>Username</th><th>Role</th><th>Action</th><th>Change Role</th></tr>";
          data.users.forEach((user) => {
            const isAdmin = user.role === "admin";
            const disableDelete = user.is_master_admin ? "disabled style='opacity:0.5; cursor:not-allowed;'" : "";
            html += `
              <tr>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>
                  <button class="deleteUserBtn" data-username="${user.username}" ${disableDelete}>Delete</button>
                </td>
                <td>
                  ${window.isMasterAdmin && !user.is_master_admin && user.username.trim() !== (document.getElementById("dashboardUsername").textContent.trim()) ? `<button class="promoteBtn ${isAdmin ? 'demote' : 'promote'}" data-username="${user.username}">  ${isAdmin ? "Demote" : "Promote"}</button>` : "Not allowed"}
                </td>
              </tr>`;
          });
          html += "</table>";
          allUsersList.innerHTML = html;

          document.querySelectorAll(".deleteUserBtn").forEach(btn => {
            if (!btn.disabled) {
              btn.addEventListener("click", function () {
                const username = this.dataset.username;
                if (confirm(`Delete user '${username}'?`)) {
                  apiFetchWithRefresh(`${BASE_URL}/delete_user`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username }),
                  })
                    .then(() => {
                      showToast("User deleted.", "success");
                      document.getElementById("navUsers").click();
                    })
                    .catch(() => showToast("Failed to delete user.", "error"));
                }
              });
            }
          });
          
          document.querySelectorAll(".promoteBtn").forEach(btn => {
            btn.addEventListener("click", function () {
              const username = this.dataset.username;
              const newRole = this.textContent.trim().toLowerCase() === "promote" ? "admin" : "user";
              if (confirm(`Are you sure you want to change ${username}'s role to ${newRole}?`)) {
                apiFetchWithRefresh(`${BASE_URL}/change_role`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username, role: newRole }),
                })
                .then((res) => {
                  if (res.message) {
                    showToast(res.message, "success");
                    document.getElementById("navUsers").click(); // Reload table
                  } else {
                    showToast(res.error || "Failed to change role", "error");
                  }
                });
              }
            });
          });

        } else {
          allUsersList.textContent = "No users found.";
        }
      })
      .catch(() => {
        allUsersList.textContent = "Failed to fetch users.";
      });
  });

  document.getElementById("copyIdBtn").addEventListener("click", () => {
    const idSpan = document.getElementById("dashboardUserId");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(idSpan.textContent)
        .then(() => showToast("Chat ID copied!", "success"))
        .catch(() => showToast("Failed to copy.", "error"));
    } else {
      showToast("Clipboard not supported", "error");
    }
  });

  // Update password toggle
  const showUpdatePasswordBtn = document.getElementById("showUpdatePasswordBtn");
  const accountManagement = document.getElementById("accountManagement");
  showUpdatePasswordBtn.addEventListener("click", () => {
    const isShown = accountManagement.style.display === "block";
    accountManagement.style.display = isShown ? "none" : "block";
    showUpdatePasswordBtn.textContent = isShown ? "Update Password" : "Hide Password Update";
  });

  // Update password submit
  document.getElementById("updatePasswordForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const currentPassword = document.getElementById("currentPassword").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();

    if (!currentPassword || newPassword.length < 6) {
      showToast("Please enter valid password data.", "error");
      return;
    }

    apiFetchWithRefresh(`${BASE_URL}/update_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
      .then((data) => {
        if (data.message) {
          showToast("Password updated successfully!", "success");
          document.getElementById("updatePasswordForm").reset();
          accountManagement.style.display = "none";
          showUpdatePasswordBtn.textContent = "Update Password";
        } else {
          showToast(data.error || "Update failed.", "error");
        }
      })
      .catch(() => showToast("Password update failed.", "error"));
  });

  // Handle "Start Chat" with Chat ID
  document.getElementById("startChatBtn").addEventListener("click", () => {
    const targetId = document.getElementById("targetUserId").value.trim();

    if (!targetId) {
      showToast("Please enter a Chat ID.", "error");
      return;
    }

    const localChatId = document.getElementById("dashboardUserId").textContent;
    if (targetId === localChatId) {
      showToast("You cannot chat with yourself.", "error");
      return;
    }

    // Send request instead of starting chat directly
    if (!socket) {
      showToast("Socket connection not established.", "error");
      return;
    }

    socket.emit("message_request", { target: targetId });
    showToast(`Request sent to ${targetId}`, "info");

    // Optionally update UI to "waiting for response"
  });

  document.getElementById("chatSendBtn").addEventListener("click", () => {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text || !currentChatPartnerId || !socket) return;

    // Emit message to server
    socket.emit("private_message", {
      recipient: currentChatPartnerId,
      message: text
    });

    // Also render locally
    appendMessage("You", text);
    input.value = "";
  });

  document.getElementById("endChatBtn").addEventListener("click", () => {
    if (currentChatPartnerId && socket) {
      // NEW: Notify the other recipient
      socket.emit("private_message", {
        recipient: currentChatPartnerId,
        message: `[System] ${document.getElementById("dashboardUsername").textContent} has ended the chat.`
      });
      socket.emit("chat_ended_notice", { recipient: currentChatPartnerId });
    }

    // Clear local chat session
    currentChatPartnerId = null;
    document.getElementById("chatMessages").innerHTML = "";
    document.getElementById("chatInput").value = "";
    document.getElementById("chatWithBox").style.display = "none";
    document.getElementById("chatWindow").style.display = "none";
    document.getElementById("reportChatBtn").style.display = "none";
    document.getElementById("targetUserId").value = "";

    showToast("Chat ended.", "info");
  });

});