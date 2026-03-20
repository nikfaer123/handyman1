const STORAGE_KEYS = {
  theme: "handyrabbit_theme_v2"
};

// Insert your credentials here OR define window.SUPABASE_URL / window.SUPABASE_ANON_KEY before app.js
const SUPABASE_URL = window.SUPABASE_URL || "https://yppxayhwvjrtuctmtece.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "sb_publishable_K38MyxI1_1M9uOHaeBNv-Q_f7cCeM6A";
const AUTH_ENDPOINT = window.AUTH_ENDPOINT || "https://handyman-backend-smd4.onrender.com/api/auth/telegram";
const API_BASE = AUTH_ENDPOINT.replace(/\/api\/auth\/telegram$/, "");

const CATEGORIES = ["Электрика", "Клининг", "Сантехника", "Сборка мебели", "Малярные работы", "Доставка"];

const TASKERS = [
  { id: "t-1", name: "Артём К.", details: "Электрик • 6 лет опыта", tags: "Щитки, проводка", rating: 4.9, priceFrom: 1800, avatar: "https://i.pravatar.cc/96?img=12" },
  { id: "t-2", name: "Елена В.", details: "Клининг • 4 года опыта", tags: "Генеральная, после ремонта", rating: 4.8, priceFrom: 2200, avatar: "https://i.pravatar.cc/96?img=32" },
  { id: "t-3", name: "Роман С.", details: "Сборка мебели • 7 лет опыта", tags: "IKEA, кухни", rating: 5, priceFrom: 2500, avatar: "https://i.pravatar.cc/96?img=22" }
];

const statusLabels = {
  new: "Новый",
  assigned: "Исполнитель назначен",
  in_progress: "В работе",
  awaiting_customer_confirmation: "Ожидает подтверждения клиента",
  done: "Завершён",
  canceled: "Отменён",
  cancelled: "Отменён",
  hidden: "Скрыт"
};

const statusRank = { new: 1, assigned: 2, in_progress: 3, awaiting_customer_confirmation: 4, done: 5, canceled: 6, cancelled: 6, hidden: 7 };

const appState = {
  supabase: null,
  authToken: null,
  isAdmin: false,
  user: null,
  profile: null,
  orders: [],
  responsesByOrder: {},
  chats: [],
  messagesByChat: {},
  ui: {
    screen: "home",
    theme: "light",
    search: "",
    sortBy: "rating",
    selectedCategory: null,
    selectedStatus: "all",
    ordersSort: "newest",
    ordersFilter: "active",
    selectedOrderId: null,
    selectedChatId: null,
    showArchivedChats: false,
    pendingDoneByTasker: {},
    expandedResponses: {}
  },
  realtime: {
    channels: {
      orders: null,
      responses: null,
      chats: null,
      messages: null
    },
    refreshTimer: null,
    isRefreshing: false,
    pendingRefresh: false,
    isBound: false
  }
};

const $ = (id) => document.getElementById(id);
const els = {
  authScreen: $("authScreen"),
  appContent: $("appContent"),
  globalLoader: $("globalLoader"),
  authForm: $("authForm"),
  roleInput: $("roleInput"),
  telegramUserInfo: $("telegramUserInfo"),

  profileName: $("profileName"),
  profileMeta: $("profileMeta"),
  profileAvatar: $("profileAvatar"),
  profileTitle: $("profileTitle"),
  profileUsername: $("profileUsername"),
  profileRole: $("profileRole"),
  profileRoleSwitcher: $("profileRoleSwitcher"),
  switchToCustomerBtn: $("switchToCustomerBtn"),
  switchToTaskerBtn: $("switchToTaskerBtn"),
  profileForm: $("profileForm"),
  profilePhone: $("profilePhone"),
  profileCity: $("profileCity"),
  profileInsights: $("profileInsights"),

  homeTitle: $("homeTitle"),
  homeSubtitle: $("homeSubtitle"),
  openTaskModal: $("openTaskModal"),
  searchInput: $("searchInput"),
  statusFilterInput: $("statusFilterInput"),
  ordersSortInput: $("ordersSortInput"),
  sortBtn: $("sortBtn"),
  categories: $("categories"),

  homeBlockATitle: $("homeBlockATitle"),
  homeBlockAList: $("homeBlockAList"),
  homeBlockAEmpty: $("homeBlockAEmpty"),
  homeBlockBTitle: $("homeBlockBTitle"),
  homeBlockBList: $("homeBlockBList"),
  homeBlockBEmpty: $("homeBlockBEmpty"),
  homeBlockCTitle: $("homeBlockCTitle"),
  homeBlockCList: $("homeBlockCList"),
  homeBlockCEmpty: $("homeBlockCEmpty"),

  ordersTitle: $("ordersTitle"),
  orderFilters: $("orderFilters"),
  ordersList: $("ordersList"),
  ordersEmpty: $("ordersEmpty"),

  orderDetailBody: $("orderDetailBody"),
  responsesList: $("responsesList"),
  responsesEmpty: $("responsesEmpty"),
  orderActions: $("orderActions"),
  respondOrderBtn: $("respondOrderBtn"),
  backToOrders: $("backToOrders"),
  responsesDialog: $("responsesDialog"),
  responsesDialogList: $("responsesDialogList"),
  closeResponsesDialog: $("closeResponsesDialog"),

  taskDialog: $("taskDialog"),
  taskForm: $("taskForm"),
  cancelDialog: $("cancelDialog"),
  taskTitle: $("taskTitle"),
  taskDescription: $("taskDescription"),
  taskCategory: $("taskCategory"),
  taskBudget: $("taskBudget"),
  taskAddress: $("taskAddress"),
  taskTime: $("taskTime"),

  responseDialog: $("responseDialog"),
  responseForm: $("responseForm"),
  responsePrice: $("responsePrice"),
  responseMessage: $("responseMessage"),
  cancelResponseDialog: $("cancelResponseDialog"),

  chatsList: $("chatsList"),
  chatsEmpty: $("chatsEmpty"),
  toggleArchivedChats: $("toggleArchivedChats"),
  chatDetail: $("chatDetail"),
  chatTitle: $("chatTitle"),
  chatMessages: $("chatMessages"),
  chatForm: $("chatForm"),
  chatInput: $("chatInput"),

  themeToggle: $("themeToggle"),
  navBar: $("bottomNav"),
  navIndicator: $("navIndicator"),
  navButtons: document.querySelectorAll(".bottom-nav button"),

  screens: {
    home: $("homeScreen"),
    orders: $("ordersScreen"),
    orderDetail: $("orderDetailScreen"),
    chats: $("chatsScreen"),
    profile: $("profileScreen")
  },

  taskerTemplate: $("taskerTemplate")
};

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function role() {
  return appState.profile?.role ?? null;
}

