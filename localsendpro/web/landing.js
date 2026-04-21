const $ = (sel) => document.querySelector(sel);

$("#slug-prefix").textContent = location.host + "/";

const form = $("#go-form");
const input = $("#slug-input");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const slug = input.value.trim();
  if (!slug) return;
  location.href = "/" + encodeURIComponent(slug);
});

const themeBtn = $("#theme-toggle");
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  document.body.classList.toggle("light", mode === "light");
  themeBtn.innerHTML = mode === "dark" ? "&#9790;" : "&#9728;";
}
applyTheme(localStorage.getItem("envpad-theme") || "dark");
themeBtn.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("envpad-theme", next);
  applyTheme(next);
});
