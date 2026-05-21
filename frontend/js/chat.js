/* =========================================================================
   chat.js — real-time chat panel.
   Pulls conversations + history via REST, listens for new messages via
   socket.io. Falls back to REST send if the socket isn't connected.
   ========================================================================= */
(async function () {
  ui.initLayout();

  const $ = (sel) => document.querySelector(sel);
  const apiBase = (window.SMARTHABBIT_API_URL || 'http://localhost:3000');
  const token = localStorage.getItem('sh_access_token');
  const me = api.getCachedUser() || {};

  const statusEl = $('[data-chat-status]');
  const statusLabel = $('[data-chat-status-label]');
  const conversationsEl = $('[data-conversations]');
  const messagesEl = $('[data-messages]');
  const inputForm = $('[data-input-form]');
  const inputEl = $('[data-input]');
  const emptyEl = $('[data-empty]');
  const threadHeader = $('[data-thread-header]');
  const threadName = $('[data-thread-name]');
  const threadAvatar = $('[data-thread-avatar]');
  const threadStatus = $('[data-thread-status]');

  let socket = null;
  let conversations = [];
  let activeFriend = null;       // the friend record currently being viewed
  let messagesByFriend = new Map(); // friendId -> [messages]

  function setStatus(state, label) {
    statusEl.classList.remove('connected', 'disconnected');
    statusEl.classList.add(state);
    statusLabel.textContent = label;
  }

  /* ---------- socket ---------- */
  function connectSocket() {
    if (!window.io) {
      setStatus('disconnected', 'Realtime unavailable');
      return;
    }
    socket = io(apiBase, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socket.on('connect',    () => setStatus('connected', 'Live'));
    socket.on('disconnect', () => setStatus('disconnected', 'Disconnected'));
    socket.on('connect_error', (e) => {
      console.warn('chat socket error:', e.message);
      setStatus('disconnected', 'Disconnected');
    });
    socket.on('chat:message', onIncomingMessage);
  }

  function onIncomingMessage(msg) {
    // Append to in-memory cache for that conversation
    const other = msg.sender_id === me.id ? msg.receiver_id : msg.sender_id;
    const buf = messagesByFriend.get(other) || [];
    buf.push(msg);
    messagesByFriend.set(other, buf);

    // If it's the active thread, render it immediately
    if (activeFriend && activeFriend.friend_id === other) {
      appendMessage(msg);
      // We're looking at it → mark read on the server
      api.put(`/chat/with/${other}/read`).catch(() => {});
      if (socket) socket.emit('chat:read', { from: other });
      bumpConversationPreview(other, msg.body, 0);
    } else {
      // Otherwise bump unread count + sound + toast
      const conv = conversations.find(c => c.friend_id === other);
      const unread = (conv?.unread_count ?? 0) + 1;
      bumpConversationPreview(other, msg.body, unread);
      window.sound && sound.play('message');
      ui.toast(`💬 New message from ${conv?.username || 'a friend'}`, 'info');
    }
  }

  function bumpConversationPreview(friendId, body, unread) {
    const conv = conversations.find(c => c.friend_id === friendId);
    if (conv) {
      conv.last_message = body;
      conv.last_message_at = new Date().toISOString();
      conv.unread_count = unread;
      renderConversations();
    } else {
      // Unknown sender — refresh the list from the server
      loadConversations();
    }
  }

  /* ---------- REST ---------- */
  async function loadConversations() {
    try {
      const data = await api.get('/chat/conversations');
      conversations = data.conversations || [];
      renderConversations();
    } catch (err) {
      conversationsEl.innerHTML = `<p class="text-muted" style="padding: var(--sp-4);">Couldn't load chats: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function renderConversations() {
    if (!conversations.length) {
      conversationsEl.innerHTML = `<p class="text-muted" style="padding: var(--sp-4);">
        No conversations yet. Add a <a href="friends.html">friend</a> to start chatting.
      </p>`;
      return;
    }
    conversationsEl.innerHTML = conversations.map(c => {
      const initial = (c.username || '?').charAt(0).toUpperCase();
      const isActive = activeFriend?.friend_id === c.friend_id;
      const avatarInner = c.avatar_url
        ? `<img src="${ui.absoluteMediaUrl(c.avatar_url)}" alt="">`
        : initial;
      return `
        <div class="chat-conversation ${isActive ? 'is-active' : ''} ${c.unread_count > 0 ? 'has-unread' : ''}"
             data-friend-id="${c.friend_id}">
          <div class="chat-conv-avatar">${avatarInner}</div>
          <div class="chat-conv-body">
            <span class="chat-conv-name">${ui.escapeHtml(c.username || 'Friend')}</span>
            <span class="chat-conv-preview">${ui.escapeHtml(c.last_message || 'Say hi!')}</span>
          </div>
          ${c.unread_count > 0 ? `<span class="chat-conv-unread">${c.unread_count}</span>` : ''}
        </div>
      `;
    }).join('');
    conversationsEl.querySelectorAll('[data-friend-id]').forEach(el => {
      el.addEventListener('click', () => openConversation(el.dataset.friendId));
    });
  }

  async function openConversation(friendId) {
    const conv = conversations.find(c => c.friend_id === friendId);
    if (!conv) return;
    activeFriend = conv;

    // Show the thread + input
    emptyEl.classList.add('hidden');
    threadHeader.classList.remove('hidden');
    inputForm.classList.remove('hidden');
    renderConversations(); // refresh active highlight

    threadName.textContent = conv.username || 'Friend';
    threadStatus.textContent = `Level ${conv.level || 1}`;
    threadAvatar.innerHTML = conv.avatar_url
      ? `<img src="${ui.absoluteMediaUrl(conv.avatar_url)}" alt="">`
      : (conv.username || '?').charAt(0).toUpperCase();

    messagesEl.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

    try {
      const data = await api.get(`/chat/with/${friendId}?limit=80`);
      const msgs = data.messages || [];
      messagesByFriend.set(friendId, msgs);
      renderMessages(msgs);
      // Mark everything they sent as read
      await api.put(`/chat/with/${friendId}/read`).catch(() => {});
      if (socket) socket.emit('chat:read', { from: friendId });
      conv.unread_count = 0;
      renderConversations();
    } catch (err) {
      messagesEl.innerHTML = `<p class="text-muted">Couldn't load messages: ${ui.escapeHtml(err.message)}</p>`;
    }
  }

  function renderMessages(msgs) {
    if (!msgs.length) {
      messagesEl.innerHTML = `<div class="chat-empty" style="flex:1;">
        <i class="fa-regular fa-paper-plane"></i>
        <h3>No messages yet</h3>
        <p>Send the first one below.</p>
      </div>`;
      return;
    }
    let lastDay = '';
    const out = [];
    for (const m of msgs) {
      const d = new Date(m.created_at);
      const day = d.toISOString().slice(0, 10);
      if (day !== lastDay) {
        out.push(`<div class="chat-day-divider">${ui.formatDate(d)}</div>`);
        lastDay = day;
      }
      out.push(messageHtml(m));
    }
    messagesEl.innerHTML = out.join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessage(m) {
    const elBubble = document.createElement('div');
    elBubble.innerHTML = messageHtml(m);
    while (elBubble.firstChild) messagesEl.appendChild(elBubble.firstChild);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function messageHtml(m) {
    const mine = m.sender_id === me.id;
    const time = new Date(m.created_at).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit'
    });
    return `<div class="chat-message ${mine ? 'mine' : 'theirs'}">
      ${ui.escapeHtml(m.body)}
      <span class="chat-message-time">${time}</span>
    </div>`;
  }

  /* ---------- send ---------- */
  inputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text || !activeFriend) return;
    inputEl.value = '';
    const friendId = activeFriend.friend_id;

    if (socket && socket.connected) {
      socket.emit('chat:send', { to: friendId, body: text }, (resp) => {
        if (!resp?.ok) {
          ui.toast(resp?.error || 'Could not send', 'error');
          inputEl.value = text;
        }
      });
    } else {
      // REST fallback
      try {
        const r = await api.post(`/chat/with/${friendId}`, { body: text });
        const msg = r.message || r;
        appendMessage(msg);
        const buf = messagesByFriend.get(friendId) || [];
        buf.push(msg);
        messagesByFriend.set(friendId, buf);
        bumpConversationPreview(friendId, msg.body, 0);
      } catch (err) {
        ui.toast(err.message || 'Could not send', 'error');
        inputEl.value = text;
      }
    }
  });

  /* ---------- boot ---------- */
  setStatus('disconnected', 'Connecting…');
  connectSocket();
  await loadConversations();
})();