function showToast(message) {
  let toast = $("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setGlobalLoading(isLoading, message = "Загрузка...") {
  if (!els.globalLoader) return;
  const text = els.globalLoader.querySelector("p");
  if (text) text.textContent = message;
  els.globalLoader.classList.toggle("hidden", !isLoading);
}

function setButtonLoading(button, isLoading, loadingText = "Подождите...") {
  if (!button) return;

  const counter = Number(button.dataset.loadingCounter || "0");

  if (isLoading) {
    if (!counter) {
      button.dataset.originalText = button.textContent;
    }
    button.dataset.loadingCounter = String(counter + 1);
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  const nextCounter = Math.max(0, counter - 1);
  button.dataset.loadingCounter = String(nextCounter);
  if (nextCounter > 0) return;

  button.disabled = false;
  if (Object.prototype.hasOwnProperty.call(button.dataset, "originalText")) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

async function withLoading(task, options = {}) {
  const { button = null, global = false, loadingText = "Подождите...", globalText = "Загрузка..." } = options;
  try {
    if (button) setButtonLoading(button, true, loadingText);
    if (global) setGlobalLoading(true, globalText);
    return await task();
  } finally {
    if (button) setButtonLoading(button, false);
    if (global) setGlobalLoading(false);
  }
}

function confirmAction(message) {
  showToast(message);
  return true;
}

function parseError(error, fallback) {
  if (error) console.error("[HandyRabbit error]", error);
  if (!error) return fallback;

  const code = error.code || error.status || error.statusCode;
  const message = (error.message || "").toLowerCase();

  if (String(code) === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "Недостаточно прав для этой операции";
  }

  if (String(code) === "401" || String(code) === "403" || message.includes("jwt") || message.includes("unauthorized")) {
    return "Сессия истекла или недействительна. Перезапустите Mini App";
  }

  if (String(code) === "23505" || message.includes("duplicate key") || message.includes("already")) {
    return "Вы уже откликались на этот заказ";
  }

  if (message.includes("failed to fetch") || message.includes("network") || message.includes("offline")) {
    return "Проблема с сетью. Проверьте интернет и повторите";
  }

  return error.message || fallback;
}

function getTelegramContext() {
  if (!window.Telegram || !window.Telegram.WebApp) {
    throw new Error("Откройте приложение внутри Telegram Mini App");
  }
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  const rawInitData = tg.initData || window.DEV_INIT_DATA || "";
  if (!rawInitData) {
    throw new Error("Не получен initData из Telegram");
  }

  return {
    rawInitData,
    unsafeUser: tg.initDataUnsafe?.user || null
  };
}

async function authorizeWithBackend(rawInitData) {
  const response = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: rawInitData })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Серверная авторизация через Telegram не удалась");
  }

  if (!payload?.accessToken || !payload?.user?.id) {
    throw new Error("Сервер авторизации вернул неполные данные");
  }

  appState.authToken = payload.accessToken;
  appState.user = payload.user;
}

async function apiRequest(path, { method = "GET", body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { "Content-Type": "application/json" };
    if (appState.authToken) headers.Authorization = `Bearer ${appState.authToken}`;
    const normalizedPath = String(path || "").startsWith("/") ? path : `/${String(path || "")}`;
    const url = `${API_BASE}${normalizedPath}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Ошибка API (${response.status})`);
    }
    return payload;
  } catch (error) {
    if (String(error?.name) === "AbortError") {
      throw new Error("Сервер долго отвечает. Попробуйте ещё раз");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function notifyEvent(type, payload = {}) {
  try {
    await apiRequest("/api/notify", { method: "POST", body: { type, ...payload } });
  } catch (error) {
    console.error("[notifyEvent]", error);
  }
}

async function fetchSessionMeta() {
  try {
    const data = await apiRequest("/api/me");
    appState.isAdmin = Boolean(data?.isAdmin);
  } catch {
    appState.isAdmin = false;
  }
}

function initSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("supabase-js не подключён");
  }
  if (SUPABASE_URL.includes("YOUR_SUPABASE") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
    throw new Error("Заполните SUPABASE_URL и SUPABASE_ANON_KEY в app.js (или window переменные)");
  }
  if (!appState.authToken) {
    throw new Error("Нет access token после серверной авторизации");
  }
  appState.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${appState.authToken}`
      }
    }
  });

  if (appState.supabase.realtime?.setAuth) {
    appState.supabase.realtime.setAuth(appState.authToken);
  }
}

function loadTheme() {
  appState.ui.theme = localStorage.getItem(STORAGE_KEYS.theme) === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-theme", appState.ui.theme === "dark");
}

function toggleTheme() {
  appState.ui.theme = appState.ui.theme === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEYS.theme, appState.ui.theme);
  document.body.classList.toggle("dark-theme", appState.ui.theme === "dark");
}

async function fetchProfile() {
  const uid = String(appState.user.id);
  const { data, error } = await appState.supabase.from("profiles").select("*").eq("telegram_id", uid).maybeSingle();
  if (error) throw error;
  appState.profile = data
    ? {
        telegramId: data.telegram_id,
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        username: data.username || "user",
        role: data.role ?? null,
        phone: data.phone || "",
        city: data.city || "",
        serviceCategories: data.role === "Исполнитель" ? ["Электрика", "Клининг"] : [],
        rating: 4.8,
        createdAt: data.created_at
      }
    : null;
}

async function upsertProfile(profilePatch = {}) {
  const allowedRoles = new Set(["Клиент", "Исполнитель"]);
  let nextRole = profilePatch.role;
  if (nextRole !== undefined) {
    nextRole = allowedRoles.has(nextRole) ? nextRole : null;
  } else {
    nextRole = appState.profile?.role ?? null;
  }

  const next = {
    telegram_id: String(appState.user.id),
    first_name: profilePatch.firstName ?? appState.user.first_name ?? "",
    last_name: profilePatch.lastName ?? appState.user.last_name ?? "",
    username: profilePatch.username ?? appState.user.username ?? "user",
    role: nextRole,
    phone: profilePatch.phone ?? appState.profile?.phone ?? "",
    city: profilePatch.city ?? appState.profile?.city ?? ""
  };

  const { data, error } = await appState.supabase
    .from("profiles")
    .upsert(next, { onConflict: "telegram_id" })
    .select("*")
    .single();
  if (error) throw error;

  appState.profile = {
    telegramId: data.telegram_id,
    firstName: data.first_name || "",
    lastName: data.last_name || "",
    username: data.username || "user",
    role: data.role ?? null,
    phone: data.phone || "",
    city: data.city || "",
    serviceCategories: data.role === "Исполнитель" ? ["Электрика", "Клининг"] : [],
    rating: 4.8,
    createdAt: data.created_at
  };
}

async function fetchResponsesForOrderIds(orderIds) {
  appState.responsesByOrder = {};
  if (!orderIds.length) return;

  const { data, error } = await appState.supabase
    .from("responses")
    .select("*")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  data.forEach((row) => {
    if (!appState.responsesByOrder[row.order_id]) appState.responsesByOrder[row.order_id] = [];
    appState.responsesByOrder[row.order_id].push({
      id: row.id,
      orderId: row.order_id,
      taskerId: row.tasker_telegram_id,
      taskerName: row.tasker_name,
      price: Number(row.price || 0),
      message: row.message || "",
      createdAt: row.created_at
    });
  });
}

async function fetchOrdersForCurrentRole() {
  const uid = String(appState.profile.telegramId);
  const isCustomer = role() === "Клиент";

  let query = appState.supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (isCustomer) {
    query = query.eq("customer_telegram_id", uid);
  }

  const { data, error } = await query;
  if (error) throw error;

  appState.orders = (data || []).map((row) => ({
    id: row.id,
    customerId: row.customer_telegram_id,
    title: row.title,
    description: row.description,
    category: row.category,
    budget: Number(row.budget || 0),
    address: row.address,
    preferredTime: row.preferred_time,
    createdAt: row.created_at,
    status: row.status,
    assignedTasker: row.assigned_tasker_telegram_id
      ? {
          id: row.assigned_tasker_telegram_id,
          name: row.assigned_tasker_name,
          price: null
        }
      : null,
    chatId: null
  }));

  const orderIds = appState.orders.map((o) => o.id);
  await fetchResponsesForOrderIds(orderIds);
}

async function createOrder(payload) {
  const record = {
    customer_telegram_id: String(appState.profile.telegramId),
    title: payload.title,
    description: payload.description,
    category: payload.category,
    budget: payload.budget,
    address: payload.address,
    preferred_time: payload.preferredTime,
    status: "new"
  };

  const { error } = await appState.supabase.from("orders").insert(record);
  if (error) throw error;
}

async function createResponse(orderId, payload) {
  const uid = String(appState.profile.telegramId);

  const localExisting = (appState.responsesByOrder[orderId] || []).some((r) => r.taskerId === uid);
  if (localExisting) throw new Error("Вы уже откликались на этот заказ");

  const { data: existing, error: checkError } = await appState.supabase
    .from("responses")
    .select("id")
    .eq("order_id", orderId)
    .eq("tasker_telegram_id", uid)
    .maybeSingle();

  if (checkError) throw checkError;
  if (existing) throw new Error("Вы уже откликались на этот заказ");

  const response = {
    order_id: orderId,
    tasker_telegram_id: uid,
    tasker_name: `${appState.profile.firstName || "Исполнитель"} ${appState.profile.lastName || ""}`.trim(),
    price: payload.price,
    message: payload.message
  };

  const { error } = await appState.supabase.from("responses").insert(response);
  if (error) throw error;
}

async function ensureChat(order) {
  const { data: existing, error: existingErr } = await appState.supabase
    .from("chats")
    .select("*")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing) return existing.id;

  const insert = {
    order_id: order.id,
    customer_telegram_id: order.customerId,
    tasker_telegram_id: order.assignedTasker.id
  };

  const { data, error } = await appState.supabase.from("chats").insert(insert).select("*").single();
  if (error) throw error;
  return data.id;
}

async function assignTasker(orderId, taskerTelegramId, taskerName) {
  const payload = await apiRequest("/api/orders/assign-tasker", {
    method: "POST",
    body: {
      orderId,
      taskerTelegramId,
      taskerName
    }
  });

  return payload?.order || null;
}

async function updateOrderStatus(orderId, status) {
  const { error } = await appState.supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

async function fetchChats() {
  const uid = String(appState.profile.telegramId);
  const { data, error } = await appState.supabase
    .from("chats")
    .select("*")
    .or(`customer_telegram_id.eq.${uid},tasker_telegram_id.eq.${uid}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  appState.chats = (data || []).filter(
    (chat) =>
      String(chat.customer_telegram_id) === uid ||
      String(chat.tasker_telegram_id) === uid
  );
}

