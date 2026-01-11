// ==========================================
// 1. КОНФИГУРАЦИЯ И ПЕРЕМЕННЫЕ
// ==========================================
// Если сайт открыт локально - используем localhost, иначе - текущий домен (пустая строка означает относительный путь)
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_URL = isLocal ? "http://127.0.0.1:8000" : ""; 

let allCars = []; // Главное хранилище всех авто с сервера
let cart = JSON.parse(localStorage.getItem('user_cart')) || [];
let favorites = JSON.parse(localStorage.getItem('user_favorites')) || [];
let currentUser = null;

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ (Запуск при старте)
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Приложение запущено...");
    await checkAuth(); // Сначала узнаем кто зашел
    applyLanguage(); // apply saved language
    await loadCars();  // Потом загружаем данные
    updateCartBadge();
    showSection('market'); // Открываем главную
});

// Simple i18n
const TRANSLATIONS = {
    ru: {
        menu: ['Главная','Профиль','Мои объявления','Избранное','Сообщения'],
        titles: {
            market: 'Актуальные предложения',
            my_ads: 'Управление объявлениями',
            profile: 'Личные данные',
            favorites: 'Избранные авто',
            cart: 'Мой Гараж',
            messages: 'Мои диалоги',
            navigation: 'Навигация'
        },
        placeholders: { search: 'Поиск по марке...' },
        buttons: { publish: 'Опубликовать', save: 'Сохранить', checkout: 'Оформить покупку', cart: 'Корзина' }
    },
    en: {
        menu: ['Home','Profile','My ads','Favorites','Messages'],
        titles: {
            market: 'Market',
            my_ads: 'Manage listings',
            profile: 'Profile',
            favorites: 'Favorites',
            cart: 'My Garage',
            messages: 'Messages',
            navigation: 'Navigation'
        },
        placeholders: { search: 'Search by brand...' },
        buttons: { publish: 'Publish', save: 'Save', checkout: 'Checkout', cart: 'Cart' }
    }
};

function getLang() { return localStorage.getItem('lang') || 'ru'; }

function setLang(lang) { localStorage.setItem('lang', lang); applyLanguage(); }

function applyLanguage() {
    const lang = getLang();
    // highlight buttons
    const enBtn = document.getElementById('lang-en');
    const ruBtn = document.getElementById('lang-ru');
    if (enBtn && ruBtn) { enBtn.style.opacity = lang === 'en' ? '1' : '0.6'; ruBtn.style.opacity = lang === 'ru' ? '1' : '0.6'; }

    const t = TRANSLATIONS[lang] || TRANSLATIONS.ru;
    // menu titles (they appear in stable order)
    const menuEls = document.querySelectorAll('.menu-title');
    menuEls.forEach((el, idx) => { if (t.menu[idx]) el.innerText = t.menu[idx]; });

    // section titles
    const map = { 'title-market': t.titles.market, 'title-my-ads': t.titles.my_ads, 'title-profile': t.titles.profile, 'title-favorites': t.titles.favorites, 'title-cart': t.titles.cart, 'title-messages': t.titles.messages, 'title-navigation': t.titles.navigation };
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) el.innerText = map[id]; });

    // placeholders
    const search = document.getElementById('search-input'); if (search) search.placeholder = t.placeholders.search;

    // buttons
    const bp = document.getElementById('btn-publish'); if (bp) bp.innerText = t.buttons.publish;
    const bs = document.getElementById('btn-save-profile'); if (bs) bs.innerText = t.buttons.save;
    const bc = document.getElementById('btn-checkout'); if (bc) bc.innerText = t.buttons.checkout;
    const cartBtn = document.getElementById('btn-cart'); if (cartBtn) cartBtn.title = t.buttons.cart;
}

