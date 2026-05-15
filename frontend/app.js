const API_URL = "/api/v1";
const AUTH_MODES = {
    LOGIN: "login",
    REGISTER: "register",
};
const MODES = {
    MONKEY: "monkey",
    SMART: "smart",
};
const SECTIONS = {
    INBOX: "inbox",
    TASKS: "tasks",
    PROJECTS: "projects",
};
const STORAGE_KEYS = {
    mode: "mindeflow_mode",
    selectedMonkeyTaskId: "mindeflow_selected_monkey_task_id",
    selectedProjectId: "mindeflow_selected_project_id",
    visibleSections: "mindeflow_visible_sections",
    sidebarOpen: "mindeflow_sidebar_open",
    taskFilterProjectId: "mindeflow_task_filter_project_id",
    taskSort: "mindeflow_task_sort",
};
const TASK_STATUS_LABELS = {
    pending: "Не начата",
    in_progress: "В работе",
    done: "Готово",
};
const COMPLETE_HOLD_MS = 2000;
const MODE_SWITCH_HOLD_MS = 5000;
const PROJECT_STATUS_LABELS = {
    active: "Активен",
    completed: "Завершен",
    archived: "Архив",
};
const collator = new Intl.Collator("ru", {
    sensitivity: "base",
    numeric: true,
});

const state = {
    user: null,
    authRequired: false,
    loginPending: false,
    loginError: "",
    authMode: AUTH_MODES.LOGIN,
    inbox: [],
    projects: [],
    tasks: [],
    mode: loadString(STORAGE_KEYS.mode, MODES.SMART),
    selectedMonkeyTaskId: loadNumber(STORAGE_KEYS.selectedMonkeyTaskId),
    selectedProjectId: loadNumber(STORAGE_KEYS.selectedProjectId),
    visibleSections: loadSectionList(STORAGE_KEYS.visibleSections, [
        SECTIONS.INBOX,
        SECTIONS.TASKS,
        SECTIONS.PROJECTS,
    ]),
    sidebarOpen: loadBoolean(STORAGE_KEYS.sidebarOpen, true),
    taskFilterProjectId: loadString(STORAGE_KEYS.taskFilterProjectId, "all"),
    taskSort: loadString(STORAGE_KEYS.taskSort, "wave"),
    performerRevealed: false,
    editingProjectId: null,
    modal: null,
    switchGuard: null,
    processingInboxId: null,
    skippingInboxId: null,
    holdingDeleteInboxId: null,
    deletingInboxId: null,
    savingProjectId: null,
    holdingDeleteProjectId: null,
    deletingProjectId: null,
    deletingTaskId: null,
    deletingAllProjectId: null,
    prioritizingTaskId: null,
    startingTaskId: null,
    holdingCompleteTaskId: null,
    completingTaskId: null,
};
let completeHoldTimerId = null;
let switchGuardHoldTimerId = null;
let deleteInboxHoldTimerId = null;
let deleteProjectHoldTimerId = null;
let performerRenderStarted = false;
let performerAnimating = false;
let vipToggleLocked = false;
const vipPressedCodes = new Set();

document.addEventListener("DOMContentLoaded", () => {
    bindStaticActions();
    initializePerformerRenderer();
    renderAll();
    void initApp();
});

async function initApp() {
    const session = await apiRequest("/auth/session", {
        allowUnauthorized: true,
        skipAuthRedirect: true,
    });

    if (!session) {
        state.authRequired = true;
        renderAll();
        return;
    }

    state.user = normalizeUser(session);
    state.authRequired = false;
    await refreshAppData();
}

function bindStaticActions() {
    getElement("mode-toggle").addEventListener("click", handleModeToggle);
    getElement("sidebar-toggle-button").addEventListener("click", toggleSidebar);
    getElement("global-add-button").addEventListener("click", openCreateInboxModal);
    getElement("inbox-add-button").addEventListener("click", openCreateInboxModal);
    getElement("sidebar-tabs").addEventListener("click", handleSidebarTabsClick);
    getElement("sidebar-account-button").addEventListener("click", () => {
        void logout();
    });

    getElement("auth-mode-login-button").addEventListener("click", () => {
        setAuthMode(AUTH_MODES.LOGIN);
    });
    getElement("auth-mode-register-button").addEventListener("click", () => {
        setAuthMode(AUTH_MODES.REGISTER);
    });
    getElement("auth-mode-switch-button").addEventListener("click", () => {
        setAuthMode(state.authMode === AUTH_MODES.LOGIN ? AUTH_MODES.REGISTER : AUTH_MODES.LOGIN);
    });

    getElement("auth-form").addEventListener("submit", (event) => {
        void handleAuthSubmit(event);
    });

    getElement("modal-close-button").addEventListener("click", closeModal);
    getElement("modal-cancel-button").addEventListener("click", closeModal);
    getElement("modal-secondary-button").addEventListener("click", () => {
        void handleModalSecondaryAction();
    });
    getElement("modal-form").addEventListener("submit", (event) => {
        void handleModalSubmit(event);
    });
    getElement("switch-guard-continue-button").addEventListener("click", closeSwitchGuard);
    getElement("switch-guard-hold-button").addEventListener("pointerdown", handleSwitchGuardPointerDown);
    getElement("sidebar-performer").addEventListener("pointerenter", handlePerformerHoverMove);
    getElement("sidebar-performer").addEventListener("pointermove", handlePerformerHoverMove);
    getElement("sidebar-performer").addEventListener("pointerleave", handlePerformerPointerLeave);
    window.addEventListener("keydown", handleVipKeyDown);
    window.addEventListener("keyup", handleVipKeyUp);
    window.addEventListener("blur", resetVipKeys);

    getElement("inbox-list").addEventListener("pointerdown", handleInboxListPointerDown);
    getElement("inbox-list").addEventListener("click", (event) => {
        void handleInboxClick(event);
    });

    getElement("tasks-toolbar").addEventListener("click", (event) => {
        void handleTasksToolbarClick(event);
    });
    getElement("tasks-toolbar").addEventListener("change", handleTasksToolbarChange);
    getElement("tasks-content").addEventListener("pointerdown", handleTasksContentPointerDown);
    getElement("tasks-content").addEventListener("click", (event) => {
        void handleTasksContentClick(event);
    });
    window.addEventListener("pointerup", handleTasksContentPointerEnd);
    window.addEventListener("pointercancel", handleTasksContentPointerEnd);
    window.addEventListener("blur", handleTasksContentPointerEnd);
    window.addEventListener("pointerup", handleDeletePointerEnd);
    window.addEventListener("pointercancel", handleDeletePointerEnd);
    window.addEventListener("blur", handleDeletePointerEnd);
    window.addEventListener("pointerup", handleSwitchGuardPointerEnd);
    window.addEventListener("pointercancel", handleSwitchGuardPointerEnd);
    window.addEventListener("blur", handleSwitchGuardPointerEnd);

    getElement("projects-toolbar").addEventListener("click", (event) => {
        void handleProjectsToolbarClick(event);
    });
    getElement("projects-content").addEventListener("click", (event) => {
        void handleProjectsContentClick(event);
    });
    getElement("projects-content").addEventListener("pointerdown", handleProjectsContentPointerDown);
}

function handleSidebarTabsClick(event) {
    const button = event.target.closest("button[data-section]");
    if (!button) {
        return;
    }

    const section = button.dataset.section;
    if (!Object.values(SECTIONS).includes(section)) {
        return;
    }

    const allowedSections = getAllowedSections();
    if (!allowedSections.includes(section)) {
        return;
    }

    const visibleSections = getVisibleSections();
    const isVisible = visibleSections.includes(section);
    if (isVisible && visibleSections.length === 1) {
        return;
    }

    const nextVisibleSections = isVisible
        ? state.visibleSections.filter((entry) => entry !== section)
        : [...state.visibleSections, section];

    if (shouldGuardProjectsView(nextVisibleSections)) {
        openSwitchGuard({
            title: "Вы еще не разобрали inbox",
            description: "Пока в inbox есть записи, перейти только к проектам можно только с удержанием 5 секунд.",
            onConfirm: () => {
                applyVisibleSections(nextVisibleSections);
            },
        });
        return;
    }

    applyVisibleSections(nextVisibleSections);
}

function handleVipKeyDown(event) {
    const allowedCodes = ["KeyV", "KeyI", "KeyP"];
    if (!allowedCodes.includes(event.code)) {
        return;
    }

    vipPressedCodes.add(event.code);
    if (allowedCodes.every((code) => vipPressedCodes.has(code)) && !vipToggleLocked) {
        vipToggleLocked = true;
        togglePerformerReveal();
    }
}

function handleVipKeyUp(event) {
    const allowedCodes = ["KeyV", "KeyI", "KeyP"];
    if (!allowedCodes.includes(event.code)) {
        return;
    }

    vipPressedCodes.delete(event.code);
    if (!allowedCodes.every((code) => vipPressedCodes.has(code))) {
        vipToggleLocked = false;
    }
}

function togglePerformerReveal() {
    state.performerRevealed = !state.performerRevealed;
    if (!state.performerRevealed) {
        deactivatePerformerAnimation();
    } else {
        drawPerformerFrame();
    }
    renderSidebar();
}