async function fetchMessages(chatId) {
  const uid = String(appState.profile.telegramId);
  const chat = appState.chats.find((c) => c.id === chatId);

  if (!chat) {
    appState.messagesByChat[chatId] = [];
    throw new Error("Чат недоступен");
  }

  const isParticipant =
    String(chat.customer_telegram_id) === uid ||
    String(chat.tasker_telegram_id) === uid;

  if (!isParticipant) {
    appState.messagesByChat[chatId] = [];
    throw new Error("Нет доступа к чату");
  }

  const { data, error } = await appState.supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  appState.messagesByChat[chatId] = data || [];
}

async function sendMessage(chatId, text) {
  const record = {
    chat_id: chatId,
    sender_telegram_id: String(appState.profile.telegramId),
    text
  };

  const { error } = await appState.supabase.from("messages").insert(record);
  if (error) throw error;
}

function updateNavIndicator() {
  const active = [...els.navButtons].find((btn) => btn.classList.contains("active"));
  if (!active) return;
  const navRect = els.navBar.getBoundingClientRect();
  const btnRect = active.getBoundingClientRect();
  const x = btnRect.left - navRect.left + (btnRect.width - 36) / 2;
  els.navIndicator.style.transform = `translateX(${x}px)`;
}

function setScreen(name) {
  appState.ui.screen = name;
  Object.entries(els.screens).forEach(([key, node]) => node.classList.toggle("hidden", key !== name));
  els.navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.screen === name));
  requestAnimationFrame(updateNavIndicator);
}

function syncRoleUI() {
  const currentRole = role();
  const isCustomer = currentRole === "Клиент";
  const isTasker = currentRole === "Исполнитель";

  if (!currentRole) {
    els.openTaskModal.classList.add("hidden");
    els.sortBtn.classList.add("hidden");
    els.homeTitle.textContent = "Профиль";
    els.homeSubtitle.textContent = "Выберите роль, чтобы продолжить";
    return;
  }

  els.openTaskModal.classList.toggle("hidden", !isCustomer);
  els.sortBtn.classList.toggle("hidden", !isCustomer && !isTasker);

  els.homeTitle.textContent = isCustomer ? "Панель клиента" : "Панель исполнителя";
  els.homeSubtitle.textContent = isCustomer
    ? "Создавайте заказы, отслеживайте отклики и выбирайте исполнителя"
    : "Смотрите новые заявки, управляйте откликами и активными работами";
}

async function switchRole(nextRole, button = null) {
  const currentRole = role();
  if (!nextRole || nextRole === currentRole) return;

  await withLoading(async () => {
    await upsertProfile({ role: nextRole });
    syncRoleUI();
    await refreshData();
    updateProfileUI();
    setProfileFormEditable(false);
    showToast(`Роль переключена: ${nextRole}`);
  }, {
    button,
    loadingText: "Переключаем..."
  });
}

function updateProfileUI() {
  const p = appState.profile;
  if (!p) return;

  const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Пользователь";
  const roleLabel = p.role || "Роль не выбрана";
  els.telegramUserInfo.textContent = `@${p.username} • id: ${p.telegramId}`;
  els.profileName.textContent = p.firstName || "друг";
  els.profileMeta.textContent = `@${p.username} • ${roleLabel}`;

  els.profileAvatar.src = `https://i.pravatar.cc/160?u=${p.telegramId}`;
  els.profileTitle.textContent = fullName;
  els.profileUsername.textContent = `Telegram: @${p.username}`;
  els.profileRole.textContent = `Роль: ${roleLabel}`;
  if (els.switchToCustomerBtn && els.switchToTaskerBtn) {
  const isCustomer = p.role === "Клиент";
  const isTasker = p.role === "Исполнитель";

  els.switchToCustomerBtn.classList.toggle("active-role", isCustomer);
  els.switchToTaskerBtn.classList.toggle("active-role", isTasker);

  els.switchToCustomerBtn.disabled = isCustomer;
  els.switchToTaskerBtn.disabled = isTasker;
}
  els.profilePhone.value = p.phone || "";
  els.profileCity.value = p.city || "";

  if (p.role === "Клиент") {
    const myOrders = appState.orders.filter((o) => o.customerId === p.telegramId);
    els.profileInsights.textContent = myOrders.length ? `История заказов: ${myOrders.length}` : "История пуста";
  } else {
    const done = appState.orders.filter((o) => o.assignedTasker?.id === p.telegramId && o.status === "done").length;
    els.profileInsights.textContent = `Категории: ${(p.serviceCategories || []).join(", ")} • Рейтинг: ${p.rating || 0} • Завершено: ${done}`;
  }
}