// attach language button events
document.addEventListener('DOMContentLoaded', () => {
    const enBtn = document.getElementById('lang-en');
    const ruBtn = document.getElementById('lang-ru');
    if (enBtn) enBtn.addEventListener('click', () => setLang('en'));
    if (ruBtn) ruBtn.addEventListener('click', () => setLang('ru'));
});

// ==========================================
// 3. АВТОРИЗАЦИЯ
// ==========================================
async function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            currentUser = await res.json();
            console.log("Пользователь:", currentUser.username);
            const nameDisp = document.getElementById('display-username');
            if (nameDisp) nameDisp.innerText = currentUser.username;

            // Показываем пункт меню "Администрирование", если у пользователя есть права
            const adminNav = document.getElementById('nav-admin');
            if (adminNav) {
                if (currentUser.role === 'admin' || currentUser.role === 'support' || currentUser.username === 'admin') {
                    adminNav.style.display = 'block';
                } else {
                    adminNav.style.display = 'none';
                }
            }

            // Prefill profile fields if present
            const editU = document.getElementById('edit-username');
            const editE = document.getElementById('edit-email');
            const avatarEl = document.getElementById('user-avatar');
            if (editU) editU.value = currentUser.username || '';
            if (editE) editE.value = currentUser.email || '';
            if (avatarEl && currentUser.avatar_url) {
                const url = currentUser.avatar_url.startsWith('http') ? currentUser.avatar_url : `${API_URL}${currentUser.avatar_url.startsWith('/') ? '' : '/'}${currentUser.avatar_url}`;
                avatarEl.style.backgroundImage = `url('${url}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.innerText = '';
            }
            // Set small header avatar
            const headerAvatar = document.getElementById('header-avatar');
            const headerInitial = document.getElementById('header-avatar-initial');
            if (headerAvatar) {
                headerAvatar.style.display = 'flex';
                // toggle dropdown menu on click
                headerAvatar.onclick = (e) => { e.stopPropagation(); toggleAvatarMenu(); };
                if (currentUser.avatar_url) {
                    const hurl = currentUser.avatar_url.startsWith('http') ? currentUser.avatar_url : `${API_URL}${currentUser.avatar_url.startsWith('/') ? '' : '/'}${currentUser.avatar_url}`;
                    headerAvatar.style.backgroundImage = `url('${hurl}')`;
                    headerAvatar.style.backgroundSize = 'cover';
                    if (headerInitial) headerInitial.style.display = 'none';
                } else {
                    if (headerInitial) {
                        headerInitial.innerText = (currentUser.username || 'U').charAt(0).toUpperCase();
                        headerInitial.style.display = 'flex';
                    }
                }
            }
            // Close menu when clicking outside
            document.addEventListener('click', (ev) => { const menu = document.getElementById('avatar-menu'); if (menu && menu.style.display === 'block') { menu.style.display = 'none'; const ava = document.getElementById('header-avatar'); if (ava) ava.setAttribute('aria-expanded', 'false'); } });

            window.toggleAvatarMenu = function(show) {
                const menu = document.getElementById('avatar-menu');
                const ava = document.getElementById('header-avatar');
                if (!menu || !ava) return;
                if (typeof show === 'boolean') {
                    menu.style.display = show ? 'block' : 'none';
                    ava.setAttribute('aria-expanded', show ? 'true' : 'false');
                    return;
                }
                const visible = menu.style.display === 'block';
                menu.style.display = visible ? 'none' : 'block';
                ava.setAttribute('aria-expanded', visible ? 'false' : 'true');
            }
        } else {
            localStorage.removeItem("token");
        }
    } catch (e) {
        console.error("Ошибка авторизации:", e);
    }
}

// ==========================================
// 4. РАБОТА С ДАННЫМИ (API)
// ==========================================
async function loadCars() {
    try {
        const res = await fetch(`${API_URL}/cars/`);
        allCars = await res.json();
        renderCarsList(allCars, 'cars-list');
    } catch (e) {
        console.error("Не удалось загрузить машины:", e);
    }
}

async function addCar() {
    const token = localStorage.getItem("token");
    if (!token) return Swal.fire('Ошибка', 'Нужно войти в аккаунт', 'error');

    const fileInput = document.getElementById('car-image');
    if (!fileInput.files[0]) return Swal.fire('Ошибка', 'Выберите фото', 'warning');

    const formData = new FormData();
    formData.append('brand', document.getElementById('brand').value);
    formData.append('model', document.getElementById('model').value);
    formData.append('year', document.getElementById('year').value);
    formData.append('price', document.getElementById('price').value);
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch(`${API_URL}/cars/`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            Swal.fire('Успех!', 'Объявление опубликовано', 'success');
            // Очистка полей
            ['brand', 'model', 'year', 'price', 'car-image'].forEach(id => document.getElementById(id).value = '');
            await loadCars();
            showSection('my-ads');
        } else {
            Swal.fire('Ошибка', 'Не удалось создать объявление', 'error');
        }
    } catch (e) { console.error(e); }
}

async function deleteCar(id) {
    const result = await Swal.fire({
        title: 'Удалить?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4d4d',
        confirmButtonText: 'Да, удалить'
    });

    if (result.isConfirmed) {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/cars/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                await loadCars(); // Обновим базу
                showSection('my-ads'); // Перерисуем список
                Swal.fire('Удалено!', '', 'success');
            }
        } catch (e) { console.error(e); }
    }
}

// ==========================================
// 5. ПОИСК И ФИЛЬТРЫ
// ==========================================
window.filterCars = function() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const min = parseFloat(document.getElementById('min-price').value) || 0;
    const max = parseFloat(document.getElementById('max-price').value) || Infinity;

    const filtered = allCars.filter(car => {
        const nameMatch = car.brand.toLowerCase().includes(search) || car.model.toLowerCase().includes(search);
        const priceMatch = car.price >= min && car.price <= max;
        return nameMatch && priceMatch;
    });

    renderCarsList(filtered, 'cars-list');
}

window.toggleFilterPopup = () => {
    const p = document.getElementById('filter-popup');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
}


// ==========================================
// 6. ОТРИСОВКА ИНТЕРФЕЙСА
// ==========================================
function renderCarsList(cars, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!cars || cars.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Список пуст</p>`;
        return;
    }

    container.innerHTML = cars.map(car => {
        const isFav = favorites.some(f => f.id === car.id);
        const isMyAdsView = (containerId === 'my-cars-list');
        const isOwner = (currentUser && car.owner_id === currentUser.id);
        
        // Формируем корректный URL картинки
        const imgUrl = car.image_url.startsWith('http') ? car.image_url : `${API_URL}/${car.image_url}`;

        return `
            <div class="showcase">
                <div class="showcase-banner" style="position:relative; height:160px; overflow:hidden;">
                    <img class="product-img default" src="${imgUrl}" alt="${escapeHtml(car.model)}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">
                    <img class="product-img hover" src="${imgUrl}" alt="${escapeHtml(car.model)}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">
                    <button onclick="toggleFavorite(${car.id})" style="position: absolute; top: 10px; right: 10px; background: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; z-index:4;">
                        <ion-icon name="${isFav ? 'heart' : 'heart-outline'}" style="color: ${isFav ? 'red' : 'black'}"></ion-icon>
                    </button>
                </div>
                <div class="showcase-content">
                    <p class="showcase-category">${car.brand}</p>
                    <h3 class="showcase-title">${car.model} (${car.year})</h3>
                    <div class="price-top" style="margin-top:10px;">
                        <p class="price">$${car.price.toLocaleString()}</p>
                    </div>
                    <div class="actions-row" style="margin-top:8px; display:flex; gap:8px; align-items:center;">
                        ${ (car.is_sold) ?
                            `<span style="background:#ff4d4d;color:#fff;padding:6px 8px;border-radius:6px;font-weight:600;">ПРОДАНО</span>` :
                            `<button class="btn-submit" onclick="addToCart(${car.id})" style="width:auto; padding:8px 12px;">В ГАРАЖ</button>`
                        }
                        ${(isMyAdsView || isOwner) ? `<button class="btn-submit" onclick="deleteCar(${car.id})" style="background: #ff4d4d; width:auto; padding:8px 12px;">УДАЛИТЬ</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 7. НАВИГАЦИЯ И ПРОЧЕЕ
// ==========================================
window.showSection = function(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById('section-' + id);
    if (target) target.style.display = 'block';

    if (id === 'market') renderCarsList(allCars, 'cars-list');
    if (id === 'favorites') renderCarsList(favorites, 'favorites-list');
    if (id === 'cart') renderCart();
    if (id === 'my-ads') {
        const myCars = allCars.filter(c => c.owner_id === currentUser?.id);
        renderCarsList(myCars, 'my-cars-list');
    }
    if (id === 'profile') populateProfileFields();
    if (id === 'messages') loadMessages();
    if (id === 'admin') loadAdminPanel();
}

// ==========================================
// MESSAGES / SUPPORT (frontend)
// ==========================================
window.sendMessage = async function(event) {
    if (event && event.preventDefault) event.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return Swal.fire('Ошибка', 'Сначала войдите в систему', 'warning');
    const input = document.getElementById('msg-input');
    if (!input || !input.value.trim()) return;
    const content = input.value.trim();

    try {
        const res = await fetch(`${API_URL}/support/messages/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            input.value = '';
            await loadMessages();
        } else {
            const txt = await res.json();
            Swal.fire('Ошибка', txt.detail || 'Не удалось отправить сообщение', 'error');
        }
    } catch (e) {
        console.error('sendMessage error', e);
        Swal.fire('Ошибка сети', 'Не удалось отправить сообщение', 'error');
    }
}

async function loadMessages() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '<p style="color:#888;">Загрузка...</p>';
    if (!token) return container.innerHTML = '<p style="color:#888;">Войдите, чтобы просматривать сообщения</p>';

    try {
        const res = await fetch(`${API_URL}/support/messages/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return container.innerHTML = '<p style="color:#888;">Не удалось загрузить сообщения</p>';
        const msgs = await res.json();
        if (!msgs || msgs.length === 0) return container.innerHTML = '<p style="color:#888;">Сообщений пока нет. Напишите первое!</p>';

        // messages come sorted desc in API; reverse to show oldest first
        msgs.reverse();
        container.innerHTML = '';
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = 'msg ' + (m.sender === 'user' ? 'sent' : 'received');
            const time = new Date(m.created_at).toLocaleString();
            div.innerHTML = `<div>${escapeHtml(m.content)}</div><div style="font-size:11px; color:#666; margin-top:6px;">${time}</div>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    } catch (e) {
        console.error('loadMessages error', e);
        container.innerHTML = '<p style="color:#888;">Ошибка при загрузке</p>';
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/\"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function toggleFavorite(id) {
    const car = allCars.find(c => c.id === id);
    const idx = favorites.findIndex(f => f.id === id);
    idx === -1 ? favorites.push(car) : favorites.splice(idx, 1);
    localStorage.setItem('user_favorites', JSON.stringify(favorites));
    loadCars(); 
}

function addToCart(id) {
    const car = allCars.find(c => c.id === id);
    if (!car) return Swal.fire('Ошибка', 'Авто не найдено', 'error');
    if (car.is_sold) return Swal.fire('Недоступно', 'Это авто уже продано', 'warning');
    if (!cart.some(i => i.id === id)) {
        cart.push(car);
        localStorage.setItem('user_cart', JSON.stringify(cart));
        updateCartBadge();
        Swal.fire({ title: 'Добавлено!', icon: 'success', timer: 700, showConfirmButton: false });
    }
}

function updateCartBadge() { 
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = cart.length; 
}

function renderCart() {
    const container = document.getElementById('cart-list');
    let total = 0;
    container.innerHTML = cart.map(item => {
        total += item.price;
        return `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
            <span>${item.brand} ${item.model}</span><b>$${item.price.toLocaleString()}</b>
        </div>`;
    }).join('');
    document.getElementById('cart-total').innerText = `$${total.toLocaleString()}`;
}

function checkout() {
    const token = localStorage.getItem('token');
    if (!token) return Swal.fire('Ошибка', 'Сначала войдите в систему', 'warning');
    if (!cart || cart.length === 0) return Swal.fire('Корзина пуста', '', 'info');

    const items = cart.map(c => c.id);
    // Validate items against current server data to avoid 404 on checkout
    const serverIds = allCars.map(c => c.id);
    const missing = items.filter(id => !serverIds.includes(id));
    // Check for sold items (by id)
    const sold = cart.filter(ci => {
        const serverCar = allCars.find(c => c.id === ci.id);
        return serverCar && serverCar.is_sold;
    }).map(c => c.id);

    if (missing.length > 0 || sold.length > 0) {
        // Remove missing and sold entries from cart
        const removed = new Set([...missing, ...sold]);
        cart = cart.filter(c => !removed.has(c.id));
        localStorage.setItem('user_cart', JSON.stringify(cart));
        updateCartBadge();

        let msg = '';
        if (missing.length) msg += `Удалены недоступные объявления: ${missing.join(', ')}. `;
        if (sold.length) msg += `Удалены уже проданные объявления: ${sold.join(', ')}.`;
        return Swal.fire('Обновлено', msg, 'warning');
    }

    Swal.fire({ title: 'Подтвердите покупку', text: `Вы покупаете ${cart.length} предмет(ов). Продолжить?`, icon: 'question', showCancelButton: true }).then(async (res) => {
        if (!res.isConfirmed) return;
        try {
            const r = await fetch(`${API_URL}/orders/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ items }) });
            if (r.ok) {
                const data = await r.json();
                // Clear local cart and update UI
                cart = [];
                localStorage.setItem('user_cart', JSON.stringify(cart));
                updateCartBadge();
                await loadCars();
                showSection('market');
                Swal.fire('Оплачено', 'Покупка оформлена. Продавец свяжется с вами.', 'success');
            } else {
                const txt = await r.json();
                Swal.fire('Ошибка', txt.detail || 'Не удалось оформить покупку', 'error');
            }
        } catch (e) { console.error('checkout error', e); Swal.fire('Ошибка сети', 'Не удалось оформить покупку', 'error'); }
    });
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "index.html";
}

