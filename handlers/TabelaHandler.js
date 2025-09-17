class TabelaHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async enviarTabela(jid) {
        const data = this.dataManager.getTabelaData();
        
        if (!data) {
            await this.sendMessage(jid, '❌ Erro: Não foi possível carregar a tabela de preços.');
            return;
        }

        let tabela = `${data.titulo}\n\n`;

        // Megas Diários
        tabela += `${data.megas_diarios.titulo}\n`;
        data.megas_diarios.pacotes.forEach(pacote => {
            tabela += `- ${pacote.mb} = ${pacote.preco} ${pacote.emoji}\n`;
        });

        tabela += `\n${data.megas_semanais.titulo}\n   \n`;
        data.megas_semanais.pacotes.forEach(pacote => {
            tabela += `• ${pacote.mb} = ${pacote.preco}${pacote.emoji}\n`;
        });

        tabela += `\n${data.megas_mensais.titulo}\n`;
        data.megas_mensais.pacotes.forEach(pacote => {
            tabela += `- ${pacote.mb} = ${pacote.preco} ${pacote.emoji}\n`;
        });

        tabela += `\n${data.nota}\n\n`;
        tabela += `${data.contato}\n\n`;
        tabela += `${data.formas_pagamento.titulo}\n\n`;
        tabela += `${data.formas_pagamento.admin}\n\n`;
        tabela += `${data.formas_pagamento.mpesa}\n\n`;
        tabela += `${data.formas_pagamento.emola}\n \n`;
        tabela += `${data.instrucoes}`;

        await this.sendMessage(jid, tabela);
    }

    buscarPacote(nomePacote) {
        const data = this.dataManager.getTabelaData();
        if (!data) return null;

        const pacoteNormalizado = nomePacote.toLowerCase().replace(/\s+/g, '');
        
        // Buscar em megas diários
        for (const pacote of data.megas_diarios.pacotes) {
            if (pacote.mb.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                return { ...pacote, tipo: 'diario', categoria: 'Diário' };
            }
        }
        
        // Buscar em megas semanais
        for (const pacote of data.megas_semanais.pacotes) {
            if (pacote.mb.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                return { ...pacote, tipo: 'semanal', categoria: 'Semanal' };
            }
        }
        
        // Buscar em megas mensais
        for (const pacote of data.megas_mensais.pacotes) {
            if (pacote.mb.toLowerCase().replace(/\s+/g, '') === pacoteNormalizado) {
                return { ...pacote, tipo: 'mensal', categoria: 'Mensal' };
            }
        }
        
        return null;
    }

    listarTodosPacotes() {
        const data = this.dataManager.getTabelaData();
        if (!data) return [];

        const todosPacotes = [];

        // Adicionar pacotes diários
        data.megas_diarios.pacotes.forEach(pacote => {
            todosPacotes.push({ ...pacote, tipo: 'diario', categoria: 'Diário' });
        });

        // Adicionar pacotes semanais
        data.megas_semanais.pacotes.forEach(pacote => {
            todosPacotes.push({ ...pacote, tipo: 'semanal', categoria: 'Semanal' });
        });

        // Adicionar pacotes mensais
        data.megas_mensais.pacotes.forEach(pacote => {
            todosPacotes.push({ ...pacote, tipo: 'mensal', categoria: 'Mensal' });
        });

        return todosPacotes;
    }

    async enviarPacotesDisponiveis(jid, filtro = null) {
        const pacotes = this.listarTodosPacotes();
        
        if (pacotes.length === 0) {
            await this.sendMessage(jid, '❌ Nenhum pacote disponível.');
            return;
        }

        let mensagem = `📋 *PACOTES DISPONÍVEIS*\n\n`;

        // Filtrar por tipo se especificado
        let pacotesFiltrados = pacotes;
        if (filtro) {
            const filtroNormalizado = filtro.toLowerCase();
            pacotesFiltrados = pacotes.filter(p => 
                p.tipo.includes(filtroNormalizado) || 
                p.categoria.toLowerCase().includes(filtroNormalizado)
            );
        }

        // Agrupar por categoria
        const categorias = {};
        pacotesFiltrados.forEach(pacote => {
            if (!categorias[pacote.categoria]) {
                categorias[pacote.categoria] = [];
            }
            categorias[pacote.categoria].push(pacote);
        });

        // Montar mensagem por categoria
        Object.entries(categorias).forEach(([categoria, pacotesCategoria]) => {
            mensagem += `*${categoria.toUpperCase()}:*\n`;
            pacotesCategoria.forEach(pacote => {
                mensagem += `• ${pacote.mb} - ${pacote.preco} ${pacote.emoji}\n`;
            });
            mensagem += `\n`;
        });

        mensagem += `💡 Use "tabela" para ver a tabela completa com informações de pagamento.`;

        await this.sendMessage(jid, mensagem);
    }

    calcularValorTotal(listaPacotes) {
        let valorTotal = 0;
        const detalhes = [];

        listaPacotes.forEach(nomePacote => {
            const pacote = this.buscarPacote(nomePacote);
            if (pacote) {
                // Extrair valor numérico do preço
                const valor = parseFloat(pacote.preco.replace(/[^\d.]/g, ''));
                if (!isNaN(valor)) {
                    valorTotal += valor;
                    detalhes.push({
                        pacote: pacote.mb,
                        preco: pacote.preco,
                        valor: valor,
                        categoria: pacote.categoria
                    });
                }
            }
        });

        return {
            valorTotal,
            detalhes,
            pacotesEncontrados: detalhes.length,
            pacotesTotal: listaPacotes.length
        };
    }

    async enviarResumoCompra(jid, listaPacotes) {
        const resumo = this.calcularValorTotal(listaPacotes);
        
        if (resumo.pacotesEncontrados === 0) {
            await this.sendMessage(jid, '❌ Nenhum pacote válido foi encontrado.');
            return;
        }

        let mensagem = `🧾 *RESUMO DA COMPRA*\n\n`;
        
        resumo.detalhes.forEach((item, index) => {
            mensagem += `${index + 1}. ${item.pacote} (${item.categoria})\n`;
            mensagem += `   💰 ${item.preco}\n\n`;
        });

        mensagem += `💳 *TOTAL: ${resumo.valorTotal.toFixed(2)} MT*\n\n`;

        if (resumo.pacotesEncontrados !== resumo.pacotesTotal) {
            const naoEncontrados = resumo.pacotesTotal - resumo.pacotesEncontrados;
            mensagem += `⚠️ ${naoEncontrados} pacote(s) não foram encontrados.\n\n`;
        }

        const data = this.dataManager.getTabelaData();
        mensagem += `${data.formas_pagamento.titulo}\n`;
        mensagem += `${data.formas_pagamento.mpesa}\n`;
        mensagem += `${data.formas_pagamento.emola}\n\n`;
        mensagem += `📝 Envie o comprovante após o pagamento.`;

        await this.sendMessage(jid, mensagem);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = TabelaHandler;