function setProfileFormEditable(editable) {
  els.profilePhone.disabled = !editable;
  els.profileCity.disabled = !editable;
  els.profilePhone.classList.toggle("readonly", !editable);
  els.profileCity.classList.toggle("readonly", !editable);

  let editBtn = document.getElementById("profileEditBtn");
  if (!editBtn && els.profileForm) {
    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.id = "profileEditBtn";
    editBtn.className = "secondary-btn";
    editBtn.textContent = "Редактировать";
    editBtn.addEventListener("click", () => setProfileFormEditable(true));
    els.profileForm.append(editBtn);
  }

  if (editBtn) {
    editBtn.classList.toggle("hidden", editable);
  }
}

function validatePhone(phone) {
  return /^\+7\d{10}$/.test(phone);
}

function validateCity(city) {
  return /^[A-Za-zА-Яа-яЁё\s-]+$/.test(city);
}

function passFilters(orderList) {
  let list = [...orderList];
  if (appState.ui.search) {
    const q = appState.ui.search.toLowerCase();
    list = list.filter((o) => `${o.title} ${o.description} ${o.category} ${o.address}`.toLowerCase().includes(q));
  }
  if (appState.ui.selectedCategory) {
    list = list.filter((o) => o.category === appState.ui.selectedCategory);
  }
  if (appState.ui.selectedStatus !== "all") {
    list = list.filter((o) => (o.status || "") === appState.ui.selectedStatus);
  }

  if (appState.ui.ordersSort === "oldest") {
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (appState.ui.ordersSort === "status") {
    list.sort((a, b) => (statusRank[a.status] || 99) - (statusRank[b.status] || 99));
  } else if (appState.ui.ordersSort === "responses") {
    list.sort((a, b) => (b.responses?.length || 0) - (a.responses?.length || 0));
  } else {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return list;
}

function enrichOrdersWithResponses() {
  appState.orders.forEach((order) => {
    order.responses = appState.responsesByOrder[order.id] || [];
  });
}

function getRoleCollections() {
  const uid = String(appState.profile.telegramId);
  const isCustomer = role() === "Клиент";

  if (isCustomer) {
    const mine = appState.orders.filter((o) => o.customerId === uid);
    const withResponses = mine.filter((o) => (o.responses || []).length > 0);
    return {
      active: mine.filter((o) => ["new", "assigned", "in_progress"].includes(o.status) && !(o.responses || []).length),
      done: mine.filter((o) => o.status === "done"),
      cancelled: mine.filter((o) => o.status === "canceled"),
      responses: withResponses
    };
  }

  return {
    newOrders: appState.orders.filter((o) => o.status === "new" && o.customerId !== uid),
    myResponses: appState.orders.filter((o) => (o.responses || []).some((r) => r.taskerId === uid)),
    myActive: appState.orders.filter((o) => o.assignedTasker?.id === uid && ["assigned", "in_progress"].includes(o.status)),
    done: appState.orders.filter((o) => o.assignedTasker?.id === uid && o.status === "done")
  };
}

function renderCategories() {
  els.categories.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = `chip${appState.ui.selectedCategory === cat ? " active" : ""}`;
    chip.type = "button";
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      appState.ui.selectedCategory = appState.ui.selectedCategory === cat ? null : cat;
      renderCategories();
      renderHomeScreen();
      renderOrders();
    });
    els.categories.append(chip);
  });

  els.taskCategory.innerHTML = CATEGORIES.map((cat) => `<option>${cat}</option>`).join("");
}

function createOrderListItem(order, buttonLabel = "Детали") {
  const card = document.createElement("article");
  card.className = "order-card soft-card raised";
  card.innerHTML = `
    <div>
      <h4>${order.title}</h4>
      <p class="details">${order.category} • ${order.budget} ₽ • ${order.address}</p>
    </div>
    <div class="stack-right">
      <span class="status ${order.status}">${statusLabels[order.status]}</span>
      <button type="button" class="secondary-btn slim" data-action="open-order" data-id="${order.id}">${buttonLabel}</button>
    </div>
  `;
  return card;
}

function createTaskerCard(tasker) {
  const node = els.taskerTemplate.content.cloneNode(true);
  node.querySelector(".avatar").src = tasker.avatar;
  node.querySelector(".name").textContent = tasker.name;
  node.querySelector(".details").textContent = tasker.details;
  node.querySelector(".tags").textContent = tasker.tags;
  node.querySelector(".rating").textContent = `★ ${tasker.rating.toFixed(1)}`;
  node.querySelector(".price").textContent = `от ${tasker.priceFrom} ₽`;
  const btn = node.querySelector("button");
  btn.type = "button";
  btn.dataset.action = "quick-order";
  btn.dataset.tasker = tasker.name;
  return node;
}

function renderHomeScreen() {
  const isCustomer = role() === "Клиент";
  const collections = getRoleCollections();

  ["A", "B", "C"].forEach((key) => {
    els[`homeBlock${key}List`].innerHTML = "";
    els[`homeBlock${key}Empty`].classList.add("hidden");
  });

  if (isCustomer) {
    els.homeBlockATitle.textContent = "Мои активные заказы";
    const active = passFilters(collections.active);
    if (!active.length) {
      els.homeBlockAEmpty.textContent = "У вас пока нет заказов";
      els.homeBlockAEmpty.classList.remove("hidden");
    } else {
      active.forEach((o) => els.homeBlockAList.append(createOrderListItem(o)));
    }

    els.homeBlockBTitle.textContent = "Отклики по моим заказам";
    const withResponses = passFilters(collections.responses);
    if (!withResponses.length) {
      els.homeBlockBEmpty.textContent = "Откликов пока нет";
      els.homeBlockBEmpty.classList.remove("hidden");
    } else {
      withResponses.forEach((o) => {
        const card = createOrderListItem(o, `Отклики: ${o.responses.length}`);
        els.homeBlockBList.append(card);
      });
    }

    els.homeBlockCTitle.textContent = "Рекомендованные исполнители";
    let taskers = [...TASKERS];
    if (appState.ui.search) {
      const q = appState.ui.search.toLowerCase();
      taskers = taskers.filter((t) => `${t.name} ${t.details} ${t.tags}`.toLowerCase().includes(q));
    }
    if (appState.ui.selectedCategory) {
      taskers = taskers.filter((t) => `${t.details} ${t.tags}`.toLowerCase().includes(appState.ui.selectedCategory.toLowerCase()));
    }
    taskers.sort((a, b) => (appState.ui.sortBy === "price" ? a.priceFrom - b.priceFrom : b.rating - a.rating));

    if (!taskers.length) {
      els.homeBlockCEmpty.textContent = "Исполнители не найдены";
      els.homeBlockCEmpty.classList.remove("hidden");
    } else {
      taskers.forEach((t) => els.homeBlockCList.append(createTaskerCard(t)));
    }
  } else {
    els.homeBlockATitle.textContent = "Новые заказы";
    const newOrders = passFilters(collections.newOrders);
    if (!newOrders.length) {
      els.homeBlockAEmpty.textContent = "Нет доступных заказов";
      els.homeBlockAEmpty.classList.remove("hidden");
    } else {
      newOrders.forEach((o) => els.homeBlockAList.append(createOrderListItem(o, "Откликнуться")));
    }

    els.homeBlockBTitle.textContent = "Мои отклики";
    const myResponses = passFilters(collections.myResponses);
    if (!myResponses.length) {
      els.homeBlockBEmpty.textContent = "Вы ещё не откликались";
      els.homeBlockBEmpty.classList.remove("hidden");
    } else {
      myResponses.forEach((o) => els.homeBlockBList.append(createOrderListItem(o, "Открыть")));
    }

    els.homeBlockCTitle.textContent = "Мои активные заказы";
    const myActive = passFilters(collections.myActive);
    if (!myActive.length) {
      els.homeBlockCEmpty.textContent = "Нет назначенных активных заказов";
      els.homeBlockCEmpty.classList.remove("hidden");
    } else {
      myActive.forEach((o) => els.homeBlockCList.append(createOrderListItem(o, "В работу")));
    }
  }
}

