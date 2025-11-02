// ===== HANDLERS/WHATSAPPVALIDATOR.JS =====
// Integração do Mega-Bot com Alauda API

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class WhatsAppValidator {
    constructor() {
        this.ALAUDA_API_URL = 'http://localhost:3003/api/whatsapp';
        this.cacheFile = path.join(__dirname, '../data/whatsapp-cache.json');
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
        
        this.loadCache();
    }

    /**
     * Carrega cache do arquivo
     */
    async loadCache() {
        try {
            const data = await fs.readFile(this.cacheFile, 'utf8');
            const cacheData = JSON.parse(data);
            
            Object.entries(cacheData).forEach(([phone, data]) => {
                this.cache.set(phone, {
                    ...data,
                    timestamp: new Date(data.timestamp)
                });
            });
            
            console.log('✅ Cache de WhatsApp carregado');
        } catch (error) {
            // Arquivo não existe ainda, tudo bem
            console.log('ℹ️ Cache de WhatsApp será criado');
        }
    }

    /**
     * Salva cache no arquivo
     */
    async saveCache() {
        try {
            const cacheObj = {};
            this.cache.forEach((value, key) => {
                cacheObj[key] = value;
            });
            
            await fs.writeFile(this.cacheFile, JSON.stringify(cacheObj, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar cache:', error.message);
        }
    }

    /**
     * Limpa cache expirado
     */
    cleanExpiredCache() {
        const now = Date.now();
        let cleaned = 0;
        
        this.cache.forEach((value, key) => {
            if (now - value.timestamp.getTime() > this.CACHE_DURATION) {
                this.cache.delete(key);
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            console.log(`🧹 ${cleaned} entradas expiradas removidas do cache`);
            this.saveCache();
        }
    }

    /**
     * Ativa número com API Key
     */
    async activate(phone, apiKey, groupId = null, groupName = null) {
        try {
            const response = await axios.post(`${this.ALAUDA_API_URL}/activate`, {
                phone,
                api_key: apiKey,
                group_id: groupId,
                group_name: groupName
            }, {
                timeout: 10000
            });

            if (response.data.success) {
                // Adiciona ao cache
                this.cache.set(phone, {
                    valid: true,
                    credits: response.data.data.credits_available,
                    timestamp: new Date()
                });
                
                await this.saveCache();
                
                return {
                    success: true,
                    message: response.data.data.message,
                    credits: response.data.data.credits_available
                };
            }

            return {
                success: false,
                message: response.data.error || 'Erro ao ativar'
            };

        } catch (error) {
            console.error('❌ Erro ao ativar WhatsApp:', error.message);
            
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.error || 'Erro na API'
                };
            }
            
            return {
                success: false,
                message: 'Erro ao conectar com Alauda API'
            };
        }
    }

    /**
     * Valida se número pode processar mensagens
     */
    async validate(phone) {
        // Limpa cache expirado
        this.cleanExpiredCache();

        // Verifica cache primeiro
        const cached = this.cache.get(phone);
        if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
            console.log(`✅ [Cache] Validação de ${phone}: ${cached.valid}`);
            return {
                valid: cached.valid,
                credits: cached.credits,
                fromCache: true
            };
        }

        // Faz requisição à API
        try {
            const response = await axios.post(`${this.ALAUDA_API_URL}/validate`, {
                phone
            }, {
                timeout: 10000
            });

            if (response.data.success) {
                const data = response.data.data;
                
                // Atualiza cache
                this.cache.set(phone, {
                    valid: true,
                    credits: data.credits_available,
                    timestamp: new Date()
                });
                
                await this.saveCache();
                
                return {
                    valid: true,
                    credits: data.credits_available,
                    cost: data.cost_per_operation,
                    fromCache: false
                };
            }

            // Não autorizado - remove do cache
            this.cache.delete(phone);
            await this.saveCache();
            
            return {
                valid: false,
                message: response.data.error,
                fromCache: false
            };

        } catch (error) {
            console.error('❌ Erro ao validar WhatsApp:', error.message);
            
            if (error.response && error.response.status === 404) {
                return {
                    valid: false,
                    message: '❌ *Número não ativado*\n\nUse *!ativar <sua_chave>* para ativar o bot.',
                    fromCache: false
                };
            }
            
            if (error.response && error.response.status === 402) {
                // Sem créditos
                this.cache.delete(phone);
                await this.saveCache();
                
                return {
                    valid: false,
                    message: error.response.data.error,
                    fromCache: false
                };
            }
            
            // Em caso de erro, mantém cache se existir
            if (cached) {
                console.log('⚠️ Usando cache devido a erro na API');
                return {
                    valid: cached.valid,
                    credits: cached.credits,
                    fromCache: true
                };
            }
            
            return {
                valid: false,
                message: 'Erro ao validar. Tente novamente.',
                fromCache: false
            };
        }
    }

    /**
     * Consome créditos
     */
    async consume(phone) {
        try {
            const response = await axios.post(`${this.ALAUDA_API_URL}/consume`, {
                phone
            }, {
                timeout: 10000
            });

            if (response.data.success) {
                // Atualiza cache
                this.cache.set(phone, {
                    valid: true,
                    credits: response.data.data.credits_remaining,
                    timestamp: new Date()
                });
                
                await this.saveCache();
                
                return {
                    success: true,
                    credits_remaining: response.data.data.credits_remaining,
                    credits_consumed: response.data.data.credits_consumed
                };
            }

            return {
                success: false,
                message: response.data.error
            };

        } catch (error) {
            console.error('❌ Erro ao consumir créditos:', error.message);
            
            if (error.response && error.response.status === 402) {
                // Sem créditos - remove do cache
                this.cache.delete(phone);
                await this.saveCache();
                
                return {
                    success: false,
                    no_credits: true,
                    message: '⚠️ *CRÉDITOS INSUFICIENTES*\n\nRecarregue sua conta para continuar usando o bot!'
                };
            }
            
            return {
                success: false,
                message: 'Erro ao consumir créditos'
            };
        }
    }

    /**
     * Limpa cache de um número específico
     */
    clearCache(phone) {
        this.cache.delete(phone);
        this.saveCache();
    }

    /**
     * Limpa todo o cache
     */
    clearAllCache() {
        this.cache.clear();
        this.saveCache();
    }
}

module.exports = new WhatsAppValidator();
