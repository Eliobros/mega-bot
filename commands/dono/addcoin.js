const fs = require('fs');
const path = require('path');
const https = require('https');

class AddCoinCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
        
        // Configurações da API
        this.apiConfig = {
            url: 'https://api.mozhost.topaziocoin.online/api/admin/coins/add'
        };
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { Prefixo: '/', NumeroDono: '' };
        }
    }

    // Fazer requisição HTTP POST
    makeHttpRequest(data) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            
            const url = new URL(this.apiConfig.url);
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        resolve({
                            statusCode: res.statusCode,
                            data: parsedData
                        });
                    } catch (error) {
                        resolve({
                            statusCode: res.statusCode,
                            data: responseData
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.setTimeout(60000); // 10 segundos timeout
            req.write(postData);
            req.end();
        });
    }

    async execute(msg, args, from, sender) {
        const config = this.getConfig();
        const prefixo = config.Prefixo || '/';
        
        // Verificar se é o dono
        const donoNumber = config.NumeroDono;
        const senderNumber = sender.replace(/@.*/, '');

        if (senderNumber !== donoNumber) {
            await this.sendMessage(from, '❌ *Acesso Negado!*\n\n🔒 Apenas o dono do bot pode adicionar coins.');
            return;
        }

        // Verificar se a senha da API está configurada
        if (!config.MozhostPassword) {
            await this.sendMessage(from, '❌ *Configuração faltando!*\n\n🔧 Configure a senha da Mozhost no arquivo dono.json:\n`"MozhostPassword": "sua_senha_aqui"`');
            return;
        }

        // Verificar argumentos
        if (args.length < 2) {
            let helpMsg = `🪙 *Adicionar Coins - Mozhost*\n\n`;
            helpMsg += `📝 *Como usar:*\n`;
            helpMsg += `\`${prefixo}addcoin <username> <quantidade>\`\n\n`;
            helpMsg += `💡 *Exemplos:*\n`;
            helpMsg += `• \`${prefixo}addcoin joao 1000\`\n`;
            helpMsg += `• \`${prefixo}addcoin maria 500\`\n`;
            helpMsg += `• \`${prefixo}addcoin admin 2500\`\n\n`;
            helpMsg += `⚠️ *Nota:* Este comando faz requisição para a API da Mozhost\n`;
            helpMsg += `🔒 *Restrito ao dono do bot*`;
            
            await this.sendMessage(from, helpMsg);
            return;
        }

        const username = args[0];
        const amount = parseInt(args[1]);

        // Validações
        if (!username || username.length < 2) {
            await this.sendMessage(from, '❌ *Username inválido!*\n\n📝 O username deve ter pelo menos 2 caracteres.');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            await this.sendMessage(from, '❌ *Quantidade inválida!*\n\n📊 Informe um número positivo válido.');
            return;
        }

        if (amount > 100000) {
            await this.sendMessage(from, '❌ *Quantidade muito alta!*\n\n📏 Limite máximo: 100,000 coins por operação.');
            return;
        }

        // Enviar mensagem de processamento
        await this.sendMessage(from, `⏳ *Processando...*\n\n🪙 Adicionando ${amount} coins para ${username}\n🔄 Aguarde...`);

        try {
            // Preparar dados para API
            const apiData = {
                username: username,
                amount: amount,
                password: config.MozhostPassword // Buscar senha do dono.json
            };

            console.log(`🪙 Tentando adicionar ${amount} coins para ${username}`);

            // Fazer requisição para API
            const response = await this.makeHttpRequest(apiData);

            console.log(`📡 Resposta da API:`, response);

            if (response.statusCode === 200) {
                // Sucesso
                let successMsg = `✅ *Coins adicionados com sucesso!*\n\n`;
                successMsg += `👤 *Usuário:* ${username}\n`;
                successMsg += `🪙 *Quantidade:* ${amount.toLocaleString()} coins\n`;
                successMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n`;
                successMsg += `🔗 *API:* Mozhost\n`;
                successMsg += `✨ *Status:* Processado com sucesso`;

                if (response.data && response.data.message) {
                    successMsg += `\n📝 *Resposta:* ${response.data.message}`;
                }

                await this.sendMessage(from, successMsg);

                // Log para console
                console.log(`✅ Coins adicionados: ${username} recebeu ${amount} coins`);

            } else if (response.statusCode === 400) {
                // Erro de validação
                let errorMsg = `❌ *Erro de validação!*\n\n`;
                errorMsg += `👤 *Usuário:* ${username}\n`;
                errorMsg += `🪙 *Quantidade:* ${amount}\n`;
                
                if (response.data && response.data.error) {
                    errorMsg += `📝 *Motivo:* ${response.data.error}`;
                } else {
                    errorMsg += `📝 *Motivo:* Dados inválidos ou usuário não encontrado`;
                }

                await this.sendMessage(from, errorMsg);

            } else if (response.statusCode === 401 || response.statusCode === 403) {
                // Erro de autenticação
                let authErrorMsg = `🔒 *Erro de autenticação!*\n\n`;
                authErrorMsg += `❌ Senha da API incorreta ou acesso negado\n`;
                authErrorMsg += `🔧 Verifique a senha no arquivo dono.json\n`;
                authErrorMsg += `📞 Contacte o desenvolvedor se necessário`;

                await this.sendMessage(from, authErrorMsg);

                console.error('❌ Erro de autenticação na API Mozhost');

            } else {
                // Outros erros
                let genericErrorMsg = `❌ *Erro na API!*\n\n`;
                genericErrorMsg += `📡 *Código:* ${response.statusCode}\n`;
                genericErrorMsg += `👤 *Usuário:* ${username}\n`;
                genericErrorMsg += `🪙 *Quantidade:* ${amount}\n`;
                genericErrorMsg += `🔄 *Tente novamente em alguns minutos*`;

                if (response.data && typeof response.data === 'string') {
                    genericErrorMsg += `\n📝 *Detalhes:* ${response.data.substring(0, 100)}`;
                }

                await this.sendMessage(from, genericErrorMsg);
            }

        } catch (error) {
            console.error('❌ Erro na requisição:', error);

            let networkErrorMsg = `❌ *Erro de conexão!*\n\n`;
            networkErrorMsg += `🌐 Falha ao conectar com a API da Mozhost\n`;
            networkErrorMsg += `👤 *Usuário:* ${username}\n`;
            networkErrorMsg += `🪙 *Quantidade:* ${amount}\n\n`;

            if (error.code === 'ENOTFOUND') {
                networkErrorMsg += `📡 *Motivo:* Servidor não encontrado`;
            } else if (error.code === 'ETIMEDOUT' || error.message === 'Request timeout') {
                networkErrorMsg += `⏱️ *Motivo:* Timeout da requisição`;
            } else {
                networkErrorMsg += `🔧 *Motivo:* ${error.message}`;
            }

            networkErrorMsg += `\n\n🔄 Verifique sua conexão e tente novamente`;

            await this.sendMessage(from, networkErrorMsg);
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = AddCoinCommand;
