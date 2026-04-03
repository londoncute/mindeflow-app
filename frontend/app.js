// ===== ИНИЦИАЛИЗАЦИЯ =====
const API_URL = "http://localhost:8080/api/v1"; // Порт из вашего .env

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    loadUserData(); // Загружаем данные пользователя при старте
});

async function initApp() {
    setupAddButtons();
    setupInboxActions();
}

// ===== ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ =====
async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/user`);
        if (response.ok) {
            const data = await response.json();
            // Обновляем имя в заголовке (h1 в index.htm)
            const headerTitle = document.querySelector("#header-top h1");
            if (headerTitle) {
                headerTitle.textContent = `Доброе утро, ${data.full_name}!`;
            }
        }
    } catch (error) {
        console.error("Ошибка загрузки данных пользователя:", error);
    }
}

// ===== ДОБАВЛЕНИЕ ЗАДАЧ =====
function setupAddButtons() {
    const buttons = document.querySelectorAll("button");

    buttons.forEach(btn => {
        if (btn.textContent.includes("Добавить")) {
            btn.addEventListener("click", async () => {
                const text = prompt("Введите задачу:");
                if (!text) return;

                // Здесь в будущем можно добавить POST запрос к бэкенду
                addInboxItem(text);
            });
        }
    });
}

function addInboxItem(text) {
    const container = document.querySelector("#card-inbox .flex.flex-col");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "flex items-center justify-between py-4 border-b border-slate-100 group";

    div.innerHTML = `
    <span class="text-slate-800 font-medium text-[15px]">${text}</span>
    <button class="px-4 py-1.5 rounded-lg text-sm font-medium text-indigo-600 border border-indigo-100 bg-white hover:bg-indigo-50">
      Обработать
    </button>
  `;

    container.appendChild(div);
}

// ===== ОБРАБОТКА КНОПОК =====
function setupInboxActions() {
    const container = document.querySelector("#card-inbox .flex.flex-col");
    if (!container) return;

    container.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" && e.target.textContent.includes("Обработать")) {
            const item = e.target.closest("div.group");
            if (item) {
                moveToTasks(item);
            }
        }
    });
}

// ===== ПЕРЕНОС В TASKS =====
function moveToTasks(item) {
    const text = item.querySelector("span").textContent;

    item.remove();

    const tasksContainer = document.querySelector("#card-tasks .flex.flex-col");
    if (!tasksContainer) return;

    const div = document.createElement("div");
    div.className = "bg-slate-50/80 rounded-xl p-3.5 flex items-center justify-between border border-slate-100 mb-2.5";

    div.innerHTML = `
    <div class="flex items-center gap-3">
      <i class="fa-regular fa-circle text-slate-300 text-lg"></i>
      <span class="text-slate-700 font-medium text-[15px]">${text}</span>
    </div>
    <button class="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
      Готово
    </button>
  `;

    tasksContainer.prepend(div);
}

// ===== КНОПКА "ГОТОВО" =====
document.addEventListener("click", (e) => {
    if (e.target.textContent.trim() === "Готово") {
        const task = e.target.closest("div.bg-slate-50\\/80");
        if (task) {
            task.remove();
        }
    }
});