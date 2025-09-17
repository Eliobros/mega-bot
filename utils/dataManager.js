const fs = require('fs');
const path = require('path');

class DataManager {
    constructor() {
        this.basePath = path.join(__dirname, '..', 'database');

        // Arquivos
        this.donoPath = path.join(this.basePath, 'dono.json');
        this.groupsPath = path.join(this.basePath, 'groupsAllowed.json');
        this.usersPath = path.join(this.basePath, 'users.json');
        this.tabelasPath = path.join(this.basePath, 'tabelas.json'); // arquivo único para todas as tabelas

        // Dados em memória
        this.donoData = null;
        this.groupsData = { grupos: [] };
        this.usersData = { users: [], comprovantes_utilizados: [] };
        this.tabelasData = null;
    }

    // ---------- Helpers ----------
    ensureBasePath() {
        if (!fs.existsSync(this.basePath)) fs.mkdirSync(this.basePath, { recursive: true });
    }

    loadJSON(filePath, defaultData = {}) {
        this.ensureBasePath();
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (err) {
            console.error(`Erro ao ler ${filePath}:`, err);
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
    }

    saveJSON(filePath, data) {
        this.ensureBasePath();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    // ---------- Carregamento ----------
    loadAll() {
        this.donoData = this.loadJSON(this.donoPath, null);
        this.groupsData = this.loadJSON(this.groupsPath, { grupos: [] });
        this.usersData = this.loadJSON(this.usersPath, { users: [], comprovantes_utilizados: [] });
        this.tabelasData = this.loadJSON(this.tabelasPath, {});
    }

    // ---------- Dono ----------
    getDonoData() {
        if (!this.donoData) this.loadAll();
        return this.donoData;
    }

    isDono(numero) {
        return this.donoData && numero === this.donoData.NumeroDono;
    }

    // ---------- Grupos ----------
    getAllowedGroups() {
        if (!this.groupsData) this.loadAll();
        return this.groupsData.grupos || [];
    }

    isGroupAllowed(groupId) {
        return this.getAllowedGroups().includes(groupId);
    }

    addGroup(groupId) {
        if (!this.groupsData.grupos.includes(groupId)) {
            this.groupsData.grupos.push(groupId);
            this.saveJSON(this.groupsPath, this.groupsData);
        }
    }

    removeGroup(groupId) {
        const idx = this.groupsData.grupos.indexOf(groupId);
        if (idx !== -1) {
            this.groupsData.grupos.splice(idx, 1);
            this.saveJSON(this.groupsPath, this.groupsData);
        }
    }

    // ---------- Usuários & comprovantes ----------
    getUsersData() {
        if (!this.usersData) this.loadAll();
        if (!this.usersData.users) this.usersData.users = [];
        if (!this.usersData.comprovantes_utilizados) this.usersData.comprovantes_utilizados = [];
        return this.usersData;
    }

    saveUsersData() {
        this.saveJSON(this.usersPath, this.usersData);
    }

    upsertUser(userObj) {
        const users = this.getUsersData().users;
        const idx = users.findIndex(u => u.number === userObj.number);
        if (idx === -1) {
            users.push(userObj);
        } else {
            users[idx] = { ...users[idx], ...userObj };
        }
        this.saveUsersData();
    }

    addComprovanteUtilizado(comprovanteObj) {
        const arr = this.getUsersData().comprovantes_utilizados;
        arr.push(comprovanteObj);
        this.saveUsersData();
    }

    removeComprovanteUtilizado(predicateFn) {
        const arr = this.getUsersData().comprovantes_utilizados;
        const before = arr.length;
        this.usersData.comprovantes_utilizados = arr.filter(c => !predicateFn(c));
        this.saveUsersData();
        return this.usersData.comprovantes_utilizados.length !== before;
    }

    findUserByNumber(number) {
        const users = this.getUsersData().users;
        return users.find(u => u.number === number) || null;
    }

    removeUser(number) {
        const users = this.getUsersData().users;
        const idx = users.findIndex(u => u.number === number);
        if (idx !== -1) {
            users.splice(idx, 1);
            this.saveUsersData();
            return true;
        }
        return false;
    }

    // ---------- Tabelas por grupo ----------
    loadTabelas() {
        if (!this.tabelasData) this.tabelasData = this.loadJSON(this.tabelasPath, {});
    }

    getTabelaByGroup(groupId) {
        this.loadTabelas();
        return this.tabelasData[groupId] || null;
    }

    saveTabelaByGroup(groupId, tabelaObj) {
        this.loadTabelas();
        this.tabelasData[groupId] = tabelaObj;
        this.saveJSON(this.tabelasPath, this.tabelasData);
    }
}

module.exports = DataManager;
