// ===== Конфигурация =====
const API_URL = "http://localhost:8080/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    loadUserData(); 
});

async function initApp() {
    // 1. Находим основные элементы
    const addMainBtn = document.getElementById('add-task-btn-main');
    const addInboxBtn = document.getElementById('add-to-inbox-btn');
    const inboxList = document.getElementById('inbox-list');
    const tasksList = document.getElementById('tasks-list');

    // 2. Логика добавления новых задач
    const handleAddTask = () => {
        const text = prompt("Опишите задачу:");
        if (text && text.trim() !== "") {
            addInboxItem(text);
        }
    };

    if (addMainBtn) addMainBtn.onclick = handleAddTask;
    if (addInboxBtn) addInboxBtn.onclick = handleAddTask;

    // 3. Обновление начального состояния счетчиков
    updateUI();
}

// ===== Загрузка данных пользователя с бэкенда =====
async function loadUserData() {
    const headerTitle = document.getElementById('header-title');
    try {
        const response = await fetch(`${API_URL}/user`);
        if (response.ok) {
            const data = await response.json();
            if (headerTitle) {
                headerTitle.textContent = `Доброго времени суток, ${data.full_name}!`;
            }
        }
    } catch (error) {
        console.error("Ошибка загрузки пользователя:", error);
        // Заглушка, если бэк не запущен
        if (headerTitle) headerTitle.textContent = "Доброго времени суток, Дмитрий!";
    }
}

// ===== Создание элемента в Inbox =====
function addInboxItem(text) {
    const container = document.getElementById('inbox-list');
    if (!container) return;

    const div = document.createElement("div");
    div.className = "flex items-center justify-between py-4 border-b border-slate-100 group transition-all";

    div.innerHTML = `
        <span class="text-slate-800 font-medium text-[15px]">${text}</span>
        <button class="action-process px-4 py-1.5 rounded-lg text-sm font-medium text-indigo-600 border border-indigo-100 bg-white hover:bg-indigo-50 transition-colors">
            Обработать
        </button>
    `;

    // Кнопка перемещения в Tasks
    div.querySelector('.action-process').onclick = () => {
        div.remove();
        moveToTasks(text);
        updateUI();
    };

    container.appendChild(div);
    updateUI();
}

// ===== Перемещение в колонку Tasks =====
function moveToTasks(text) {
    const tasksContainer = document.getElementById('tasks-list');
    if (!tasksContainer) return;

    const div = document.createElement("div");
    // Стиль карточки как в твоем дизайне
    div.className = "bg-slate-50/80 rounded-xl p-3.5 flex items-center justify-between border border-slate-100 mb-2.5 transition-all hover:border-indigo-200";

    div.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fa-regular fa-circle text-slate-300 text-lg"></i>
            <span class="text-slate-700 font-medium text-[15px]">${text}</span>
        </div>
        <button class="action-done bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/10">
            Готово
        </button>
    `;

    // Кнопка "Готово" (просто удаляем задачу)
    div.querySelector('.action-done').onclick = () => {
        div.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            div.remove();
            updateUI();
        }, 200);
    };

    tasksContainer.prepend(div);
}

// ===== Обновление интерфейса (счетчики и пустые состояния) =====
function updateUI() {
    const inboxList = document.getElementById('inbox-list');
    const emptyState = document.getElementById('inbox-empty-state');
    const sidebarBadge = document.getElementById('sidebar-inbox-count');

    if (inboxList && sidebarBadge) {
        const count = inboxList.children.length;
        sidebarBadge.textContent = count;
        
        if (emptyState) {
            count === 0 ? emptyState.classList.remove('hidden') : emptyState.classList.add('hidden');
        }
    }
}