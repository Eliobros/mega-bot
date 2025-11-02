const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

class ComprovanteHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.OCR_API_KEY = process.env.OCR_API_KEY || 'K87899142388957';
    }

    /**
     * Processa imagem com OCR e tenta detectar comprovante
     */
    async processarImagem(msg, groupJid, senderJid) {
        try {
            console.log('📸 Processando imagem para detectar comprovante...');

            const buffer = await downloadMediaMessage(msg, 'buffer', {});

            if (!buffer) {
                console.log('❌ Erro ao baixar imagem');
                return;
            }

            console.log('✅ Imagem baixada, tamanho:', buffer.length, 'bytes');

            await this.sendMessage(groupJid, '🔍 Analisando imagem...\n ⏳ Aguarde alguns segundos...');

            const textoExtraido = await this.extrairTextoDeImagem(buffer);

            if (!textoExtraido) {
                console.log('❌ Não foi possível extrair texto da imagem');
                return;
            }

            console.log('📝 Texto extraído da imagem:');
            console.log(textoExtraido);

            await this.processar(textoExtraido, groupJid, senderJid);

        } catch (error) {
            console.error('❌ Erro ao processar imagem:', error);
            await this.sendMessage(groupJid, '❌ Erro ao processar a imagem.\nTente enviar o texto do comprovante diretamente.');
        }
    }

    /**
     * Extrai texto de imagem usando OCR.space API
     */
    async extrairTextoDeImagem(imageBuffer) {
        try {
            const formData = new FormData();
            formData.append('base64Image', `data:image/png;base64,${imageBuffer.toString('base64')}`);
            formData.append('language', 'por');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2');

            const response = await axios.post(
                'https://api.ocr.space/parse/image',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'apikey': this.OCR_API_KEY
                    },
                    timeout: 30000
                }
            );

            if (response.data.IsErroredOnProcessing) {
                console.error('❌ Erro no OCR:', response.data.ErrorMessage);
                return null;
            }

            const textoExtraido = response.data.ParsedResults?.[0]?.ParsedText;

            if (!textoExtraido) {
                console.log('⚠️ Nenhum texto foi detectado na imagem');
                return null;
            }

            return textoExtraido;

        } catch (error) {
            console.error('❌ Erro ao chamar OCR API:', error.message);
            return null;
        }
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
            const dadosMpesa = this.extrairDadosMpesa(texto, groupJid);
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
            const dadosEmola = this.extrairDadosEmola(texto, groupJid);
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

    // ===== MUDANÇA: Buscar números válidos por grupo =====
    getNumerosValidosGrupo(groupJid, tipo) {
        const usersData = this.dataManager.getUsersData();
        
        // Inicializar estrutura se não existir
        if (!usersData.configuracoes_grupos) {
            usersData.configuracoes_grupos = {};
        }

        // Se o grupo não tem configuração, retornar números padrão
        if (!usersData.configuracoes_grupos[groupJid]) {
            console.log(`⚠️ Grupo ${groupJid} não tem números configurados, usando padrão`);
            // Fallback para números do dono.json (compatibilidade)
            const donoData = this.dataManager.getDonoData();
            const cfg = donoData.numeros_pagamento?.[tipo];
            return {
                numeros: Array.isArray(cfg) ? cfg : (cfg ? [cfg] : []),
                nomes: {}
            };
        }

        const grupoConfig = usersData.configuracoes_grupos[groupJid];
        const numerosConfig = grupoConfig.numeros_pagamento?.[tipo];

        if (!numerosConfig) {
            return { numeros: [], nomes: {} };
        }

        // Se for array simples de números
        if (Array.isArray(numerosConfig)) {
            return { numeros: numerosConfig, nomes: {} };
        }

        // Se for objeto com números e nomes
        if (numerosConfig.numeros) {
            return {
                numeros: numerosConfig.numeros || [],
                nomes: numerosConfig.nomes || {}
            };
        }

        return { numeros: [], nomes: {} };
    }

    verificarDuplicata(chave, tipo) {
        const usersData = this.dataManager.getUsersData();
        if (!usersData.comprovantes_utilizados) {
            usersData.comprovantes_utilizados = [];
        }
        return usersData.comprovantes_utilizados.some(comp =>
            comp.chave === chave && comp.tipo === tipo
        );
    }

    registrarComprovante(chave, tipo, usuario, valor) {
        const usersData = this.dataManager.getUsersData();
        if (!usersData.comprovantes_utilizados) {
            usersData.comprovantes_utilizados = [];
        }

        const registro = {
            chave: chave,
            tipo: tipo,
            usuario: usuario,
            valor: valor,
            data_uso: new Date().toISOString(),
            timestamp: Date.now()
        };

        usersData.comprovantes_utilizados.push(registro);

        // Limpar comprovantes muito antigos (mais de 90 dias)
        const treseMesesAtras = Date.now() - (90 * 24 * 60 * 60 * 1000);
        usersData.comprovantes_utilizados = usersData.comprovantes_utilizados.filter(
            comp => comp.timestamp > treseMesesAtras
        );

        this.dataManager.saveUsersData();
    }

    // ===== MUDANÇA: Validar por grupo =====
    extrairDadosMpesa(texto, groupJid) {
        try {
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

            // ===== VALIDAR USANDO NÚMEROS DO GRUPO =====
            const { numeros: numerosValidos, nomes } = this.getNumerosValidosGrupo(groupJid, 'mpesa');
            const isDestinoValido = numerosValidos.includes(numeroDestino);

            // Buscar nome amigável configurado para este número
            const nomeAmigavel = nomes[numeroDestino] || nomeDestino;

            return {
                chave,
                valor,
                numeroDestino,
                nomeDestino: nomeAmigavel,
                data,
                hora,
                isDestinoValido,
                numerosValidosGrupo: numerosValidos,
                tipo: 'M-Pesa'
            };
        } catch (error) {
            console.error('Erro ao extrair dados M-Pesa:', error);
            return null;
        }
    }

    // ===== MUDANÇA: Validar por grupo =====
    extrairDadosEmola(texto, groupJid) {
        try {
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

            // ===== VALIDAR USANDO NÚMEROS DO GRUPO =====
            const { numeros: numerosValidos, nomes } = this.getNumerosValidosGrupo(groupJid, 'emola');
            const isDestinoValido = numerosValidos.includes(numeroDestino);

            // Buscar nome amigável configurado para este número
            const nomeAmigavel = nomes[numeroDestino] || nomeDestino;

            return {
                chave,
                valor,
                numeroDestino,
                nomeDestino: nomeAmigavel,
                data,
                hora,
                isDestinoValido,
                numerosValidosGrupo: numerosValidos,
                tipo: 'E-Mola'
            };
        } catch (error) {
            console.error('Erro ao extrair dados E-Mola:', error);
            return null;
        }
    }

    async enviarConfirmacaoMpesa(groupJid, senderJid, dados) {
        const donoData = this.dataManager.getDonoData();

        let mensagem = `🧾 *Comprovativo detectado* (M-Pesa)\n`;
        mensagem += `🔑 *Chave:* ${dados.chave}\n`;

        if (dados.isDestinoValido) {
            mensagem += `🏦 *Destino validado:* ${dados.nomeDestino}\n`;
        } else {
            mensagem += `❌ *Destino inválido:* ${dados.nomeDestino}\n`;
        }

        mensagem += `💵 *Valor:* ${dados.valor} MT\n`;

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
            const numerosMpesa = dados.numerosValidosGrupo.join(', ') || 'número configurado';
            mensagem += `\n\n❌ *Atenção!* Este comprovativo não é válido.\n`;
            mensagem += `💰 Certifique-se de enviar para o(s) número(s) correto(s): ${numerosMpesa}`;
        }

        await this.sendMessage(groupJid, mensagem, { mentions: [senderJid] });
    }

    async enviarConfirmacaoEmola(groupJid, senderJid, dados) {
        const donoData = this.dataManager.getDonoData();

        let mensagem = `🧾 *Comprovativo detectado* (E-Mola)\n`;
        mensagem += `🔑 *Chave:* ${dados.chave}\n`;

        if (dados.isDestinoValido) {
            mensagem += `🏦 *Destino validado:* ${dados.nomeDestino}\n`;
        } else {
            mensagem += `❌ *Destino inválido:* ${dados.nomeDestino}\n`;
        }

        mensagem += `💵 *Valor:* ${dados.valor} MT\n`;

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
            const numerosEmola = dados.numerosValidosGrupo.join(', ') || 'número configurado';
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

        await this.sendMessage(groupJid, mensagem, { mentions: [senderJid] });

        // Alerta ao dono
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
            const partes = dataStr.split('/');
            if (partes.length === 3) {
                const dia = partes[1].padStart(2, '0');
                const mes = partes[0].padStart(2, '0');
                let ano = partes[2];

                if (ano.length === 2) {
                    ano = '20' + ano;
                }

                return `${mes}/${dia}/${ano}`;
            }
            return dataStr;
        } catch {
            return dataStr;
        }
    }

    formatarHora(horaStr) {
        try {
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
