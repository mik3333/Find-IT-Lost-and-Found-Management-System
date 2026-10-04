const app = document.getElementById("app");
const nav = document.getElementById("nav");
const logoutBtn = document.getElementById("logout-btn");
const navToggle = document.getElementById("nav-toggle");

let currentUser = null;
let categories = [];

navToggle.addEventListener("click", () => nav.classList.toggle("open"));
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  currentUser = null;
  location.hash = "#/login";
  await boot();
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function setNav() {
  document.querySelectorAll("[data-auth]").forEach((el) => {
    el.style.display = currentUser ? "" : "none";
  });
  document.querySelectorAll("[data-guest]").forEach((el) => {
    el.style.display = currentUser ? "none" : "";
  });
  document.querySelectorAll("[data-admin]").forEach((el) => {
    el.style.display = currentUser?.role === "admin" ? "" : "none";
  });
  const avatar = document.getElementById("nav-avatar");
  avatar.src = currentUser?.profilePicture || "";
  avatar.style.display = currentUser?.profilePicture ? "" : "none";
  const path = location.hash.replace("#", "") || "/";
  nav.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href").replace("#", "");
    link.classList.toggle(
      "active",
      href === path ||
        (href === "/" && path === "/") ||
        (href.startsWith("/admin/") && (path === "/admin" || path.startsWith("/admin/")))
    );
  });
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function thumb(item) {
  if (item.imagePath) {
    return `<div class="thumb" style="background-image:url('${escapeHtml(item.imagePath)}')"></div>`;
  }
  return `<div class="thumb">No photo</div>`;
}

function itemCard(item) {
  return `
    <a class="card" href="#/item/${item.id}">
      ${thumb(item)}
      <div class="card-body">
        <div>
          <span class="badge ${item.reportType}">${item.reportType}</span>
          <span class="badge">${escapeHtml(item.status)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="muted">${escapeHtml(item.category)} · ${escapeHtml(item.location)}</p>
        <div class="card-author">
          ${
            item.owner.profilePicture
              ? `<img class="card-avatar" src="${escapeHtml(item.owner.profilePicture)}" alt="" />`
              : `<span class="card-avatar card-avatar--empty"></span>`
          }
          <span>${escapeHtml(item.owner.username)}</span>
          ${item.owner.role === "admin" ? `<span class="role-badge">Admin</span>` : ""}
        </div>
      </div>
    </a>
  `;
}

function notice(message, ok = false) {
  return message ? `<div class="notice ${ok ? "success" : ""}">${escapeHtml(message)}</div>` : "";
}

