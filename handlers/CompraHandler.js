class CompraHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async processar(clienteJid, pacote, groupJid) {
        const clienteNumero = clienteJid.replace('@s.whatsapp.net', '');
        const hoje = new Date().toISOString().split('T')[0];
        
        // Buscar informações do pacote
        const pacoteInfo = this.encontrarPacote(pacote);
        if (!pacoteInfo) {
            await this.sendMessage(groupJid, `❌ Pacote "${pacote}" não encontrado na tabela!`);
            return;
        }

        // Verificar se é cliente novo (primeira compra absoluta)
        const usersData = this.dataManager.getUsersData();
        const isClienteNovo = !usersData.usuarios[clienteJid];
        
        // Inicializar usuário se não existir
        if (isClienteNovo) {
            usersData.usuarios[clienteJid] = {
                nome: `Cliente ${clienteNumero}`,
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
        
        // Calcular GB do pacote
        const gbPacote = this.calcularGB(pacoteInfo.mb);
        
        // Verificar tipos de compra
        const isPrimeiraCompraAbsoluta = isClienteNovo;
        const isPrimeiraCompraDoDia = usuario.compras_hoje === 0 && !isClienteNovo;
        const isCompraMultiplaDoDia = usuario.compras_hoje > 0;
        
        // Calcular dias desde última compra (apenas para clientes antigos)
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
            pacote: pacoteInfo.mb,
            preco: pacoteInfo.preco,
            tipo: pacoteInfo.tipo
        });

        // Atualizar estatísticas do grupo
        usersData.estatisticas_grupo.total_compras_realizadas++;
        usersData.estatisticas_grupo.ultima_atualizacao = hoje;
        
        // Encontrar posição no ranking e maior comprador
        const ranking = this.calcularRanking(clienteJid);
        
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
        await this.enviarMensagemCompra(groupJid, clienteJid, pacoteInfo, dadosCompra, ranking);
    }

    encontrarPacote(nomePacote) {
        const tabelaData = this.dataManager.getTabelaData();
        const pacoteNormalizado = nomePacote.toLowerCase().replace(/\s+/g, '');
        
        // Buscar em megas diários
        for (const pacote of tabelaData.megas_diarios.pacotes) {
            if (pacote.mb.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                return { ...pacote, tipo: 'diario' };
            }
        }
        
        // Buscar em megas semanais
        for (const pacote of tabelaData.megas_semanais.pacotes) {
            if (pacote.mb.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                return { ...pacote, tipo: 'semanal' };
            }
        }
        
        // Buscar em megas mensais
        for (const pacote of tabelaData.megas_mensais.pacotes) {
            if (pacote.mb.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                return { ...pacote, tipo: 'mensal' };
            }
        }
        
        return null;
    }

    calcularGB(mbString) {
        const valor = parseFloat(mbString.replace(/[^\d.]/g, ''));
        if (mbString.toLowerCase().includes('gb')) {
            return valor;
        } else {
            return valor / 1024; // Converter MB para GB
        }
    }

    calcularDiasSemComprar(ultimaCompra, hoje) {
        const dataUltima = new Date(ultimaCompra);
        const dataHoje = new Date(hoje);
        const diffTime = Math.abs(dataHoje - dataUltima);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    calcularRanking(clienteJid) {
        const usersData = this.dataManager.getUsersData();
        const usuarios = Object.entries(usersData.usuarios)
            .map(([jid, userData]) => ({ jid, ...userData }))
            .sort((a, b) => b.total_gb_acumulado - a.total_gb_acumulado);
        
        const posicao = usuarios.findIndex(u => u.jid === clienteJid) + 1;
        const maiorComprador = usuarios[0];
        
        // Atualizar maior comprador nas estatísticas
        usersData.estatisticas_grupo.maior_comprador = {
            numero: maiorComprador.numero,
            nome: maiorComprador.nome,
            total_gb: maiorComprador.total_gb_acumulado
        };
        
        return {
            posicao,
            totalUsuarios: usuarios.length,
            maiorCompradorGB: maiorComprador.total_gb_acumulado,
            clienteGB: usersData.usuarios[clienteJid].total_gb_acumulado
        };
    }

    async enviarMensagemCompra(groupJid, clienteJid, pacoteInfo, dadosCompra, ranking) {
        const usersData = this.dataManager.getUsersData();
        const usuario = usersData.usuarios[clienteJid];
        
        let mensagem = `Obrigado @${usuario.numero} por comprar *${pacoteInfo.mb}*!\n`;
        
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
        
        // Mensagem motivacional baseada no total acumulado
        if (ranking.clienteGB >= 10) {
            mensagem += `\n🌟 *CLIENTE VIP!* Você já acumulou mais de 10GB! Merece desconto especial!`;
        } else if (ranking.clienteGB >= 5) {
            mensagem += `\n💎 *CLIENTE PREMIUM!* Você já acumulou mais de 5GB! Continue assim!`;
        } else if (ranking.clienteGB >= 2) {
            mensagem += `\n🥇 *BOM CLIENTE!* Você já acumulou mais de 2GB! Parabéns!`;
        }
        
        await this.sendMessage(groupJid, mensagem, { mentions: [clienteJid] });
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = CompraHandler;