// ==========================================
// ADMIN / SUPPORT UI HELPERS
// ==========================================
async function loadAdminPanel() {
    const token = localStorage.getItem('token');
    if (!token) return Swal.fire('Ошибка', 'Требуется вход как админ', 'warning');

    await loadAllUsers();
    await loadAllMessagesAdmin();
    await loadAdminReports();
}

async function loadAllUsers() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('admin-users-list');
    if (!container) return;
    container.innerHTML = 'Загрузка...';

    try {
        // Используем новый эндпоинт для отчета по пользователям
        const res = await fetch(`${API_URL}/admin/reports/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return container.innerHTML = 'Нет доступа или ошибка';
        const users = await res.json();
        
        if (users.length === 0) return container.innerHTML = '<p>Пользователей нет</p>';
        container.innerHTML = users.map(u => {
            return `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px; border-bottom:1px solid #f1f1f1;">
                <div><b>${u.username}</b> (${u.role})<br>
                <span style="font-size:12px; color:#666;">Email: ${u.email} | Авто: ${u.cars_count} | Покупок: ${u.purchases_count}</span></div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-submit" onclick="setUserRole(${u.id}, 'support')" style="padding:6px 10px;">Назначить support</button>
                    <button class="btn-submit" onclick="setUserRole(${u.id}, 'user')" style="background:#ccc;padding:6px 10px;">Убрать роли</button>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadAllUsers error', e); container.innerHTML = 'Ошибка'; }
}

async function setUserRole(userId, role) {
    const token = localStorage.getItem('token');
    if (!token) return Swal.fire('Ошибка', 'Требуется вход как админ', 'warning');
    try {
        const form = new URLSearchParams();
        form.append('role', role);
        const res = await fetch(`${API_URL}/admin/users/${userId}/role`, { method: 'PATCH', body: form, headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            Swal.fire('Готово', 'Роль обновлена', 'success');
            await loadAdminPanel();
        } else {
            const txt = await res.json();
            Swal.fire('Ошибка', txt.detail || 'Не удалось обновить роль', 'error');
        }
    } catch (e) { console.error('setUserRole error', e); Swal.fire('Ошибка сети', 'Не удалось', 'error'); }
}

async function loadAdminReports() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('admin-reports');
    if (!container) return;
    
    container.innerHTML = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">' +
        '<div id="report-items-box" style="background:#f9f9f9; padding:15px; border-radius:8px;">Загрузка товаров...</div>' +
        '<div id="report-cats-box" style="background:#f9f9f9; padding:15px; border-radius:8px;">Загрузка категорий...</div>' +
        '</div>';

    try {
        // 1. Товары
        const resItems = await fetch(`${API_URL}/admin/reports/items`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (resItems.ok) {
            const data = await resItems.json();
            let html = '<h4>Топ дорогих (активных)</h4><ul style="padding-left:20px; margin-top:5px;">';
            data.expensive_active.forEach(c => html += `<li>${c.brand} ${c.model} - <b>$${c.price.toLocaleString()}</b></li>`);
            html += '</ul>';
            document.getElementById('report-items-box').innerHTML = html;
        }

        // 2. Категории
        const resCats = await fetch(`${API_URL}/admin/reports/categories`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (resCats.ok) {
            const data = await resCats.json();
            let html = '<h4>Объявлений по маркам</h4><ul style="padding-left:20px; margin-top:5px;">';
            data.forEach(c => html += `<li>${c.category}: ${c.count} шт.</li>`);
            html += '</ul>';
            document.getElementById('report-cats-box').innerHTML = html;
        }
    } catch (e) { console.error('loadAdminReports error', e); }
}

async function loadAllMessagesAdmin() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('admin-messages-list');
    if (!container) return;
    container.innerHTML = 'Загрузка сообщений...';
    try {
        const res = await fetch(`${API_URL}/admin/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return container.innerHTML = 'Нет доступа или ошибка';
        const msgs = await res.json();
        if (!msgs.length) return container.innerHTML = '<p>Сообщений нет</p>';
        container.innerHTML = msgs.map(m => `<div style="padding:8px; border-bottom:1px solid #f9f9f9;"><b>user_id:${m.user_id}</b> <span style="color:#666; font-size:12px;">${new Date(m.created_at).toLocaleString()}</span><div style="margin-top:6px;">${escapeHtml(m.content)}</div></div>`).join('');
    } catch (e) { console.error('loadAllMessagesAdmin error', e); container.innerHTML = 'Ошибка'; }
}

async function updateProfile() {
    const token = localStorage.getItem('token');
    if (!token) return Swal.fire('Ошибка', 'Сначала войдите в систему', 'warning');

    const username = document.getElementById('edit-username').value;
    const email = document.getElementById('edit-email').value;

    try {
        const res = await fetch(`${API_URL}/auth/profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, email })
        });

        if (res.ok) {
            const data = await res.json();
            Swal.fire('Готово', 'Данные обновлены', 'success');
            // Обновим отображаемое имя
            const nameDisp = document.getElementById('display-username');
            if (nameDisp) nameDisp.innerText = data.username;
        } else {
            const txt = await res.json();
            Swal.fire('Ошибка', txt.detail || 'Не удалось обновить', 'error');
        }
    } catch (e) {
        console.error('Update profile error', e);
        Swal.fire('Ошибка', 'Сервер не отвечает', 'error');
    }
}

