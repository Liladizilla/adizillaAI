(() => {
  const $ = (id) => document.getElementById(id);
  const KEYS = { chats: "adizilla.chats.v1", memory: "adizilla.memory.v1", enabled: "adizilla.memory-enabled.v1", theme: "adizilla.theme.v1" };
  let chats = read(KEYS.chats, []);
  let memory = read(KEYS.memory, "");
  let memoryEnabled = read(KEYS.enabled, false);
  let currentId = null;
  let busy = false;
  let theme = read(KEYS.theme, "dark");
  const panels = { chat: $("chatPanel"), memory: $("memoryPanel"), library: $("libraryPanel") };
  function read(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast("Browser storage is full. Export your chats and clear older conversations."); } }
  function id() { return globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2); }
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function toast(message) { $("infoTitle").textContent = "Just so you know"; $("infoText").textContent = message; $("infoDialog").showModal(); }
  function activeChat() { return chats.find(c => c.id === currentId); }
  function persistChats() { save(KEYS.chats, chats); renderHistory(); renderLibrary(); }
  function newChat() {
    currentId = id();
    chats.unshift({ id: currentId, title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
    chats = chats.slice(0, 100);
    persistChats(); renderMessages(); showPanel("chat"); $("promptInput").focus(); closeMobile();
  }
  function showPanel(name) {
    Object.entries(panels).forEach(([key, panel]) => { panel.classList.toggle("active-panel", key === name); panel.classList.toggle("hidden", key !== name); });
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.panel === name));
    $("breadcrumbPage").textContent = name.charAt(0).toUpperCase() + name.slice(1);
    if (name === "memory") syncMemoryUI();
    if (name === "library") renderLibrary();
    closeMobile();
  }
  function renderHistory(filter = "") {
    const list = $("chatList"); list.replaceChildren();
    const filtered = chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));
    $("emptyHistory").classList.toggle("hidden", filtered.length > 0);
    $("emptyHistory").textContent = filter ? "No matching conversations." : "Your conversations will appear here.";
    $("chatCount").textContent = String(chats.length);
    filtered.forEach(chat => {
      const row = document.createElement("div"); row.className = "history-item" + (chat.id === currentId ? " selected" : "");
      const open = document.createElement("button"); open.className = "history-title"; open.textContent = chat.title; open.title = chat.title; open.addEventListener("click", () => openChat(chat.id));
      const del = document.createElement("button"); del.className = "history-delete"; del.textContent = "×"; del.title = "Delete conversation"; del.setAttribute("aria-label", "Delete " + chat.title);
      del.addEventListener("click", (event) => { event.stopPropagation(); chats = chats.filter(c => c.id !== chat.id); if (currentId === chat.id) currentId = null; persistChats(); renderMessages(); });
      row.append(open, del); list.append(row);
    });
  }
  function openChat(chatId) { currentId = chatId; renderHistory(); renderMessages(); showPanel("chat"); }
  function renderMessages() {
    const chat = activeChat(); const messages = $("messages"); messages.replaceChildren();
    const empty = !chat || !chat.messages.length; $("welcome").classList.toggle("hidden", !empty);
    if (chat) chat.messages.forEach((message, index) => messages.append(makeMessage(message, index)));
    $("conversationScroll").scrollTop = $("conversationScroll").scrollHeight;
  }
  function renderText(content) {
    // Safe lightweight formatting: escape HTML first, then support paragraphs, inline code and fenced code.
    let text = escapeHTML(content);
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => "<pre><code>" + code.trim() + "</code></pre>");
    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    return text.split(/\n{2,}/).map(block => block.startsWith("<pre>") ? block : "<p>" + block.replace(/\n/g, "<br>") + "</p>").join("");
  }
  function makeMessage(message, index) {
    const row = document.createElement("article"); row.className = "message " + message.role;
    if (message.role === "assistant") {
      const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = "✳";
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
    $("memoryText").value = memory; $("memoryEnabled").checked = memoryEnabled; $("memoryLength").textContent = memory.length + " / 3000";
    $("memoryCount").textContent = memory.trim() ? "1" : "0"; $("memoryChipText").textContent = memoryEnabled && memory.trim() ? "Memory on" : "Memory off";
    $("memoryChip").style.color = memoryEnabled && memory.trim() ? "#cbb8ff" : "";
  }
  function saveMemory() {
    memory = $("memoryText").value.slice(0, 3000); memoryEnabled = $("memoryEnabled").checked;
    save(KEYS.memory, memory); save(KEYS.enabled, memoryEnabled); syncMemoryUI();
    $("infoTitle").textContent = "Memory updated"; $("infoText").textContent = memoryEnabled ? "Your approved memory is saved on this device and will be included in future chat requests." : "Memory is saved locally but will not be sent with chat requests while disabled."; $("infoDialog").showModal();
  }
  async function sendMessage(content) {
    content = content.trim(); if (!content || busy) return;
    if (!currentId || !activeChat()) { currentId = id(); chats.unshift({ id: currentId, title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }); }
    const chat = activeChat(); chat.messages.push({ role: "user", content });
    if (chat.messages.filter(m => m.role === "user").length === 1) chat.title = content.slice(0, 48) + (content.length > 48 ? "…" : "");
    chat.updatedAt = Date.now(); persistChats(); renderMessages(); $("promptInput").value = ""; resizeInput();
    busy = true; $("sendBtn").disabled = true; $("typing").classList.remove("hidden"); $("conversationScroll").scrollTop = $("conversationScroll").scrollHeight;
    try {
      const recent = chat.messages.slice(-24).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: recent, memory: memoryEnabled ? memory : "" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "The request failed. Please try again.");
      chat.messages.push({ role: "assistant", content: data.answer }); chat.updatedAt = Date.now(); persistChats(); renderMessages();
    } catch (error) {
      const message = error.message || "Could not reach AdizillaAI.";
      chat.messages.push({ role: "assistant", content: "I couldn't complete that request. " + message }); persistChats(); renderMessages();
    } finally {
      busy = false; $("sendBtn").disabled = false; $("typing").classList.add("hidden"); $("promptInput").focus();
    }
  }
  function resizeInput() { const input = $("promptInput"); input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 180) + "px"; }
  function openDialog(id) { const dialog = $(id); if (dialog && !dialog.open) dialog.showModal(); }
  function closeMobile() { $("sidebar").classList.remove("open"); $("scrim").classList.remove("show"); }
  async function checkHealth() {
    try { const res = await fetch("/api/health"); const data = await res.json(); const pill = document.querySelector(".provider-pill"); pill.classList.toggle("online", data.provider_configured); pill.classList.toggle("offline", !data.provider_configured); $("providerStatus").textContent = data.provider_configured ? (data.provider || "AI") + " ready" : "API key needed"; }
    catch { document.querySelector(".provider-pill").classList.add("offline"); $("providerStatus").textContent = "Backend unavailable"; }
  }
  function exportChats() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), chats }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "adizillaai-conversations.json"; a.click(); URL.revokeObjectURL(url);
  }
  document.querySelectorAll("[data-panel]").forEach(btn => btn.addEventListener("click", () => showPanel(btn.dataset.panel)));
  $("newChat").addEventListener("click", newChat);
  $("chatForm").addEventListener("submit", e => { e.preventDefault(); sendMessage($("promptInput").value); });
  $("promptInput").addEventListener("input", resizeInput);
  $("promptInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("chatForm").requestSubmit(); } });
  document.querySelectorAll("[data-prompt]").forEach(btn => btn.addEventListener("click", () => { $("promptInput").value = btn.dataset.prompt; resizeInput(); $("promptInput").focus(); }));
  $("memoryChip").addEventListener("click", () => showPanel("memory"));
  $("memoryText").addEventListener("input", () => { $("memoryLength").textContent = $("memoryText").value.length + " / 3000"; });
  $("saveMemory").addEventListener("click", saveMemory);
  $("memoryEnabled").addEventListener("change", () => { memoryEnabled = $("memoryEnabled").checked; save(KEYS.enabled, memoryEnabled); syncMemoryUI(); });
  $("searchToggle").addEventListener("click", () => { $("searchChats").classList.toggle("hidden"); if (!$("searchChats").classList.contains("hidden")) $("searchChats").focus(); else { $("searchChats").value = ""; renderHistory(); } });
  $("searchChats").addEventListener("input", e => renderHistory(e.target.value));
  $("exportChats").addEventListener("click", exportChats);
  $("themeBtn").addEventListener("click", () => { theme = theme === "dark" ? "light" : "dark"; document.body.classList.toggle("light-mode", theme === "light"); save(KEYS.theme, theme); });
  $("upgradeSide").addEventListener("click", () => openDialog("upgradeDialog")); $("upgradeTop").addEventListener("click", () => openDialog("upgradeDialog"));
  $("notifyUpgrade").addEventListener("click", () => { $("upgradeDialog").close(); toast("Launch notifications are not connected yet. Premium billing and account infrastructure must be added before sign-ups can be collected."); });
  $("settingsBtn").addEventListener("click", () => openDialog("settingsDialog"));
  $("clearChats").addEventListener("click", () => { chats = []; currentId = null; persistChats(); renderMessages(); $("settingsDialog").close(); });
  $("clearMemory").addEventListener("click", () => { memory = ""; memoryEnabled = false; save(KEYS.memory, memory); save(KEYS.enabled, false); syncMemoryUI(); $("settingsDialog").close(); toast("Saved memory cleared from this browser."); });
  $("attachInfo").addEventListener("click", () => toast("File attachments are on the roadmap. The current chat endpoint accepts text only."));
  $("openSidebar").addEventListener("click", () => { $("sidebar").classList.add("open"); $("scrim").classList.add("show"); });
  $("closeSidebar").addEventListener("click", closeMobile); $("scrim").addEventListener("click", closeMobile);
  document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => btn.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); }));
  document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); newChat(); } if ((e.metaKey || e.ctrlKey) && e.key === "1") { e.preventDefault(); showPanel("chat"); } });
  document.body.classList.toggle("light-mode", theme === "light");
  syncMemoryUI(); renderHistory(); renderMessages(); renderLibrary(); checkHealth();
  if (!chats.length) { /* The welcome screen is the intentional first-run state. */ } else { currentId = null; }
})();