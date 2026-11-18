const API_STORAGE_KEY = "care-notes-api-url";
const TOKEN_STORAGE_KEY = "care-notes-token";
const DEFAULT_API_URL = window.CARE_NOTES_API_URL || "http://localhost:5000/api";

const state = {
  apiUrl: localStorage.getItem(API_STORAGE_KEY) || DEFAULT_API_URL,
  token: localStorage.getItem(TOKEN_STORAGE_KEY),
  user: null,
  view: "notes",
  authMode: "login",
  pages: { notes: 1, posts: 1, users: 1, interests: 1, "my-posts": 1 },
  pageSize: 8,
  editingNote: null,
  noticeTimer: null
};

const authView = document.querySelector("#auth-view");
const dashboardView = document.querySelector("#dashboard-view");
const authFormContainer = document.querySelector("#auth-form-container");
const viewContent = document.querySelector("#view-content");
const notice = document.querySelector("#notice");
const apiUrlInput = document.querySelector("#api-url");

apiUrlInput.value = state.apiUrl;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function notify(message, type = "success") {
  clearTimeout(state.noticeTimer);
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  state.noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 4500);
}

function setConnectionStatus(message, connected = false) {
  const status = document.querySelector("#connection-status");
  status.textContent = message;
  status.style.color = connected ? "var(--green)" : "var(--muted)";
}

function normalizeApiUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let response;
  try {
    response = await fetch(`${state.apiUrl}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    setConnectionStatus("API unavailable");
    throw new Error(`Could not connect to ${state.apiUrl}. Check that the backend is running and the API URL is correct.`);
  }

  setConnectionStatus("API connected", true);
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) {
      clearSession();
      showAuthView();
    }
    const details = Array.isArray(data?.details) ? ` ${data.details.join(" ")}` : "";
    throw new Error((data?.message || `Request failed (${response.status}).`) + details);
  }
  return data;
}

function showAuthError(message) {
  const error = document.querySelector("#auth-error");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

function renderAuthForm() {
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    const active = tab.dataset.authMode === state.authMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  if (state.authMode === "register") {
    authFormContainer.innerHTML = `
      <h2 class="form-heading">Create your account</h2>
      <p class="form-subheading">Start with a few details. You can add interests now or later.</p>
      <form id="auth-form">
        <label class="field"><span>Name</span><input name="name" required maxlength="100" autocomplete="name"></label>
        <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>
        <label class="field"><span>Password</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <label class="field"><span>Interests <small>(comma separated, optional)</small></span><input name="interests" placeholder="Gardening, reading"></label>
        <button class="button button-full" type="submit">Create account</button>
        <p id="auth-error" class="auth-error" role="alert" hidden></p>
      </form>`;
  } else {
    authFormContainer.innerHTML = `
      <h2 class="form-heading">Welcome back</h2>
      <p class="form-subheading">Sign in to pick up where you left off.</p>
      <form id="auth-form">
        <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>
        <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="current-password"></label>
        <button class="button button-full" type="submit">Sign in</button>
        <p id="auth-error" class="auth-error" role="alert" hidden></p>
      </form>`;
  }
}

function showAuthView() {
  authView.hidden = false;
  dashboardView.hidden = true;
  document.querySelector("#account-bar").hidden = true;
  setConnectionStatus("API not checked");
  renderAuthForm();
}

function showDashboard() {
  authView.hidden = true;
  dashboardView.hidden = false;
  document.querySelector("#account-bar").hidden = false;
  document.querySelector("#account-name").textContent = state.user.name;
  document.querySelector("#account-role").textContent = state.user.role;
  document.querySelector("#admin-nav").hidden = state.user.role !== "admin";
  void openView("notes");
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function pager(view, pagination) {
  const totalPages = Math.max(1, pagination?.totalPages || 1);
  const page = pagination?.page || 1;
  return `
    <div class="pager">
      <button type="button" data-action="page" data-view="${view}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${page} of ${totalPages} · ${pagination?.total || 0} total</span>
      <button type="button" data-action="page" data-view="${view}" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Next</button>
    </div>`;
}

function pageQuery(view) {
  return `?page=${state.pages[view] || 1}&limit=${state.pageSize}`;
}

function renderPageHeading(title, subtitle, action = "") {
  return `
    <div class="view-heading">
      <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
      ${action}
    </div>`;
}

function renderNoteForm(note = null) {
  const editing = Boolean(note);
  return `
    <div class="panel">
      <h3>${editing ? "Edit this note" : "A new note"}</h3>
      <p class="panel-copy">${editing ? "Update the title or content." : "Save a thought before it wanders off."}</p>
      <form id="note-form" data-id="${editing ? escapeHtml(note._id) : ""}">
        <label class="field"><span>Title</span><input name="title" required maxlength="200" value="${escapeHtml(note?.title || "")}" placeholder="A small idea"></label>
        <label class="field"><span>Content</span><textarea name="content" required maxlength="10000" placeholder="Write it down...">${escapeHtml(note?.content || "")}</textarea></label>
        <button class="button" type="submit">${editing ? "Save changes" : "Save note"}</button>
        ${editing ? '<button class="button button-quiet" type="button" data-action="cancel-edit">Cancel</button>' : ""}
      </form>
    </div>`;
}

function renderNotes(notes, pagination) {
  const cards = notes.map((note) => `
    <article class="item-card">
      <div class="item-top">
        <div><h3>${escapeHtml(note.title)}</h3><span class="item-meta">${state.user.role === "admin" && note.owner ? `By ${escapeHtml(note.owner.name)} · ` : ""}${escapeHtml(formatDate(note.updatedAt || note.createdAt))}</span></div>
        <div class="item-actions">
          <button class="button button-quiet button-small" type="button" data-action="edit-note" data-id="${escapeHtml(note._id)}">Edit</button>
          <button class="button button-danger button-small" type="button" data-action="delete-note" data-id="${escapeHtml(note._id)}">Delete</button>
        </div>
      </div>
      <p>${escapeHtml(note.content)}</p>
    </article>`).join("");
  return `
    ${renderPageHeading(state.user.role === "admin" ? "All notes" : "Your notes", state.user.role === "admin" ? "Review and manage notes across the workspace." : "A little space for everything you want to remember.")}
    <div class="content-grid">
      <div id="note-form-slot">${renderNoteForm(state.editingNote)}</div>
      <div>
        <div class="list-header"><h3>Saved notes</h3><span class="count-label">${pagination.total} total</span></div>
        <div class="item-list">${cards || '<div class="empty-state"><strong>Nothing here just yet</strong>Your saved notes will show up here.</div>'}</div>
        ${pager("notes", pagination)}
      </div>
    </div>`;
}

function renderPostForm() {
  return `
    <div class="panel">
      <h3>Share a thought</h3>
      <p class="panel-copy">Create a post for the community feed.</p>
      <form id="post-form">
        <label class="field"><span>Post</span><textarea name="content" required maxlength="5000" placeholder="What would you like to share?"></textarea></label>
        <button class="button" type="submit">Publish post</button>
      </form>
    </div>`;
}

function renderPosts(posts, pagination, view = "posts") {
  const cards = posts.map((post) => `
    <article class="item-card">
      <div class="item-top"><div><h3>${escapeHtml(view === "my-posts" ? state.user.name : post.author?.name || "Community member")}</h3><span class="item-meta">${escapeHtml(formatDate(post.createdAt))}</span></div></div>
      <p>${escapeHtml(post.content)}</p>
    </article>`).join("");
  return `
    ${renderPageHeading(view === "my-posts" ? "My posts" : "Community posts", view === "my-posts" ? "Posts you have shared with the community." : "Ideas and updates shared by the community.")}
    <div class="content-grid">
      ${view === "my-posts" ? '<div class="panel"><h3>Your posts</h3><p class="panel-copy">Posts you publish appear in the community feed and here.</p></div>' : renderPostForm()}
      <div>
        <div class="list-header"><h3>${view === "my-posts" ? "Your posts" : "Latest posts"}</h3><span class="count-label">${pagination.total} total</span></div>
        <div class="item-list">${cards || '<div class="empty-state"><strong>No posts yet</strong>When there are posts, you will find them here.</div>'}</div>
        ${pager(view, pagination)}
      </div>
    </div>`;
}

function renderUsers(users, pagination) {
  const rows = users.map((user) => `
    <tr>
      <td><span class="user-name">${escapeHtml(user.name)}</span><br><span class="user-email">${escapeHtml(user.email)}</span></td>
      <td><span class="role-badge">${escapeHtml(user.role)}</span></td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
      <td><div class="table-actions">
        <button class="button button-outline button-small" type="button" data-action="user-posts" data-id="${escapeHtml(user._id)}">Posts</button>
        ${user._id === state.user._id ? "" : `<button class="button button-quiet button-small" type="button" data-action="toggle-role" data-id="${escapeHtml(user._id)}" data-role="${user.role === "admin" ? "user" : "admin"}">${user.role === "admin" ? "Demote" : "Make admin"}</button>
        <button class="button button-danger button-small" type="button" data-action="delete-user" data-id="${escapeHtml(user._id)}">Remove</button>`}
      </div></td>
    </tr>`).join("");

  return `
    ${renderPageHeading("Manage users", "Create accounts, manage roles, or view a member's posts.")}
    <div class="content-grid">
      <div class="panel">
        <h3>Add a user</h3><p class="panel-copy">New accounts receive the role selected below.</p>
        <form id="user-form">
          <label class="field"><span>Name</span><input name="name" required maxlength="100"></label>
          <label class="field"><span>Email</span><input name="email" type="email" required></label>
          <label class="field"><span>Temporary password</span><input name="password" type="password" required minlength="8"></label>
          <label class="field"><span>Role</span><select name="role"><option value="user">User</option><option value="admin">Admin</option></select></label>
          <label class="field"><span>Interests <small>(comma separated)</small></span><input name="interests" placeholder="Music, hiking"></label>
          <button class="button" type="submit">Create account</button>
        </form>
      </div>
      <div>
        <div class="list-header"><h3>Workspace members</h3><span class="count-label">${pagination.total} total</span></div>
        <div class="table-wrap">
          <table><thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">No users found.</td></tr>'}</tbody>
          </table>
        </div>
        ${pager("users", pagination)}
      </div>
    </div>`;
}

function renderInterests(groups, pagination) {
  const cards = groups.map((group) => `
    <article class="interest-card">
      <div class="interest-title"><span>${escapeHtml(group._id)}</span><span class="interest-count">${group.users.length} ${group.users.length === 1 ? "member" : "members"}</span></div>
      <div class="interest-users">${group.users.map((user) => `<span class="interest-user">${escapeHtml(user.name)} · ${escapeHtml(user.email)}</span>`).join("")}</div>
    </article>`).join("");
  return `
    ${renderPageHeading("Interests", "See which interests are shared across your members.")}
    <div class="list-header"><h3>Grouped interests</h3><span class="count-label">${pagination.total} groups</span></div>
    <div class="group-list">${cards || '<div class="empty-state"><strong>No interests yet</strong>Interests appear when members add them to their profiles.</div>'}</div>
    ${pager("interests", pagination)}`;
}

async function openView(view, options = {}) {
  state.view = view;
  if (!options.keepPage) state.pages[view] = 1;
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view || (view.startsWith("user-posts:") && button.dataset.view === "users"));
  });
  viewContent.innerHTML = '<div class="loading">Loading your workspace…</div>';

  try {
    if (view === "notes") {
      const data = await api(`/notes${pageQuery(view)}`);
      viewContent.innerHTML = renderNotes(data.notes, data.pagination);
    } else if (view === "posts") {
      const data = await api(`/posts${pageQuery(view)}`);
      viewContent.innerHTML = renderPosts(data.posts, data.pagination);
    } else if (view === "my-posts") {
      const data = await api(`/users/${encodeURIComponent(state.user._id)}/posts${pageQuery(view)}`);
      viewContent.innerHTML = renderPosts(data.posts, data.pagination, "my-posts");
    } else if (view === "users" && state.user.role === "admin") {
      const data = await api(`/users${pageQuery(view)}`);
      viewContent.innerHTML = renderUsers(data.users, data.pagination);
    } else if (view === "interests" && state.user.role === "admin") {
      const data = await api(`/users/interests/group${pageQuery(view)}`);
      viewContent.innerHTML = renderInterests(data.groups, data.pagination);
    } else if (view.startsWith("user-posts:") && state.user.role === "admin") {
      const userId = view.slice("user-posts:".length);
      const data = await api(`/users/${encodeURIComponent(userId)}/posts${pageQuery(view)}`);
      const cards = data.posts.map((post) => `
        <article class="item-card">
          <div class="item-top"><h3>${escapeHtml(data.user.name)}</h3><span class="item-meta">${escapeHtml(formatDate(post.createdAt))}</span></div>
          <p>${escapeHtml(post.content)}</p>
        </article>`).join("");
      viewContent.innerHTML = `
        ${renderPageHeading(`${data.user.name}'s posts`, "Posts shared by this workspace member.", '<button class="button button-outline button-small" type="button" data-action="back-users">← Back to users</button>')}
        <div class="item-list">${cards || '<div class="empty-state"><strong>No posts yet</strong>This member has not shared a post.</div>'}</div>
        ${pager(view, data.pagination)}`;
    } else {
      await openView("notes");
    }
  } catch (error) {
    viewContent.innerHTML = `<div class="empty-state"><strong>Could not load this view</strong>${escapeHtml(error.message)}</div>`;
  }
}

async function signInOrRegister(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const values = new FormData(form);
    const payload = Object.fromEntries(values.entries());
    const path = state.authMode === "register" ? "/auth/register" : "/auth/login";
    if (state.authMode === "register") {
      payload.interests = payload.interests.split(",").map((item) => item.trim()).filter(Boolean);
    }
    const result = await api(path, { method: "POST", body: payload });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
    showDashboard();
  } catch (error) {
    showAuthError(error.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleContentSubmit(form) {
  const values = new FormData(form);
  const data = Object.fromEntries(values.entries());
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    if (form.id === "note-form") {
      const id = form.dataset.id;
      await api(id ? `/notes/${encodeURIComponent(id)}` : "/notes", {
        method: id ? "PATCH" : "POST",
        body: data
      });
      state.editingNote = null;
      notify(id ? "Note updated." : "Note saved.");
    } else if (form.id === "post-form") {
      await api("/posts", { method: "POST", body: data });
      notify("Your post is live.");
    } else if (form.id === "user-form") {
      data.interests = data.interests.split(",").map((item) => item.trim()).filter(Boolean);
      await api("/users", { method: "POST", body: data });
      notify("User account created.");
    }
    await openView(state.view, { keepPage: true });
  } catch (error) {
    notify(error.message, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

document.querySelectorAll(".auth-tab").forEach((button) => {
  button.addEventListener("click", () => {
    state.authMode = button.dataset.authMode;
    renderAuthForm();
  });
});

authFormContainer.addEventListener("submit", (event) => {
  if (event.target.id !== "auth-form") return;
  event.preventDefault();
  void signInOrRegister(event.target);
});

apiUrlInput.addEventListener("change", () => {
  state.apiUrl = normalizeApiUrl(apiUrlInput.value) || DEFAULT_API_URL;
  apiUrlInput.value = state.apiUrl;
  localStorage.setItem(API_STORAGE_KEY, state.apiUrl);
});

document.querySelector("#main-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) void openView(button.dataset.view);
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  clearSession();
  showAuthView();
});

viewContent.addEventListener("submit", (event) => {
  if (["note-form", "post-form", "user-form"].includes(event.target.id)) {
    event.preventDefault();
    void handleContentSubmit(event.target);
  }
});

viewContent.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "page") {
    const nextPage = Number(button.dataset.page);
    if (nextPage < 1) return;
    state.pages[button.dataset.view] = nextPage;
    await openView(button.dataset.view, { keepPage: true });
    return;
  }

  if (action === "cancel-edit") {
    state.editingNote = null;
    await openView("notes", { keepPage: true });
    return;
  }

  try {
    if (action === "delete-note") {
      if (!window.confirm("Delete this note? This cannot be undone.")) return;
      await api(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
      notify("Note deleted.");
      if (state.editingNote?._id === id) state.editingNote = null;
      await openView("notes", { keepPage: true });
    } else if (action === "edit-note") {
      const result = await api(`/notes/${encodeURIComponent(id)}`);
      state.editingNote = result.note;
      await openView("notes", { keepPage: true });
    } else if (action === "delete-user") {
      if (!window.confirm("Remove this account? This cannot be undone.")) return;
      await api(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      notify("User removed.");
      await openView("users", { keepPage: true });
    } else if (action === "toggle-role") {
      const role = button.dataset.role;
      await api(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { role } });
      notify(`User role changed to ${role}.`);
      await openView("users", { keepPage: true });
    } else if (action === "user-posts") {
      const view = `user-posts:${id}`;
      state.pages[view] = 1;
      await openView(view);
    } else if (action === "back-users") {
      await openView("users", { keepPage: true });
    }
  } catch (error) {
    notify(error.message, "error");
  }
});

async function initialize() {
  renderAuthForm();
  if (!state.token) {
    showAuthView();
    return;
  }

  try {
    const data = await api("/users/me");
    state.user = data.user;
    showDashboard();
  } catch {
    clearSession();
    showAuthView();
  }
}

void initialize();