function renderOrders() {
  const collections = getRoleCollections();
  const isCustomer = role() === "Клиент";

  const filters = isCustomer
    ? [
        { key: "active", label: "Active" },
        { key: "done", label: "Done" },
        { key: "canceled", label: "Cancelled" }
      ]
    : [
        { key: "new", label: "Доступные" },
        { key: "responses", label: "Мои отклики" },
        { key: "mine", label: "Мои активные" }
      ];

  if (!filters.some((f) => f.key === appState.ui.ordersFilter)) appState.ui.ordersFilter = filters[0].key;

  els.ordersTitle.textContent = isCustomer ? "Мои заказы" : "Заказы исполнителя";
  els.orderFilters.innerHTML = filters
    .map((f) => `<button type="button" data-filter="${f.key}" class="filter-btn ${appState.ui.ordersFilter === f.key ? "active" : ""}">${f.label}</button>`)
    .join("");

  let list = [];
  if (isCustomer) {
    if (appState.ui.ordersFilter === "active") list = collections.active;
    if (appState.ui.ordersFilter === "done") list = collections.done;
    if (appState.ui.ordersFilter === "canceled") list = collections.cancelled;
  } else {
    if (appState.ui.ordersFilter === "new") list = collections.newOrders;
    if (appState.ui.ordersFilter === "responses") list = collections.myResponses;
    if (appState.ui.ordersFilter === "mine") list = collections.myActive;
  }

  list = passFilters(list);

  els.ordersList.innerHTML = "";
  els.ordersEmpty.classList.toggle("hidden", list.length > 0);
  if (!list.length) {
    els.ordersEmpty.textContent = "Заказов пока нет";
    return;
  }

  list.forEach((o) => els.ordersList.append(createOrderListItem(o)));
}

function getVisibleResponsesForOrder(order) {
  const isCustomer = role() === "Клиент";
  const myId = String(appState.profile.telegramId);

  return (isCustomer
    ? order.responses || []
    : (order.responses || []).filter((r) => r.taskerId === myId)
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function openResponsesArchive(order) {
  if (!els.responsesDialog || !els.responsesDialogList) return;

  const visible = getVisibleResponsesForOrder(order);
  els.responsesDialogList.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "details";
    empty.textContent = "Откликов пока нет";
    els.responsesDialogList.append(empty);
  } else {
    const isCustomer = role() === "Клиент";

    visible.forEach((r) => {
      const card = document.createElement("article");
      card.className = "order-card soft-card raised";
      card.innerHTML = `
        <div>
          <h4>${r.taskerName}</h4>
          <p class="details">${r.message}</p>
          <p class="details">${r.price} ₽ • ${new Date(r.createdAt).toLocaleString("ru-RU")}</p>
        </div>
      `;

      if (isCustomer && order.status === "new") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "primary-btn small";
        btn.textContent = "Выбрать исполнителя";
        btn.onclick = async () => {
          try {
            if (!confirmAction("Принять этого исполнителя?")) return;
            await assignTasker(order.id, r.taskerId, r.taskerName);
            await notifyEvent("tasker_assigned", { orderId: order.id, taskerTelegramId: r.taskerId });
            els.responsesDialog.close();
            await refreshData();
            renderOrderDetail();
            showToast("Исполнитель выбран");
          } catch (error) {
            showToast(parseError(error, "Не удалось назначить исполнителя"));
          }
        };
        card.append(btn);
      }

      els.responsesDialogList.append(card);
    });
  }

  els.responsesDialog.showModal();
}

function renderResponses(order) {
  els.responsesList.innerHTML = "";

  const visible = getVisibleResponsesForOrder(order);

  els.responsesEmpty.classList.toggle("hidden", visible.length > 0);
  if (!visible.length) {
    els.responsesEmpty.textContent = "Откликов пока нет";
    return;
  }

  const limit = 3;
  const source = visible.slice(0, limit);
  const isCustomer = role() === "Клиент";

  source.forEach((r) => {
    const card = document.createElement("article");
    card.className = "order-card soft-card raised";
    card.innerHTML = `
      <div>
        <h4>${r.taskerName}</h4>
        <p class="details">${r.message}</p>
        <p class="details">${r.price} ₽ • ${new Date(r.createdAt).toLocaleString("ru-RU")}</p>
      </div>
    `;

    if (isCustomer && order.status === "new") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary-btn small";
      btn.textContent = "Выбрать исполнителя";
      btn.onclick = async () => {
        try {
          if (!confirmAction("Принять этого исполнителя?")) return;
          await assignTasker(order.id, r.taskerId, r.taskerName);
          await notifyEvent("tasker_assigned", { orderId: order.id, taskerTelegramId: r.taskerId });
          await refreshData();
          renderOrderDetail();
          showToast("Исполнитель выбран");
        } catch (error) {
          showToast(parseError(error, "Не удалось назначить исполнителя"));
        }
      };
      card.append(btn);
    }

    els.responsesList.append(card);
  });

  if (visible.length > limit) {
    const openArchiveBtn = document.createElement("button");
    openArchiveBtn.type = "button";
    openArchiveBtn.className = "secondary-btn slim";
    openArchiveBtn.textContent = `Показать все (${visible.length})`;
    openArchiveBtn.onclick = () => openResponsesArchive(order);
    els.responsesList.append(openArchiveBtn);
  }
}

    if (appState.isAdmin) {
      const blockBtn = document.createElement("button");
      blockBtn.type = "button";
      blockBtn.className = "secondary-btn slim";
      blockBtn.textContent = "Блокировать";
      blockBtn.onclick = async () => {
        const reason = prompt("Причина блокировки:", "Нарушение правил") || "Заблокирован администратором";
        if (!confirmAction(`Заблокировать @${r.taskerName}?`)) return;
        try {
          await apiRequest("/api/admin/block-user", {
            method: "POST",
            body: { targetTelegramId: r.taskerId, reason }
          });
          showToast("Пользователь заблокирован");
        } catch (error) {
          showToast(parseError(error, "Не удалось заблокировать пользователя"));
        }
      };
      card.append(blockBtn);
    }

    els.responsesList.append(card);

  if (visible.length > limit) {
    const openArchiveBtn = document.createElement("button");
    openArchiveBtn.type = "button";
    openArchiveBtn.className = "secondary-btn slim";
    openArchiveBtn.textContent = `Показать все (${visible.length})`;
    openArchiveBtn.onclick = () => openResponsesArchive(order);
    els.responsesList.append(openArchiveBtn);
  }
  

