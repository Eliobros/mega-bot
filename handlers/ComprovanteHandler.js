class ComprovanteHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    isComprovante(texto) {
        // Detectar M-Pesa
        if (texto.includes('Confirmado') && texto.includes('Transferiste') && texto.includes('M-Pesa')) {
            return 'mpesa';
        }
        
        // Detectar E-Mola
        if (texto.includes('ID da transacao') && texto.includes('Transferiste') && texto.includes('MT para conta')) {
            return 'emola';
        }
        
        return false;
    }

    async processar(texto, groupJid, senderJid) {
        const tipoComprovante = this.isComprovante(texto);
        
        if (tipoComprovante === 'mpesa') {
            const dadosMpesa = this.extrairDadosMpesa(texto);
            if (dadosMpesa) {
                // Verificar se não é duplicata
                const isDuplicata = this.verificarDuplicata(dadosMpesa.chave, 'mpesa');
                if (isDuplicata) {
                    await this.enviarAlertaDuplicata(groupJid, senderJid, dadosMpesa, 'M-Pesa');
                    return;
                }
                
                // Registrar comprovante como usado
                this.registrarComprovante(dadosMpesa.chave, 'mpesa', senderJid, dadosMpesa.valor);
                
                await this.enviarConfirmacaoMpesa(groupJid, senderJid, dadosMpesa);
            }
        } else if (tipoComprovante === 'emola') {
            const dadosEmola = this.extrairDadosEmola(texto);
            if (dadosEmola) {
                // Verificar se não é duplicata
                const isDuplicata = this.verificarDuplicata(dadosEmola.chave, 'emola');
                if (isDuplicata) {
                    await this.enviarAlertaDuplicata(groupJid, senderJid, dadosEmola, 'E-Mola');
                    return;
                }
                
                // Registrar comprovante como usado
                this.registrarComprovante(dadosEmola.chave, 'emola', senderJid, dadosEmola.valor);
                
                await this.enviarConfirmacaoEmola(groupJid, senderJid, dadosEmola);
            }
        }
    }

    verificarDuplicata(chave, tipo) {
        const usersData = this.dataManager.getUsersData();
        return usersData.comprovantes_utilizados.some(comp => 
            comp.chave === chave && comp.tipo === tipo
        );
    }

    registrarComprovante(chave, tipo, usuario, valor) {
        const usersData = this.dataManager.getUsersData();
        const registro = {
            chave: chave,
            tipo: tipo,
            usuario: usuario,
            valor: valor,
            data_uso: new Date().toISOString(),
            timestamp: Date.now()
        };
        
        usersData.comprovantes_utilizados.push(registro);
        
        // Limpar comprovantes muito antigos (mais de 90 dias) para não ocupar muito espaço
        const treseMesesAtras = Date.now() - (90 * 24 * 60 * 60 * 1000);
        usersData.comprovantes_utilizados = usersData.comprovantes_utilizados.filter(
            comp => comp.timestamp > treseMesesAtras
        );
        
        this.dataManager.saveUsersData();
    }

    extrairDadosMpesa(texto) {
        try {
            // Exemplo: "Confirmado CI76HAL8186. Transferiste 20.00MT e a taxa foi de 0.00MT para 853341114 - FABIO aos 7/9/25 as 7:29 AM"
            
            // Extrair chave da transação
            const chaveMatch = texto.match(/Confirmado ([A-Z0-9]+)\./);
            const chave = chaveMatch ? chaveMatch[1] : null;
            
            // Extrair valor
            const valorMatch = texto.match(/Transferiste ([\d.]+)MT/);
            const valor = valorMatch ? valorMatch[1] : null;
            
            // Extrair número de destino
            const numeroMatch = texto.match(/para (\d+) - ([^\n]+)/);
            const numeroDestino = numeroMatch ? numeroMatch[1] : null;
            const nomeDestino = numeroMatch ? numeroMatch[2].trim() : null;
            
            // Extrair data e hora
            const dataHoraMatch = texto.match(/aos ([\d\/]+) as ([\d:]+\s[AP]M)/);
            const data = dataHoraMatch ? dataHoraMatch[1] : null;
            const hora = dataHoraMatch ? dataHoraMatch[2] : null;
            
            // Validar se é para os números corretos
            const donoData = this.dataManager.getDonoData();
            const mpesaCfg = donoData.numeros_pagamento?.mpesa;
            const numerosValidos = Array.isArray(mpesaCfg)
                ? mpesaCfg
                : (mpesaCfg ? [mpesaCfg] : ['853341114']);
            const isDestinoValido = numerosValidos.includes(numeroDestino);
            
            return {
                chave,
                valor,
                numeroDestino,
                nomeDestino,
                data,
                hora,
                isDestinoValido,
                tipo: 'M-Pesa'
            };
        } catch (error) {
            console.error('Erro ao extrair dados M-Pesa:', error);
            return null;
        }
    }

    extrairDadosEmola(texto) {
        try {
            // Exemplo: "ID da transacao PP250907.0719.q97852. Transferiste 20.00MT para conta 865325439, nome: FABIO BELCHIOR MACUACUA as 07:19:33"
            
            // Extrair ID da transação
            const chaveMatch = texto.match(/ID da transacao ([A-Z0-9.]+)\./);
            const chave = chaveMatch ? chaveMatch[1] : null;
            
            // Extrair valor
            const valorMatch = texto.match(/Transferiste ([\d.]+)MT/);
            const valor = valorMatch ? valorMatch[1] : null;
            
            // Extrair conta e nome de destino
            const destinoMatch = texto.match(/para conta (\d+), nome: ([^\n]+)/);
            const numeroDestino = destinoMatch ? destinoMatch[1] : null;
            const nomeDestino = destinoMatch ? destinoMatch[2].trim() : null;
            
            // Extrair hora
            const horaMatch = texto.match(/as ([\d:]+)/);
            const hora = horaMatch ? horaMatch[1] : null;
            
            // Extrair data
            const dataMatch = texto.match(/de ([\d\/]+)\./);
            const data = dataMatch ? dataMatch[1] : null;
            
            // Validar se é para os números corretos
            const donoData = this.dataManager.getDonoData();
            const emolaCfg = donoData.numeros_pagamento?.emola;
            const numerosValidos = Array.isArray(emolaCfg)
                ? emolaCfg
                : (emolaCfg ? [emolaCfg] : ['865325439']);
            const isDestinoValido = numerosValidos.includes(numeroDestino);
            
            return {
                chave,
                valor,
                numeroDestino,
                nomeDestino,
                data,
                hora,
                isDestinoValido,
                tipo: 'E-Mola'
            };
        } catch (error) {
            console.error('Erro ao extrair dados E-Mola:', error);
            return null;
        }
    }

    async enviarConfirmacaoMpesa(groupJid, senderJid, dados) {
        const senderNumber = senderJid.replace('@s.whatsapp.net', '');
        const donoData = this.dataManager.getDonoData();
        
        let mensagem = `🧾 *Comprovativo detectado* (M-Pesa)\n`;
        mensagem += `🔑 *Chave:* ${dados.chave}\n`;
        
        if (dados.isDestinoValido) {
            // Mapear números conhecidos para nomes amigáveis (Habibo / Paulo)
            const mpesaCfg = donoData.numeros_pagamento?.mpesa;
            const numerosValidos = Array.isArray(mpesaCfg)
                ? mpesaCfg
                : (mpesaCfg ? [mpesaCfg] : ['853341114']);
            const friendlyMap = {
                '841617651': 'Habibo',
                '848300881': 'Paulo'
            };
            const friendly = friendlyMap[dados.numeroDestino] || dados.nomeDestino || 'Destino válido';
            mensagem += `🏦 *Destino validado:* ${friendly}\n`;
        } else {
            mensagem += `❌ *Destino inválido:* ${dados.nomeDestino}\n`;
        }
        
        mensagem += `💵 *Valor:* ${dados.valor} MT\n`;
        
        // Formatar data/hora
        if (dados.data && dados.hora) {
            const hoje = new Date().toLocaleDateString('pt-BR');
            const dataComprovante = this.formatarData(dados.data);
            
            if (dataComprovante === hoje) {
                mensagem += `🕒 hoje às ${this.formatarHora(dados.hora)}`;
            } else {
                mensagem += `🕒 ${dataComprovante} às ${this.formatarHora(dados.hora)}`;
            }
        }
        
        if (dados.isDestinoValido) {
            mensagem += `\n\n✅ *Pagamento confirmado!*\n`;
            mensagem += `📝 Aguarde o processamento do seu pedido.\n`;
            mensagem += `👨‍💼 Em caso de dúvidas, contacte o ${donoData.NickDono}`;
        } else {
            const mpesaCfg = donoData.numeros_pagamento?.mpesa;
            const numerosMpesa = Array.isArray(mpesaCfg)
                ? mpesaCfg.join(', ')
                : (mpesaCfg || '853341114');
            mensagem += `\n\n❌ *Atenção!* Este comprovativo não é válido.\n`;
            mensagem += `💰 Certifique-se de enviar para o(s) número(s) correto(s): ${numerosMpesa}`;
        }
        
        await this.sendMessage(groupJid, mensagem, { mentions: [senderJid] });
    }

    async enviarConfirmacaoEmola(groupJid, senderJid, dados) {
        const senderNumber = senderJid.replace('@s.whatsapp.net', '');
        const donoData = this.dataManager.getDonoData();
        
        let mensagem = `🧾 *Comprovativo detectado* (E-Mola)\n`;
        mensagem += `🔑 *Chave:* ${dados.chave}\n`;
        
        if (dados.isDestinoValido) {
            mensagem += `🏦 *Destino validado:* ${dados.nomeDestino}\n`;
        } else {
            mensagem += `❌ *Destino inválido:* ${dados.nomeDestino}\n`;
        }
        
        mensagem += `💵 *Valor:* ${dados.valor} MT\n`;
        
        // Formatar data/hora
        if (dados.data && dados.hora) {
            const hoje = new Date().toLocaleDateString('pt-BR');
            const dataComprovante = this.formatarData(dados.data);
            
            if (dataComprovante === hoje) {
                mensagem += `🕒 hoje às ${dados.hora}`;
            } else {
                mensagem += `🕒 ${dataComprovante} às ${dados.hora}`;
            }
        }
        
        if (dados.isDestinoValido) {
            mensagem += `\n\n✅ *Pagamento confirmado!*\n`;
            mensagem += `📝 Aguarde o processamento do seu pedido.\n`;
            mensagem += `👨‍💼 Em caso de dúvidas, contacte o ${donoData.NickDono}`;
        } else {
            const emolaCfg = donoData.numeros_pagamento?.emola;
            const numerosEmola = Array.isArray(emolaCfg)
                ? emolaCfg.join(', ')
                : (emolaCfg || '865325439');
            mensagem += `\n\n❌ *Atenção!* Este comprovativo não é válido.\n`;
            mensagem += `💰 Certifique-se de enviar para o(s) número(s) correto(s): ${numerosEmola}`;
        }
        
        await this.sendMessage(groupJid, mensagem, { mentions: [senderJid] });
    }

    async enviarAlertaDuplicata(groupJid, senderJid, dados, tipoPlataforma) {
        const usersData = this.dataManager.getUsersData();
        const comprovanteExistente = usersData.comprovantes_utilizados.find(
            comp => comp.chave === dados.chave && comp.tipo.toLowerCase() === tipoPlataforma.toLowerCase().replace('-', '')
        );
        
        const senderNumber = senderJid.replace('@s.whatsapp.net', '');
        
        let mensagem = `🚨 *ALERTA DE FRAUDE DETECTADA* 🚨\n\n`;
        mensagem += `🧾 *Comprovativo duplicado* (${tipoPlataforma})\n`;
        mensagem += `🔑 *Chave:* ${dados.chave}\n`;
        mensagem += `💵 *Valor:* ${dados.valor} MT\n\n`;
        
        mensagem += `❌ *Este comprovativo já foi utilizado anteriormente!*\n\n`;
        
        if (comprovanteExistente) {
            const dataUso = new Date(comprovanteExistente.data_uso).toLocaleString('pt-BR');
            const usuarioAnterior = comprovanteExistente.usuario.replace('@s.whatsapp.net', '');
            
            mensagem += `📋 *Detalhes do uso anterior:*\n`;
            mensagem += `👤 Usuário: ${usuarioAnterior}\n`;
            mensagem += `📅 Data: ${dataUso}\n`;
            mensagem += `💰 Valor: ${comprovanteExistente.valor} MT\n\n`;
        }
        
        mensagem += `⚠️ *ATENÇÃO:*\n`;
        mensagem += `• Não tente reutilizar comprovantes\n`;
        mensagem += `• Cada comprovante só pode ser usado uma vez\n`;
        mensagem += `• Tentativas de fraude serão reportadas\n\n`;
        mensagem += `🔒 Para sua segurança, faça um novo pagamento com um comprovante válido.`;
        
        // Enviar alerta para o usuário
        await this.sendMessage(groupJid, mensagem, { mentions: [senderJid] });
        
        // Enviar alerta privado para o dono (se estiver em grupo)
        if (groupJid.endsWith('@g.us')) {
            const donoData = this.dataManager.getDonoData();
            const donoJid = donoData.NumeroDono + '@s.whatsapp.net';
            let alertaDono = `🚨 *TENTATIVA DE FRAUDE DETECTADA* 🚨\n\n`;
            alertaDono += `👤 *Usuário:* ${senderNumber}\n`;
            alertaDono += `🧾 *Tipo:* ${tipoPlataforma}\n`;
            alertaDono += `🔑 *Chave duplicada:* ${dados.chave}\n`;
            alertaDono += `💵 *Valor:* ${dados.valor} MT\n`;
            alertaDono += `🏪 *Grupo:* ${groupJid}\n\n`;
            alertaDono += `⚠️ Monitore este usuário para possíveis outras tentativas.`;
            
            await this.sendMessage(donoJid, alertaDono);
        }
    }

    formatarData(dataStr) {
        try {
            // Converter de formato americano (7/9/25) para brasileiro (07/09/2025)
            const partes = dataStr.split('/');
            if (partes.length === 3) {
                const dia = partes[1].padStart(2, '0');
                const mes = partes[0].padStart(2, '0');
                let ano = partes[2];
                
                // Se ano tem 2 dígitos, assumir 20xx
                if (ano.length === 2) {
                    ano = '20' + ano;
                }
                
                return `${dia}/${mes}/${ano}`;
            }
            return dataStr;
        } catch {
            return dataStr;
        }
    }

    formatarHora(horaStr) {
        try {
            // Converter de 12h (7:29 AM) para 24h (07:29)
            if (horaStr.includes('AM') || horaStr.includes('PM')) {
                const isPM = horaStr.includes('PM');
                const horaSemPeriodo = horaStr.replace(/\s?(AM|PM)/, '');
                const [horas, minutos] = horaSemPeriodo.split(':');
                
                let hora24 = parseInt(horas);
                if (isPM && hora24 !== 12) {
                    hora24 += 12;
                } else if (!isPM && hora24 === 12) {
                    hora24 = 0;
                }
                
                return `${hora24.toString().padStart(2, '0')}:${minutos}`;
            }
            return horaStr;
        } catch {
            return horaStr;
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = ComprovanteHandler;