async function renderHome() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const reportType = params.get("type") || "";
  const sort = params.get("sort") || "latest";
  const requestedPage = Number.parseInt(params.get("page") || "1", 10);
  const data = await api(
    `/api/items?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&reportType=${encodeURIComponent(reportType)}&sort=${encodeURIComponent(sort)}`
  );
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(data.items.length / pageSize));
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const pageItems = data.items.slice((page - 1) * pageSize, page * pageSize);

  const topicList = data.items.slice(0, 8).map((item, index) => {
    const letter = item.title.trim().charAt(0)?.toUpperCase() || "T";
    const tone = ["blue", "orange", "red", "green", "purple", "gold", "gray", "violet"][index % 8];
    return `
      <li class="topic-item">
        <a class="topic-link" href="#/item/${item.id}">
          ${
            item.owner.profilePicture
              ? `<img class="topic-badge topic-avatar" src="${escapeHtml(item.owner.profilePicture)}" alt="" />`
              : `<span class="topic-badge ${tone}">${escapeHtml(letter)}</span>`
          }
          <span class="topic-text">${escapeHtml(item.title)}</span>
        </a>
      </li>
    `;
  }).join("");
  const pageQuery = new URLSearchParams(params);
  const pageLink = (target, label, active = false, disabled = false) => {
    pageQuery.set("page", String(target));
    return `<a class="page-number${active ? " active" : ""}${disabled ? " disabled" : ""}" href="#/?${pageQuery.toString()}"${active ? ' aria-current="page"' : ""}${disabled ? ' aria-disabled="true"' : ""}>${label}</a>`;
  };
  const pagination = pageCount === 1
    ? pageLink(1, 1, true)
    : `${pageLink(page - 1, "Previous", false, page === 1)}${Array.from({ length: pageCount }, (_, index) => pageLink(index + 1, index + 1, index + 1 === page)).join("")}${pageLink(page + 1, "Next", false, page === pageCount)}`;

  app.innerHTML = `
    <section class="forum-layout">
      <div class="forum-feed">
        <div class="forum-controls">
          <div class="page-numbers">
            ${pagination}
          </div>
          <a class="forum-post-btn" href="#/post">Post a thread</a>
        </div>

        <form class="forum-filters" id="filter-form">
          <input name="q" type="search" value="${escapeHtml(q)}" placeholder="Search..." />
          <select name="category">
            <option value="">All types</option>
            ${categories.map((c) => `<option value="${escapeHtml(c)}" ${c === category ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>
          <select name="type">
            <option value="">Lost & found</option>
            <option value="lost" ${reportType === "lost" ? "selected" : ""}>Lost</option>
            <option value="found" ${reportType === "found" ? "selected" : ""}>Found</option>
          </select>
          <select name="sort">
            <option value="latest" ${sort === "latest" ? "selected" : ""}>Latest</option>
            <option value="oldest" ${sort === "oldest" ? "selected" : ""}>Oldest</option>
            <option value="az" ${sort === "az" ? "selected" : ""}>A–Z</option>
            <option value="za" ${sort === "za" ? "selected" : ""}>Z–A</option>
          </select>
        </form>

        <div class="grid">
          ${pageItems.length ? pageItems.map(itemCard).join("") : `<div class="empty">No reports match these filters.</div>`}
        </div>
      </div>

      <aside class="forum-sidebar">
        <h3>New Topics</h3>
        <ul class="topic-list">
          ${topicList || "<li class='topic-item subtle'>No recent topics</li>"}
        </ul>
      </aside>
    </section>
  `;

  const filterForm = document.getElementById("filter-form");
  if (filterForm) {
    const applyFilters = () => {
      const form = new FormData(filterForm);
      const next = new URLSearchParams();
      for (const [key, value] of form.entries()) {
        if (value) next.set(key, value);
      }
      location.hash = `#/?${next.toString()}`;
    };
    filterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      applyFilters();
    });
    filterForm.querySelector('input[name="q"]').addEventListener("change", applyFilters);
    filterForm.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", applyFilters);
    });
  }
}

function authForm(mode, message = "") {
  const isLogin = mode === "login";
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">${isLogin ? "Welcome back" : "Create account"}</p>
      <h1>${isLogin ? "Log in" : "Register"}</h1>
      ${notice(message)}
      <form class="form" id="auth-form">
        <input name="email" type="email" required placeholder="Email" />
        ${isLogin ? "" : `<input name="username" required minlength="3" maxlength="24" placeholder="Public username" />`}
        <input name="password" type="password" required minlength="8" placeholder="Password" />
        <button class="btn" type="submit">${isLogin ? "Log in" : "Create account"}</button>
        <p class="muted">${
          isLogin
            ? `Need an account? <a href="#/register">Register</a>`
            : `Already registered? <a href="#/login">Log in</a>`
        }</p>
      </form>
    </section>
  `;

  document.getElementById("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      const data = await api(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      currentUser = data.user;
      location.hash = "#/";
      await boot();
    } catch (error) {
      authForm(mode, error.message);
    }
  });
}

function requireUser() {
  if (currentUser) return true;
  authForm("login", "Please log in to continue.");
  return false;
}

async function renderPost(message = "", ok = false) {
  if (!requireUser()) return;
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">New report</p>
      <h1>Post a thread</h1>
      ${notice(message, ok)}
      <form class="form wide" id="post-form">
        <div class="split">
          <select name="reportType" required>
            <option value="lost">Lost item</option>
            <option value="found">Found item</option>
          </select>
          <select name="category" required>
            ${categories.map((c) => `<option>${escapeHtml(c)}</option>`).join("")}
          </select>
        </div>
        <input name="title" required maxlength="80" placeholder="Thread title" />
        <textarea name="description" required minlength="10" placeholder="Describe the item, marks, color, and when you last saw it."></textarea>
        <div class="split">
          <input name="location" required placeholder="Location" />
          <input name="incidentDate" type="date" required />
        </div>
        <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        <button class="btn" type="submit">Publish thread</button>
      </form>
    </section>
  `;

  document.getElementById("post-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("/api/items", { method: "POST", body: new FormData(event.target) });
      location.hash = `#/item/${data.item.id}`;
    } catch (error) {
      renderPost(error.message);
    }
  });
}