function renderOrderDetail() {
  const order = appState.orders.find((o) => o.id === appState.ui.selectedOrderId);
  if (!order) return;

  const isCustomer = role() === "Клиент";
  const myId = String(appState.profile.telegramId);
  const isAssignedTasker = order.assignedTasker?.id === myId;
  const assignedText = order.assignedTasker ? `${order.assignedTasker.name}` : "—";

  els.orderDetailBody.innerHTML = `
    <p><strong>Описание:</strong> ${order.description}</p>
    <p><strong>Категория:</strong> ${order.category}</p>
    <p><strong>Бюджет:</strong> ${order.budget} ₽</p>
    <p><strong>Адрес:</strong> ${order.address}</p>
    <p><strong>Время:</strong> ${order.preferredTime}</p>
    <p><strong>Статус:</strong> ${statusLabels[order.status]}</p>
    <p><strong>Исполнитель:</strong> ${assignedText}</p>
  `;

  els.orderActions.innerHTML = "";
  els.respondOrderBtn.classList.add("hidden");

  const addAction = (label, fn, primary = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = primary ? "primary-btn small" : "secondary-btn slim";
    btn.textContent = label;
    btn.onclick = () => withLoading(() => fn(), { button: btn, loadingText: "Подождите..." });
    els.orderActions.append(btn);
  };

  if (isCustomer && order.status === "new") {
    addAction("Отменить заказ", async () => {
      try {
        if (!confirmAction("Отменить заказ?")) return;
        await updateOrderStatus(order.id, "canceled");
        await notifyEvent("order_canceled", { orderId: order.id });
        await refreshData();
        renderOrderDetail();
        showToast("Заказ отменён");
      } catch (error) {
        showToast(parseError(error, "Ошибка обновления статуса"));
      }
    });
  }

  if (!isCustomer && order.status === "new") {
    els.respondOrderBtn.classList.remove("hidden");
  }

  if (!isCustomer && isAssignedTasker && order.status === "assigned") {
    addAction("Начать работу", async () => {
      try {
        await updateOrderStatus(order.id, "in_progress");
        await refreshData();
        renderOrderDetail();
        showToast("Работа начата");
      } catch (error) {
        showToast(parseError(error, "Ошибка обновления статуса"));
      }
    }, true);
  }

  if (!isCustomer && isAssignedTasker && order.status === "in_progress") {
    addAction("Запросить завершение", async () => {
      try {
        await apiRequest("/api/orders/complete-action", {
          method: "POST",
          body: { orderId: order.id, action: "request_by_tasker" }
        });
        await refreshData();
        renderOrderDetail();
        showToast("Ожидает подтверждения клиента");
      } catch (error) {
        showToast(parseError(error, "Ошибка обновления статуса"));
      }
    }, true);
  }

  if (isCustomer && order.status === "awaiting_customer_confirmation") {
    addAction("Подтвердить завершение", async () => {
      try {
        await apiRequest("/api/orders/complete-action", {
          method: "POST",
          body: { orderId: order.id, action: "confirm_by_customer" }
        });
        await refreshData();
        renderOrderDetail();
        showToast("Заказ завершён");
      } catch (error) {
        showToast(parseError(error, "Ошибка обновления статуса"));
      }
    }, true);
  }

  if (order.assignedTasker) {
    addAction("Открыть чат", async () => {
      try {
        const chatId = await ensureChat(order);
        await refreshData();
        setScreen("chats");
        await openChat(chatId);
      } catch (error) {
        showToast(parseError(error, "Не удалось открыть чат"));
      }
    });
  }

  if (appState.isAdmin) {
    addAction("Скрыть заказ", async () => {
      const reason = prompt("Причина скрытия:", "Нарушение правил") || "Скрыто администратором";
      if (!confirmAction("Скрыть заказ для пользователей?")) return;
      try {
        await apiRequest("/api/admin/order-action", { method: "POST", body: { orderId: order.id, action: "hide", reason } });
        await refreshData();
        showToast("Заказ скрыт");
      } catch (error) {
        showToast(parseError(error, "Не удалось скрыть заказ"));
      }
    });

    addAction("Админ: завершить", async () => {
      if (!confirmAction("Принудительно завершить заказ?")) return;
      try {
        await apiRequest("/api/admin/order-action", { method: "POST", body: { orderId: order.id, action: "force_done" } });
        await refreshData();
        showToast("Заказ завершён админом");
      } catch (error) {
        showToast(parseError(error, "Не удалось завершить заказ"));
      }
    });

    addAction("Админ: отменить", async () => {
      if (!confirmAction("Принудительно отменить заказ?")) return;
      try {
        await apiRequest("/api/admin/order-action", { method: "POST", body: { orderId: order.id, action: "force_canceled" } });
        await refreshData();
        showToast("Заказ отменён админом");
      } catch (error) {
        showToast(parseError(error, "Не удалось отменить заказ"));
      }
    });
  }

  renderResponses(order);
}

function renderChats() {
  const uid = String(appState.profile.telegramId);
  const available = appState.chats
    .filter((c) => c.customer_telegram_id === uid || c.tasker_telegram_id === uid)
    .sort((a, b) => {
      if (a.id === appState.ui.selectedChatId) return -1;
      if (b.id === appState.ui.selectedChatId) return 1;

      const orderA = appState.orders.find((o) => o.id === a.order_id);
      const orderB = appState.orders.find((o) => o.id === b.order_id);

      const messagesA = appState.messagesByChat[a.id] || [];
      const messagesB = appState.messagesByChat[b.id] || [];
      const updatedA = messagesA[messagesA.length - 1]?.created_at || a.created_at;
      const updatedB = messagesB[messagesB.length - 1]?.created_at || b.created_at;

      return new Date(updatedB) - new Date(updatedA);
    });

  const openChats = [];
  const closedChats = [];

  available.forEach((chat) => {
    const order = appState.orders.find((o) => o.id === chat.order_id);
    if (["done", "canceled", "cancelled", "hidden"].includes(order?.status)) {
      closedChats.push(chat);
    } else {
      openChats.push(chat);
    }
  });

  const visibleChats = appState.ui.showArchivedChats ? closedChats : openChats;

  els.chatsList.innerHTML = "";
  els.chatDetail.classList.add("hidden");
  els.chatsEmpty.classList.toggle("hidden", visibleChats.length > 0);

  if (els.toggleArchivedChats) {
    els.toggleArchivedChats.textContent = appState.ui.showArchivedChats
      ? "Показать активные"
      : "Показать архив";
  }

  if (!visibleChats.length) {
    els.chatsEmpty.textContent = appState.ui.showArchivedChats
      ? "Архивных чатов пока нет"
      : "Активных чатов пока нет";
    return;
  }

  visibleChats.forEach((chat) => {
    const order = appState.orders.find((o) => o.id === chat.order_id);
    const messages = appState.messagesByChat[chat.id] || [];
    const last = messages[messages.length - 1];

    const card = document.createElement("article");
    card.className = "chat-item soft-card raised";
    card.innerHTML = `
      <div>
        <h4>${order?.title || "Заказ"}</h4>
        <p class="details">${last?.text || "Нет сообщений"}</p>
      </div>
      <button class="secondary-btn slim" data-chat-id="${chat.id}" type="button">Открыть</button>
    `;
    els.chatsList.append(card);
  });
}

