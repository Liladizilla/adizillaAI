let initializeApp, getAuth, onAuthStateChanged, createUserWithEmailAndPassword;
let signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider;
let sendPasswordResetEmail, signOut, updateProfile;

(() => {
  const $ = (id) => document.getElementById(id);
  const KEYS = { chats: "adizilla.chats.v1", memory: "adizilla.memory.v1", enabled: "adizilla.memory-enabled.v1", theme: "adizilla.theme.v1" };
  let chats = read(KEYS.chats, []);
  let memory = read(KEYS.memory, "");
  let memoryDraft = memory;
  let memoryEnabled = read(KEYS.enabled, false);
  let currentId = null;
  let busy = false;
  let pendingAttachments = [];
  let theme = read(KEYS.theme, "system");
  let firebaseAuth = null;
  let firebaseUser = null;
  let revenueCatStatus = { isPro: false, loading: false, error: null };
  let revenueCatModulePromise = null;
  let firebaseReady = false;
  let authMode = "signin";
  let authInitialization = Promise.resolve(false);
  let cloudSyncStatus = "Local device";
  let cloudSyncTimer = null;
  let cloudSyncRunning = false;
  let cloudSyncAgain = false;
  const deletedChatsKey = "adizilla.deleted-cloud-chats.v1";
  const panels = { chat: $("chatPanel"), memory: $("memoryPanel"), library: $("libraryPanel") };
  function scopedKey(key) { return firebaseUser ? key.replace("adizilla.", "adizilla.user." + firebaseUser.uid + ".") : key; }
  function read(key, fallback) { try { const value = localStorage.getItem(scopedKey(key)); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } }
  function save(key, value) { try { localStorage.setItem(scopedKey(key), JSON.stringify(value)); return true; } catch { toast("Browser storage could not save this change. Export your chats and free browser storage before trying again."); return false; } }
  function id() { return globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2); }
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function toast(message) { $("infoTitle").textContent = "Just so you know"; $("infoText").textContent = message; $("infoDialog").showModal(); }
  function activeChat() { return chats.find(c => c.id === currentId); }
  function persistChats() {
    save(KEYS.chats, chats);
    renderHistory();
    renderLibrary();
    scheduleCloudSync();
  }
  async function cloudRequest(path, options = {}) {
    if (!firebaseUser) throw new Error("Sign in to sync your conversations.");
    const token = await firebaseUser.getIdToken();
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Cloud sync failed.");
    return data;
  }
  function scheduleCloudSync() {
    if (!firebaseUser) return;
    if (cloudSyncRunning) { cloudSyncAgain = true; return; }
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => syncCloudChats().catch(() => {
      cloudSyncStatus = "Cloud sync paused";
      renderAccount();
    }), 900);
  }
  async function syncCloudChats() {
    if (!firebaseUser || cloudSyncRunning) return;
    cloudSyncRunning = true;
    cloudSyncStatus = "Syncing cloud history…";
    renderAccount();
    try {
      const tombstones = read(deletedChatsKey, []);
      for (const chatId of tombstones) {
        try { await cloudRequest("/api/chats/" + encodeURIComponent(chatId), { method: "DELETE" }); }
        catch (error) { if (!String(error.message).includes("not found")) throw error; }
      }
      if (tombstones.length) save(deletedChatsKey, []);
      const listing = await cloudRequest("/api/chats");
      const remote = new Map((listing.chats || []).map(chat => [chat.id, chat]));
      const local = [...chats];
      const merged = [...local];
      for (const summary of remote.values()) {
        const localIndex = merged.findIndex(chat => chat.id === summary.id);
        if (localIndex < 0) {
          const full = await cloudRequest("/api/chats/" + encodeURIComponent(summary.id));
          merged.push(full);
        } else if (Number(summary.updatedAt || 0) > Number(merged[localIndex].updatedAt || 0)) {
          const full = await cloudRequest("/api/chats/" + encodeURIComponent(summary.id));
          merged[localIndex] = full;
        } else if (Number(merged[localIndex].updatedAt || 0) > Number(summary.updatedAt || 0)) {
          await uploadChat(merged[localIndex]);
        }
        remote.delete(summary.id);
      }
      for (const chat of merged) {
        if (!listing.chats?.some(item => item.id === chat.id)) await uploadChat(chat);
      }
      if (!cloudSyncAgain) {
        chats = merged.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 100);
        save(KEYS.chats, chats);
        currentId = chats.some(chat => chat.id === currentId) ? currentId : null;
        renderHistory();
        renderMessages();
        renderLibrary();
        cloudSyncStatus = "Cloud sync on";
        renderAccount();
      }
    } catch (error) {
      cloudSyncStatus = "Cloud sync paused";
      renderAccount();
      throw error;
    } finally {
      cloudSyncRunning = false;
      if (cloudSyncAgain && firebaseUser) {
        cloudSyncAgain = false;
        scheduleCloudSync();
      }
    }
  }
  async function uploadChat(chat) {
    const payload = {
      id: chat.id,
      title: String(chat.title || "New conversation").slice(0, 200),
      createdAt: Number(chat.createdAt) || Date.now(),
      updatedAt: Number(chat.updatedAt) || Date.now(),
      messages: (Array.isArray(chat.messages) ? chat.messages : []).filter(m => !m.isError).slice(-40).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000)
      }))
    };
    await cloudRequest("/api/chats/" + encodeURIComponent(chat.id), { method: "PUT", body: JSON.stringify(payload) });
  }
  function markCloudChatDeleted(chatId) {
    if (!firebaseUser || !chatId) return;
    const tombstones = read(deletedChatsKey, []);
    if (!tombstones.includes(chatId)) save(deletedChatsKey, [...tombstones, chatId]);
    scheduleCloudSync();
  }
  function newChat() {
    currentId = id();
    chats.unshift({ id: currentId, title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
    persistChats(); renderMessages(); showPanel("chat"); $("promptInput").focus(); closeMobile();
  }
  function showPanel(name) {
    Object.entries(panels).forEach(([key, panel]) => { panel.classList.toggle("active-panel", key === name); panel.classList.toggle("hidden", key !== name); });
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.panel === name));
    const chat = activeChat();
    $("breadcrumbPage").textContent = name === "chat" && chat?.messages?.length ? chat.title : name.charAt(0).toUpperCase() + name.slice(1);
    $("breadcrumbPage").setAttribute("aria-label", name === "chat" && chat?.messages?.length ? "Rename conversation: " + chat.title : name);
    if (name === "memory") syncMemoryUI();
    if (name === "library") renderLibrary();
    closeMobile();
  }
  function renderHistory(filter = "") {
    const list = $("chatList"); list.replaceChildren();
    const filtered = chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));
    $("emptyHistory").classList.toggle("hidden", filtered.length > 0);
    $("emptyHistory").textContent = filter ? "No matching conversations." : "Nothing here yet. Your chats show up as you have them."; $("recentsHeading").classList.toggle("hidden", chats.length === 0 && !filter); $("chatCount").classList.toggle("hidden", chats.length === 0);
    $("chatCount").textContent = String(chats.length);
    filtered.forEach(chat => {
      const row = document.createElement("div"); row.className = "history-item" + (chat.id === currentId ? " selected" : "");
      const open = document.createElement("button"); open.className = "history-title"; open.textContent = chat.title; open.title = chat.title; open.addEventListener("click", () => openChat(chat.id));
      const del = document.createElement("button"); del.className = "history-delete"; del.textContent = "×"; del.title = "Delete conversation"; del.setAttribute("aria-label", "Delete " + chat.title);
      del.addEventListener("click", (event) => { event.stopPropagation(); markCloudChatDeleted(chat.id); chats = chats.filter(c => c.id !== chat.id); if (currentId === chat.id) currentId = null; persistChats(); renderMessages(); });
      row.append(open, del); list.append(row);
    });
  }
  function openChat(chatId) { currentId = chatId; renderHistory(); renderMessages(); showPanel("chat"); }
  function renderMessages() {
    const chat = activeChat();
    const crumb = $("breadcrumbPage");
    if (document.querySelector("#chatPanel").classList.contains("active-panel")) {
      crumb.textContent = chat?.messages?.length ? chat.title : "Chat";
      crumb.title = chat?.messages?.length ? "Click to rename this conversation" : "";
      crumb.style.cursor = chat?.messages?.length ? "text" : "";
    }
    const messages = $("messages"); messages.replaceChildren();
    const empty = !chat || !chat.messages.length; $("welcome").classList.toggle("hidden", !empty);
    if (chat) chat.messages.forEach((message, index) => messages.append(makeMessage(message, index)));
    $("conversationScroll").scrollTop = $("conversationScroll").scrollHeight;
  }
  function renderText(content) {
    // Render a safe Markdown subset. Raw HTML from model output is escaped before formatting.
    let source = escapeHTML(String(content ?? "").replace(/\r\n?/g, "\n"));
    const protectedHTML = [];
    const protect = (html) => {
      const token = "@@ADIZILLA_TOKEN_" + protectedHTML.length + "@@";
      protectedHTML.push(html);
      return token;
    };
    const tick = String.fromCharCode(96);
    const fencePattern = new RegExp(tick.repeat(3) + "([^\\n" + tick + "]*)\\n([\\s\\S]*?)" + tick.repeat(3), "g");
    source = source.replace(fencePattern, (_, language, code) => {
      const lang = language.trim().replace(/[^a-zA-Z0-9_+-]/g, "");
      const label = lang ? '<span class="code-language">' + lang + '</span>' : "";
      return "\n" + protect('<pre class="code-block">' + label + '<code>' + code.replace(/\n$/, "") + '</code></pre>') + "\n";
    });
    const inlineCodePattern = new RegExp(tick + "([^" + tick + "\\n]+)" + tick, "g");
    source = source.replace(inlineCodePattern, (_, code) =>
      protect('<code class="inline-code">' + code + '</code>')
    );

    function inline(text) {
      let value = text;
      value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      value = value.replace(/__(.+?)__/g, "<strong>$1</strong>");
      value = value.replace(/~~(.+?)~~/g, "<del>$1</del>");
      value = value.replace(/==(.+?)==/g, '<mark class="text-highlight">$1</mark>');
      value = value.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
      value = value.replace(/(^|[^\w_])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");
      return value;
    }

    const lines = source.split("\n");
    const output = [];
    let paragraph = [];
    const flushParagraph = () => {
      if (paragraph.length) {
        output.push("<p>" + inline(paragraph.join("<br>")) + "</p>");
        paragraph = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) { flushParagraph(); continue; }

      const tokenMatch = trimmed.match(/^@@ADIZILLA_TOKEN_(\d+)@@$/);
      if (tokenMatch) {
        flushParagraph();
        output.push(trimmed);
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const level = heading[1].length;
        output.push("<h" + level + ">" + inline(heading[2].replace(/\s+#+$/, "")) + "</h" + level + ">");
        continue;
      }

      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushParagraph();
        output.push("<hr>");
        continue;
      }

      const nextLine = (lines[i + 1] || "").trim();
      const isTableSeparator = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(nextLine);
      if (trimmed.includes("|") && isTableSeparator) {
        flushParagraph();
        const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
        const headers = cells(trimmed);
        const rows = [];
        i += 2;
        while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim()) {
          rows.push(cells(lines[i]));
          i++;
        }
        i--;
        const head = "<thead><tr>" + headers.map(cell => "<th>" + inline(cell) + "</th>").join("") + "</tr></thead>";
        const body = "<tbody>" + rows.map(row => "<tr>" + headers.map((_, index) => "<td>" + inline(row[index] || "") + "</td>").join("") + "</tr>").join("") + "</tbody>";
        output.push('<div class="table-wrap"><table class="markdown-table">' + head + body + "</table></div>");
        continue;
      }

      if (/^&gt;\s?/.test(trimmed)) {
        flushParagraph();
        const quote = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i].trim())) {
          quote.push(inline(lines[i].trim().replace(/^&gt;\s?/, "")));
          i++;
        }
        i--;
        output.push("<blockquote>" + quote.map(item => "<p>" + item + "</p>").join("") + "</blockquote>");
        continue;
      }

      const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
      const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const isOrdered = Boolean(ordered);
        const tag = isOrdered ? "ol" : "ul";
        const items = [];
        while (i < lines.length) {
          const candidate = lines[i].trim();
          const match = candidate.match(isOrdered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
          if (!match) break;
          items.push("<li>" + inline(match[1]) + "</li>");
          i++;
        }
        i--;
        output.push("<" + tag + ">" + items.join("") + "</" + tag + ">");
        continue;
      }

      paragraph.push(trimmed);
    }
    flushParagraph();

    let html = output.join("");
    html = html.replace(/@@ADIZILLA_TOKEN_(\d+)@@/g, (_, index) => protectedHTML[Number(index)] || "");
    return html;
  }
  function makeMessage(message, index) {
    const row = document.createElement("article"); row.className = "message " + message.role;
    if (message.role === "assistant") {
      const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = "a";
      const body = document.createElement("div"); body.className = "message-content"; body.innerHTML = renderText(message.content);
      const actions = document.createElement("div"); actions.className = "message-actions";
      const copy = document.createElement("button"); copy.textContent = "Copy response"; copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(message.content); copy.textContent = "Copied"; } catch { toast("Clipboard access isn't available in this browser."); } });
      actions.append(copy); body.append(actions); row.append(avatar, body);
    } else {
      const body = document.createElement("div"); body.className = "message-content"; body.textContent = message.content; row.append(body);
    }
    return row;
  }
  function renderLibrary() {
    const list = $("libraryList"); if (!list) return; list.replaceChildren();
    if (!chats.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Nothing saved yet. Start a conversation and it will show up here."; list.append(p); return; }
    chats.forEach(chat => {
      const row = document.createElement("div"); row.className = "library-row";
      const title = document.createElement("span"); title.textContent = chat.title;
      const date = document.createElement("small"); date.textContent = new Date(chat.updatedAt).toLocaleDateString();
      const open = document.createElement("button"); open.className = "secondary-btn"; open.textContent = "Open"; open.addEventListener("click", () => openChat(chat.id));
      row.append(title, date, open); list.append(row);
    });
  }
  function syncMemoryUI() {
    $("memoryText").value = memoryDraft; $("memoryEnabled").checked = memoryEnabled; $("memoryLength").textContent = memoryDraft.length + " / 3000";
    $("memoryCount").textContent = memory.trim() ? "1" : "0";
    $("memoryCount").classList.toggle("hidden", !memory.trim());
    $("memoryChipText").textContent = memoryEnabled && memory.trim() ? "Memory on" : "Memory off";
    $("memoryChip").setAttribute("aria-pressed", String(Boolean(memoryEnabled && memory.trim())));
    $("memoryChip").title = memoryEnabled && memory.trim() ? "Memory is on. Select to manage saved memory." : "Memory is off. Select to manage saved memory.";
    $("memoryChip").style.color = memoryEnabled && memory.trim() ? "var(--accent)" : "";
  }
  function saveMemory() {
    const draft = $("memoryText").value.slice(0, 3000);
    const enabled = $("memoryEnabled").checked;
    if (!save(KEYS.memory, draft)) return;
    if (!save(KEYS.enabled, enabled)) { save(KEYS.memory, memory); $("memoryEnabled").checked = memoryEnabled; return; }
    memory = draft; memoryDraft = draft; memoryEnabled = enabled; syncMemoryUI();
    $("infoTitle").textContent = "Memory updated"; $("infoText").textContent = memoryEnabled ? "Your approved memory is saved on this device and will be included in future chat requests." : "Memory is saved locally but will not be sent with chat requests while disabled."; $("infoDialog").showModal();
  }
  function renderAttachments() {
    const list = $("attachmentList");
    const count = $("attachmentCount");
    if (!list || !count) return;
    list.replaceChildren();
    list.classList.toggle("hidden", pendingAttachments.length === 0);
    count.textContent = pendingAttachments.length ? pendingAttachments.length + "/4 attached" : ""; updateSendState();
    pendingAttachments.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "attachment-chip";
      const name = document.createElement("span");
      name.textContent = file.name;
      name.title = file.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + file.name);
      remove.addEventListener("click", () => {
        pendingAttachments.splice(index, 1);
        renderAttachments();
      });
      chip.append(name, remove);
      list.append(chip);
    });
  }
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read " + file.name));
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.readAsDataURL(file);
    });
  }
  async function addAttachments(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (pendingAttachments.length >= 4) { toast("Attach up to four files per message."); break; }
      if (file.size > 2_500_000) { toast(file.name + " is over the 2.5 MB per-file limit."); continue; }
      if (pendingAttachments.reduce((sum, item) => sum + (item.size || 0), 0) + file.size > 3_000_000) { toast("Keep all attachments under 3 MB combined."); break; }
      try {
        const data = await readFileAsBase64(file);
        pendingAttachments.push({ name: file.name, mime_type: file.type || "application/octet-stream", data: data, size: file.size });
      } catch (error) {
        toast(error.message || "Could not read that file.");
      }
    }
    renderAttachments();
  }
  async function sendMessage(content) {
    content = content.trim();
    if ((!content && !pendingAttachments.length) || busy) return;
    await authInitialization;
    if (!firebaseUser) { setAuthMode("signin"); openDialog("authDialog"); return; }
    const attachments = pendingAttachments.slice();
    pendingAttachments = [];
    renderAttachments();
    if (!content) content = "Please analyze the attached file(s).";
    if (!currentId || !activeChat()) { currentId = id(); chats.unshift({ id: currentId, title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }); }
    const displayContent = content + (attachments.length ? "\n\nAttached files: " + attachments.map(file => file.name).join(", ") : "");
    const chat = activeChat(); chat.messages.push({ role: "user", content: displayContent });
    if (chat.messages.filter(m => m.role === "user").length === 1) chat.title = content.slice(0, 48) + (content.length > 48 ? "…" : "");
    chat.updatedAt = Date.now(); persistChats(); renderMessages(); $("promptInput").value = ""; resizeInput();
    busy = true; $("sendBtn").disabled = true; $("typing").classList.remove("hidden"); $("conversationScroll").scrollTop = $("conversationScroll").scrollHeight;
    try {
      const recent = chat.messages.filter(m => !m.isError).slice(-24).map(m => ({ role: m.role, content: m.content }));
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken }, body: JSON.stringify({ messages: recent, memory: memoryEnabled ? memory : "", attachments: attachments }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "The request failed. Please try again.");
      chat.messages.push({ role: "assistant", content: data.answer }); chat.updatedAt = Date.now(); persistChats(); renderMessages();
    } catch (error) {
      const message = error.message || "Could not reach AdizillaAI.";
      chat.messages.push({ role: "assistant", content: "I couldn't complete that request. " + message, isError: true }); persistChats(); renderMessages();
    } finally {
      busy = false; $("typing").classList.add("hidden"); updateSendState(); $("promptInput").focus();
    }
  }
  function resizeInput() {
    const input = $("promptInput");
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 192) + "px";
    input.style.overflowY = input.scrollHeight > 192 ? "auto" : "hidden";
    updateSendState();
  }
  function updateSendState() {
    const input = $("promptInput"), send = $("sendBtn");
    if (send) send.disabled = !busy && !input.value.trim() && pendingAttachments.length === 0;
  }
  function applyTheme(next = theme) {
    theme = next;
    const effective = next === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : next;
    document.body.classList.toggle("light-mode", effective === "light");
    document.documentElement.dataset.theme = effective;
    $("themeBtn").title = "Theme: " + next + ". Select to change.";
    $("themeBtn").setAttribute("aria-label", "Theme: " + next);
  }
  function updateWelcomeGreeting() {
    const greeting = $("welcomeGreeting");
    if (!greeting) return;
    const name = firebaseUser?.displayName?.trim()?.split(/\s+/)[0];
    const hour = new Date().getHours();
    const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    greeting.textContent = name ? "Good " + period + ", " + name + ". What's on your mind?" : "What's on your mind?";
  }
  function openDialog(id) { const dialog = $(id); if (dialog && !dialog.open) dialog.showModal(); }
  function closeMobile() { $("sidebar").classList.remove("open"); $("scrim").classList.remove("show"); }
  async function checkHealth() {
    const pill = document.querySelector(".provider-pill");
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const failed = !res.ok || !data.provider_configured;
      pill.classList.toggle("hidden", !failed);
      $("providerStatus").textContent = "Reconnecting…";
    } catch {
      pill.classList.remove("hidden");
      $("providerStatus").textContent = "Reconnecting…";
    }
  }
  function setAuthError(message) {
    const error = $("authError");
    error.textContent = message || "";
    error.classList.toggle("hidden", !message);
  }
  function setAuthMode(mode) {
    authMode = mode;
    $("authFormState").classList.toggle("hidden", Boolean(firebaseUser));
    $("authSignedInState").classList.toggle("hidden", !firebaseUser);
    $("authNameWrap").classList.toggle("hidden", mode !== "signup");
    $("authTitle").textContent = mode === "signup" ? "Make it yours." : "Welcome back.";
    $("authEyebrow").textContent = mode === "signup" ? "CREATE YOUR ACCOUNT" : "YOUR WORKSPACE";
    $("authDescription").textContent = mode === "signup" ? "Create an account to start using your personal AI workspace." : "Sign in to continue to your personal AdizillaAI workspace.";
    $("authSubmit").textContent = mode === "signup" ? "Create account" : "Sign in";
    $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $("authSwitchCopy").textContent = mode === "signup" ? "Already have an account?" : "New to AdizillaAI?";
    $("authSwitchBtn").textContent = mode === "signup" ? "Sign in" : "Create account";
    $("resetPasswordBtn").classList.toggle("hidden", mode === "signup");
    $("googleAuthBtn").classList.remove("hidden");
    setAuthError("");
    if (!firebaseReady) setAuthError("Authentication setup is incomplete. The site owner must configure Firebase in the server environment.");
    if (firebaseUser) $("authSignedInEmail").textContent = firebaseUser.email || firebaseUser.displayName || "Signed-in account";
  }
  function renderAccount() {
    const signedIn = Boolean(firebaseUser);
    $("accountActionTitle").textContent = signedIn ? "Account menu" : "Sign in";
    $("profileName").textContent = signedIn ? (firebaseUser.displayName || "Your account") : "Guest";
    $("profileAvatar").textContent = signedIn ? (firebaseUser.displayName || firebaseUser.email || "A").trim().charAt(0).toUpperCase() : "G";
    $("accountBtn").title = signedIn ? "Account menu, settings, upgrade and sign out" : "Sign in or create an account";
    if (signedIn) $("authSignedInEmail").textContent = firebaseUser.email || firebaseUser.displayName || "Signed-in account";
    updateWelcomeGreeting();
    renderSubscriptionStatus();
  }
  function loadRevenueCat() {
    if (!revenueCatModulePromise) revenueCatModulePromise = import("/assets/revenuecat.js");
    return revenueCatModulePromise;
  }
  function renderSubscriptionStatus() {
    const status = $("subscriptionStatus");
    if (!status) return;
    status.textContent = revenueCatStatus.loading ? "Checking plan…" :
      revenueCatStatus.isPro ? "AdizillaAI Pro active" :
      revenueCatStatus.error ? "Subscription status unavailable" :
      firebaseUser ? "Free plan" : "Sign in to manage your plan";
    status.dataset.pro = String(revenueCatStatus.isPro);
  }
  async function refreshRevenueCatStatus(user = firebaseUser) {
    if (!user) {
      revenueCatStatus = { isPro: false, loading: false, error: null };
      document.documentElement.dataset.adizillaPro = "false";
      renderSubscriptionStatus();
      return revenueCatStatus;
    }
    revenueCatStatus = { ...revenueCatStatus, loading: true, error: null };
    renderSubscriptionStatus();
    try {
      const rc = await loadRevenueCat();
      const result = await rc.getSubscriptionStatus(user);
      revenueCatStatus = { isPro: result.isPro, loading: false, error: null };
      document.documentElement.dataset.adizillaPro = String(result.isPro);
      renderSubscriptionStatus();
      return result;
    } catch (error) {
      console.error("RevenueCat status check failed:", error);
      revenueCatStatus = { isPro: false, loading: false, error };
      document.documentElement.dataset.adizillaPro = "false";
      renderSubscriptionStatus();
      return { customerInfo: null, isPro: false, error };
    }
  }
  async function openRevenueCatPaywall() {
    await authInitialization;
    if (!firebaseUser) {
      setAuthMode("signin");
      openDialog("authDialog");
      return;
    }
    const message = $("subscriptionMessage");
    const target = $("revenuecatPaywall");
    const button = $("accountUpgradeBtn");
    if (message) { message.textContent = ""; message.classList.add("hidden"); }
    if (target) target.replaceChildren();
    openDialog("upgradeDialog");
    if (button) button.disabled = true;
    try {
      const rc = await loadRevenueCat();
      const result = await rc.showRevenueCatPaywall(firebaseUser, target);
      revenueCatStatus = { isPro: result.isPro, loading: false, error: null };
      document.documentElement.dataset.adizillaPro = String(result.isPro);
      renderSubscriptionStatus();
      if (message) {
        message.textContent = result.isPro ? "AdizillaAI Pro is active on this account." :
          "Checkout closed. No active Pro entitlement was found.";
        message.classList.remove("hidden");
      }
    } catch (error) {
      console.error("RevenueCat paywall failed:", error);
      if (message) {
        message.textContent = error?.message || "Billing could not be loaded. Check the RevenueCat Web Billing configuration and try again.";
        message.classList.remove("hidden");
      }
    } finally {
      if (button) button.disabled = false;
    }
  }
  function reloadWorkspaceForCurrentUser() {
    chats = read(KEYS.chats, []);
    memory = read(KEYS.memory, "");
    memoryDraft = memory;
    memoryEnabled = read(KEYS.enabled, false);
    currentId = null;
    syncMemoryUI();
    renderHistory();
    renderMessages();
    renderLibrary();
  }
  async function initializeFirebaseAuth() {
    try {
      const response = await fetch("/api/auth/config");
      const config = await response.json();
      if (!response.ok || !config.configured || !config.firebase) {
        firebaseReady = false;
        setAuthError("Authentication setup is incomplete. The site owner must configure Firebase in the server environment.");
        renderAccount();
        return false;
      }
      const appSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
      const authSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
      initializeApp = appSdk.initializeApp;
      getAuth = authSdk.getAuth;
      onAuthStateChanged = authSdk.onAuthStateChanged;
      createUserWithEmailAndPassword = authSdk.createUserWithEmailAndPassword;
      signInWithEmailAndPassword = authSdk.signInWithEmailAndPassword;
      signInWithPopup = authSdk.signInWithPopup;
      GoogleAuthProvider = authSdk.GoogleAuthProvider;
      sendPasswordResetEmail = authSdk.sendPasswordResetEmail;
      signOut = authSdk.signOut;
      updateProfile = authSdk.updateProfile;
      const firebaseApp = initializeApp(config.firebase);
      firebaseAuth = getAuth(firebaseApp);
      firebaseReady = true;
      return await new Promise(resolve => {
        let firstState = true;
        onAuthStateChanged(firebaseAuth, user => {
          const previousUid = firebaseUser?.uid || null;
          firebaseUser = user;
          renderAccount();
          if (previousUid !== (user?.uid || null)) {
            cloudSyncStatus = user ? "Syncing cloud history…" : "Local device";
            refreshRevenueCatStatus(user);
            reloadWorkspaceForCurrentUser();
            if (user) syncCloudChats().catch(() => {
              cloudSyncStatus = "Cloud sync paused";
              renderAccount();
              toast("You are signed in, but cloud history could not sync. Your local conversations are still available.");
            });
          }
          if (firstState) { firstState = false; resolve(true); }
        });
      });
    } catch (error) {
      firebaseReady = false;
      setAuthError("Could not initialize authentication. Check Firebase configuration and authorized domains.");
      renderAccount();
      return false;
    }
  }
  async function showAuthErrorFrom(error) {
    const messages = {
      "auth/email-already-in-use": "That email already has an account. Try signing in instead.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password": "Use a stronger password with at least 8 characters.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/user-not-found": "No account was found for that email.",
      "auth/wrong-password": "Email or password is incorrect.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/unauthorized-domain": "This domain is not authorized in Firebase Authentication settings.",
      "auth/operation-not-allowed": "Enable this sign-in method in Firebase Console → Authentication → Sign-in method.",
      "auth/too-many-requests": "Too many attempts. Wait a little and try again."
    };
    setAuthError(messages[error.code] || error.message || "Authentication failed. Please try again.");
  }
  $("accountBtn").addEventListener("click", async () => {
    await authInitialization;
    if (firebaseUser) openDialog("settingsDialog");
    else { setAuthMode("signin"); openDialog("authDialog"); }
  });
  $("authSwitchBtn").addEventListener("click", () => setAuthMode(authMode === "signup" ? "signin" : "signup"));
  $("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    setAuthError("");
    if (!firebaseReady || !firebaseAuth) {
      setAuthError("Firebase is not configured yet. Add the Firebase Web config and server service-account secret to Vercel.");
      return;
    }
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const button = $("authSubmit");
    button.disabled = true;
    try {
      if (authMode === "signup") {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const displayName = $("authName").value.trim();
        if (displayName) await updateProfile(result.user, { displayName });
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
      $("authDialog").close();
      $("authPassword").value = "";
      toast(authMode === "signup" ? "Your account is ready. Cloud sync will connect your conversation history." : "You're signed in. Your personal workspace is ready.");
    } catch (error) {
      await showAuthErrorFrom(error);
    } finally {
      button.disabled = false;
    }
  });
  $("googleAuthBtn").addEventListener("click", async () => {
    setAuthError("");
    if (!firebaseReady || !firebaseAuth) {
      setAuthError("Firebase is not configured yet. The site owner needs to finish setup.");
      return;
    }
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      $("authDialog").close();
      toast("Signed in with Google. Your personal workspace is ready.");
    } catch (error) {
      await showAuthErrorFrom(error);
    }
  });
  $("resetPasswordBtn").addEventListener("click", async () => {
    setAuthError("");
    if (!firebaseReady || !firebaseAuth) { setAuthError("Firebase is not configured yet."); return; }
    const email = $("authEmail").value.trim();
    if (!email) { setAuthError("Enter your email address above, then tap Forgot password again."); return; }
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setAuthError("Password reset email sent. Check your inbox and spam folder.");
    } catch (error) {
      await showAuthErrorFrom(error);
    }
  });
  $("signOutBtn").addEventListener("click", async () => {
    if (!firebaseAuth) return;
    try {
      await signOut(firebaseAuth);
      $("authDialog").close();
      toast("Signed out. Your account-specific local workspace is kept separate from guest data on this device.");
    } catch (error) {
      await showAuthErrorFrom(error);
    }
  });

  function exportChats() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), chats }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "adizillaai-conversations.json"; a.click(); URL.revokeObjectURL(url);
  }
  document.querySelectorAll("[data-panel]").forEach(btn => btn.addEventListener("click", () => showPanel(btn.dataset.panel)));
  $("newChat").addEventListener("click", newChat);
  const renameBreadcrumb = () => {
    const chat = activeChat();
    if (!chat || !chat.messages?.length) return;
    const title = window.prompt("Rename conversation", chat.title);
    if (title === null) return;
    const next = title.trim().slice(0, 100);
    if (!next) return;
    chat.title = next; chat.updatedAt = Date.now(); persistChats(); renderMessages();
  };
  $("breadcrumbPage").addEventListener("click", renameBreadcrumb);
  $("breadcrumbPage").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); renameBreadcrumb(); } });
  $("chatForm").addEventListener("submit", e => { e.preventDefault(); sendMessage($("promptInput").value); });
  $("promptInput").addEventListener("input", resizeInput);
  $("promptInput").addEventListener("focus", () => $("inputHint").classList.remove("hidden"));
  $("promptInput").addEventListener("blur", () => $("inputHint").classList.add("hidden"));
  $("promptInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("chatForm").requestSubmit(); } });
  document.querySelectorAll("[data-prompt]").forEach(btn => btn.addEventListener("click", () => {
    const input = $("promptInput");
    input.value = btn.dataset.prompt; resizeInput(); input.focus();
    const start = input.value.indexOf("[");
    const end = input.value.indexOf("]", start);
    if (start >= 0 && end > start) input.setSelectionRange(start + 1, end);
  }));
  $("memoryChip").addEventListener("click", () => {
    if (!memory.trim()) { showPanel("memory"); return; }
    const next = !memoryEnabled;
    if (save(KEYS.enabled, next)) { memoryEnabled = next; syncMemoryUI(); }
  });
  $("modelPicker").addEventListener("change", () => {
    const label = $("modelPicker").selectedOptions[0]?.textContent || "Adizilla Fast";
    toast(label + " is a display preset only right now. The configured AI provider remains unchanged.");
  });
  $("memoryText").addEventListener("input", () => { memoryDraft = $("memoryText").value; $("memoryLength").textContent = memoryDraft.length + " / 3000"; });
  $("saveMemory").addEventListener("click", saveMemory);
  $("memoryEnabled").addEventListener("change", () => { const next = $("memoryEnabled").checked; if (save(KEYS.enabled, next)) { memoryEnabled = next; syncMemoryUI(); } else { $("memoryEnabled").checked = memoryEnabled; } });
  $("searchToggle").addEventListener("click", () => { $("searchChats").classList.toggle("hidden"); if (!$("searchChats").classList.contains("hidden")) $("searchChats").focus(); else { $("searchChats").value = ""; renderHistory(); } });
  $("searchChats").addEventListener("input", e => renderHistory(e.target.value));
  $("exportChats").addEventListener("click", exportChats);
  $("themeBtn").addEventListener("click", () => { theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark"; applyTheme(theme); save(KEYS.theme, theme); });
  $("accountUpgradeBtn").addEventListener("click", openRevenueCatPaywall);
  $("settingsSignOut").addEventListener("click", async () => { if (!firebaseAuth) return; try { await signOut(firebaseAuth); $("settingsDialog").close(); toast("You are signed out. Your local conversations remain on this device."); } catch (error) { toast(error.message || "Sign out failed. Please try again."); } });
  $("settingsOpenAuth").addEventListener("click", async () => { $("settingsDialog").close(); await authInitialization; setAuthMode("signin"); openDialog("authDialog"); });
  $("clearChats").addEventListener("click", () => { chats.forEach(chat => markCloudChatDeleted(chat.id)); chats = []; currentId = null; persistChats(); renderMessages(); $("settingsDialog").close(); });
  $("clearMemory").addEventListener("click", () => { if (!save(KEYS.memory, "") || !save(KEYS.enabled, false)) return; memory = ""; memoryDraft = ""; memoryEnabled = false; syncMemoryUI(); $("settingsDialog").close(); toast("Saved memory cleared from this browser."); });
  $("attachInfo").addEventListener("click", () => $("attachmentInput").click());
  $("attachmentInput").addEventListener("change", async event => { await addAttachments(event.target.files); event.target.value = ""; });
  $("createImageBtn").addEventListener("click", async () => {
    await authInitialization;
    if (!firebaseUser) { setAuthMode("signin"); openDialog("authDialog"); return; }
    $("imageError").classList.add("hidden");
    openDialog("imageDialog");
  });
  $("imageForm").addEventListener("submit", async event => {
    event.preventDefault();
    await authInitialization;
    if (!firebaseUser) { setAuthMode("signin"); openDialog("authDialog"); return; }
    const prompt = $("imagePrompt").value.trim();
    if (prompt.length < 3) return;
    const button = $("generateImageSubmit");
    const error = $("imageError");
    const wrap = $("generatedImageWrap");
    button.disabled = true;
    button.textContent = "Creating…";
    error.textContent = "";
    error.classList.add("hidden");
    wrap.classList.add("hidden");
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ prompt: prompt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Image generation failed.");
      $("generatedImage").src = data.image_url;
      $("openGeneratedImage").href = data.image_url;
      $("generatedImageModel").textContent = data.model || "AI-generated";
      wrap.classList.remove("hidden");
    } catch (err) {
      error.textContent = err.message || "Could not generate that image.";
      error.classList.remove("hidden");
    } finally {
      button.disabled = false;
      button.textContent = "Generate image ↗";
    }
  });
  $("openSidebar").addEventListener("click", () => { $("sidebar").classList.add("open"); $("scrim").classList.add("show"); });
  $("closeSidebar").addEventListener("click", closeMobile); $("scrim").addEventListener("click", closeMobile);
  document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => btn.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); }));
  document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); } if ((e.metaKey || e.ctrlKey) && e.key === "1") { e.preventDefault(); showPanel("chat"); } });
  applyTheme(theme); updateWelcomeGreeting();
  const sidebar = $("sidebar");
  sidebar.classList.toggle("collapsed", read("adizilla.sidebar-collapsed.v1", false));
  $("collapseSidebar").addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("collapsed");
    save("adizilla.sidebar-collapsed.v1", collapsed);
    $("collapseSidebar").title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    $("collapseSidebar").setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  });
  $("promptInput").addEventListener("paste", event => { const files = [...(event.clipboardData?.files || [])]; if (files.length) addAttachments(files); });
  $("chatForm").addEventListener("dragover", event => { event.preventDefault(); $("chatForm").classList.add("drag-over"); });
  $("chatForm").addEventListener("dragleave", event => { if (!event.relatedTarget || !$("chatForm").contains(event.relatedTarget)) $("chatForm").classList.remove("drag-over"); });
  $("chatForm").addEventListener("drop", async event => { event.preventDefault(); $("chatForm").classList.remove("drag-over"); if (event.dataTransfer?.files?.length) await addAttachments(event.dataTransfer.files); });
  $("createImageBtn").addEventListener("click", () => $("createImageBtn").setAttribute("aria-pressed", "true"));
  window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (theme === "system") applyTheme("system"); });
  syncMemoryUI(); renderHistory(); renderMessages(); renderLibrary(); updateSendState(); checkHealth();
  authInitialization = initializeFirebaseAuth();
  if (!chats.length) { /* The welcome screen is the intentional first-run state. */ } else { currentId = null; }
})();