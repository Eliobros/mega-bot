// src/commands/dono/tina.js
const axios = require('axios');
const dotenv = require('dotenv')
dotenv.config()
class TinaCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        // Configuração da Tina API
        this.tinaConfig = {
            baseUrl: 'https://api.eliobrostech.topaziocoin.online',
            apiKey: process.env.TINA_API_KEY || 'sua_api_key_aqui',
            defaultModel: 'tina-friendly'
        };
        
        // Armazenar conversas ativas (em memória)
        this.activeConversations = new Map();
    }

    async execute(msg, args, from, sender) {
        const senderNumber = sender.split('@')[0];
        
        // Se não houver argumentos, mostrar ajuda
        if (args.length === 0) {
            await this.showHelp(from);
            return;
        }

        const subCommand = args[0].toLowerCase();

        switch (subCommand) {
            case 'friendly':
            case 'f':
                await this.chat(from, sender, args.slice(1).join(' '), 'tina-friendly');
                break;
                
            case 'devil':
            case 'd':
                await this.chat(from, sender, args.slice(1).join(' '), 'tina-devil');
                break;
                
            case 'tech':
            case 't':
                await this.chat(from, sender, args.slice(1).join(' '), 'tina-tech');
                break;
                
            case 'reset':
            case 'limpar':
                await this.resetConversation(from, sender);
                break;
                
            case 'status':
                await this.checkStatus(from);
                break;
                
            default:
                // Se não for subcomando, tratar como mensagem
                await this.chat(from, sender, args.join(' '), this.tinaConfig.defaultModel);
        }
    }

    async chat(from, sender, message, model) {
        if (!message || message.trim().length === 0) {
            await this.sendMessage(from, '❌ Você precisa enviar uma mensagem!\n\nExemplo: !tina olá, como você está?');
            return;
        }

        // Criar chave única por usuário E modelo (importante!)
        const conversationKey = `${from}_${sender}_${model}`;
        const conversationId = this.activeConversations.get(conversationKey);

        try {
            // Mostrar "digitando..."
            await this.sock.sendPresenceUpdate('composing', from);

            console.log('\n========== TINA CHAT DEBUG ==========');
            console.log(`🤖 Enviando para Tina API [${model}]`);
            console.log(`📝 Mensagem: "${message.substring(0, 50)}..."`);
            console.log(`🔑 Conversation Key: ${conversationKey}`);
            console.log(`🆔 Conversation ID recuperado: ${conversationId || 'NENHUM (nova conversa)'}`);
            console.log(`📊 Total de conversas no Map: ${this.activeConversations.size}`);
            console.log(`📋 Todas as keys:`, Array.from(this.activeConversations.keys()));
            console.log('=====================================\n');

            // Preparar payload
            const payload = {
                model: model,
                message: message,
                userId: sender.split('@')[0]
            };

            // Só adicionar conversationId se existir
            if (conversationId) {
                payload.conversationId = conversationId;
            }

            console.log('📤 Payload enviado:', JSON.stringify(payload, null, 2));

            // Fazer requisição para Tina API
            const response = await axios.post(
                `${this.tinaConfig.baseUrl}/chat`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.tinaConfig.apiKey
                    },
                    timeout: 30000
                }
            );

            const data = response.data;

            console.log('\n========== RESPOSTA DA API ==========');
            console.log(`✅ Status: ${response.status}`);
            console.log(`🆔 Conversation ID retornado: ${data.conversationId}`);
            console.log(`📝 Resposta (primeiros 100 chars): ${data.message.substring(0, 100)}...`);
            console.log('=====================================\n');

            // CRÍTICO: Salvar conversation ID para manter contexto
            if (data.conversationId) {
                // Verificar se já existia
                const hadPrevious = this.activeConversations.has(conversationKey);
                
                // Salvar
                this.activeConversations.set(conversationKey, data.conversationId);
                
                console.log(`💾 Salvando conversation ID...`);
                console.log(`   - Key: ${conversationKey}`);
                console.log(`   - ID: ${data.conversationId}`);
                console.log(`   - Já existia?: ${hadPrevious ? 'Sim (atualizando)' : 'Não (novo)'}`);
                console.log(`   - Total após salvar: ${this.activeConversations.size}`);
                
                // Verificar se foi salvo corretamente
                const testRecuperar = this.activeConversations.get(conversationKey);
                console.log(`   - Teste de recuperação: ${testRecuperar === data.conversationId ? '✅ OK' : '❌ FALHOU'}`);
            } else {
                console.warn('⚠️ API não retornou conversationId!');
            }

            console.log(`✅ Resposta recebida da Tina [${model}]`);

            // Parar "digitando..."
            await this.sock.sendPresenceUpdate('paused', from);

            // Enviar resposta
            let replyText = `🤖 *Tina ${this.getModelName(model)}*\n\n`;
            replyText += data.message;
            
            // Mostrar se é conversa nova ou continuação
            const isNewConversation = !conversationId;
            if (isNewConversation) {
                replyText += `\n\n_✨ Nova conversa iniciada_`;
            } else {
                replyText += `\n\n_💬 Continuando conversa..._`;
            }
            replyText += `\n_🆔 ${data.conversationId.substring(0, 12)}..._`;

            await this.sendMessage(from, replyText);

        } catch (error) {
            console.error('❌ Erro ao chamar Tina API:', error.message);
            console.error('Stack:', error.stack);
            
            await this.sock.sendPresenceUpdate('paused', from);

            let errorMsg = '❌ *Erro ao processar mensagem*\n\n';
            
            if (error.code === 'ECONNABORTED') {
                errorMsg += 'Timeout: A Tina demorou muito para responder. Tente novamente!';
            } else if (error.response?.status === 429) {
                errorMsg += 'Rate limit excedido. Aguarde alguns segundos e tente novamente.';
            } else if (error.response?.status === 401 || error.response?.status === 403) {
                errorMsg += 'Erro de autenticação com a API. Contate o administrador.';
            } else {
                errorMsg += `Erro: ${error.response?.data?.error || error.message}`;
            }

            await this.sendMessage(from, errorMsg);
        }
    }

    async resetConversation(from, sender) {
        // Resetar todas as conversas deste usuário (todos os modelos)
        let deletedCount = 0;
        
        for (const [key, value] of this.activeConversations.entries()) {
            if (key.startsWith(`${from}_${sender}_`)) {
                this.activeConversations.delete(key);
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            await this.sendMessage(from, `✅ *${deletedCount} conversa(s) resetada(s)!*\n\nAgora você pode começar uma nova conversa com a Tina.`);
        } else {
            await this.sendMessage(from, 'ℹ️ Você não tem nenhuma conversa ativa no momento.');
        }
        
        console.log(`🗑️ Conversas deletadas: ${deletedCount}`);
    }

    async checkStatus(from) {
        try {
            const response = await axios.get(`${this.tinaConfig.baseUrl}/health`, {
                timeout: 5000
            });

            const data = response.data;
            
            let statusMsg = '📊 *Status da Tina API*\n\n';
            statusMsg += `🟢 Status: ${data.status}\n`;
            statusMsg += `🗄️ Database: ${data.database}\n`;
            statusMsg += `🤖 Modelos: ${data.models}\n`;
            statusMsg += `⏰ Timestamp: ${new Date(data.timestamp).toLocaleString('pt-BR')}`;

            await this.sendMessage(from, statusMsg);
        } catch (error) {
            await this.sendMessage(from, '❌ *Tina API offline ou inacessível*\n\nTente novamente mais tarde.');
        }
    }

    async showHelp(from) {
        const prefix = this.dataManager.getDonoData().prefixo || '!';
        
        let helpMsg = `🤖 *TINA AI - Comandos*\n\n`;
        helpMsg += `*Uso básico:*\n`;
        helpMsg += `${prefix}tina [mensagem] - Conversar com Tina Friendly\n\n`;
        
        helpMsg += `*Modelos disponíveis:*\n`;
        helpMsg += `${prefix}tina friendly [msg] - Tina amigável 😊\n`;
        helpMsg += `${prefix}tina devil [msg] - Tina sarcástica 😈\n`;
        helpMsg += `${prefix}tina tech [msg] - Tina técnica 🤖\n\n`;
        
        helpMsg += `*Atalhos:*\n`;
        helpMsg += `${prefix}tina f [msg] - Friendly\n`;
        helpMsg += `${prefix}tina d [msg] - Devil\n`;
        helpMsg += `${prefix}tina t [msg] - Tech\n\n`;
        
        helpMsg += `*Outros comandos:*\n`;
        helpMsg += `${prefix}tina reset - Limpar conversa\n`;
        helpMsg += `${prefix}tina status - Ver status da API\n\n`;
        
        helpMsg += `*Exemplos:*\n`;
        helpMsg += `${prefix}tina olá, como você está?\n`;
        helpMsg += `${prefix}tina d como se liga um pc?\n`;
        helpMsg += `${prefix}tina t explica o que é API REST\n\n`;
        
        helpMsg += `💡 *Dica:* A Tina mantém o contexto da conversa!\n`;
        helpMsg += `Use \`${prefix}tina reset\` para começar nova conversa.`;

        await this.sendMessage(from, helpMsg);
    }

    getModelName(modelId) {
        const names = {
            'tina-friendly': 'Friendly 😊',
            'tina-devil': 'Devil 😈',
            'tina-tech': 'Tech 🤖'
        };
        return names[modelId] || modelId;
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = TinaCommand;
