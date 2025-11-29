// Локальна аутентифікація з localStorage + відправка на сервер
// Користувачі зберігаються в браузері та записуються в текстовий файл на сервері

const Auth = {
  DB_KEY: 'inforneseach_users',
  ADMIN_KEY: 'inforneseach_admins',
  API_KEYS_KEY: 'inforneseach_api_keys',
  MAIN_ADMIN: 'sashabuhina@gmail.com',
  API_BASE: 'http://localhost:3000', // Может быть пусто если server не нужен
  
  getUsers() {
    const data = localStorage.getItem(this.DB_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  saveUsers(users) {
    localStorage.setItem(this.DB_KEY, JSON.stringify(users));
  },

  getAdmins() {
    const data = localStorage.getItem(this.ADMIN_KEY);
    return data ? JSON.parse(data) : [this.MAIN_ADMIN];
  },

  saveAdmins(admins) {
    localStorage.setItem(this.ADMIN_KEY, JSON.stringify(admins));
  },

  isAdmin(email) {
    return this.getAdmins().includes(email.toLowerCase());
  },

  makeAdmin(email) {
    email = email.toLowerCase();
    const admins = this.getAdmins();
    if (!admins.includes(email)) {
      admins.push(email);
      this.saveAdmins(admins);
    }
  },

  removeAdmin(email) {
    email = email.toLowerCase();
    // Главный админ не может быть удален
    if (email === this.MAIN_ADMIN) return false;
    
    const admins = this.getAdmins();
    const idx = admins.indexOf(email);
    if (idx > -1) {
      admins.splice(idx, 1);
      this.saveAdmins(admins);
      return true;
    }
    return false;
  },

  getApiKeys() {
    const data = localStorage.getItem(this.API_KEYS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveApiKeys(keys) {
    localStorage.setItem(this.API_KEYS_KEY, JSON.stringify(keys));
  },

  generateApiKey(plan, email) {
    email = email.toLowerCase();
    const keys = this.getApiKeys();
    
    // Generate random key
    const randomKey = 'key_' + Math.random().toString(36).substr(2, 9) + '_' + Math.random().toString(36).substr(2, 9);
    
    const requests = { 'plan-a': 35, 'plan-b': 85, 'plan-c': 180 }[plan] || 0;
    
    const newKey = {
      id: Math.max(0, ...keys.map(k => k.id || 0)) + 1,
      key: randomKey,
      plan,
      email,
      requests,
      used: 0,
      created_at: new Date().toISOString(),
      issued_by: this.getCurrentUser()?.email || 'system'
    };
    
    keys.push(newKey);
    this.saveApiKeys(keys);
    
    return newKey;
  },
  
  async logToServer(action, email, id) {
    // Попытка отправить лог на сервер (не критично если не получится)
    try {
      await fetch(this.API_BASE + '/api/log-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, id, timestamp: new Date().toISOString() })
      }).catch(() => {});
    } catch (e) {}
  },
  
  register(email, password, password2) {
    email = email.trim().toLowerCase();
    
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return { ok: false, error: 'Неверный email' };
    }
    if (!password || !password2) {
      return { ok: false, error: 'Оба пароля обязательны' };
    }
    if (password !== password2) {
      return { ok: false, error: 'Пароли не совпадают' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'Пароль должен быть минимум 6 символов' };
    }
    
    const users = this.getUsers();
    if (users.some(u => u.email === email)) {
      return { ok: false, error: 'Пользователь с таким email уже существует' };
    }
    
    // Simple hash (для демо; в продакшене используйте bcrypt на сервере)
    const hashed = btoa(password); // base64 encode (not secure!)
    
    const newUser = {
      id: Math.max(0, ...users.map(u => u.id || 0)) + 1,
      email,
      password: hashed,
      created_at: new Date().toISOString()
    };
    
    users.push(newUser);
    this.saveUsers(users);
    
    // Отправить лог на сервер
    this.logToServer('register', email, newUser.id);
    
    return { ok: true, id: newUser.id };
  },
  
  login(email, password) {
    email = email.trim().toLowerCase();
    
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return { ok: false, error: 'Неверный email' };
    }
    if (!password) {
      return { ok: false, error: 'Пароль обязателен' };
    }
    
    const users = this.getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return { ok: false, error: 'Пользователь не найден' };
    }
    
    const hashed = btoa(password);
    if (user.password !== hashed) {
      return { ok: false, error: 'Неверный пароль' };
    }
    
    // Зберегти токен сесії
    sessionStorage.setItem('currentUser', JSON.stringify({ id: user.id, email: user.email }));
    
    // Отправить лог на сервер
    this.logToServer('login', email, user.id);
    
    return { ok: true, id: user.id, email: user.email };
  },
  
  getCurrentUser() {
    const data = sessionStorage.getItem('currentUser');
    return data ? JSON.parse(data) : null;
  },
  
  logout() {
    sessionStorage.removeItem('currentUser');
  }
  ,
  // Ensure MAIN_ADMIN exists in admins and users on first run.
  // If the MAIN_ADMIN user is missing, create it with a temporary password 'admin123'.
  // This is for convenience on local installs; change the password after first login.
  ensureMainAdminExists() {
    // Ensure MAIN_ADMIN is in admins
    const admins = this.getAdmins();
    if (!admins.includes(this.MAIN_ADMIN)) {
      admins.push(this.MAIN_ADMIN);
      this.saveAdmins(admins);
    }

    // Ensure MAIN_ADMIN has a user account
    const users = this.getUsers();
    const exists = users.some(u => u.email === this.MAIN_ADMIN);
    const desiredPass = 'sasha0304';
    const hashed = btoa(desiredPass);
    if (!exists) {
      const newUser = {
        id: Math.max(0, ...users.map(u => u.id || 0)) + 1,
        email: this.MAIN_ADMIN,
        password: hashed,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      this.saveUsers(users);
      // Log to server (non-blocking)
      this.logToServer('create-main-admin', this.MAIN_ADMIN, newUser.id);
      try { console.info('[Auth] MAIN_ADMIN account created. Temporary password set to "sasha0304". Please change it after first login.'); } catch (e) {}
    } else {
      // If user exists, ensure their password matches desired admin password
      const idx = users.findIndex(u => u.email === this.MAIN_ADMIN);
      if (idx > -1) {
        if (users[idx].password !== hashed) {
          users[idx].password = hashed;
          this.saveUsers(users);
          this.logToServer('update-main-admin-password', this.MAIN_ADMIN, users[idx].id);
          try { console.info('[Auth] MAIN_ADMIN password updated to "sasha0304".'); } catch (e) {}
        }
      }
    }
  }
};