// ==========================================
// 8. LOGIN / REGISTER HANDLERS (for index.html)
// ==========================================
window.handleLogin = async function(event) {
    if (event && event.preventDefault) event.preventDefault();
    const u = document.getElementById('username')?.value;
    const p = document.getElementById('password')?.value;
    if (!u || !p) return Swal.fire('Ошибка', 'Введите логин и пароль', 'warning');

    const form = new URLSearchParams();
    form.append('username', u);
    form.append('password', p);

    try {
        const res = await fetch(`${API_URL}/auth/token`, { method: 'POST', body: form });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            window.location.href = 'cars.html';
        } else {
            Swal.fire('Ошибка', 'Неверный логин или пароль', 'error');
        }
    } catch (e) {
        console.error('Login error', e);
        Swal.fire('Ошибка', 'Сервер не отвечает', 'error');
    }
}

window.handleRegister = async function(event) {
    if (event && event.preventDefault) event.preventDefault();
    const u = document.getElementById('username')?.value;
    const p = document.getElementById('password')?.value;
    if (!u || !p) return Swal.fire('Ошибка', 'Заполните поля', 'warning');

    const form = new URLSearchParams();
    form.append('username', u);
    form.append('email', `${u}@market.com`);
    form.append('password', p);

    try {
        const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', body: form });
        if (res.ok) {
            Swal.fire('Готово', 'Регистрация успешна. Войдите в систему.', 'success');
        } else {
            const txt = await res.text();
            Swal.fire('Ошибка', txt || 'Не удалось зарегистрироваться', 'error');
        }
    } catch (e) {
        console.error('Register error', e);
        Swal.fire('Ошибка', 'Сервер не отвечает', 'error');
    }
}

