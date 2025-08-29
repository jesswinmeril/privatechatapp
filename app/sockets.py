# my_flask_app/app/sockets.py

from flask_socketio import SocketIO, emit
from flask import request
from .db import get_db_connection  # Assuming you have a db module for DB connections
connected_users = {}  # {chat_id: socket.sid}

def get_user_flags_by_chat_id(chat_id):
    """
    Looks up whether the user is banned or muted by their chat_id.
    Returns dict like {"is_banned": 0, "is_muted": 1}
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_banned, is_muted FROM users WHERE chat_id = ?", (chat_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"is_banned": row["is_banned"], "is_muted": row["is_muted"]}
    return None


def register_socket_handlers(socketio):
    @socketio.on("connect")
    def handle_connect():
        print(f"[Socket] Connected: {request.sid}")

    @socketio.on("disconnect")
    def handle_disconnect():
        for chat_id, sid in list(connected_users.items()):
            if sid == request.sid:
                print(f"[-] {chat_id} disconnected")
                del connected_users[chat_id]

    @socketio.on("identify")
    def handle_identify(data):
        chat_id = data.get("chat_id")
        if chat_id:
            flags = get_user_flags_by_chat_id(chat_id)
            if flags:
                if flags["is_banned"]:
                    print(f"[!] Banned user {chat_id} tried to connect. Disconnecting.")
                    emit("error", {"error": "You are banned from the system."}, to=request.sid)
                    socketio.disconnect(request.sid)
                    return
            connected_users[chat_id] = request.sid
            print(f"[+] {chat_id} is now connected with sid {request.sid}")

    @socketio.on("private_message")
    def handle_private_message(data):
        recipient_id = data.get("recipient")
        message = data.get("message")
        sender_sid = request.sid

        sender_id = None
        for cid, sid in connected_users.items():
            if sid == sender_sid:
                sender_id = cid
                break

        if not sender_id:
            emit("error", {"error": "Sender not identified"})
            return

        # 🔹 Check if sender is muted
        flags = get_user_flags_by_chat_id(sender_id)
        if flags and flags["is_muted"]:
            print(f"[!] Muted user {sender_id} tried to send message.")
            emit("error", {"error": "You are muted and cannot send messages."}, to=sender_sid)
            return

        recipient_sid = connected_users.get(recipient_id)
        if recipient_sid:
            emit("private_message", {
                "sender": sender_id,
                "message": message
            }, to=recipient_sid)
        else:
            print(f"[!] Recipient not online: {recipient_id}")
        
    @socketio.on("message_request")
    def handle_message_request(data):
        target_chat_id = data.get("target")
        sender_sid = request.sid

        # Find sender's chat ID
        sender_id = next((cid for cid, sid in connected_users.items() if sid == sender_sid), None)

        if not sender_id or not target_chat_id:
            return

        recipient_sid = connected_users.get(target_chat_id)
        if not recipient_sid:
            emit("request_result", {"status": "offline"}, to=sender_sid)
        else:
            emit("request_received", {"from": sender_id}, to=recipient_sid)

    @socketio.on("request_response")
    def handle_request_response(data):
        accepted = data.get("accepted")
        requester_id = data.get("to")  # Chat ID of the original requester
        responder_sid = request.sid

        responder_id = next((cid for cid, sid in connected_users.items() if sid == responder_sid), None)
        requester_sid = connected_users.get(requester_id)

        if not responder_id or not requester_sid:
            return

        emit("request_result", {
            "status": "accepted" if accepted else "rejected",
            "by": responder_id
        }, to=requester_sid)
    
    @socketio.on("chat_ended_notice")
    def handle_chat_end(data):
        partner_id = data.get("recipient")  # who to notify

        partner_sid = connected_users.get(partner_id)
        sender_sid = request.sid

        sender_id = next((cid for cid, sid in connected_users.items() if sid == sender_sid), None)

        if partner_sid and sender_id:
            print(f"📴 {sender_id} ended chat with {partner_id}")
            emit("chat_ended_notice", {"from": sender_id}, to=partner_sid)

    @socketio.on("report_user")
    def handle_report_user(data):
        reporter_id = data.get("reporter_id")
        reported_id = data.get("reported_id")
        reason = data.get("reason")
        chat_log = data.get("chat_log", "")  # Optional

        # Save to DB
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO reports (reporter_id, reported_id, reason, chat_log) VALUES (?, ?, ?, ?)",
            (reporter_id, reported_id, reason, chat_log)
        )
        conn.commit()
        conn.close()

        # Optionally, notify all admins (or just log for now)
        # emit("report_received", {...}, broadcast=True)
