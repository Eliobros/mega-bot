const fs = require('fs');
const path = require('path');

class DataManager {
    constructor() {
        this.basePath = path.join(__dirname, '..', 'database');
	
        // ---------- Arquivos ----------
        this.donoPath = path.join(this.basePath, 'dono.json');
        this.groupsPath = path.join(this.basePath, 'groupsAllowed.json');
        this.usersPath = path.join(this.basePath, 'users.json');
        this.tabelasPath = path.join(this.basePath, 'tabelas.json');
        this.membersEntryPath = path.join(this.basePath, 'membersEntry.json'); // 🆕
	this.statusWarningsPath = path.join(this.basePath, 'statusWarnings.json'); // ✅ adicionado
        // ---------- Dados em memória ----------
        this.donoData = null;
        this.groupsData = { grupos: [] };
        this.usersData = { users: [], comprovantes_utilizados: [] };
        this.tabelasData = {};
        this.membersEntryData = {}; // 🆕
	statusMentionWarnings: {};
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
        this.donoData = this.loadJSON(this.donoPath, { prefixo: '!', NomeDoBot: 'Bot', NickDono: 'Admin', NumeroDono: '' });
        this.groupsData = this.loadJSON(this.groupsPath, { grupos: [] });
        this.usersData = this.loadJSON(this.usersPath, { users: [], comprovantes_utilizados: [] });
        this.tabelasData = this.loadJSON(this.tabelasPath, {});
        this.membersEntryData = this.loadJSON(this.membersEntryPath, {}); // 🆕
	this.statusWarningsData = this.loadJSON(this.statusWarningsPath, {}); // 🆕

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

    addAllowedGroup(groupId) {
        if (!this.groupsData) this.loadAll();
        if (!this.groupsData.grupos.includes(groupId)) {
            this.groupsData.grupos.push(groupId);
            this.saveJSON(this.groupsPath, this.groupsData);
            return true;
        }
        return false;
    }

    removeAllowedGroup(groupId) {
        if (!this.groupsData) this.loadAll();
        const before = this.groupsData.grupos.length;
        this.groupsData.grupos = this.groupsData.grupos.filter(g => g !== groupId);
        if (this.groupsData.grupos.length !== before) {
            this.saveJSON(this.groupsPath, this.groupsData);
            return true;
        }
        return false;
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
        return this.getUsersData().users.find(u => u.number === number) || null;
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

    // ---------- Tabelas ----------
    getTabelaData() {
        if (!this.tabelasData) this.loadAll();
        return this.tabelasData;
    }

    getTabelaByGroup(groupId) {
        if (!this.tabelasData) this.loadAll();
        return this.tabelasData[groupId] || null;
    }

    saveTabelaByGroup(groupId, tabelaObj) {
        if (!this.tabelasData) this.loadAll();
        this.tabelasData[groupId] = tabelaObj;
        this.saveJSON(this.tabelasPath, this.tabelasData);
    }

    // ---------- Assinaturas de Grupos ----------
    getGroupSubscriptionsData() {
        if (!this.groupSubscriptionsData) {
            const filePath = path.join(this.basePath, 'groupSubscriptions.json');
            this.groupSubscriptionsData = this.loadJSON(filePath, { assinaturas: [] });
        }
        return this.groupSubscriptionsData;
    }

    saveGroupSubscriptionsData() {
        const filePath = path.join(this.basePath, 'groupSubscriptions.json');
        this.saveJSON(filePath, this.groupSubscriptionsData);
    }

    getGroupSubscription(groupId) {
        const data = this.getGroupSubscriptionsData();
        return data.assinaturas.find(g => g.groupId === groupId);
    }

    addGroupSubscription(groupId, days = 30) {
        const data = this.getGroupSubscriptionsData();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        const group = {
            groupId,
            startDate: new Date(),
            endDate,
            active: true
        };

        data.assinaturas.push(group);
        this.saveGroupSubscriptionsData();
        return group;
    }

    renewGroupSubscription(groupId, days = 30) {
        const data = this.getGroupSubscriptionsData();
        const group = data.assinaturas.find(g => g.groupId === groupId);
        if (group) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);
            group.endDate = endDate;
            group.active = true;
            this.saveGroupSubscriptionsData();
            return true;
        }
        return false;
    }

    deactivateGroupSubscription(groupId) {
        const data = this.getGroupSubscriptionsData();
        const group = data.assinaturas.find(g => g.groupId === groupId);
        if (group) {
            group.active = false;
            this.saveGroupSubscriptionsData();
        }
    }

