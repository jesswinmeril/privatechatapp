// my_flask_app/app/static/state.js

let currentUser = null;
let currentChatId = null;
let socket = null;

export function setCurrentUser(user) {
  currentUser = user;
}
export function getCurrentUser() {
  return currentUser;
}

export function setCurrentChatId(chatId) {
  currentChatId = chatId;
}
export function getCurrentChatId() {
  return currentChatId;
}

export function setSocket(sock) {
  socket = sock;
}
export function getSocket() {
  return socket;
}