function resetVipKeys() {
    vipPressedCodes.clear();
    vipToggleLocked = false;
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    if (state.loginPending) {
        return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    state.loginPending = true;
    state.loginError = "";
    renderAuthOverlay();

    try {
        const path = state.authMode === AUTH_MODES.REGISTER ? "/auth/register" : "/auth/login";
        const payload = state.authMode === AUTH_MODES.REGISTER
            ? {
                full_name: fullName,
                email,
                password,
            }
            : {
                email,
                password,
            };

        const user = await apiRequest(path, {
            method: "POST",
            body: JSON.stringify(payload),
            skipAuthRedirect: true,
        });

        state.user = normalizeUser(user);
        state.authRequired = false;
        state.loginPending = false;
        state.authMode = AUTH_MODES.LOGIN;
        renderAuthOverlay();
        await refreshAppData();
    } catch (error) {
        state.loginPending = false;
        state.loginError = error.message;
        renderAuthOverlay();
    }
}

function handleModeToggle() {
    const targetMode = state.mode === MODES.MONKEY ? MODES.SMART : MODES.MONKEY;
    const guard = getModeSwitchGuard(targetMode);
    if (guard) {
        openSwitchGuard(guard);
        return;
    }

    applyMode(targetMode);
}

function applyMode(mode) {
    cancelHeldTaskCompletion({
        render: false,
    });
    cancelHeldInboxDelete({
        render: false,
    });
    cancelHeldProjectDelete({
        render: false,
    });
    closeSwitchGuard({
        render: false,
    });
    state.mode = mode;
    persistString(STORAGE_KEYS.mode, state.mode);

    if (mode === MODES.MONKEY) {
        state.visibleSections = [SECTIONS.TASKS];
    } else if (state.inbox.length) {
        state.visibleSections = [SECTIONS.INBOX];
    } else {
        state.visibleSections = [SECTIONS.INBOX, SECTIONS.PROJECTS];
    }

    normalizeSelections();
    renderAll();
}

function getModeSwitchGuard(targetMode) {
    if (targetMode === MODES.SMART && getMonkeyTaskQueue().length) {
        return {
            title: "Вы еще не доделали задачи",
            description: "Сначала закройте текущие задачи или удерживайте кнопку 5 секунд.",
            onConfirm: () => {
                applyMode(targetMode);
            },
        };
    }

    if (targetMode === MODES.MONKEY && hasProjectsWithoutTasks()) {
        return {
            title: "Вы еще не доделали задачи",
            description: "У каждого проекта должна быть хотя бы одна задача, если не хотите переключаться принудительно.",
            onConfirm: () => {
                applyMode(targetMode);
            },
        };
    }

    return null;
}

function openSwitchGuard(config) {
    cancelSwitchGuardHold({
        render: false,
    });
    state.switchGuard = {
        title: config.title || "Подтверждение",
        description: config.description || "",
        onConfirm: typeof config.onConfirm === "function" ? config.onConfirm : null,
    };
    renderSwitchGuard();
}

function closeSwitchGuard(options = {}) {
    cancelSwitchGuardHold({
        render: false,
    });
    state.switchGuard = null;
    if (options.render !== false) {
        renderSwitchGuard();
    }
}

function handleSwitchGuardPointerDown(event) {
    const button = event.target.closest("#switch-guard-hold-button");
    if (!(button instanceof HTMLButtonElement) || !state.switchGuard) {
        return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    event.preventDefault();
    startSwitchGuardHold();
}

function handleSwitchGuardPointerEnd() {
    cancelSwitchGuardHold();
}

function startSwitchGuardHold() {
    if (!state.switchGuard || switchGuardHoldTimerId != null) {
        return;
    }

    renderSwitchGuard(true);
    switchGuardHoldTimerId = window.setTimeout(() => {
        finalizeSwitchGuard();
    }, MODE_SWITCH_HOLD_MS);
}

function cancelSwitchGuardHold(options = {}) {
    if (switchGuardHoldTimerId != null) {
        window.clearTimeout(switchGuardHoldTimerId);
        switchGuardHoldTimerId = null;
    }

    if (options.render !== false) {
        renderSwitchGuard();
    }
}

function finalizeSwitchGuard() {
    if (!state.switchGuard) {
        return;
    }

    const onConfirm = state.switchGuard.onConfirm;
    if (switchGuardHoldTimerId != null) {
        window.clearTimeout(switchGuardHoldTimerId);
        switchGuardHoldTimerId = null;
    }
    closeSwitchGuard({
        render: false,
    });
    if (onConfirm) {
        onConfirm();
    }
}

function shouldGuardProjectsView(nextVisibleSections) {
    if (state.mode !== MODES.SMART || !state.inbox.length) {
        return false;
    }

    const currentVisibleSections = getVisibleSections();
    const isOpeningProjects = nextVisibleSections.includes(SECTIONS.PROJECTS) &&
        !currentVisibleSections.includes(SECTIONS.PROJECTS);

    return isOpeningProjects || !nextVisibleSections.includes(SECTIONS.INBOX);
}

function applyVisibleSections(nextVisibleSections) {
    state.visibleSections = [...nextVisibleSections];
    normalizeVisibleSections();
    if (!getVisibleSections().includes(SECTIONS.TASKS)) {
        cancelHeldTaskCompletion({
            render: false,
        });
    }
    renderHeader();
    renderSidebarTabs();
}

function handleInboxListPointerDown(event) {
    const button = event.target.closest("button[data-action='delete-inbox']");
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    const inboxId = Number(button.dataset.inboxId);
    if (!Number.isFinite(inboxId)) {
        return;
    }

    event.preventDefault();
    startHeldInboxDelete(inboxId);
}

function handleProjectsContentPointerDown(event) {
    const button = event.target.closest("button[data-action='delete-project']");
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    const projectId = Number(button.dataset.projectId);
    if (!Number.isFinite(projectId)) {
        return;
    }

    event.preventDefault();
    startHeldProjectDelete(projectId);
}

function handleDeletePointerEnd() {
    cancelHeldInboxDelete();
    cancelHeldProjectDelete();
}

async function handleInboxClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const inboxId = Number(button.dataset.inboxId);
    if (!Number.isFinite(inboxId)) {
        return;
    }

    switch (button.dataset.action) {
        case "process-inbox":
            openProcessInboxModal(inboxId);
            break;
        case "skip-inbox":
            await skipInboxItem(inboxId);
            break;
        case "delete-inbox":
            break;
        default:
            break;
    }
}

function handleTasksToolbarChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
        return;
    }

    if (target.id === "task-filter-select") {
        state.taskFilterProjectId = target.value;
        persistString(STORAGE_KEYS.taskFilterProjectId, state.taskFilterProjectId);
        renderTasks();
        return;
    }

    if (target.id === "task-sort-select") {
        state.taskSort = target.value;
        persistString(STORAGE_KEYS.taskSort, state.taskSort);
        renderTasks();
    }
}

async function handleTasksToolbarClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    if (button.dataset.action === "next-monkey-task") {
        moveToNextMonkeyTask();
    }
}

async function handleTasksContentClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const taskId = Number(button.dataset.taskId);
    if (!Number.isFinite(taskId)) {
        return;
    }

    switch (button.dataset.action) {
        case "start-task":
            await startTask(taskId);
            break;
        case "complete-task":
            break;
        default:
            break;
    }
}

function handleTasksContentPointerDown(event) {
    const button = event.target.closest("button[data-action='complete-task']");
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
        return;
    }

    const taskId = Number(button.dataset.taskId);
    if (!Number.isFinite(taskId)) {
        return;
    }

    event.preventDefault();
    startHeldTaskCompletion(taskId);
}

function handleTasksContentPointerEnd() {
    cancelHeldTaskCompletion();
}

async function handleProjectsToolbarClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    switch (button.dataset.action) {
        case "create-project":
            openCreateProjectModal();
            break;
        case "next-project":
            moveToNextProject();
            break;
        default:
            break;
    }
}

async function handleProjectsContentClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    switch (button.dataset.action) {
        case "select-project": {
            const projectId = Number(button.dataset.projectId);
            if (!Number.isFinite(projectId)) {
                return;
            }

            state.selectedProjectId = projectId;
            state.editingProjectId = projectId;
            persistNumber(STORAGE_KEYS.selectedProjectId, state.selectedProjectId);
            renderProjects();
            break;
        }
        case "save-project": {
            const projectId = Number(button.dataset.projectId);
            if (!Number.isFinite(projectId)) {
                return;
            }

            await saveCurrentProject(projectId);
            break;
        }
        case "create-task": {
            const projectId = Number(button.dataset.projectId);
            if (!Number.isFinite(projectId)) {
                return;
            }

            openCreateTaskModal(projectId);
            break;
        }
        case "prioritize-task": {
            const taskId = Number(button.dataset.taskId);
            if (!Number.isFinite(taskId)) {
                return;
            }

            await prioritizeTask(taskId);
            break;
        }
        case "delete-task": {
            const taskId = Number(button.dataset.taskId);
            if (!Number.isFinite(taskId)) {
                return;
            }

            await deleteTask(taskId);
            break;
        }
        case "delete-project": {
            break;
        }
        case "delete-all-tasks": {
            const projectId = Number(button.dataset.projectId);
            if (!Number.isFinite(projectId)) {
                return;
            }

            await deleteAllProjectTasks(projectId);
            break;
        }
        default:
            break;
    }
}

async function refreshAppData() {
    await Promise.all([
        loadInboxItems(),
        loadProjects(),
        loadTasks(),
    ]);

    normalizeSelections();
    renderAll();
}

async function loadInboxItems() {
    const response = await apiRequest("/inbox/?status=new&limit=100&offset=0");
    const items = Array.isArray(response?.data) ? response.data : [];
    state.inbox = items.map(normalizeInboxItem).sort((left, right) => left.position - right.position);
}

async function loadProjects() {
    const response = await apiRequest("/projects/?limit=100&offset=0");
    const items = Array.isArray(response?.data) ? response.data : [];
    state.projects = items.map(normalizeProject);
}

async function loadTasks() {
    const response = await apiRequest("/tasks/?limit=300&offset=0");
    const items = Array.isArray(response?.data) ? response.data : [];
    state.tasks = items.map(normalizeTask);
}

async function logout() {
    try {
        await apiRequest("/auth/logout", {
            method: "POST",
            skipAuthRedirect: true,
        });
    } catch (error) {
        console.error("Ошибка выхода:", error);
    } finally {
        handleSessionExpired();
    }
}