// ==========================================
// Avatar upload handler
// ==========================================
window.handleAvatarUpload = async function(event) {
    const token = localStorage.getItem('token');
    if (!token) return Swal.fire('Ошибка', 'Войдите в систему, чтобы загрузить аватар', 'warning');
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(`${API_URL}/auth/avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        if (res.ok) {
            const data = await res.json();
            const avatarEl = document.getElementById('user-avatar');
            const url = data.avatar_url.startsWith('http') ? data.avatar_url : `${API_URL}${data.avatar_url.startsWith('/') ? '' : '/'}${data.avatar_url}`;
            if (avatarEl) {
                avatarEl.style.backgroundImage = `url('${url}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.innerText = '';
            }
            // Update local copy of currentUser
            if (currentUser) currentUser.avatar_url = data.avatar_url;
            Swal.fire('Готово', 'Аватар обновлён', 'success');
        } else {
            Swal.fire('Ошибка', 'Не удалось загрузить аватар', 'error');
        }
    } catch (e) {
        console.error('Avatar upload error', e);
        Swal.fire('Ошибка сети', 'Не удалось загрузить аватар', 'error');
    }
}

// ==========================================
// Fill profile fields (call when opening profile)
// ==========================================
function populateProfileFields() {
    if (!currentUser) return;
    const editU = document.getElementById('edit-username');
    const editE = document.getElementById('edit-email');
    const avatarEl = document.getElementById('user-avatar');
    if (editU) editU.value = currentUser.username || '';
    if (editE) editE.value = currentUser.email || '';
    if (avatarEl && currentUser.avatar_url) {
        const url = currentUser.avatar_url.startsWith('http') ? currentUser.avatar_url : `${API_URL}${currentUser.avatar_url.startsWith('/') ? '' : '/'}${currentUser.avatar_url}`;
        avatarEl.style.backgroundImage = `url('${url}')`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.innerText = '';
    }
}