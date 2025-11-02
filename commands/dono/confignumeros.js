/**
 * Comando: confignumeros
 * 
 * Configura os números de pagamento (M-Pesa e E-Mola) para um grupo específico
 * 
 * Uso:
 * !confignumeros mpesa 862840075 Habibo
 * !confignumeros emola 841617651 Paulo
 * !confignumeros ver
 */

class ConfigNumerosCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(msg, args, from, sender) {
        const prefixo = this.dataManager.getDonoData().prefixo;

        // Verificar se é grupo
        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        // Verificar se tem argumentos
        if (args.length < 1) {
            await this.sendMessage(from, this.getHelpMessage(prefixo));
            return;
        }

        const subcomando = args[0].toLowerCase();

        // Ver configuração atual
        if (subcomando === 'ver' || subcomando === 'listar') {
            await this.mostrarConfiguracao(from);
            return;
        }

        // Adicionar número
        if (subcomando === 'mpesa' || subcomando === 'emola') {
            if (args.length < 2) {
                await this.sendMessage(from, `❌ Uso: ${prefixo}confignumeros ${subcomando} <numero> [nome]`);
                return;
            }

            const numero = args[1];
            const nome = args.slice(2).join(' ') || null;

            await this.adicionarNumero(from, subcomando, numero, nome);
            return;
        }

        // Remover número
        if (subcomando === 'remover' || subcomando === 'deletar') {
            if (args.length < 3) {
                await this.sendMessage(from, `❌ Uso: ${prefixo}confignumeros remover <mpesa|emola> <numero>`);
                return;
            }

            const tipo = args[1].toLowerCase();
            const numero = args[2];

            await this.removerNumero(from, tipo, numero);
            return;
        }

