const socket = io();
const container = document.getElementById("container");
const statusEl = document.getElementById("status");
const notificationEl = document.getElementById("notification");
const loadingEl = document.getElementById("loading");
const loadingTextEl = document.getElementById("loading-text");
const authButtons = Array.from(document.querySelectorAll(".button"));
const TOTAL = 1000000;
let offset = 0;

function setLoading(message) {
  loadingTextEl.innerText = message;
  loadingEl.classList.remove("hidden");
  authButtons.forEach((btn) => (btn.disabled = true));
}

function clearLoading() {
  loadingEl.classList.add("hidden");
  authButtons.forEach((btn) => (btn.disabled = false));
}

function showNotification(title, message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
  notificationEl.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function togglePassword() {
  const passInput = document.getElementById("pass");
  const toggleBtn = document.querySelector(".password-toggle");
  if (passInput.type === "password") {
    passInput.type = "text";
    toggleBtn.textContent = "🙈";
  } else {
    passInput.type = "password";
    toggleBtn.textContent = "👁️";
  }
}

async function load() {
  if (offset >= TOTAL) return;

  setLoading("Loading checkboxes...");
  try {
    const res = await fetch(`/checkboxes/${offset}`);
    const data = await res.json();

    data.bits.forEach((bit, i) => {
      const index = offset + i;
      const wrapper = document.createElement("div");
      wrapper.className = "checkbox-wrapper";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "cb-" + index;
      cb.checked = bit === 1;
      cb.disabled = bit === 1;

      cb.onclick = (e) => {
        if (!cb.checked) return e.preventDefault();
        socket.emit("client:checkbox:change", { index });
      };

      wrapper.appendChild(cb);
      container.appendChild(wrapper);
    });

    offset += data.bits.length;
  } catch (error) {
    showNotification(
      "Load failed",
      "Unable to load checkboxes. Please refresh the page.",
    );
  } finally {
    clearLoading();
  }
}

container.addEventListener("scroll", () => {
  if (
    container.scrollTop + container.clientHeight >=
    container.scrollHeight - 120
  ) {
    load();
  }
});

socket.on("server:checkbox:change", ({ index, owner }) => {
  const el = document.getElementById("cb-" + index);
  if (el) {
    el.checked = true;
    el.disabled = true;
    el.title = owner;
  }
});

socket.on("server:error", (msg) =>
  showNotification("Error", msg || "An unexpected error occurred."),
);

socket.on("server:user", (user) => {
  statusEl.innerText = user ? `Logged in as ${user}` : "Not logged in";
});

async function auth(type) {
  const user = document.getElementById("user").value.trim();
  const pass = document.getElementById("pass").value.trim();

  if (!user || !pass) {
    showNotification("Validation", "Please enter both username and password.");
    return;
  }

  setLoading(type === "login" ? "Signing in..." : "Creating account...");
  try {
    const res = await fetch(`/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });

    const data = await res.json();
    if (data.success) {
      showNotification(
        "Success",
        `${type === "login" ? "Logged in" : "Registered"} successfully.`,
      );
      document.getElementById("user").value = "";
      document.getElementById("pass").value = "";
      setTimeout(() => location.reload(), 900);
    } else {
      showNotification("Failed", data.error || "Unable to authenticate.");
    }
  } catch (error) {
    showNotification("Failed", "Server error. Please try again.");
  } finally {
    clearLoading();
  }
}

async function logout() {
  setLoading("Logging out...");
  try {
    const res = await fetch("/logout", { method: "POST" });
    const data = await res.json();

    if (data.success) {
      showNotification("Logged out", "You have been successfully logged out.");
      setTimeout(() => location.reload(), 900);
    } else {
      showNotification("Failed", data.error || "Logout failed.");
    }
  } catch (error) {
    showNotification("Failed", "Server error. Please try again.");
  } finally {
    clearLoading();
  }
}

load();
load();
