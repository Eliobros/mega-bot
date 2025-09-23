const fs = require('fs');
const path = require('path');

class CompraHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async processar(clienteJid, pacote, groupJid, tipoPreferido = null) {
        try {
            // Garantir que clienteJid é string e válido
            if (typeof clienteJid !== 'string' || !clienteJid) {
                await this.sendMessage(groupJid, '❌ Erro: JID do cliente inválido!');
                return;
            }

            const clienteNumero = clienteJid.replace(/@.*/, '');
            const hoje = new Date().toISOString().split('T')[0];

            // Buscar informações do pacote (opcionalmente por tipo preferido: d/s/m)
            const pacoteInfo = this.encontrarPacote(pacote, tipoPreferido);
            if (!pacoteInfo) {
                await this.sendMessage(groupJid, `❌ Pacote "${pacote}" não encontrado na tabela!`);
                return;
            }

            // Obter dados dos usuários
            const usersData = this.dataManager.getUsersData();
            
            // Inicializar estrutura se não existir
            if (!usersData.usuarios) {
                usersData.usuarios = {};
            }
            if (!usersData.estatisticas_grupo) {
                usersData.estatisticas_grupo = {
                    total_usuarios: 0,
                    total_compras_realizadas: 0,
                    ultima_atualizacao: hoje,
                    maior_comprador: null
                };
            }

            // Verificar se é cliente novo
            const isClienteNovo = !usersData.usuarios[clienteJid];

            // Inicializar usuário se não existir
            if (isClienteNovo) {
                // Tentar obter nome real do usuário
                let nomeUsuario = clienteNumero;
                try {
                    const contact = await this.sock.onWhatsApp(clienteJid);
                    if (contact[0]?.name) {
                        nomeUsuario = contact[0].name;
                    }
                } catch (err) {
                    console.log('Não foi possível obter nome do contato');
                }

                usersData.usuarios[clienteJid] = {
                    nome: nomeUsuario,
                    numero: clienteNumero,
                    total_compras: 0,
                    total_gb_acumulado: 0,
                    primeira_compra: hoje,
                    ultima_compra: '',
                    compras_hoje: 0,
                    historico_compras: []
                };
                usersData.estatisticas_grupo.total_usuarios++;
            }

            const usuario = usersData.usuarios[clienteJid];

            // Resetar compras do dia se mudou o dia
            if (usuario.ultima_compra !== hoje) {
                usuario.compras_hoje = 0;
            }

            // Calcular GB do pacote usando valor_numerico
            const gbPacote = this.calcularGB(pacoteInfo.valor_numerico, pacoteInfo.tipo_dados);

            // Verificar tipos de compra
            const isPrimeiraCompraAbsoluta = isClienteNovo;
            const isPrimeiraCompraDoDia = usuario.compras_hoje === 0 && !isClienteNovo;
            const isCompraMultiplaDoDia = usuario.compras_hoje > 0;

            // Calcular dias desde última compra
            let diasSemComprar = 0;
            if (!isClienteNovo && usuario.ultima_compra) {
                diasSemComprar = this.calcularDiasSemComprar(usuario.ultima_compra, hoje);
            }

            // Atualizar dados do usuário
            usuario.total_compras++;
            usuario.total_gb_acumulado += gbPacote;
            usuario.ultima_compra = hoje;
            usuario.compras_hoje++;

            // Adicionar ao histórico
            usuario.historico_compras.push({
                data: hoje,
                hora: new Date().toLocaleTimeString('pt-BR'),
                pacote: pacoteInfo.nome,
                quantidade: pacoteInfo.quantidade,
                preco: pacoteInfo.preco,
                gb: gbPacote,
                tipo: pacoteInfo.tipo
            });

            // Atualizar estatísticas do grupo
            usersData.estatisticas_grupo.total_compras_realizadas++;
            usersData.estatisticas_grupo.ultima_atualizacao = hoje;

            // Calcular ranking
            const ranking = this.calcularRanking(clienteJid, usersData);

            // Salvar dados
            this.dataManager.saveUsersData();

            // Dados para a mensagem
            const dadosCompra = {
                isPrimeiraCompraAbsoluta,
                isPrimeiraCompraDoDia,
                isCompraMultiplaDoDia,
                diasSemComprar,
                numeroComprasDoDia: usuario.compras_hoje
            };

            // Enviar mensagem de confirmação
            await this.enviarMensagemCompra(groupJid, clienteJid, pacoteInfo, dadosCompra, ranking, usuario);

            console.log(`✅ Compra processada: ${usuario.nome} (${clienteNumero}) comprou ${pacoteInfo.nome} - ${pacoteInfo.quantidade}`);

        } catch (err) {
            console.error('Erro ao processar compra:', err);
            await this.sendMessage(groupJid, '❌ Ocorreu um erro ao processar a compra!');
        }
    }

    encontrarPacote(nomePacote, tipoPreferido = null) {
        const tabelaData = this.dataManager.getTabelaData();
        if (!tabelaData) {
            return null;
        }

        const pacoteNormalizado = nomePacote.toLowerCase().replace(/\s+/g, '');

        // Mapear tipo preferido para chaves
        const preferMap = {
            'd': 'megas_diarios',
            's': 'megas_semanais',
            'm': 'megas_mensais'
        };
        const chavePreferida = tipoPreferido && preferMap[tipoPreferido.toLowerCase()] ? preferMap[tipoPreferido.toLowerCase()] : null;

        // Buscar apenas no tipo preferido se informado
        const buscarEmColecao = (colecao, tipoRotulo) => {
            if (!colecao?.pacotes) return null;
            for (const pacote of colecao.pacotes) {
                // Buscar por nome (ex: "20MT")
                if (pacote.nome.toLowerCase() === nomePacote.toLowerCase()) {
                    return { ...pacote, tipo: tipoRotulo };
                }
                // Buscar por quantidade (ex: "1100MB")
                if (pacote.quantidade.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                    return { ...pacote, tipo: tipoRotulo };
                }
                // Buscar por valor numérico
                const inputNum = parseInt(nomePacote.replace(/\D/g, ''));
                if (!isNaN(inputNum) && pacote.valor_numerico === inputNum) {
                    return { ...pacote, tipo: tipoRotulo };
                }
            }
            return null;
        };

        if (chavePreferida) {
            const resPref = buscarEmColecao(tabelaData[chavePreferida], chavePreferida === 'megas_diarios' ? 'diario' : (chavePreferida === 'megas_semanais' ? 'semanal' : 'mensal'));
            if (resPref) return resPref;
        }

        // Buscar em megas diários
        if (tabelaData.megas_diarios?.pacotes) {
            for (const pacote of tabelaData.megas_diarios.pacotes) {
                // Buscar por nome (ex: "20MT")
                if (pacote.nome.toLowerCase() === nomePacote.toLowerCase()) {
                    return { ...pacote, tipo: 'diario' };
                }
                // Buscar por quantidade (ex: "1100MB")
                if (pacote.quantidade.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                    return { ...pacote, tipo: 'diario' };
                }
                // Buscar por valor numérico (ex: 1100)
                const inputNum = parseInt(nomePacote.replace(/\D/g, ''));
                if (!isNaN(inputNum) && pacote.valor_numerico === inputNum) {
                    return { ...pacote, tipo: 'diario' };
                }
            }
        }

        // Buscar em megas semanais
        if (tabelaData.megas_semanais?.pacotes) {
            for (const pacote of tabelaData.megas_semanais.pacotes) {
                if (pacote.nome.toLowerCase() === nomePacote.toLowerCase()) {
                    return { ...pacote, tipo: 'semanal' };
                }
                if (pacote.quantidade.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                    return { ...pacote, tipo: 'semanal' };
                }
                const inputNum = parseInt(nomePacote.replace(/\D/g, ''));
                if (!isNaN(inputNum) && pacote.valor_numerico === inputNum) {
                    return { ...pacote, tipo: 'semanal' };
                }
            }
        }

        // Buscar em megas mensais
        if (tabelaData.megas_mensais?.pacotes) {
            for (const pacote of tabelaData.megas_mensais.pacotes) {
                if (pacote.nome.toLowerCase() === nomePacote.toLowerCase()) {
                    return { ...pacote, tipo: 'mensal' };
                }
                if (pacote.quantidade.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                    return { ...pacote, tipo: 'mensal' };
                }
                const inputNum = parseInt(nomePacote.replace(/\D/g, ''));
                if (!isNaN(inputNum) && pacote.valor_numerico === inputNum) {
                    return { ...pacote, tipo: 'mensal' };
                }
            }
        }

        return null;
    }

    calcularGB(valorNumerico, tipoDados) {
        if (tipoDados === 'GB') {
            return valorNumerico;
        } else if (tipoDados === 'MB') {
            return valorNumerico / 1024; // Converter MB para GB
        }
        return 0;
    }

    calcularDiasSemComprar(ultimaCompra, hoje) {
        const dataUltima = new Date(ultimaCompra);
        const dataHoje = new Date(hoje);
        const diffTime = Math.abs(dataHoje - dataUltima);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    calcularRanking(clienteJid, usersData) {
        const usuarios = Object.entries(usersData.usuarios)
            .map(([jid, userData]) => ({ jid, ...userData }))
            .sort((a, b) => b.total_gb_acumulado - a.total_gb_acumulado);

        const posicao = usuarios.findIndex(u => u.jid === clienteJid) + 1;
        const maiorComprador = usuarios[0];

        // Atualizar maior comprador nas estatísticas
        if (maiorComprador) {
            usersData.estatisticas_grupo.maior_comprador = {
                numero: maiorComprador.numero,
                nome: maiorComprador.nome,
                total_gb: maiorComprador.total_gb_acumulado
            };
        }

        return {
            posicao,
            totalUsuarios: usuarios.length,
            maiorCompradorGB: maiorComprador ? maiorComprador.total_gb_acumulado : 0,
            clienteGB: usersData.usuarios[clienteJid].total_gb_acumulado
        };
    }

    async enviarMensagemCompra(groupJid, clienteJid, pacoteInfo, dadosCompra, ranking, usuario) {
        let mensagem = `Obrigado @${usuario.numero} por comprar *${pacoteInfo.nome}* (${pacoteInfo.quantidade})!\n`;

        // Diferentes tipos de mensagens baseadas no tipo de compra
        if (dadosCompra.isPrimeiraCompraAbsoluta) {
            mensagem += `🎉 Esta é a sua *PRIMEIRA COMPRA* no grupo! Bem-vindo(a)!\n`;
            mensagem += `🌟 Parabéns por se juntar à nossa família de clientes!\n`;
        } else if (dadosCompra.isPrimeiraCompraDoDia) {
            mensagem += `📅 Você está fazendo a sua *primeira compra do dia*!\n`;

            if (dadosCompra.diasSemComprar > 1) {
                if (dadosCompra.diasSemComprar <= 3) {
                    mensagem += `⏰ Há ${dadosCompra.diasSemComprar} dias que você não comprava. Que bom ter você de volta!\n`;
                } else if (dadosCompra.diasSemComprar <= 7) {
                    mensagem += `📱 Há ${dadosCompra.diasSemComprar} dias que você não comprava. Bom tê-lo(a) de volta!\n`;
                } else if (dadosCompra.diasSemComprar <= 30) {
                    mensagem += `🎯 Há ${dadosCompra.diasSemComprar} dias que você não comprava. Sentimos sua falta!\n`;
                } else {
                    mensagem += `🏆 Há ${dadosCompra.diasSemComprar} dias que você não comprava. Que alegria ter você de volta!\n`;
                }
            } else if (dadosCompra.diasSemComprar === 1) {
                mensagem += `🔥 Cliente fiel! Comprou ontem e já está de volta hoje!\n`;
            }
        } else if (dadosCompra.isCompraMultiplaDoDia) {
            mensagem += `🛒 Esta é a sua *${dadosCompra.numeroComprasDoDia}ª compra* de hoje!\n`;
            mensagem += `💪 Você está muito ativo hoje! Continue assim!\n`;
        }

        // Informações de ranking
        mensagem += `\n📊 Você é o comprador nº *${ranking.posicao}* do grupo, com um total acumulado de *${ranking.clienteGB.toFixed(2)}GB*.\n`;

        if (ranking.posicao === 1) {
            mensagem += `👑 *PARABÉNS!* Você é o MAIOR COMPRADOR do grupo!\n`;
            mensagem += `🏆 Continue liderando e inspire outros compradores!\n`;
        } else {
            mensagem += `🎯 O maior comprador acumulou *${ranking.maiorCompradorGB.toFixed(2)}GB*.\n`;
            const diferenca = (ranking.maiorCompradorGB - ranking.clienteGB).toFixed(2);

            if (diferenca <= 1) {
                mensagem += `🔥 Você está muito próximo da liderança! Faltam apenas *${diferenca}GB*!\n`;
            } else if (diferenca <= 5) {
                mensagem += `⚡ Lute para ultrapassar esse nível e ganhar bônus incríveis!\n`;
            } else {
                mensagem += `🚀 Continue comprando e suba no ranking!\n`;
            }
        }

        // Mensagens motivacionais baseadas no total acumulado
        if (ranking.clienteGB >= 10) {
            mensagem += `\n🌟 *CLIENTE VIP!* Você já acumulou mais de 10GB! Merece desconto especial!`;
        } else if (ranking.clienteGB >= 5) {
            mensagem += `\n💎 *CLIENTE PREMIUM!* Você já acumulou mais de 5GB! Continue assim!`;
        } else if (ranking.clienteGB >= 2) {
            mensagem += `\n🥇 *BOM CLIENTE!* Você já acumulou mais de 2GB! Parabéns!`;
        }

        // Informação sobre o tipo e validade do pacote
        const tipoTexto = pacoteInfo.tipo === 'diario' ? 'Diário (24h)' : 
                        pacoteInfo.tipo === 'semanal' ? 'Semanal (7 dias)' : 'Mensal (30 dias)';
        mensagem += `\n📋 *Tipo do Pacote:* ${tipoTexto}`;

        await this.sendMessage(groupJid, mensagem, { mentions: [clienteJid] });
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }

    // Métodos auxiliares para estatísticas
    async getEstatisticasGrupo() {
        const usersData = this.dataManager.getUsersData();
        return usersData.estatisticas_grupo || {};
    }

    async getRankingCompleto(limite = 10) {
        const usersData = this.dataManager.getUsersData();
        if (!usersData.usuarios) return [];

        return Object.entries(usersData.usuarios)
            .map(([jid, userData]) => ({
                jid,
                nome: userData.nome,
                numero: userData.numero,
                totalGB: userData.total_gb_acumulado,
                totalCompras: userData.total_compras
            }))
            .sort((a, b) => b.totalGB - a.totalGB)
            .slice(0, limite);
    }
}

module.exports = CompraHandler;