        await this.sendMessage(from, this.getHelpMessage(prefixo));
    }

    async adicionarNumero(groupJid, tipo, numero, nome) {
        try {
            const usersData = this.dataManager.getUsersData();

            // Inicializar estrutura
            if (!usersData.configuracoes_grupos) {
                usersData.configuracoes_grupos = {};
            }

            if (!usersData.configuracoes_grupos[groupJid]) {
                usersData.configuracoes_grupos[groupJid] = {
                    numeros_pagamento: {
                        mpesa: { numeros: [], nomes: {} },
                        emola: { numeros: [], nomes: {} }
                    }
                };
            }

            const grupoConfig = usersData.configuracoes_grupos[groupJid];

            // Garantir estrutura correta
            if (!grupoConfig.numeros_pagamento) {
                grupoConfig.numeros_pagamento = {
                    mpesa: { numeros: [], nomes: {} },
                    emola: { numeros: [], nomes: {} }
                };
            }

            if (!grupoConfig.numeros_pagamento[tipo]) {
                grupoConfig.numeros_pagamento[tipo] = { numeros: [], nomes: {} };
            }

            const tipoConfig = grupoConfig.numeros_pagamento[tipo];

            // Garantir que é objeto com numeros e nomes
            if (Array.isArray(tipoConfig)) {
                grupoConfig.numeros_pagamento[tipo] = {
                    numeros: tipoConfig,
                    nomes: {}
                };
            }

            const config = grupoConfig.numeros_pagamento[tipo];

            // Verificar se já existe
            if (config.numeros.includes(numero)) {
                await this.sendMessage(groupJid, `⚠️ O número *${numero}* já está cadastrado para ${tipo.toUpperCase()}!`);
                return;
            }

            // Adicionar número
            config.numeros.push(numero);

            // Adicionar nome se fornecido
            if (nome) {
                config.nomes[numero] = nome;
            }

            // Salvar
            this.dataManager.saveUsersData();

            let mensagem = `✅ Número adicionado com sucesso!\n\n`;
            mensagem += `📱 *${tipo.toUpperCase()}:* ${numero}\n`;
            if (nome) {
                mensagem += `👤 *Nome:* ${nome}\n`;
            }
            mensagem += `\n🏪 *Grupo:* Configuração atualizada`;

            await this.sendMessage(groupJid, mensagem);

        } catch (error) {
            console.error('Erro ao adicionar número:', error);
            await this.sendMessage(groupJid, '❌ Erro ao adicionar número!');
        }
    }

    async removerNumero(groupJid, tipo, numero) {
        try {
            const usersData = this.dataManager.getUsersData();

            if (!usersData.configuracoes_grupos?.[groupJid]?.numeros_pagamento?.[tipo]) {
                await this.sendMessage(groupJid, `❌ Nenhum número configurado para ${tipo.toUpperCase()}!`);
                return;
            }

            const config = usersData.configuracoes_grupos[groupJid].numeros_pagamento[tipo];

            // Verificar se existe
            const index = config.numeros.indexOf(numero);
            if (index === -1) {
                await this.sendMessage(groupJid, `❌ Número *${numero}* não encontrado!`);
                return;
            }

            // Remover
            config.numeros.splice(index, 1);
            delete config.nomes[numero];

            // Salvar
            this.dataManager.saveUsersData();

            await this.sendMessage(groupJid, `✅ Número *${numero}* removido de ${tipo.toUpperCase()}!`);

        } catch (error) {
            console.error('Erro ao remover número:', error);
            await this.sendMessage(groupJid, '❌ Erro ao remover número!');
        }
    }

    async mostrarConfiguracao(groupJid) {
        try {
            const usersData = this.dataManager.getUsersData();

            let mensagem = `📋 *CONFIGURAÇÃO DE PAGAMENTOS*\n`;
            mensagem += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            const grupoConfig = usersData.configuracoes_grupos?.[groupJid];

            if (!grupoConfig || !grupoConfig.numeros_pagamento) {
                mensagem += `⚠️ Nenhum número configurado ainda!\n\n`;
                mensagem += `Use os comandos abaixo para configurar:\n`;
                const prefixo = this.dataManager.getDonoData().prefixo;
                mensagem += `• ${prefixo}confignumeros mpesa <numero> [nome]\n`;
                mensagem += `• ${prefixo}confignumeros emola <numero> [nome]`;
                await this.sendMessage(groupJid, mensagem);
                return;
            }

            // M-Pesa
            const mpesaConfig = grupoConfig.numeros_pagamento.mpesa;
            if (mpesaConfig && mpesaConfig.numeros && mpesaConfig.numeros.length > 0) {
                mensagem += `💳 *M-PESA:*\n`;
                mpesaConfig.numeros.forEach(num => {
                    const nome = mpesaConfig.nomes?.[num];
                    mensagem += `  📱 ${num}`;
                    if (nome) mensagem += ` - ${nome}`;
                    mensagem += `\n`;
                });
                mensagem += `\n`;
            } else {
                mensagem += `💳 *M-PESA:* Nenhum número configurado\n\n`;
            }

            // E-Mola
            const emolaConfig = grupoConfig.numeros_pagamento.emola;
            if (emolaConfig && emolaConfig.numeros && emolaConfig.numeros.length > 0) {
                mensagem += `💰 *E-MOLA:*\n`;
                emolaConfig.numeros.forEach(num => {
                    const nome = emolaConfig.nomes?.[num];
                    mensagem += `  📱 ${num}`;
                    if (nome) mensagem += ` - ${nome}`;
                    mensagem += `\n`;
                });
            } else {
                mensagem += `💰 *E-MOLA:* Nenhum número configurado`;
            }

            await this.sendMessage(groupJid, mensagem);

        } catch (error) {
            console.error('Erro ao mostrar configuração:', error);
            await this.sendMessage(groupJid, '❌ Erro ao buscar configuração!');
        }
    }

    getHelpMessage(prefixo) {
        let msg = `📋 *CONFIGURAR NÚMEROS DE PAGAMENTO*\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `*Adicionar número:*\n`;
        msg += `• ${prefixo}confignumeros mpesa <numero> [nome]\n`;
        msg += `• ${prefixo}confignumeros emola <numero> [nome]\n\n`;
        msg += `*Exemplos:*\n`;
        msg += `• ${prefixo}confignumeros mpesa 862840075 Habibo\n`;
        msg += `• ${prefixo}confignumeros emola 841617651 Paulo\n\n`;
        msg += `*Ver configuração atual:*\n`;
        msg += `• ${prefixo}confignumeros ver\n\n`;
        msg += `*Remover número:*\n`;
        msg += `• ${prefixo}confignumeros remover mpesa 862840075\n`;
        msg += `• ${prefixo}confignumeros remover emola 841617651`;
        
        return msg;
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = ConfigNumerosCommand;