async function renderItem(id) {
  const data = await api(`/api/items/${id}`);
  const item = data.item;
  const canClaim = currentUser && !item.isOwner && item.status !== "returned" && item.status !== "closed";
  app.innerHTML = `
    <article class="item-hero">
      ${
        item.imagePath
          ? `<img src="${escapeHtml(item.imagePath)}" alt="${escapeHtml(item.title)}" />`
          : `<div class="placeholder-art">No photo attached</div>`
      }
      <div class="item-copy">
        <div class="item-byline">
          <p class="eyebrow">${escapeHtml(item.owner.username)} · uploaded ${escapeHtml(formatDate(item.createdAt))}</p>
          ${item.owner.role === "admin" ? `<span class="role-badge">Admin</span>` : ""}
        </div>
        <h1>${escapeHtml(item.title)}</h1>
        <div>
          <span class="badge ${item.reportType}">${item.reportType}</span>
          <span class="badge">${escapeHtml(item.category)}</span>
          <span class="badge">${escapeHtml(item.status)}</span>
        </div>
        <p>${escapeHtml(item.description)}</p>
        <p class="muted">Last seen / found at ${escapeHtml(item.location)} on ${escapeHtml(item.incidentDate)}.</p>
        ${
          currentUser?.role === "admin"
            ? `<form class="actions" id="status-form">
                <select name="status">${["reported", "claimed", "returned", "closed"]
                  .map((s) => `<option ${s === item.status ? "selected" : ""}>${s}</option>`)
                  .join("")}</select>
                <button class="btn" type="submit">Update status</button>
              </form>`
            : ""
        }
        ${
          canClaim
            ? `<form class="form" id="claim-form" style="margin-top:18px">
                <textarea name="message" required minlength="10" placeholder="Explain why this item belongs to you. Include unique details."></textarea>
                <label class="field-label" for="claim-proof">Attach an image as proof (optional)</label>
                <input id="claim-proof" name="proof" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
                <button class="btn" type="submit">Submit claim request</button>
              </form>`
            : ""
        }
      </div>
    </article>
    ${
      data.claims.length
        ? `<section class="panel" style="margin-top:16px">
            <h2>Claims</h2>
            <div class="list">
              ${data.claims
                .map(
                  (c) => `<div class="row">
                    <div>
                      <strong>${escapeHtml(c.username)}</strong>
                      ${c.role === "admin" ? `<span class="role-badge">Admin</span>` : ""}
                      <p>${escapeHtml(c.message)}</p>
                      ${c.imagePath ? `<a class="evidence-link" href="${escapeHtml(c.imagePath)}" target="_blank" rel="noopener">View attached proof</a>` : ""}
                      ${c.adminNote ? `<p class="muted">Admin: ${escapeHtml(c.adminNote)}</p>` : ""}
                    </div>
                    <span class="badge">${escapeHtml(c.status)}</span>
                  </div>`
                )
                .join("")}
            </div>
          </section>`
        : ""
    }
  `;

  const statusForm = document.getElementById("status-form");
  if (statusForm) {
    statusForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = new FormData(event.target).get("status");
      await api(`/api/items/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      renderItem(id);
    });
  }

  const claimForm = document.getElementById("claim-form");
  if (claimForm) {
    claimForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api(`/api/items/${id}/claims`, {
          method: "POST",
          body: new FormData(event.target)
        });
        renderItem(id);
      } catch (error) {
        alert(error.message);
      }
    });
  }
}

async function renderProfile(message = "", ok = false) {
  if (!requireUser()) return;
  const claims = await api("/api/me/claims");
  const picture = currentUser.profilePicture || "";
  app.innerHTML = `
    <section class="panel">
      <div class="profile-head">
        ${
          picture
            ? `<img class="avatar" src="${escapeHtml(picture)}" alt="" />`
            : `<div class="avatar"></div>`
        }
        <div>
          <p class="eyebrow">${escapeHtml(currentUser.role)}</p>
          <h1>${escapeHtml(currentUser.username)}</h1>
          <p class="muted">${escapeHtml(currentUser.email)}</p>
        </div>
      </div>
      ${notice(message, ok)}
      <div class="split">
        <form class="form" id="profile-form">
          <h2>Public profile</h2>
          <input name="username" value="${escapeHtml(currentUser.username)}" minlength="3" maxlength="24" required />
          <input name="profilePicture" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          <button class="btn" type="submit">Save profile</button>
        </form>
        <form class="form" id="password-form">
          <h2>Change password</h2>
          <input name="currentPassword" type="password" required placeholder="Current password" />
          <input name="newPassword" type="password" required minlength="8" placeholder="New password" />
          <button class="btn secondary" type="submit">Update password</button>
        </form>
      </div>
      <h2 style="margin-top:28px">Your claim requests</h2>
      <div class="list">
        ${
          claims.claims.length
            ? claims.claims
                .map(
                  (c) => `<a class="row" href="#/item/${c.itemId}">
                    <div>
                      <strong>${escapeHtml(c.title)}</strong>
                      <p class="muted">${escapeHtml(c.status)}${c.adminNote ? " · " + escapeHtml(c.adminNote) : ""}</p>
                    </div>
                  </a>`
                )
                .join("")
            : `<p class="muted">You have not submitted any claims yet.</p>`
        }
      </div>
    </section>
  `;

  document.getElementById("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("/api/auth/profile", { method: "PUT", body: new FormData(event.target) });
      currentUser = data.user;
      setNav();
      renderProfile("Profile updated.", true);
    } catch (error) {
      renderProfile(error.message);
    }
  });

  document.getElementById("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      renderProfile("Password updated. Only the hashed value is stored.", true);
    } catch (error) {
      renderProfile(error.message);
    }
  });
}

async function renderAdmin(section = "overview") {
  if (!currentUser || currentUser.role !== "admin") {
    app.innerHTML = `<section class="panel">${notice("Admin access required.")}</section>`;
    return;
  }
  const sections = {
    overview: "Overview",
    claims: "Pending claims",
    accounts: "Accounts",
    threads: "Threads",
    archive: "Archive"
  };
  if (!Object.hasOwn(sections, section)) section = "overview";

  app.innerHTML = `<section class="panel admin-loading" role="status">Loading admin dashboard...</section>`;
  const data = await api("/api/admin/overview");
  let archiveData = { entries: [] };
  let archiveError = "";
  if (section === "archive") {
    try {
      archiveData = await api("/api/admin/archive");
    } catch (error) {
      archiveError = error.message;
    }
  }
  const sectionNav = Object.entries(sections)
    .map(([key, label]) => `<a class="admin-tab${key === section ? " active" : ""}" href="#/admin/${key}"${key === section ? ' aria-current="page"' : ""}>${label}</a>`)
    .join("");
  let content = "";

  if (section === "overview") {
    content = `
      <div class="admin-stats">
        <div class="admin-stat"><span>Students</span><b>${data.totals.users}</b></div>
        <div class="admin-stat"><span>Total threads</span><b>${data.totals.items}</b></div>
        <div class="admin-stat"><span>Claims to review</span><b>${data.totals.pendingClaims}</b></div>
        <div class="admin-stat"><span>Items returned</span><b>${data.totals.returned}</b></div>
      </div>
      <div class="admin-columns">
        <section class="panel admin-section">
          <div class="section-heading"><div><p class="eyebrow">Distribution</p><h2>Threads by category</h2></div></div>
          <div class="category-list">
            ${data.byCategory.map((row) => `<div class="category-row"><span>${escapeHtml(row.category)}</span><b>${row.count}</b></div>`).join("") || "<p class='muted'>No data yet.</p>"}
          </div>
        </section>
        <section class="panel admin-section">
          <div class="section-heading"><div><p class="eyebrow">Recently posted</p><h2>Latest threads</h2></div></div>
          <div class="category-list">
            ${data.recentItems.map((thread) => `<a class="category-row" href="#/item/${thread.id}"><span>${escapeHtml(thread.title)}<small class="admin-row-note">${escapeHtml(thread.username)}</small></span><span class="badge">${escapeHtml(thread.status)}</span></a>`).join("") || "<p class='muted'>No threads yet.</p>"}
          </div>
        </section>
      </div>`;
  } else if (section === "claims") {
    content = `
      <section class="panel admin-section">
        <div class="section-heading">
          <div><p class="eyebrow">Needs attention</p><h2>Pending claims</h2></div>
          <span class="badge">${data.pendingClaims.length} pending</span>
        </div>
        <div class="admin-claim-list" id="claim-list">
          ${data.pendingClaims.length
            ? data.pendingClaims.map((claim) => `<article class="admin-claim">
                <div class="admin-claim-copy">
                  <p class="muted">${escapeHtml(claim.username)} claims</p>
                  <h3>${escapeHtml(claim.title)}</h3>
                  <p>${escapeHtml(claim.message)}</p>
                  ${claim.image_path ? `<a class="evidence-link" href="${escapeHtml(claim.image_path)}" target="_blank" rel="noopener">View attached proof</a>` : ""}
                </div>
                <div class="actions">
                  <button class="btn" data-approve="${claim.id}">Approve</button>
                  <button class="btn secondary" data-reject="${claim.id}">Reject</button>
                  <a class="btn secondary" href="#/item/${claim.item_id}">View thread</a>
                </div>
              </article>`).join("")
            : `<p class="muted">No pending claims.</p>`}
        </div>
      </section>`;
  } else if (section === "accounts") {
    content = `
      <section class="panel admin-section">
        <div class="section-heading">
          <div><p class="eyebrow">Access</p><h2>Manage accounts</h2></div>
          <span class="muted">${data.users.length} accounts</span>
        </div>
        <div class="user-table-wrap">
          <table class="user-table" data-account-table>
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>${data.users.map((user) => `<tr>
              <td><span class="user-name">${escapeHtml(user.username)}</span></td>
              <td class="muted">${escapeHtml(user.email)}</td>
              <td>${user.role === "admin" ? `<span class="role-badge">Admin</span>` : `<span class="badge">Student</span>`}</td>
              <td class="table-actions">
                ${Number(user.id) === Number(currentUser.id)
                  ? `<span class="muted">Current account</span>`
                  : `<button class="btn secondary role-action" data-user-id="${user.id}" data-role="${user.role === "admin" ? "user" : "admin"}">${user.role === "admin" ? "Remove admin" : "Make admin"}</button>
                     <button class="btn danger role-action" data-delete-user="${user.id}">Delete account</button>`}
              </td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>`;
  } else if (section === "threads") {
    content = `
      <section class="panel admin-section">
        <div class="section-heading">
          <div><p class="eyebrow">Content moderation</p><h2>Manage threads</h2></div>
          <span class="muted">${data.threads.length} threads</span>
        </div>
        <div class="user-table-wrap">
          <table class="user-table">
            <thead><tr><th>Thread</th><th>Posted by</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>            ${(data.threads || []).map((thread) => `<tr>
              <td><a class="user-name" href="#/item/${thread.id}">${escapeHtml(thread.title)}</a></td>
              <td class="muted">${escapeHtml(thread.username)}</td>
              <td><span class="badge ${escapeHtml(thread.report_type)}">${escapeHtml(thread.report_type)}</span></td>
              <td><span class="badge">${escapeHtml(thread.status)}</span></td>
              <td><button class="btn danger role-action" data-delete-thread="${thread.id}">Archive thread</button></td>
            </tr>`).join("") || `<tr><td colspan="5" class="muted">No thread-management data is available from the server.</td></tr>`}</tbody>
          </table>
        </div>
      </section>`;
  } else {
    content = `
      <section class="panel admin-section">
        <div class="section-heading">
          <div><p class="eyebrow">Recovery</p><h2>Archived records</h2></div>
          <span class="muted">${archiveData.entries.length} records · stored separately</span>
        </div>
        ${archiveError
          ? notice(`The archive service is unavailable (${archiveError}). Restart the server and try again.`)
          : archiveData.entries.length
          ? `<div class="user-table-wrap">
              <table class="user-table archive-table">
                <thead><tr><th>Record</th><th>Details</th><th>Archived</th><th>Action</th></tr></thead>
                <tbody>${archiveData.entries.map((entry) => `<tr>
                  <td><span class="badge">${escapeHtml(entry.type)}</span></td>
                  <td class="user-name">${escapeHtml(entry.summary)}</td>
                  <td class="muted">${escapeHtml(formatDate(entry.archivedAt))}</td>
                  <td><button class="btn secondary role-action" data-restore="${entry.id}">Restore</button></td>
                </tr>`).join("")}</tbody>
              </table>
            </div>`
          : `<p class="muted">Deleted accounts, threads, and claims will be kept here for recovery.</p>`}
      </section>`;
  }

  app.innerHTML = `
    <section class="admin-page">
      <header class="admin-heading">
        <div>
          <p class="eyebrow">Administration</p>
          <h1>Dashboard</h1>
        </div>
        <p class="muted">Manage claims, users, and lost-and-found activity.</p>
      </header>
      <nav class="admin-tabs" aria-label="Admin dashboard pages">${sectionNav}</nav>
      <div class="admin-content">${content}</div>
    </section>
  `;

  const claimList = document.getElementById("claim-list");
  if (claimList) claimList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-approve], [data-reject]");
    if (!button) return;
    const approve = button.hasAttribute("data-approve");
    const id = button.getAttribute(approve ? "data-approve" : "data-reject");
    const adminNote = approve ? "" : prompt("Optional admin note") || "";
    try {
      await api(`/api/admin/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: approve ? "approved" : "rejected", adminNote })
      });
      await renderAdmin(section);
    } catch (error) {
      app.insertAdjacentHTML("afterbegin", notice(error.message));
    }
  });
  const userTable = app.querySelector(".user-table[data-account-table]");
  if (userTable) userTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-user-id]");
    if (!button) return;
    try {
      await api(`/api/admin/users/${button.dataset.userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: button.dataset.role })
      });
      await renderAdmin(section);
    } catch (error) {
      app.insertAdjacentHTML("afterbegin", notice(error.message));
    }
  });
  app.querySelector(".admin-page").addEventListener("click", async (event) => {
    const deleteUserButton = event.target.closest("[data-delete-user]");
    const deleteThreadButton = event.target.closest("[data-delete-thread]");
    const restoreButton = event.target.closest("[data-restore]");
    try {
      if (deleteUserButton) {
        if (!confirm("Archive this account and its threads and claims? It can be restored later.")) return;
        await api(`/api/admin/users/${deleteUserButton.dataset.deleteUser}`, { method: "DELETE" });
      } else if (deleteThreadButton) {
        if (!confirm("Archive this thread and its claims? It can be restored later.")) return;
        await api(`/api/admin/items/${deleteThreadButton.dataset.deleteThread}`, { method: "DELETE" });
      } else if (restoreButton) {
        await api(`/api/admin/archive/${restoreButton.dataset.restore}/restore`, { method: "POST" });
      } else {
        return;
      }
      await renderAdmin(section);
    } catch (error) {
      app.insertAdjacentHTML("afterbegin", notice(error.message));
    }
  });
}