function openCreateInboxModal() {
    openModal({
        title: "Новая запись в inbox",
        description: "Добавьте заголовок и короткое описание. Эта форма заменяет старый prompt и работает без перезагрузки.",
        submitLabel: "Добавить",
        fields: [
            {
                name: "title",
                label: "Заголовок",
                type: "text",
                required: true,
                placeholder: "Например, придумать сценарий для проекта",
            },
            {
                name: "text",
                label: "Описание",
                type: "textarea",
                rows: 4,
                placeholder: "Контекст, детали, ссылка, мысль...",
            },
        ],
        onSubmit: async (values) => {
            await apiRequest("/inbox/", {
                method: "POST",
                body: JSON.stringify({
                    title: values.title.trim(),
                    text: values.text.trim(),
                }),
            });
            closeModal();
            await refreshAppData();
        },
    });
}

function openCreateProjectModal(options = {}) {
    const prefill = options.prefill || options;
    const modalTitle = options.title || "Новый проект";
    const modalDescription = options.description || "Создайте проект вручную.";
    const submitLabel = options.submitLabel || "Создать проект";
    const onCreated = typeof options.onCreated === "function" ? options.onCreated : null;
    const afterRefresh = typeof options.afterRefresh === "function" ? options.afterRefresh : null;
    const extraPayload = options.extraPayload || {};

    openModal({
        title: modalTitle,
        description: modalDescription,
        submitLabel,
        fields: [
            {
                name: "title",
                label: "Название проекта",
                type: "text",
                required: true,
                value: prefill.title || "",
            },
            {
                name: "description",
                label: "Описание",
                type: "textarea",
                rows: 4,
                value: prefill.description || "",
            },
            {
                name: "materials",
                label: "Материалы",
                type: "textarea",
                rows: 4,
                value: prefill.materials || "",
                placeholder: "Ссылки, заметки, документы, исходники...",
            },
        ],
        onSubmit: async (values) => {
            const created = await apiRequest("/projects/", {
                method: "POST",
                body: JSON.stringify({
                    ...extraPayload,
                    title: values.title.trim(),
                    description: toNullableString(values.description),
                    materials: values.materials.trim(),
                }),
            });

            if (onCreated) {
                await onCreated(created, values);
            }

            state.selectedProjectId = Number(created.id);
            state.editingProjectId = null;
            persistNumber(STORAGE_KEYS.selectedProjectId, state.selectedProjectId);
            closeModal();
            await refreshAppData();

            if (afterRefresh) {
                afterRefresh(created, values);
            }
        },
    });
}

function openProcessInboxModal(inboxId) {
    const item = state.inbox.find((entry) => entry.id === inboxId);
    if (!item) {
        return;
    }

    if (!state.projects.length) {
        openCreateProjectFromInboxModal(inboxId);
        return;
    }

    if (state.projects.length === 1) {
        openInboxTaskModal(inboxId, {
            fixedProjectId: state.projects[0].id,
        });
        return;
    }

    openInboxTaskModal(inboxId, {
        defaultProjectId: getDefaultInboxProjectId(),
    });
}

function openInboxTaskModal(inboxId, options = {}) {
    const item = state.inbox.find((entry) => entry.id === inboxId);
    if (!item) {
        return;
    }

    const fixedProjectId = Number(options.fixedProjectId);
    const hasFixedProject = Number.isFinite(fixedProjectId) && fixedProjectId > 0;
    const defaultProjectId = hasFixedProject ? fixedProjectId : Number(options.defaultProjectId || getDefaultInboxProjectId());
    const selectedProject = getProjectById(defaultProjectId);

    openModal({
        title: "Обработать inbox-элемент",
        description: hasFixedProject
            ? `Inbox-элемент превратится в задачу внутри проекта "${selectedProject ? selectedProject.title : "выбранного проекта"}".`
            : "Выберите существующий проект и настройте новую задачу перед сохранением.",
        submitLabel: "Создать задачу",
        secondaryAction: {
            label: "Создать проект",
            onClick: () => {
                openCreateProjectFromInboxModal(inboxId);
            },
        },
        fields: [
            ...(
                hasFixedProject
                    ? []
                    : [{
                        name: "projectId",
                        label: "Проект",
                        type: "select",
                        required: true,
                        value: String(defaultProjectId),
                        options: state.projects.map((project) => ({
                            value: String(project.id),
                            label: project.title,
                        })),
                    }]
            ),
            {
                name: "title",
                label: "Название задачи",
                type: "text",
                required: true,
                value: item.title,
            },
            {
                name: "description",
                label: "Описание задачи",
                type: "textarea",
                rows: 4,
                value: item.text,
            },
            {
                name: "materials",
                label: "Материалы",
                type: "textarea",
                rows: 4,
                placeholder: "Ссылки, заметки или файлы для этой задачи",
            },
        ],
        onSubmit: async (values) => {
            const projectId = hasFixedProject ? fixedProjectId : Number(values.projectId);
            await processInboxIntoProject(inboxId, projectId, {
                title: values.title,
                description: values.description,
                materials: values.materials,
            });
            closeModal();
        },
    });
}

function openCreateProjectFromInboxModal(inboxId) {
    const item = state.inbox.find((entry) => entry.id === inboxId);
    if (!item) {
        return;
    }

    openCreateProjectModal({
        title: "Создать проект из inbox",
        description: "Данные из inbox уже перенесены в форму проекта.",
        submitLabel: "Создать проект",
        prefill: {
            title: item.title,
            description: item.text,
            materials: "",
        },
        extraPayload: {
            source_inbox_id: inboxId,
        },
        onCreated: async () => {
            await apiRequest(`/inbox/${inboxId}`, {
                method: "DELETE",
            });
        },
    });
}

async function processInboxIntoProject(inboxId, projectId, taskInput = {}) {
    state.processingInboxId = inboxId;
    renderInbox();

    try {
        await createTaskFromInboxItem(inboxId, projectId, taskInput);
        await refreshAppData();
    } finally {
        state.processingInboxId = null;
        renderInbox();
    }
}

async function createTaskFromInboxItem(inboxId, projectId, taskInput = {}) {
    const item = state.inbox.find((entry) => entry.id === inboxId);
    if (!item) {
        throw new Error("Inbox-элемент не найден");
    }

    const targetProjectId = Number(projectId);
    if (!Number.isFinite(targetProjectId) || targetProjectId <= 0) {
        throw new Error("Невозможно определить проект для задачи");
    }

    const title = String(taskInput.title ?? item.title).trim();
    const description = String(taskInput.description ?? item.text).trim();
    const materials = String(taskInput.materials ?? "").trim();

    if (!title) {
        throw new Error("Название задачи обязательно");
    }

    await apiRequest("/tasks/", {
        method: "POST",
        body: JSON.stringify({
            project_id: targetProjectId,
            title,
            description,
            materials,
            wave: getNextWaveForProject(targetProjectId),
        }),
    });

    await apiRequest(`/inbox/${inboxId}`, {
        method: "DELETE",
    });

    state.selectedProjectId = targetProjectId;
    persistNumber(STORAGE_KEYS.selectedProjectId, state.selectedProjectId);
}

function openCreateTaskModal(projectId) {
    const project = getProjectById(projectId);
    if (!project) {
        return;
    }

    openModal({
        title: `Новая задача для "${project.title}"`,
        description: "Задача появится в проекте сразу после сохранения.",
        submitLabel: "Создать задачу",
        fields: [
            {
                name: "title",
                label: "Название задачи",
                type: "text",
                required: true,
            },
            {
                name: "description",
                label: "Описание",
                type: "textarea",
                rows: 4,
            },
            {
                name: "materials",
                label: "Материалы",
                type: "textarea",
                rows: 4,
                placeholder: "Файлы, ссылки, заметки по задаче",
            },
        ],
        onSubmit: async (values) => {
            await apiRequest("/tasks/", {
                method: "POST",
                body: JSON.stringify({
                    project_id: projectId,
                    title: values.title.trim(),
                    description: values.description.trim(),
                    materials: values.materials.trim(),
                    wave: getNextWaveForProject(projectId),
                }),
            });
            closeModal();
            await refreshAppData();
        },
    });
}

async function handleModalSubmit(event) {
    event.preventDefault();

    if (!state.modal || state.modal.submitting) {
        return;
    }

    const values = getModalValues(new FormData(event.currentTarget), state.modal.fields);
    state.modal.submitting = true;
    renderModal();

    try {
        await state.modal.onSubmit(values);
    } catch (error) {
        window.alert(error.message);
    } finally {
        if (state.modal) {
            state.modal.submitting = false;
            renderModal();
        }
    }
}

async function handleModalSecondaryAction() {
    if (!state.modal || state.modal.submitting || !state.modal.secondaryAction) {
        return;
    }

    const action = state.modal.secondaryAction;

    try {
        closeModal();
        await action.onClick();
    } catch (error) {
        window.alert(error.message);
    }
}

async function skipInboxItem(inboxId) {
    state.skippingInboxId = inboxId;
    renderInbox();

    try {
        await apiRequest(`/inbox/${inboxId}/skip`, {
            method: "POST",
        });
        await refreshAppData();
    } finally {
        state.skippingInboxId = null;
        renderInbox();
    }
}

function startHeldInboxDelete(inboxId) {
    if (state.holdingDeleteInboxId === inboxId || state.deletingInboxId === inboxId) {
        return;
    }

    cancelHeldInboxDelete({
        render: false,
    });
    state.holdingDeleteInboxId = inboxId;
    renderInbox();
    deleteInboxHoldTimerId = window.setTimeout(() => {
        void finalizeHeldInboxDelete(inboxId);
    }, COMPLETE_HOLD_MS);
}

function cancelHeldInboxDelete(options = {}) {
    if (deleteInboxHoldTimerId != null) {
        window.clearTimeout(deleteInboxHoldTimerId);
        deleteInboxHoldTimerId = null;
    }

    if (state.holdingDeleteInboxId == null) {
        return;
    }

    state.holdingDeleteInboxId = null;
    if (options.render !== false) {
        renderInbox();
    }
}