async function openChat(chatId) {
    const uid = String(appState.profile.telegramId);
    const chat = appState.chats.find((c) => c.id === chatId);

  if (!chat) {
    showToast("Чат недоступен");
    return;
  }

  const isParticipant =
    String(chat.customer_telegram_id) === uid ||
    String(chat.tasker_telegram_id) === uid;

  if (!isParticipant) {
    showToast("Нет доступа к этому чату");
    return;
  }

  await fetchMessages(chatId);
  appState.ui.selectedChatId = chatId;

  // chat уже объявлен выше 
  // просто используем его 
  if (!chat) return;

  const order = appState.orders.find((o) => o.id === chat.order_id);
  els.chatTitle.textContent = `Чат: ${order?.title || "Заказ"}`;
  els.chatMessages.innerHTML = "";

  const isClosedChat = ["done", "canceled", "cancelled", "hidden"].includes(order?.status);

  if (isClosedChat) {
  const notice = document.createElement("p");
  notice.className = "details";
  notice.textContent = "Заказ завершён. Чат доступен только для чтения.";
  els.chatMessages.append(notice);
}

  const chatSubmitBtn = els.chatForm.querySelector("button[type='submit']");

  els.chatInput.disabled = isClosedChat;
  els.chatInput.required = !isClosedChat;
  els.chatInput.placeholder = isClosedChat
  ? "Чат закрыт, отправка сообщений недоступна"
  : "Введите сообщение";

if (chatSubmitBtn) {
  chatSubmitBtn.disabled = isClosedChat;
  chatSubmitBtn.textContent = isClosedChat ? "Чат закрыт" : "Отправить";
}

  els.chatForm.classList.toggle("readonly", isClosedChat);

  if (!(appState.messagesByChat[chatId] || []).length) {
    const empty = document.createElement("p");
    empty.className = "details";
    empty.textContent = "Сообщений пока нет";
    els.chatMessages.append(empty);
  }

  (appState.messagesByChat[chatId] || []).forEach((msg) => {
    const mine = String(msg.sender_telegram_id) === String(appState.profile.telegramId);
    const p = document.createElement("p");
    p.className = `message ${mine ? "mine" : ""}`;
    p.textContent = msg.text;
    els.chatMessages.append(p);
  });

  els.chatDetail.classList.remove("hidden");
}

async function refreshData() {
  await fetchOrdersForCurrentRole();
  enrichOrdersWithResponses();
  await fetchChats();
  await Promise.all(appState.chats.map((chat) => fetchMessages(chat.id)));

  syncRoleUI();
  renderHomeScreen();
  renderOrders();
  renderChats();
  updateProfileUI();
}

function hasSupabaseRealtime() {
  return Boolean(appState.supabase && appState.supabase.channel);
}

function scheduleRealtimeRefresh() {
  if (!appState.profile) return;

  clearTimeout(appState.realtime.refreshTimer);
  appState.realtime.refreshTimer = setTimeout(async () => {
    if (appState.realtime.isRefreshing) {
      appState.realtime.pendingRefresh = true;
      return;
    }

    appState.realtime.isRefreshing = true;
    try {
      await refreshData();
      if (appState.ui.screen === "orderDetail" && appState.ui.selectedOrderId) {
        renderOrderDetail();
      }
    } catch {
      // silent realtime fallback
    } finally {
      appState.realtime.isRefreshing = false;
      if (appState.realtime.pendingRefresh) {
        appState.realtime.pendingRefresh = false;
        scheduleRealtimeRefresh();
      }
    }
  }, 250);
}

async function handleRealtimeMessage(payload) {
  const chatId = payload?.new?.chat_id || payload?.old?.chat_id;
  if (!chatId) {
    scheduleRealtimeRefresh();
    return;
  }

  try {
    await fetchMessages(chatId);
    renderChats();
    if (appState.ui.selectedChatId === chatId) {
      await openChat(chatId);
    }
  } catch {
    scheduleRealtimeRefresh();
  }
}

function subscribeToOrders() {
  if (appState.realtime.channels.orders || !hasSupabaseRealtime()) return;
  appState.realtime.channels.orders = appState.supabase
    .channel(`orders-live-${appState.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      scheduleRealtimeRefresh();
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        scheduleRealtimeRefresh();
      }
    });
}

function subscribeToResponses() {
  if (appState.realtime.channels.responses || !hasSupabaseRealtime()) return;
  appState.realtime.channels.responses = appState.supabase
    .channel(`responses-live-${appState.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, () => {
      scheduleRealtimeRefresh();
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        scheduleRealtimeRefresh();
      }
    });
}

function subscribeToChats() {
  if (appState.realtime.channels.chats || !hasSupabaseRealtime()) return;
  appState.realtime.channels.chats = appState.supabase
    .channel(`chats-live-${appState.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
      scheduleRealtimeRefresh();
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        scheduleRealtimeRefresh();
      }
    });
}

function subscribeToMessages() {
  if (appState.realtime.channels.messages || !hasSupabaseRealtime()) return;
  appState.realtime.channels.messages = appState.supabase
    .channel(`messages-live-${appState.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload) => {
      await handleRealtimeMessage(payload);
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        scheduleRealtimeRefresh();
      }
    });
}

function initRealtimeSubscriptions() {
  if (!appState.profile || !hasSupabaseRealtime()) return;
  subscribeToOrders();
  subscribeToResponses();
  subscribeToChats();
  subscribeToMessages();
}

function destroyRealtimeSubscriptions() {
  if (!hasSupabaseRealtime()) return;

  Object.values(appState.realtime.channels).forEach((channel) => {
    if (channel) appState.supabase.removeChannel(channel);
  });

  appState.realtime.channels = {
    orders: null,
    responses: null,
    chats: null,
    messages: null
  };
  clearTimeout(appState.realtime.refreshTimer);
}