function renderFaqs() {
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Help</p>
      <h1>FAQs</h1>
      <h2>Who can use FIND IT?</h2>
      <p>Students and authorized campus users can register with an email and password. An administrator account oversees reports and claims.</p>
      <h2>How do I report an item?</h2>
      <p>Open <strong>Post a thread</strong>, choose Lost or Found, attach a photo, and include category, location, and date.</p>
      <h2>How do claims work?</h2>
      <p>A user submits a claim with identifying details. An administrator verifies the request and can mark the item as claimed, returned, or closed.</p>
      <h2>Are passwords stored in plain text?</h2>
      <p>No. Passwords are hashed with bcrypt before they are saved. The system cannot read your original password.</p>
      <h2>Does this send SMS or email alerts?</h2>
      <p>No. Those services are out of scope for this academic localhost project.</p>
    </section>
  `;
}

function renderTerms() {
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Policies</p>
      <h1>Terms and Policies</h1>
      <p>FIND IT is an academic lost-and-found website intended for localhost demonstration. Users must provide truthful reports and must not post content they do not have the right to share.</p>
      <h2>Accounts</h2>
      <p>You are responsible for your login credentials. Passwords are stored as bcrypt hashes. Administrators can view account usernames and emails for oversight, but cannot recover original passwords.</p>
      <h2>Reports and claims</h2>
      <p>Submitting a claim does not automatically transfer an item. An administrator must verify the request. False claims may be rejected and the related thread may be closed.</p>
      <h2>Privacy</h2>
      <p>Do not include sensitive personal data such as full ID numbers, home addresses, or payment details in public thread descriptions.</p>
      <h2>Scope</h2>
      <p>This system does not include mobile apps, school SIS integration, payments, GPS tracking, SMS/email notifications, or AI image matching.</p>
    </section>
  `;
}

async function route() {
  nav.classList.remove("open");
  const hash = location.hash.replace("#", "") || "/";
  const [path] = hash.split("?");
  try {
    if (path === "/" || path === "") return renderHome();
    if (path === "/login") return authForm("login");
    if (path === "/register") return authForm("register");
    if (path === "/post") return renderPost();
    if (path === "/profile") return renderProfile();
    if (path === "/faqs") return renderFaqs();
    if (path === "/terms") return renderTerms();
    if (path === "/admin" || path.startsWith("/admin/")) {
      return await renderAdmin(path.split("/")[2] || "overview");
    }
    if (path.startsWith("/item/")) return renderItem(path.split("/")[2]);
    app.innerHTML = `<section class="panel"><h1>Page not found</h1></section>`;
  } catch (error) {
    app.innerHTML = `<section class="panel">${notice(error.message)}</section>`;
  }
}

async function boot() {
  const [me, meta] = await Promise.all([api("/api/auth/me"), api("/api/meta")]);
  currentUser = me.user;
  categories = meta.categories;
  setNav();
  await route();
}

window.addEventListener("hashchange", () => {
  setNav();
  route();
});

boot();