async function finalizeHeldInboxDelete(inboxId) {
    if (state.holdingDeleteInboxId !== inboxId) {
        return;
    }

    if (deleteInboxHoldTimerId != null) {
        window.clearTimeout(deleteInboxHoldTimerId);
        deleteInboxHoldTimerId = null;
    }

    state.holdingDeleteInboxId = null;
    state.deletingInboxId = inboxId;
    renderInbox();

    try {
        await apiRequest(`/inbox/${inboxId}`, {
            method: "DELETE",
        });
        await refreshAppData();
    } finally {
        if (state.deletingInboxId === inboxId) {
            state.deletingInboxId = null;
        }
        renderInbox();
    }
}

async function saveCurrentProject(projectId) {
    const titleInput = getElement("project-title-input");
    const descriptionInput = getElement("project-description-input");
    const materialsInput = getElement("project-materials-input");
    const statusInput = getElement("project-status-input");

    if (!titleInput || !descriptionInput || !materialsInput || !statusInput) {
        return;
    }

    state.savingProjectId = projectId;
    renderProjects();

    try {
        await apiRequest(`/projects/${projectId}`, {
            method: "PATCH",
            body: JSON.stringify({
                title: titleInput.value.trim(),
                description: toNullableString(descriptionInput.value),
                materials: materialsInput.value.trim(),
                status: statusInput.value,
            }),
        });
        state.selectedProjectId = projectId;
        state.editingProjectId = null;
        persistNumber(STORAGE_KEYS.selectedProjectId, state.selectedProjectId);
        await refreshAppData();
    } finally {
        state.savingProjectId = null;
        renderProjects();
    }
}

async function deleteTask(taskId) {
    state.deletingTaskId = taskId;
    renderProjects();

    try {
        await apiRequest(`/tasks/${taskId}`, {
            method: "DELETE",
        });
        await refreshAppData();
    } finally {
        state.deletingTaskId = null;
        renderProjects();
    }
}

async function prioritizeTask(taskId) {
    state.prioritizingTaskId = taskId;
    renderProjects();

    try {
        await apiRequest(`/tasks/${taskId}/prioritize`, {
            method: "POST",
        });
        await refreshAppData();
    } finally {
        state.prioritizingTaskId = null;
        renderProjects();
    }
}

async function deleteAllProjectTasks(projectId) {
    const confirmed = window.confirm("Удалить все задачи этого проекта?");
    if (!confirmed) {
        return;
    }

    state.deletingAllProjectId = projectId;
    renderProjects();

    try {
        await apiRequest(`/projects/${projectId}/tasks`, {
            method: "DELETE",
        });
        await refreshAppData();
    } finally {
        state.deletingAllProjectId = null;
        renderProjects();
    }
}

async function deleteProject(projectId) {
    const project = getProjectById(projectId);
    if (!project) {
        return;
    }

    state.deletingProjectId = projectId;
    renderProjects();

    try {
        await apiRequest(`/projects/${projectId}`, {
            method: "DELETE",
        });
        await refreshAppData();
    } finally {
        state.deletingProjectId = null;
        renderProjects();
    }
}

function startHeldProjectDelete(projectId) {
    if (state.holdingDeleteProjectId === projectId || state.deletingProjectId === projectId) {
        return;
    }

    cancelHeldProjectDelete({
        render: false,
    });
    state.holdingDeleteProjectId = projectId;
    renderProjects();
    deleteProjectHoldTimerId = window.setTimeout(() => {
        void finalizeHeldProjectDelete(projectId);
    }, COMPLETE_HOLD_MS);
}

function cancelHeldProjectDelete(options = {}) {
    if (deleteProjectHoldTimerId != null) {
        window.clearTimeout(deleteProjectHoldTimerId);
        deleteProjectHoldTimerId = null;
    }

    if (state.holdingDeleteProjectId == null) {
        return;
    }

    state.holdingDeleteProjectId = null;
    if (options.render !== false) {
        renderProjects();
    }
}

async function finalizeHeldProjectDelete(projectId) {
    if (state.holdingDeleteProjectId !== projectId) {
        return;
    }

    if (deleteProjectHoldTimerId != null) {
        window.clearTimeout(deleteProjectHoldTimerId);
        deleteProjectHoldTimerId = null;
    }

    state.holdingDeleteProjectId = null;
    await deleteProject(projectId);
}

async function startTask(taskId) {
    cancelHeldTaskCompletion({
        render: false,
    });
    state.startingTaskId = taskId;
    renderTasks();

    try {
        await apiRequest(`/tasks/${taskId}/start`, {
            method: "POST",
        });
        state.selectedMonkeyTaskId = taskId;
        persistNumber(STORAGE_KEYS.selectedMonkeyTaskId, taskId);
        await refreshAppData();
    } finally {
        state.startingTaskId = null;
        renderTasks();
    }
}

function startHeldTaskCompletion(taskId) {
    if (state.holdingCompleteTaskId === taskId || state.completingTaskId === taskId) {
        return;
    }

    cancelHeldTaskCompletion({
        render: false,
    });
    state.holdingCompleteTaskId = taskId;
    renderTasks();
    completeHoldTimerId = window.setTimeout(() => {
        void finalizeHeldTaskCompletion(taskId);
    }, COMPLETE_HOLD_MS);
}

function cancelHeldTaskCompletion(options = {}) {
    if (completeHoldTimerId != null) {
        window.clearTimeout(completeHoldTimerId);
        completeHoldTimerId = null;
    }

    if (state.holdingCompleteTaskId == null) {
        return;
    }

    state.holdingCompleteTaskId = null;
    if (options.render !== false) {
        renderTasks();
    }
}

async function finalizeHeldTaskCompletion(taskId) {
    if (state.holdingCompleteTaskId !== taskId) {
        return;
    }

    if (completeHoldTimerId != null) {
        window.clearTimeout(completeHoldTimerId);
        completeHoldTimerId = null;
    }

    state.holdingCompleteTaskId = null;
    state.completingTaskId = taskId;
    renderTasks();

    try {
        await apiRequest(`/tasks/${taskId}/complete`, {
            method: "POST",
        });
        await refreshAppData();
    } finally {
        if (state.completingTaskId === taskId) {
            state.completingTaskId = null;
        }
        renderTasks();
    }
}

function moveToNextMonkeyTask() {
    const queue = getMonkeyTaskQueue();
    if (!queue.length) {
        return;
    }

    const current = getCurrentMonkeyTask();
    const currentIndex = current ? queue.findIndex((task) => task.id === current.id) : -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % queue.length : 0;
    state.selectedMonkeyTaskId = queue[nextIndex].id;
    persistNumber(STORAGE_KEYS.selectedMonkeyTaskId, state.selectedMonkeyTaskId);
    renderTasks();
    renderProjects();
}

function moveToNextProject() {
    if (!state.projects.length) {
        return;
    }

    const currentId = state.editingProjectId ?? state.selectedProjectId;
    const currentIndex = currentId
        ? state.projects.findIndex((project) => project.id === currentId)
        : -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % state.projects.length : 0;
    state.selectedProjectId = state.projects[nextIndex].id;
    state.editingProjectId = state.projects[nextIndex].id;
    persistNumber(STORAGE_KEYS.selectedProjectId, state.selectedProjectId);
    renderProjects();
}

function renderAll() {
    renderAuthOverlay();
    renderModal();
    renderSwitchGuard();
    renderSidebar();
    renderHeader();
    renderModeBlock();
    renderInbox();
    renderTasks();
    renderProjects();
    renderSidebarTabs();
}

function renderAuthOverlay() {
    const overlay = getElement("auth-overlay");
    const submitButton = getElement("auth-submit-button");
    const errorBlock = getElement("auth-error");
    const helperText = getElement("auth-helper-text");
    const fullNameGroup = getElement("auth-full-name-group");
    const fullNameInput = fullNameGroup.querySelector("input");
    const loginModeButton = getElement("auth-mode-login-button");
    const registerModeButton = getElement("auth-mode-register-button");
    const switchButton = getElement("auth-mode-switch-button");
    const isRegisterMode = state.authMode === AUTH_MODES.REGISTER;

    overlay.classList.toggle("hidden", !state.authRequired);

    submitButton.disabled = state.loginPending;
    submitButton.innerHTML = state.loginPending
        ? '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Сохраняем...'
        : isRegisterMode
            ? '<i class="fa-solid fa-user-plus text-xs"></i> Создать аккаунт'
            : '<i class="fa-solid fa-right-to-bracket text-xs"></i> Войти';

    fullNameGroup.classList.toggle("hidden", !isRegisterMode);
    fullNameInput.required = isRegisterMode;

    helperText.innerHTML = isRegisterMode
        ? 'Создайте новый аккаунт и вы сразу попадете в приложение.'
        : 'Тестовый вход: <span class="font-semibold text-slate-900">user@example.com</span> / <span class="font-semibold text-slate-900">mindflow123</span>';

    loginModeButton.className = isRegisterMode
        ? "rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition"
        : "rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition";
    registerModeButton.className = isRegisterMode
        ? "rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition"
        : "rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition";
    switchButton.textContent = isRegisterMode
        ? "Уже есть аккаунт? Войти"
        : "Нет аккаунта? Зарегистрироваться";

    if (state.loginError) {
        errorBlock.textContent = state.loginError;
        errorBlock.classList.remove("hidden");
    } else {
        errorBlock.textContent = "";
        errorBlock.classList.add("hidden");
    }
}

function renderModal() {
    const overlay = getElement("modal-overlay");
    const title = getElement("modal-title");
    const description = getElement("modal-description");
    const fields = getElement("modal-fields");
    const secondaryButton = getElement("modal-secondary-button");
    const submitButton = getElement("modal-submit-button");
    const closeButton = getElement("modal-close-button");
    const cancelButton = getElement("modal-cancel-button");

    if (!state.modal) {
        overlay.classList.add("hidden");
        fields.innerHTML = "";
        secondaryButton.textContent = "";
        secondaryButton.classList.add("hidden");
        return;
    }

    overlay.classList.remove("hidden");
    title.textContent = state.modal.title;
    description.textContent = state.modal.description || "";
    fields.innerHTML = state.modal.fields.map(renderModalField).join("");
    secondaryButton.textContent = state.modal.secondaryAction?.label || "";
    secondaryButton.classList.toggle("hidden", !state.modal.secondaryAction);
    secondaryButton.disabled = Boolean(state.modal.submitting);

    submitButton.textContent = state.modal.submitting ? "Сохраняем..." : state.modal.submitLabel;
    submitButton.disabled = Boolean(state.modal.submitting);
    closeButton.disabled = Boolean(state.modal.submitting);
    cancelButton.disabled = Boolean(state.modal.submitting);
}