async function bindEvents() {
  if (appState.realtime.isBound) return;
  appState.realtime.isBound = true;

  if (els.switchToCustomerBtn) {
    els.switchToCustomerBtn.addEventListener("click", async (e) => {
      try {
        await switchRole("Клиент", e.currentTarget);
      } catch (error) {
        showToast(parseError(error, "Не удалось переключить роль"));
      }
    });
  }

  if (els.switchToTaskerBtn) {
    els.switchToTaskerBtn.addEventListener("click", async (e) => {
      try {
        await switchRole("Исполнитель", e.currentTarget);
      } catch (error) {
        showToast(parseError(error, "Не удалось переключить роль"));
      }
    });
  }

 els.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await withLoading(async () => {
    try {
      const selectedRole = els.roleInput.value;
      if (!["Клиент", "Исполнитель"].includes(selectedRole)) {
        showToast("Выберите роль");
        return;
      }

      await upsertProfile({ role: selectedRole });
      syncRoleUI();

      els.authScreen.classList.add("hidden");
      els.appContent.classList.remove("hidden");

      await refreshData();
      updateProfileUI();
      setProfileFormEditable(false);
      initRealtimeSubscriptions();
      setScreen("home");
      showToast("Профиль сохранён");
    } catch (error) {
      showToast(parseError(error, "Ошибка сохранения профиля"));
    }
  }, { button: e.submitter, loadingText: "Сохраняем...", global: true, globalText: "Сохраняем профиль..." });
    });

  els.profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await withLoading(async () => {
      try {
        const phone = els.profilePhone.value.trim();
        const city = els.profileCity.value.trim();

        if (phone && !validatePhone(phone)) {
          showToast("Телефон должен быть в формате +7XXXXXXXXXX");
          return;
        }

        if (city && !validateCity(city)) {
          showToast("Город может содержать только буквы, пробелы и дефис");
          return;
        }

        await upsertProfile({ phone, city });
        updateProfileUI();
        setProfileFormEditable(false);
        showToast("Профиль обновлён");
      } catch (error) {
        showToast(parseError(error, "Ошибка обновления профиля"));
      }
    }, { button: e.submitter, loadingText: "Сохраняем..." });
  });

  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(bindEvents.searchTimer);
    bindEvents.searchTimer = setTimeout(() => {
      appState.ui.search = e.target.value.trim();
      renderHomeScreen();
      renderOrders();
    }, 250);
  });

  els.statusFilterInput.addEventListener("change", (e) => {
    appState.ui.selectedStatus = e.target.value;
    renderHomeScreen();
    renderOrders();
  });

  els.ordersSortInput.addEventListener("change", (e) => {
    appState.ui.ordersSort = e.target.value;
    renderHomeScreen();
    renderOrders();
  });

  els.sortBtn.addEventListener("click", () => {
    appState.ui.sortBy = appState.ui.sortBy === "rating" ? "price" : "rating";
    els.sortBtn.textContent = `Сорт: ${appState.ui.sortBy === "rating" ? "рейтинг" : "цена"}`;
    renderHomeScreen();
  });

  els.openTaskModal.addEventListener("click", () => els.taskDialog.showModal());
  els.cancelDialog.addEventListener("click", () => els.taskDialog.close());

  els.taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await withLoading(async () => {
      try {
        await createOrder({
          title: els.taskTitle.value.trim(),
          description: els.taskDescription.value.trim(),
          category: els.taskCategory.value,
          budget: Number(els.taskBudget.value),
          address: els.taskAddress.value.trim(),
          preferredTime: els.taskTime.value.trim()
        });
        els.taskForm.reset();
        els.taskDialog.close();
        await refreshData();
        showToast("Заказ создан");
      } catch (error) {
        showToast(parseError(error, "Ошибка создания заказа"));
      }
    }, { button: e.submitter, loadingText: "Создаём...", global: true, globalText: "Создаём заказ..." });
  });

  els.orderFilters.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    appState.ui.ordersFilter = btn.dataset.filter;
    renderOrders();
  });

  const openOrderFromEvent = (event) => {
    const btn = event.target.closest("button[data-action='open-order']");
    if (btn) {
      appState.ui.selectedOrderId = btn.dataset.id;
      renderOrderDetail();
      setScreen("orderDetail");
    }
  };

  els.ordersList.addEventListener("click", openOrderFromEvent);
  els.homeBlockAList.addEventListener("click", openOrderFromEvent);
  els.homeBlockBList.addEventListener("click", openOrderFromEvent);

  els.homeBlockCList.addEventListener("click", (e) => {
    const quick = e.target.closest("button[data-action='quick-order']");
    if (quick) {
      els.taskTitle.value = `Заказ для ${quick.dataset.tasker}`;
      els.taskDialog.showModal();
      return;
    }
    openOrderFromEvent(e);
  });

  els.respondOrderBtn.addEventListener("click", () => els.responseDialog.showModal());
  els.cancelResponseDialog.addEventListener("click", () => els.responseDialog.close());

  els.responseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await withLoading(async () => {
      try {
        await createResponse(appState.ui.selectedOrderId, {
          price: Number(els.responsePrice.value),
          message: els.responseMessage.value.trim()
        });
        await notifyEvent("new_response", { orderId: appState.ui.selectedOrderId });
        els.responseForm.reset();
        els.responseDialog.close();
        await refreshData();
        renderOrderDetail();
        showToast("Отклик отправлен");
      } catch (error) {
        showToast(parseError(error, "Ошибка отправки отклика"));
      }
    }, { button: e.submitter, loadingText: "Отправляем..." });
  });

  els.backToOrders.addEventListener("click", () => setScreen("orders"));

  if (els.toggleArchivedChats) {
  els.toggleArchivedChats.addEventListener("click", () => {
    appState.ui.showArchivedChats = !appState.ui.showArchivedChats;
    appState.ui.selectedChatId = null;
    renderChats();
  });
}

  els.chatsList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-chat-id]");
    if (!btn) return;
    try {
      await openChat(btn.dataset.chatId);
    } catch (error) {
      showToast(parseError(error, "Ошибка загрузки чата"));
    }
  });

  els.chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await withLoading(async () => {
    try {
      const chatId = appState.ui.selectedChatId;
      const text = els.chatInput.value.trim();
      if (!chatId || !text) return;

      const chat = appState.chats.find((c) => c.id === chatId);
      const order = appState.orders.find((o) => o.id === chat?.order_id);
      const isClosedChat = ["done", "canceled", "cancelled", "hidden"].includes(order?.status);

      if (isClosedChat) {
        showToast("Чат закрыт, отправка сообщений недоступна");
        return;
      }

      await sendMessage(chatId, text);
      await notifyEvent("new_message", { chatId });
      els.chatInput.value = "";
      await openChat(chatId);
      renderChats();
      showToast("Сообщение отправлено");
    } catch (error) {
      showToast(parseError(error, "Ошибка отправки сообщения"));
    }
  }, { button: e.submitter, loadingText: "Отправляем..." });
});

  els.navButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    if (btn.dataset.screen === "chats") {
      appState.ui.showArchivedChats = false;
      appState.ui.selectedChatId = null;
      renderChats();
    }
    setScreen(btn.dataset.screen);
  })
);
  els.themeToggle.addEventListener("click", toggleTheme);
  window.addEventListener("resize", updateNavIndicator);
  window.addEventListener("beforeunload", destroyRealtimeSubscriptions);

  if (els.closeResponsesDialog && els.responsesDialog) {
  els.closeResponsesDialog.addEventListener("click", () => {
    els.responsesDialog.close();
  });

  els.responsesDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    els.responsesDialog.close();
  });
}
}

async function initApp() {
  loadTheme();

  try {
    const tg = getTelegramContext();
    await authorizeWithBackend(tg.rawInitData);
  } catch (error) {
    showToast(parseError(error, "Ошибка Telegram авторизации"));
    els.telegramUserInfo.textContent = "Не удалось проверить Telegram initData на сервере";
    els.authScreen.classList.remove("hidden");
    els.appContent.classList.add("hidden");
    return;
  }

  try {
    initSupabase();
  } catch (error) {
    showToast(error.message);
    els.telegramUserInfo.textContent = `@${appState.user.username || "user"} • id: ${appState.user.id}`;
    els.authScreen.classList.remove("hidden");
    els.appContent.classList.add("hidden");
    bindEvents();
    return;
  }

  await bindEvents();
  renderCategories();
  await fetchSessionMeta();

  try {
    await fetchProfile();

    if (!appState.profile || !appState.profile.role) {
      els.telegramUserInfo.textContent = `@${appState.user.username || "user"} • id: ${appState.user.id}`;
      destroyRealtimeSubscriptions();
      els.authScreen.classList.remove("hidden");
      els.appContent.classList.add("hidden");
      return;
    }

    els.authScreen.classList.add("hidden");
    els.appContent.classList.remove("hidden");

    await refreshData();
    setProfileFormEditable(false);
    initRealtimeSubscriptions();
    setScreen("home");
  } catch (error) {
    showToast(parseError(error, "Ошибка инициализации Supabase"));
    destroyRealtimeSubscriptions();
    els.authScreen.classList.remove("hidden");
    els.appContent.classList.add("hidden");
  }
}

initApp();
