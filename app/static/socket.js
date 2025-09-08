// my_flask_app/app/static/socket.js

import { getSocket, setSocket } from './state.js';

/**
 * Initialize Socket.IO connection with event handlers.
 * 
 * @param {string} baseURL - The base URL for the socket connection.
 * @param {object} user - The user object containing at least `chat_id`.
 * @param {object} eventHandlers - Map of eventName => handlerFunction.
 * 
 * @returns {object} - The socket instance.
 */
export function initSocket(baseURL, user, eventHandlers = {}) {
  let socket = getSocket();
  if (socket) {
    socket.disconnect();
  }

  socket = io(baseURL);

  socket.on("connect", () => {
    if (user && user.chat_id) {
      socket.emit("identify", { chat_id: user.chat_id });
    }
  });

  // Attach event handlers from the provided map
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    if (typeof handler === "function") {
      socket.on(event, handler);
    }
  });

  // Optional: generic error/logging listeners
  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);
  });

  socket.on("disconnect", (reason) => {
    console.info("Socket disconnected:", reason);
  });

  setSocket(socket);
  return socket;
}

/**
 * Send a private message via socket.
 * 
 * @param {string} recipientChatId - Chat ID of the recipient.
 * @param {string} message - Message text to send.
 */
export function sendMessage(recipientChatId, message) {
  const socket = getSocket();
  if (!socket || !recipientChatId || !message) return;
  socket.emit("private_message", {
    recipient: recipientChatId,
    message,
  });
}

/**
 * Send a chat end notification to current chat partner.
 * 
 * @param {string} recipientChatId 
 */
export function endChat(recipientChatId) {
  const socket = getSocket();
  if (!socket || !recipientChatId) return;
  socket.emit("chat_end_notice", { recipient: recipientChatId });
}

/**
 * Subscribe to a particular socket event.
 * 
 * @param {string} event - Event name.
 * @param {function} handler - Event handler callback.
 */
export function onEvent(event, handler) {
  const socket = getSocket();
  if (!socket) return;
  socket.on(event, handler);
}

/**
 * Disconnect the socket.
 */
export function disconnectSocket() {
  const socket = getSocket();
  if (socket) {
    socket.disconnect();
    setSocket(null);
  }
}