function renderSwitchGuard(isHolding = switchGuardHoldTimerId != null) {
    const overlay = getElement("switch-guard-overlay");
    const title = getElement("switch-guard-title");
    const description = getElement("switch-guard-description");
    const button = getElement("switch-guard-hold-button");
    const fill = getElement("switch-guard-hold-fill");

    if (!state.switchGuard) {
        overlay.classList.add("hidden");
        title.textContent = "Вы еще не доделали задачи";
        description.textContent = "";
        button.disabled = false;
        fill.className = "origin-left scale-x-0 absolute inset-0 rounded-2xl bg-rose-500/20";
        return;
    }

    overlay.classList.remove("hidden");
    title.textContent = state.switchGuard.title || "Подтверждение";
    description.textContent = state.switchGuard.description || "";
    button.disabled = false;
    fill.className = isHolding
        ? "progress-bar-running-slow absolute inset-0 rounded-2xl bg-rose-500/20"
        : "origin-left scale-x-0 absolute inset-0 rounded-2xl bg-rose-500/20";
}

function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    persistBoolean(STORAGE_KEYS.sidebarOpen, state.sidebarOpen);
    renderSidebar();
}

function renderSidebar() {
    const sidebar = getElement("sidebar-navigation");
    const button = getElement("sidebar-toggle-button");
    const performerZone = getElement("sidebar-performer-zone");

    sidebar.className = state.sidebarOpen
        ? "z-20 flex h-full w-[280px] shrink-0 flex-col bg-[#111424] text-slate-300"
        : "hidden z-20 h-full w-[280px] shrink-0 flex-col bg-[#111424] text-slate-300";
    performerZone.classList.toggle("hidden", !state.sidebarOpen || state.mode !== MODES.SMART || !state.performerRevealed);
    if (state.mode !== MODES.SMART || !state.sidebarOpen || !state.performerRevealed) {
        deactivatePerformerAnimation();
    }

    button.setAttribute("aria-label", state.sidebarOpen ? "Скрыть меню" : "Показать меню");
    button.innerHTML = state.sidebarOpen
        ? '<i class="fa-solid fa-xmark"></i>'
        : '<i class="fa-solid fa-bars"></i>';
}

function initializePerformerRenderer() {
    const video = getElement("sidebar-performer-video");
    if (!(video instanceof HTMLVideoElement) || performerRenderStarted) {
        return;
    }

    const startLoop = () => {
        if (performerRenderStarted) {
            return;
        }

        performerRenderStarted = true;
        const renderFrame = () => {
            drawPerformerFrame();
            window.requestAnimationFrame(renderFrame);
        };
        renderFrame();
    };

    video.addEventListener("loadeddata", () => {
        video.pause();
        video.currentTime = 0;
        drawPerformerFrame();
        startLoop();
    });
    video.addEventListener("play", startLoop);
    video.addEventListener("seeked", drawPerformerFrame);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    void video.load();
}

function drawPerformerFrame() {
    const video = getElement("sidebar-performer-video");
    const canvas = getElement("sidebar-performer");
    if (!(video instanceof HTMLVideoElement) || !(canvas instanceof HTMLCanvasElement) || video.readyState < 2) {
        return;
    }

    const context = canvas.getContext("2d", {
        willReadFrequently: true,
    });
    if (!context) {
        return;
    }

    const crop = getPerformerCrop(video.videoWidth, video.videoHeight);
    if (canvas.width !== crop.width || canvas.height !== crop.height) {
        canvas.width = crop.width;
        canvas.height = crop.height;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
        video,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
    );

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const bg = {
        r: 197,
        g: 197,
        b: 197,
    };
    const threshold = 26;
    const feather = 14;

    for (let index = 0; index < frame.data.length; index += 4) {
        const red = frame.data[index];
        const green = frame.data[index + 1];
        const blue = frame.data[index + 2];
        const distance = Math.max(
            Math.abs(red - bg.r),
            Math.abs(green - bg.g),
            Math.abs(blue - bg.b),
        );

        if (distance <= threshold) {
            frame.data[index + 3] = 0;
            continue;
        }

        if (distance <= threshold + feather) {
            frame.data[index + 3] = Math.round(((distance - threshold) / feather) * 255);
        }
    }

    context.putImageData(frame, 0, 0);
}

function getPerformerCrop(videoWidth, videoHeight) {
    return {
        x: Math.round(videoWidth * 0.28),
        y: Math.round(videoHeight * 0.03),
        width: Math.round(videoWidth * 0.44),
        height: Math.round(videoHeight * 0.90),
    };
}

function handlePerformerHoverMove(event) {
    if (state.mode !== MODES.SMART || !state.performerRevealed) {
        return;
    }

    const performer = getElement("sidebar-performer");
    if (!(performer instanceof HTMLCanvasElement)) {
        return;
    }

    if (!isPointerOverPerformer(event, performer)) {
        deactivatePerformerAnimation();
        return;
    }

    activatePerformerAnimation();
    const rect = performer.getBoundingClientRect();
    const ratioX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const ratioY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const shiftX = (ratioX - 0.5) * 44;
    const shiftY = (ratioY - 0.55) * 18;

    performer.style.transform = `translate3d(calc(-50% + ${shiftX}px), ${shiftY}px, 0)`;
}

function handlePerformerPointerLeave() {
    deactivatePerformerAnimation();
}

function activatePerformerAnimation() {
    const video = getElement("sidebar-performer-video");
    if (!(video instanceof HTMLVideoElement) || performerAnimating) {
        return;
    }

    performerAnimating = true;
    void video.play().catch(() => {});
}

function deactivatePerformerAnimation() {
    const video = getElement("sidebar-performer-video");
    if (!(video instanceof HTMLVideoElement)) {
        resetPerformerPosition();
        return;
    }

    performerAnimating = false;
    video.pause();
    if (video.currentTime !== 0) {
        video.currentTime = 0;
    } else {
        drawPerformerFrame();
    }
    resetPerformerPosition();
}

function isPointerOverPerformer(event, canvas) {
    const context = canvas.getContext("2d", {
        willReadFrequently: true,
    });
    if (!context) {
        return false;
    }

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        return false;
    }

    return context.getImageData(x, y, 1, 1).data[3] > 24;
}

function resetPerformerPosition() {
    const performer = getElement("sidebar-performer");
    if (!performer) {
        return;
    }

    performer.style.transform = "translate3d(-50%, 0, 0)";
}

function renderHeader() {
    const addButton = getElement("global-add-button");
    const sidebarUserEmail = getElement("sidebar-user-email");

    if (state.user) {
        sidebarUserEmail.textContent = state.user.email;
    } else {
        sidebarUserEmail.textContent = "-";
    }

    addButton.classList.toggle("hidden", state.authRequired);
}

function renderModeBlock() {
    const modeName = getElement("mode-name");
    const toggle = getElement("mode-toggle");
    const thumb = getElement("mode-toggle-thumb");
    const inboxModeBadge = getElement("inbox-mode-badge");
    const tasksCaption = getElement("tasks-caption");
    const projectsCaption = getElement("projects-caption");

    if (state.mode === MODES.MONKEY) {
        modeName.textContent = "Обезьяна";
        inboxModeBadge.textContent = "Скрыт";
        setOptionalText(tasksCaption, "");
        setOptionalText(projectsCaption, "");
        toggle.className = "relative inline-flex h-9 w-16 items-center rounded-full bg-amber-500 transition-colors";
        thumb.className = "inline-block h-7 w-7 translate-x-8 rounded-full bg-white shadow-md transition-transform";
        return;
    }

    modeName.textContent = "Умный тип";
    inboxModeBadge.textContent = "Список";
    setOptionalText(tasksCaption, "");
    setOptionalText(projectsCaption, "");

    toggle.className = "relative inline-flex h-9 w-16 items-center rounded-full bg-slate-700 transition-colors";
    thumb.className = "inline-block h-7 w-7 translate-x-1 rounded-full bg-white shadow-md transition-transform";
}

function renderInbox() {
    const list = getElement("inbox-list");
    const emptyState = getElement("inbox-empty-state");
    const hint = getElement("inbox-focus-hint");
    const badge = getElement("inbox-sidebar-badge");

    list.innerHTML = "";
    badge.textContent = String(state.inbox.length);

    if (!state.inbox.length) {
        hint.textContent = "Inbox пуст.";
        hint.classList.remove("hidden");
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");
        return;
    }

    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
    hint.textContent = "";
    hint.classList.add("hidden");
    list.innerHTML = state.inbox.map((item) => renderInboxRow(item)).join("");
}