    isGroupSubscriptionActive(groupId) {
        const group = this.getGroupSubscription(groupId);
        if (!group) return false;
        const now = new Date();
        return group.active && now <= new Date(group.endDate);
    }


	// ===== ADICIONE ESSES MÉTODOS NO SEU DataManager.js =====

// 📌 Obter número de avisos de um membro por marcar grupo no status
getStatusMentionWarnings(groupJid, participantJid) {
    if (!this.statusWarningsData[groupJid]) {
        this.statusWarningsData[groupJid] = {};
    }
    
    return this.statusWarningsData[groupJid][participantJid] || 0;
}

// 📌 Adicionar aviso de menção no status
addStatusMentionWarning(groupJid, participantJid) {
    if (!this.statusWarningsData[groupJid]) {
        this.statusWarningsData[groupJid] = {};
    }
    
    const currentWarnings = this.statusWarningsData[groupJid][participantJid] || 0;
    this.statusWarningsData[groupJid][participantJid] = currentWarnings + 1;
    
    this.saveJSON(this.statusWarningsPath, this.statusWarningsData);
    
    return this.statusWarningsData[groupJid][participantJid];
}

// 📌 Resetar avisos de um membro (caso admin queira dar segunda chance)
resetStatusMentionWarnings(groupJid, participantJid) {
    if (this.statusWarningsData[groupJid]?.[participantJid]) {
        delete this.statusWarningsData[groupJid][participantJid];
        this.saveJSON(this.statusWarningsPath, this.statusWarningsData);
        return true;
    }
    return false;
}

// 📌 Ver todos os avisos de um grupo
getGroupStatusMentionWarnings(groupJid) {
    return this.statusWarningsData[groupJid] || {};
}

    // 🆕 ---------- Entradas de Membros ----------
    getMembersEntryData() {
        if (!this.membersEntryData) this.loadAll();
        return this.membersEntryData;
    }

    saveMembersEntryData() {
        this.saveJSON(this.membersEntryPath, this.membersEntryData);
    }

    /**
     * Adiciona ou atualiza a data de entrada de um membro
     * @param {string} groupJid - JID do grupo
     * @param {string} memberJid - JID do membro
     * @param {string} entryDate - Data de entrada em ISO format
     */
    addMemberEntry(groupJid, memberJid, entryDate) {
        if (!this.membersEntryData[groupJid]) {
            this.membersEntryData[groupJid] = {};
        }
        
        // Só atualiza se o membro ainda não tiver registro (primeira entrada)
        if (!this.membersEntryData[groupJid][memberJid]) {
            this.membersEntryData[groupJid][memberJid] = {
                entryDate,
                registered: entryDate
            };
            this.saveMembersEntryData();
        }
    }

    /**
     * Remove o registro de entrada de um membro
     * @param {string} groupJid - JID do grupo
     * @param {string} memberJid - JID do membro
     */
    removeMemberEntry(groupJid, memberJid) {
        if (this.membersEntryData[groupJid] && this.membersEntryData[groupJid][memberJid]) {
            delete this.membersEntryData[groupJid][memberJid];
            this.saveMembersEntryData();
        }
    }

    /**
     * Retorna a data de entrada de um membro
     * @param {string} groupJid - JID do grupo
     * @param {string} memberJid - JID do membro
     * @returns {string|null} - Data de entrada ou null
     */
    getMemberEntryDate(groupJid, memberJid) {
        if (this.membersEntryData[groupJid] && this.membersEntryData[groupJid][memberJid]) {
            return this.membersEntryData[groupJid][memberJid].entryDate;
        }
        return null;
    }

    /**
     * Verifica se um membro entrou nos últimos X dias
     * @param {string} groupJid - JID do grupo
     * @param {string} memberJid - JID do membro
     * @param {number} days - Número de dias
     * @returns {boolean}
     */
    memberEnteredInLastDays(groupJid, memberJid, days) {
        const entryDate = this.getMemberEntryDate(groupJid, memberJid);
        if (!entryDate) return false;

        const entry = new Date(entryDate);
        const now = new Date();
        const diffTime = Math.abs(now - entry);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays <= days;
    }

    /**
     * Retorna todos os membros de um grupo com suas datas de entrada
     * @param {string} groupJid - JID do grupo
     * @returns {Object}
     */
    getAllMembersEntry(groupJid) {
        return this.membersEntryData[groupJid] || {};
    }
}

module.exports = DataManager;
