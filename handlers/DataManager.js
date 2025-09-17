const fs = require('fs');
const path = require('path');

class DataManager {
    constructor() {
        this.donoPath = path.join(__dirname, '../database/dono.json');
        this.donoData = null;
    }

    // Carrega os dados do dono
    loadDono() {
        if (!fs.existsSync(this.donoPath)) {
            throw new Error('Arquivo dono.json não encontrado em ../database/');
        }
        const raw = fs.readFileSync(this.donoPath, 'utf-8');
        this.donoData = JSON.parse(raw);
    }

    // Retorna os dados completos do dono
    getDonoData() {
        if (!this.donoData) {
            this.loadDono();
        }
        return this.donoData;
    }

    // Verifica se o número passado é do dono
    isDono(numero) {
        if (!this.donoData) {
            this.loadDono();
        }
        return numero === this.donoData.NumeroDono;
    }
}

module.exports = DataManager;