function renderTasks() {
    const headingGroup = getElement("tasks-heading-group");
    const toolbar = getElement("tasks-toolbar");
    const content = getElement("tasks-content");
    const emptyState = getElement("tasks-empty-state");

    if (state.mode === MODES.MONKEY) {
        const queue = getMonkeyTaskQueue();
        const currentTask = getCurrentMonkeyTask();
        headingGroup.classList.add("hidden");

        toolbar.innerHTML = `
            ${queue.length > 1 ? `
                <button
                    data-action="next-monkey-task"
                    class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                    Следующая задача
                </button>
            ` : ""}
        `;

        if (!currentTask) {
            content.innerHTML = "";
            emptyState.textContent = "Пусто";
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        content.innerHTML = renderMonkeyTaskCard(currentTask, queue);
        return;
    }

    headingGroup.classList.remove("hidden");
    const tasks = getSmartTasks();
    toolbar.innerHTML = `
        <label class="relative">
            <select
                id="task-filter-select"
                class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            >
                <option value="all">Все проекты</option>
                ${state.projects.map((project) => `
                    <option value="${project.id}" ${String(project.id) === state.taskFilterProjectId ? "selected" : ""}>
                        ${escapeHtml(project.title)}
                    </option>
                `).join("")}
            </select>
        </label>
        <label class="relative">
            <select
                id="task-sort-select"
                class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            >
                <option value="wave" ${state.taskSort === "wave" ? "selected" : ""}>Сортировка: волна</option>
                <option value="title" ${state.taskSort === "title" ? "selected" : ""}>Сортировка: название</option>
                <option value="status" ${state.taskSort === "status" ? "selected" : ""}>Сортировка: статус</option>
            </select>
        </label>
    `;

    if (!tasks.length) {
        content.innerHTML = "";
        emptyState.textContent = "Пусто";
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    content.innerHTML = tasks.map((task) => renderSmartTaskRow(task)).join("");
}

function renderProjects() {
    const toolbar = getElement("projects-toolbar");
    const content = getElement("projects-content");
    const emptyState = getElement("projects-empty-state");

    if (state.mode === MODES.MONKEY) {
        toolbar.innerHTML = "";
        content.innerHTML = "";
        emptyState.classList.add("hidden");
        return;
    }

    toolbar.innerHTML = `
        <button
            data-action="create-project"
            class="rounded-xl bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100"
        >
            <i class="fa-solid fa-plus text-xs"></i>
            Новый проект
        </button>
        ${state.projects.length > 1 ? `
            <button
                data-action="next-project"
                class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
                Следующий проект
            </button>
        ` : ""}
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            ${state.projects.length} ${pluralize(state.projects.length, "проект", "проекта", "проектов")}
        </span>
    `;

    if (!state.projects.length) {
        content.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    content.innerHTML = renderSmartProjectsBrowser();
}

function renderSmartProjectsBrowser() {
    return `
        <div class="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
            <div class="mb-4">
                <h3 class="text-base font-bold text-slate-900">Все проекты</h3>
            </div>
            <div class="space-y-2">
                ${state.projects.map((project) => renderSmartProjectListItem(project)).join("")}
            </div>
        </div>
        ${renderSmartProjectEditor()}
    `;
}

function renderMonkeyInboxCard(item, totalItems) {
    return `
        <div class="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">Элемент 1 / ${totalItems}</span>
                <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Текущий фокус</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900">${escapeHtml(item.title)}</h3>
            <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">${escapeHtml(item.text || "Без описания")}</p>
            <div class="mt-5 flex flex-wrap gap-2">
                ${renderInboxActionButton({
                    label: state.processingInboxId === item.id ? "Обрабатываем..." : "Обработать",
                    action: "process-inbox",
                    inboxId: item.id,
                    variant: "primary",
                    disabled: state.processingInboxId === item.id,
                })}
                ${renderInboxActionButton({
                    label: state.skippingInboxId === item.id ? "Сдвигаем..." : "Скип",
                    action: "skip-inbox",
                    inboxId: item.id,
                    variant: "secondary",
                    disabled: state.skippingInboxId === item.id,
                })}
                ${renderInboxActionButton({
                    label: state.deletingInboxId === item.id ? "Удаляем..." : state.holdingDeleteInboxId === item.id ? "Держите..." : "Удалить",
                    action: "delete-inbox",
                    inboxId: item.id,
                    variant: "danger",
                    timed: state.holdingDeleteInboxId === item.id,
                    disabled: state.deletingInboxId === item.id,
                })}
            </div>
        </div>
    `;
}

function renderInboxRow(item) {
    return `
        <div class="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <h3 class="text-[15px] font-semibold text-slate-800">${escapeHtml(item.title)}</h3>
                    <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">${escapeHtml(item.text || "Без описания")}</p>
                </div>
                <div class="flex shrink-0 flex-wrap justify-end gap-2">
                    ${renderInboxActionButton({
                        label: state.processingInboxId === item.id ? "Обрабатываем..." : "Обработать",
                        action: "process-inbox",
                        inboxId: item.id,
                        variant: "primary",
                        disabled: state.processingInboxId === item.id,
                    })}
                    ${renderInboxActionButton({
                        label: state.skippingInboxId === item.id ? "Скипаем..." : "Скип",
                        action: "skip-inbox",
                        inboxId: item.id,
                        variant: "secondary",
                        disabled: state.skippingInboxId === item.id,
                    })}
                    ${renderInboxActionButton({
                        label: state.deletingInboxId === item.id ? "Удаляем..." : state.holdingDeleteInboxId === item.id ? "Держите..." : "Удалить",
                        action: "delete-inbox",
                        inboxId: item.id,
                        variant: "danger",
                        timed: state.holdingDeleteInboxId === item.id,
                        disabled: state.deletingInboxId === item.id,
                    })}
                </div>
            </div>
        </div>
    `;
}

function renderSmartProjectListItem(project) {
    const projectTasks = getTasksForProject(project.id);
    const isActive = state.editingProjectId === project.id;
    const isDeleting = state.deletingProjectId === project.id;
    const isHoldingDelete = state.holdingDeleteProjectId === project.id;

    return `
        <div class="flex items-center gap-2">
            <button
                data-action="select-project"
                data-project-id="${project.id}"
                class="${isActive ? "border-indigo-200 bg-indigo-50" : "border-slate-100 bg-white hover:border-slate-200"} flex-1 rounded-2xl border p-4 text-left transition"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="text-[15px] font-semibold text-slate-800">${escapeHtml(project.title)}</div>
                        <div class="mt-1 text-sm text-slate-500">
                            ${projectTasks.length} ${pluralize(projectTasks.length, "задача", "задачи", "задач")}
                        </div>
                    </div>
                    ${renderProjectStatusBadge(project.status)}
                </div>
            </button>
            <button
                data-action="delete-project"
                data-project-id="${project.id}"
                ${isDeleting ? "disabled" : ""}
                class="${isHoldingDelete ? "timed-fill timed-fill-rose" : ""} rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
                ${isDeleting ? "Удаляем..." : isHoldingDelete ? "Держите..." : "Удалить"}
            </button>
        </div>
    `;
}

function renderMonkeyTaskCard(task, queue) {
    const project = getProjectById(task.projectId);
    const isInProgress = task.status === "in_progress";
    const isStarting = state.startingTaskId === task.id;
    const isHolding = state.holdingCompleteTaskId === task.id;
    const isCompleting = state.completingTaskId === task.id;

    return `
        <div class="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                    Фокус ${queue.findIndex((item) => item.id === task.id) + 1} / ${queue.length}
                </span>
                ${renderStatusBadge(task.status)}
            </div>

            <h3 class="text-lg font-bold text-slate-900">${escapeHtml(task.title)}</h3>
            <div class="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <span class="rounded-full bg-white px-3 py-1 shadow-sm">${escapeHtml(project ? project.title : "Без проекта")}</span>
            </div>

            <div class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
                ${
                    isInProgress
                        ? `
                            <div class="font-semibold text-slate-800">Описание</div>
                            <div class="mt-2 whitespace-pre-wrap leading-6">${escapeHtml(task.description || "Без описания")}</div>
                            <div class="mt-4 font-semibold text-slate-800">Материалы</div>
                            <div class="mt-2 whitespace-pre-wrap leading-6">${escapeHtml(task.materials || "Материалы не добавлены")}</div>
                        `
                        : 'Нажмите "Приступить", чтобы открыть детали задачи и перейти к выполнению.'
                }
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
                ${
                    isInProgress
                        ? `
                            <button
                                data-action="complete-task"
                                data-task-id="${task.id}"
                                ${isCompleting ? "disabled" : ""}
                                class="${isHolding ? "timed-fill timed-fill-emerald" : ""} select-none rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-90"
                            >
                                ${isCompleting ? "Завершаем..." : isHolding ? "Держите..." : "Выполнено"}
                            </button>
                        `
                        : `
                            <button
                                data-action="start-task"
                                data-task-id="${task.id}"
                                ${isStarting ? "disabled" : ""}
                                class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                ${isStarting ? "Открываем..." : "Приступить"}
                            </button>
                        `
                }
            </div>

            <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div class="${isHolding ? "progress-bar-running" : isCompleting ? "origin-left scale-x-100" : "origin-left scale-x-0"} h-full rounded-full bg-emerald-500"></div>
            </div>
        </div>
    `;
}

function renderSmartTaskRow(task) {
    const project = getProjectById(task.projectId);

    return `
        <div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-[15px] font-semibold text-slate-800">${escapeHtml(task.title)}</h3>
                        ${renderStatusBadge(task.status)}
                        <span class="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">волна ${task.wave}</span>
                    </div>
                    <p class="mt-2 text-sm font-medium text-slate-500">${escapeHtml(project ? project.title : "Без проекта")}</p>
                    <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">${escapeHtml(task.description || "Без описания")}</p>
                </div>
            </div>
        </div>
    `;
}

function renderSmartProjectEditor() {
    const project = getEditingProject();
    if (!project) {
        return `
            <div class="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Выберите проект в списке.
            </div>
        `;
    }

    const projectTasks = getTasksForProject(project.id);
    const isSaving = state.savingProjectId === project.id;
    const isDeletingProject = state.deletingProjectId === project.id;
    const isHoldingDeleteProject = state.holdingDeleteProjectId === project.id;
    const isDeletingAll = state.deletingAllProjectId === project.id;

    return `
        <div class="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
            <div class="mb-5 flex items-center justify-between gap-4">
                <div>
                    <h3 class="text-lg font-bold text-slate-900">${escapeHtml(project.title)}</h3>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    ${renderProjectStatusBadge(project.status)}
                    <button
                        data-action="delete-project"
                        data-project-id="${project.id}"
                        ${isDeletingProject ? "disabled" : ""}
                        class="${isHoldingDeleteProject ? "timed-fill timed-fill-rose" : ""} rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        ${isDeletingProject ? "Удаляем..." : isHoldingDeleteProject ? "Держите..." : "Удалить проект"}
                    </button>
                </div>
            </div>

            <div class="space-y-4">
                <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Название</span>
                    <input
                        id="project-title-input"
                        type="text"
                        value="${escapeHtml(project.title)}"
                        class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    >
                </label>

                <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Описание</span>
                    <textarea
                        id="project-description-input"
                        rows="4"
                        class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    >${escapeHtml(project.description)}</textarea>
                </label>

                <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Материалы</span>
                    <textarea
                        id="project-materials-input"
                        rows="4"
                        class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    >${escapeHtml(project.materials)}</textarea>
                </label>

                <div class="flex flex-wrap items-end gap-3">
                    <label class="block min-w-[180px] flex-1">
                        <span class="mb-2 block text-sm font-medium text-slate-700">Статус проекта</span>
                        <select
                            id="project-status-input"
                            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        >
                            ${renderProjectStatusOptions(project.status)}
                        </select>
                    </label>

                    <button
                        data-action="save-project"
                        data-project-id="${project.id}"
                        ${isSaving ? "disabled" : ""}
                        class="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        ${isSaving ? "Сохраняем..." : "Сохранить проект"}
                    </button>
                </div>
            </div>
        </div>

        <div class="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h4 class="text-base font-bold text-slate-900">Задачи проекта</h4>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        data-action="create-task"
                        data-project-id="${project.id}"
                        class="rounded-xl bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100"
                    >
                        Создать задачу
                    </button>
                    <button
                        data-action="delete-all-tasks"
                        data-project-id="${project.id}"
                        ${isDeletingAll ? "disabled" : ""}
                        class="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        ${isDeletingAll ? "Удаляем все..." : "Удалить все"}
                    </button>
                </div>
            </div>

            ${
                projectTasks.length
                    ? `
                        <div class="space-y-3">
                            ${projectTasks.map((task) => `
                                <div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                                    <div class="flex items-start justify-between gap-4">
                                        <div class="min-w-0">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <h5 class="text-[15px] font-semibold text-slate-800">${escapeHtml(task.title)}</h5>
                                                ${renderStatusBadge(task.status)}
                                            </div>
                                            <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">${escapeHtml(task.description || "Без описания")}</p>
                                        </div>
                                        <div class="flex shrink-0 items-center gap-2">
                                            <button
                                                data-action="prioritize-task"
                                                data-task-id="${task.id}"
                                                ${state.prioritizingTaskId === task.id ? "disabled" : ""}
                                                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
                                                aria-label="Сделать первой"
                                            >
                                                ${state.prioritizingTaskId === task.id ? '<i class="fa-solid fa-spinner fa-spin"></i>' : '<i class="fa-solid fa-arrow-right"></i>'}
                                            </button>
                                            <button
                                                data-action="delete-task"
                                                data-task-id="${task.id}"
                                                ${state.deletingTaskId === task.id ? "disabled" : ""}
                                                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                ${state.deletingTaskId === task.id ? "Удаляем..." : "Удалить"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    `
                    : `
                        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            У этого проекта пока нет задач.
                        </div>
                    `
            }
        </div>
    `;
}

function renderMonkeyProjectsContext() {
    const currentTask = getCurrentMonkeyTask();
    const project = currentTask ? getProjectById(currentTask.projectId) : state.projects[0] || null;

    if (!project) {
        return `
            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Проектов пока нет. В режиме обезьяны они появятся здесь только как контекст.
            </div>
        `;
    }

    return `
        <div class="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Контекст текущей работы</div>
                    <h3 class="mt-2 text-lg font-bold text-slate-900">${escapeHtml(project.title)}</h3>
                </div>
                ${renderProjectStatusBadge(project.status)}
            </div>
            <div class="space-y-4 text-sm leading-6 text-slate-600">
                <div>
                    <div class="font-semibold text-slate-800">Описание</div>
                    <div class="mt-1 whitespace-pre-wrap">${escapeHtml(project.description || "Без описания")}</div>
                </div>
                <div>
                    <div class="font-semibold text-slate-800">Материалы</div>
                    <div class="mt-1 whitespace-pre-wrap">${escapeHtml(project.materials || "Материалы не добавлены")}</div>
                </div>
            </div>
        </div>
    `;
}

function renderInboxActionButton(config) {
    const variantClasses = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/10",
        secondary: "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
        danger: "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
    };

    const timedClasses = config.timed
        ? config.variant === "danger"
            ? "timed-fill timed-fill-rose"
            : "timed-fill timed-fill-emerald"
        : "";

    return `
        <button
            data-action="${config.action}"
            data-inbox-id="${config.inboxId}"
            ${config.disabled ? "disabled" : ""}
            class="${timedClasses} rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-80 ${variantClasses[config.variant]}"
        >
            ${escapeHtml(config.label)}
        </button>
    `;
}

function renderSidebarRule(text) {
    return `
        <div class="flex items-start gap-2">
            <div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400"></div>
            <div>${escapeHtml(text)}</div>
        </div>
    `;
}

function renderModalField(field) {
    const commonInputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";
    const value = escapeHtml(field.value || "");
    const required = field.required ? "required" : "";
    const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "";
    const readonly = field.readonly ? "readonly" : "";

    if (field.type === "textarea") {
        return `
            <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">${escapeHtml(field.label)}</span>
                <textarea
                    name="${field.name}"
                    rows="${field.rows || 4}"
                    ${required}
                    ${readonly}
                    ${placeholder}
                    class="${commonInputClass}"
                >${value}</textarea>
            </label>
        `;
    }

    if (field.type === "number") {
        return `
            <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">${escapeHtml(field.label)}</span>
                <input
                    name="${field.name}"
                    type="number"
                    value="${value}"
                    min="${field.min || 1}"
                    ${required}
                    ${readonly}
                    class="${commonInputClass}"
                >
            </label>
        `;
    }

    if (field.type === "select") {
        return `
            <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">${escapeHtml(field.label)}</span>
                <select
                    name="${field.name}"
                    ${required}
                    class="${commonInputClass}"
                >
                    ${(field.options || []).map((option) => `
                        <option value="${escapeHtml(option.value)}" ${String(field.value) === String(option.value) ? "selected" : ""}>
                            ${escapeHtml(option.label)}
                        </option>
                    `).join("")}
                </select>
            </label>
        `;
    }

    return `
        <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-700">${escapeHtml(field.label)}</span>
            <input
                name="${field.name}"
                type="${field.type || "text"}"
                value="${value}"
                ${required}
                ${readonly}
                ${placeholder}
                class="${commonInputClass}"
            >
        </label>
    `;
}

function renderStatusBadge(status) {
    const colorClasses = {
        pending: "bg-slate-100 text-slate-600",
        in_progress: "bg-amber-100 text-amber-700",
        done: "bg-emerald-100 text-emerald-700",
    };

    return `
        <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold ${colorClasses[status] || "bg-slate-100 text-slate-600"}">
            ${TASK_STATUS_LABELS[status] || status}
        </span>
    `;
}

function renderProjectStatusBadge(status) {
    const colorClasses = {
        active: "bg-indigo-100 text-indigo-700",
        completed: "bg-emerald-100 text-emerald-700",
        archived: "bg-slate-100 text-slate-600",
    };

    return `
        <span class="rounded-full px-3 py-1 text-xs font-semibold ${colorClasses[status] || "bg-slate-100 text-slate-600"}">
            ${PROJECT_STATUS_LABELS[status] || status}
        </span>
    `;
}

function renderProjectStatusOptions(currentStatus) {
    return ["active", "completed", "archived"].map((status) => `
        <option value="${status}" ${currentStatus === status ? "selected" : ""}>
            ${PROJECT_STATUS_LABELS[status]}
        </option>
    `).join("");
}

function setAuthMode(mode) {
    state.authMode = mode;
    state.loginError = "";

    const authForm = getElement("auth-form");
    const emailInput = authForm.querySelector('input[name="email"]');
    const passwordInput = authForm.querySelector('input[name="password"]');
    const fullNameInput = authForm.querySelector('input[name="full_name"]');

    if (mode === AUTH_MODES.REGISTER) {
        if (emailInput.value === "user@example.com") {
            emailInput.value = "";
        }
        if (passwordInput.value === "mindflow123") {
            passwordInput.value = "";
        }
        fullNameInput.value = "";
    }

    renderAuthOverlay();
}

function openModal(config) {
    state.modal = {
        ...config,
        submitting: false,
    };
    renderModal();
}

function closeModal() {
    state.modal = null;
    renderModal();
}

function normalizeSelections() {
    const projectIds = state.projects.map((project) => project.id);
    if (!projectIds.length) {
        state.selectedProjectId = null;
        state.editingProjectId = null;
        persistNumber(STORAGE_KEYS.selectedProjectId, null);
    } else if (state.selectedProjectId != null && !projectIds.includes(state.selectedProjectId)) {
        state.selectedProjectId = null;
        persistNumber(STORAGE_KEYS.selectedProjectId, null);
    }

    if (state.editingProjectId != null && !projectIds.includes(state.editingProjectId)) {
        state.editingProjectId = null;
    }

    const queue = getMonkeyTaskQueue();
    const queueIds = queue.map((task) => task.id);
    if (!queueIds.length) {
        state.selectedMonkeyTaskId = null;
        persistNumber(STORAGE_KEYS.selectedMonkeyTaskId, null);
    } else if (!queueIds.includes(state.selectedMonkeyTaskId)) {
        state.selectedMonkeyTaskId = queueIds[0];
        persistNumber(STORAGE_KEYS.selectedMonkeyTaskId, state.selectedMonkeyTaskId);
    }

    if (state.taskFilterProjectId !== "all" && !projectIds.includes(Number(state.taskFilterProjectId))) {
        state.taskFilterProjectId = "all";
        persistString(STORAGE_KEYS.taskFilterProjectId, state.taskFilterProjectId);
    }

    if (![MODES.MONKEY, MODES.SMART].includes(state.mode)) {
        state.mode = MODES.SMART;
        persistString(STORAGE_KEYS.mode, state.mode);
    }

    normalizeVisibleSections();
}

function getCurrentProject() {
    if (!state.projects.length) {
        return null;
    }

    return state.projects.find((project) => project.id === state.selectedProjectId) || state.projects[0];
}

function getEditingProject() {
    if (state.editingProjectId == null) {
        return null;
    }

    return getProjectById(state.editingProjectId);
}

function getDefaultInboxProjectId() {
    return getCurrentProject()?.id || state.projects[0]?.id || "";
}

function getProjectById(projectId) {
    return state.projects.find((project) => project.id === projectId) || null;
}

function getTasksForProject(projectId) {
    return state.tasks
        .filter((task) => task.projectId === projectId)
        .sort(compareTasksByWave);
}

function getFrontTaskForProject(projectId) {
    return getTasksForProject(projectId).find((task) => task.status !== "done") || null;
}

function getNextWaveForProject(projectId) {
    const projectTasks = getTasksForProject(projectId);
    if (!projectTasks.length) {
        return 1;
    }

    return Math.max(...projectTasks.map((task) => task.wave)) + 1;
}

function getMonkeyTaskQueue() {
    return state.projects
        .map((project) => getFrontTaskForProject(project.id))
        .filter(Boolean);
}

function getCurrentMonkeyTask() {
    const queue = getMonkeyTaskQueue();
    if (!queue.length) {
        return null;
    }

    return queue.find((task) => task.id === state.selectedMonkeyTaskId) || queue[0];
}

function getSmartTasks() {
    let tasks = [...state.tasks];

    if (state.taskFilterProjectId !== "all") {
        const projectId = Number(state.taskFilterProjectId);
        tasks = tasks.filter((task) => task.projectId === projectId);
    }

    switch (state.taskSort) {
        case "title":
            tasks.sort((left, right) => collator.compare(left.title, right.title) || compareTasksByWave(left, right));
            break;
        case "status":
            tasks.sort((left, right) => compareTaskStatus(left.status, right.status) || compareTasksByWave(left, right));
            break;
        case "wave":
        default:
            tasks.sort(compareTasksByWave);
            break;
    }

    return tasks;
}

function hasProjectsWithoutTasks() {
    return state.projects.some((project) => !getFrontTaskForProject(project.id));
}

function compareTasksByWave(left, right) {
    return left.wave - right.wave ||
        compareTaskStatus(left.status, right.status) ||
        collator.compare(left.title, right.title);
}

function compareTaskStatus(leftStatus, rightStatus) {
    const order = {
        in_progress: 0,
        pending: 1,
        done: 2,
    };

    return (order[leftStatus] ?? 99) - (order[rightStatus] ?? 99);
}

function getProjectName(projectId) {
    return getProjectById(projectId)?.title || "Без проекта";
}

function normalizeUser(user) {
    return {
        fullName: user.full_name || "user",
        email: user.email || "",
    };
}

function normalizeInboxItem(item) {
    return {
        id: Number(item.id),
        title: item.title || "",
        text: item.text || "",
        status: item.status || "new",
        position: Number(item.position || 0),
    };
}

function normalizeProject(project) {
    return {
        id: Number(project.id),
        title: project.title || "",
        description: project.description || "",
        materials: project.materials || "",
        status: project.status || "active",
        sourceInboxId: project.source_inbox_id ? Number(project.source_inbox_id) : null,
    };
}

function normalizeTask(task) {
    return {
        id: Number(task.id),
        projectId: Number(task.project_id),
        title: task.title || "",
        description: task.description || "",
        materials: task.materials || "",
        wave: Number(task.wave || 1),
        status: task.status || "pending",
        startedAt: task.started_at || null,
        completedAt: task.completed_at || null,
    };
}

function getModalValues(formData, fields) {
    const values = {};

    fields.forEach((field) => {
        const rawValue = formData.get(field.name);
        values[field.name] = rawValue == null ? "" : String(rawValue);
    });

    return values;
}

function toNullableString(value) {
    const trimmed = String(value || "").trim();
    return trimmed ? trimmed : null;
}

function handleSessionExpired() {
    cancelHeldTaskCompletion({
        render: false,
    });
    cancelHeldInboxDelete({
        render: false,
    });
    cancelHeldProjectDelete({
        render: false,
    });
    closeSwitchGuard({
        render: false,
    });
    state.user = null;
    state.authRequired = true;
    state.loginPending = false;
    state.loginError = "";
    state.authMode = AUTH_MODES.LOGIN;
    state.inbox = [];
    state.projects = [];
    state.tasks = [];
    state.visibleSections = getAllowedSections();
    persistString(STORAGE_KEYS.visibleSections, state.visibleSections.join(","));
    state.editingProjectId = null;
    state.completingTaskId = null;
    renderAll();
}

function renderSidebarTabs() {
    const allowedSections = getAllowedSections();
    const visibleSections = getVisibleSections();
    const tabs = [
        { section: SECTIONS.INBOX, element: getElement("sidebar-tab-inbox"), card: getElement("card-inbox") },
        { section: SECTIONS.TASKS, element: getElement("sidebar-tab-tasks"), card: getElement("card-tasks") },
        { section: SECTIONS.PROJECTS, element: getElement("sidebar-tab-projects"), card: getElement("card-projects") },
    ];

    tabs.forEach(({ section, element, card }) => {
        const isAllowed = allowedSections.includes(section);
        const isActive = visibleSections.includes(section);
        if (!isAllowed) {
            element.className = "hidden";
            card.classList.add("hidden");
            return;
        }

        element.className = isActive
            ? "flex w-full items-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition-all"
            : "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200";
        element.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    renderDashboardLayout(visibleSections);
}

function renderDashboardLayout(visibleSections) {
    const layout = getElement("dashboard-layout");
    const cards = {
        [SECTIONS.INBOX]: getElement("card-inbox"),
        [SECTIONS.TASKS]: getElement("card-tasks"),
        [SECTIONS.PROJECTS]: getElement("card-projects"),
    };
    const visibleSet = new Set(visibleSections);
    const hasInbox = visibleSet.has(SECTIONS.INBOX);

    layout.className = visibleSections.length > 1
        ? "mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-6 xl:grid-cols-12"
        : "mx-auto flex max-w-[1400px] flex-col gap-6";

    Object.entries(cards).forEach(([section, card]) => {
        const isVisible = visibleSet.has(section);
        card.className = getCardLayoutClass(section, {
            isVisible,
            multiColumn: visibleSections.length > 1,
            hasInbox,
            visibleCount: visibleSections.length,
        });
    });
}

function getCardLayoutClass(section, options) {
    const baseClass = "rounded-[24px] border border-slate-100/50 bg-white p-7 shadow-sm";
    if (!options.isVisible) {
        return `hidden ${baseClass}`;
    }

    if (!options.multiColumn) {
        return baseClass;
    }

    if (options.hasInbox) {
        if (section === SECTIONS.INBOX) {
            return `${baseClass} xl:col-span-7`;
        }

        return `${baseClass} xl:col-span-5`;
    }

    if (options.visibleCount === 2) {
        return `${baseClass} xl:col-span-6`;
    }

    return `${baseClass} xl:col-span-4`;
}

function getAllowedSections() {
    return state.mode === MODES.MONKEY
        ? [SECTIONS.TASKS]
        : [SECTIONS.INBOX, SECTIONS.PROJECTS];
}

function getVisibleSections() {
    return getAllowedSections().filter((section) => state.visibleSections.includes(section));
}

function normalizeVisibleSections() {
    const allowedSections = getAllowedSections();
    const normalized = allowedSections.filter((section) => state.visibleSections.includes(section));
    state.visibleSections = normalized.length ? normalized : [...allowedSections];
    persistString(STORAGE_KEYS.visibleSections, state.visibleSections.join(","));
}

function getVisibleSectionsTitle() {
    return getVisibleSections().map(getSectionLabel).join(" + ");
}

function getSectionLabel(section) {
    switch (section) {
        case SECTIONS.TASKS:
            return "Tasks";
        case SECTIONS.PROJECTS:
            return "Projects";
        case SECTIONS.INBOX:
        default:
            return "Inbox";
    }
}

function setOptionalText(element, text) {
    element.textContent = text;
    element.classList.toggle("hidden", !text);
}

async function apiRequest(path, options = {}) {
    const {
        allowUnauthorized = false,
        skipAuthRedirect = false,
        headers = {},
        body,
        ...restOptions
    } = options;

    const response = await fetch(`${API_URL}${path}`, {
        credentials: "same-origin",
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body,
        ...restOptions,
    });

    if (allowUnauthorized && response.status === 401) {
        return null;
    }

    const payload = await readResponsePayload(response);
    if (!response.ok) {
        if (response.status === 401 && !skipAuthRedirect) {
            handleSessionExpired();
        }

        throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    return payload;
}

async function readResponsePayload(response) {
    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        console.error("Не удалось распарсить JSON:", error);
        return null;
    }
}

function pluralize(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return few;
    }
    return many;
}

function delay(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getElement(id) {
    return document.getElementById(id);
}

function loadString(key, fallbackValue) {
    const value = window.localStorage.getItem(key);
    return value == null ? fallbackValue : value;
}

function loadSectionList(key, fallbackValue) {
    const value = window.localStorage.getItem(key);
    if (!value) {
        return [...fallbackValue];
    }

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function loadNumber(key) {
    const value = window.localStorage.getItem(key);
    if (!value) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function loadBoolean(key, fallbackValue) {
    const value = window.localStorage.getItem(key);
    if (value == null) {
        return fallbackValue;
    }

    return value === "true";
}

function persistString(key, value) {
    window.localStorage.setItem(key, value);
}

function persistNumber(key, value) {
    if (value == null) {
        window.localStorage.removeItem(key);
        return;
    }

    window.localStorage.setItem(key, String(value));
}

function persistBoolean(key, value) {
    window.localStorage.setItem(key, value ? "true" : "false");
}
