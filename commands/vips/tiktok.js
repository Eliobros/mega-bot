const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TikTokCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.tempDir = path.join(__dirname, '../../temp');
        this.maxFileSize = 100 * 1024 * 1024; // 100MB (TikTok videos são maiores)

        // Configuração da API Alauda
        this.alaudaApiUrl = 'https://alauda-api.topazioverse.com.br';
        this.alaudaApiKey = 'alauda_live_99a071963a4a21faf81b435dd4c01cc0c92c2de219881728866e829977213865';

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async execute(msg, args, from, sender) {
        try {
            if (!args.length) {
                await this.sendHelpMessage(from);
                return;
            }

            let url = args.join(' ').trim();
            
            // Remove texto extra do TikTok Lite
            const urlMatch = url.match(/(https?:\/\/)?(vm\.|vt\.|www\.)?tiktok\.com\/[^\s]+/i);
            if (urlMatch) {
                url = urlMatch[0];
            }
            
            const pushName = msg.pushName || sender.split('@')[0];

            if (!this.isValidTikTokUrl(url)) {
                await this.sendMessage(from,
                    '❌ *URL inválida!*\n\n' +
                    '🔗 *Formatos aceitos:*\n' +
                    '• https://www.tiktok.com/@user/video/123...\n' +
                    '• https://vm.tiktok.com/XXX...\n' +
                    '• https://vt.tiktok.com/XXX...'
                );
                return;
            }

            // Se for URL encurtada, expande primeiro
            if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
                await this.sendMessage(from, '🔄 *Expandindo URL encurtada...*');
                url = await this.expandTikTokUrl(url);
                console.log('🎯 URL final:', url);
            }

            await this.sendMessage(from, '⏳ *Processando vídeo do TikTok...*\n\n🔍 Obtendo informações via Alauda API...');

            // Baixa o vídeo via Alauda API
            const downloadResult = await this.downloadTikTokFromAlauda(url);

            if (!downloadResult.success) {
                await this.sendMessage(from,
                    `❌ *Erro ao processar vídeo!*\n\n` +
                    `⚠️ ${downloadResult.error}\n\n` +
                    `💰 Créditos restantes: ${downloadResult.creditsRemaining || 'N/A'}`
                );
                return;
            }

            const videoInfo = downloadResult.videoInfo;

            // Envia prévia com informações
            await this.sendVideoPreview(from, videoInfo, pushName);

            // Verifica se tem link de download
            if (!videoInfo.download || !videoInfo.download.no_watermark) {
                await this.sendMessage(from, '❌ *Link de download não disponível!*');
                return;
            }

            // Baixa o arquivo de vídeo
            await this.sendMessage(from, '📥 *Baixando vídeo...*');
            const videoPath = await this.downloadFile(videoInfo.download.no_watermark, 'mp4');

            // Verifica tamanho do arquivo
            const fileStats = fs.statSync(videoPath);
            if (fileStats.size > this.maxFileSize) {
                this.cleanupFiles([videoPath]);
                await this.sendMessage(from,
                    `❌ *Arquivo muito grande!*\n\n` +
                    `📊 Tamanho: ${(fileStats.size / 1024 / 1024).toFixed(1)}MB\n` +
                    `📏 Limite: ${this.maxFileSize / 1024 / 1024}MB`
                );
                return;
            }

            // Envia o vídeo
            await this.sendMessage(from, `🎬 *Enviando vídeo...*\n\n💰 Créditos restantes: ${downloadResult.creditsRemaining || 'N/A'}`);
            await this.sendVideo(from, videoPath, videoInfo);

            this.cleanupFiles([videoPath]);
            console.log(`🎬 Vídeo TikTok enviado: ${videoInfo.title} para ${sender.replace('@s.whatsapp.net', '')}`);
            console.log(`💰 Créditos restantes: ${downloadResult.creditsRemaining}`);

        } catch (error) {
            console.error('❌ Erro no comando tiktok:', error);
            await this.handleError(from, error);
        }
    }

    /**
     * Expande URLs encurtadas do TikTok (vm.tiktok.com → www.tiktok.com)
     */
    async expandTikTokUrl(shortUrl) {
        try {
            console.log('🔄 Expandindo URL:', shortUrl);
            
            const response = await axios.get(shortUrl, {
                maxRedirects: 0, // Não segue redirect automaticamente
                validateStatus: status => status === 301 || status === 302 || status === 200
            });
            
            // Se retornou redirect, pega a location
            if (response.status === 301 || response.status === 302) {
                const expandedUrl = response.headers.location;
                console.log('✅ URL expandida:', expandedUrl);
                return expandedUrl;
            }
            
            return shortUrl;
            
        } catch (error) {
            // Se der erro, tenta pegar do response.request
            if (error.response?.headers?.location) {
                const expandedUrl = error.response.headers.location;
                console.log('✅ URL expandida (via error):', expandedUrl);
                return expandedUrl;
            }
            
            // Se axios.request existe, tenta pegar responseUrl
            if (error.request?.res?.responseUrl) {
                const expandedUrl = error.request.res.responseUrl;
                console.log('✅ URL expandida (via request):', expandedUrl);
                return expandedUrl;
            }
            
            console.log('⚠️ Não foi possível expandir, usando original');
            return shortUrl;
        }
    }

    isValidTikTokUrl(url) {
        const tiktokPatterns = [
            /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w-]+/,
            /^https?:\/\/m\.tiktok\.com\/v\/\d+/
        ];
        return tiktokPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Faz download do vídeo via Alauda API
     */
    async downloadTikTokFromAlauda(url) {
        try {
            const response = await axios.post(
                `${this.alaudaApiUrl}/api/tiktok/download`,
                { url: url },
                {
                    headers: {
                        'X-API-Key': this.alaudaApiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000 // 2 minutos
                }
            );

            if (response.data.success) {
                const data = response.data.data;

                return {
                    success: true,
                    videoInfo: data,
                    creditsRemaining: data.credits_remaining
                };
            }

            return {
                success: false,
                error: response.data.message || 'Erro desconhecido'
            };

        } catch (error) {
            console.error('❌ Erro no download via Alauda:', error.message);

            let errorMsg = 'Erro no download';

            if (error.response) {
                if (error.response.status === 429) {
                    errorMsg = 'Limite de requisições atingido. Tente em alguns minutos.';
                } else if (error.response.status === 403) {
                    errorMsg = 'API Key inválida ou sem créditos.';
                } else {
                    errorMsg = error.response.data?.message || `Erro ${error.response.status}`;
                }
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = 'Timeout: vídeo demorou muito para processar';
            }

            return {
                success: false,
                error: errorMsg
            };
        }
    }

    /**
     * Limpa URLs malformadas (remove prefixos duplicados)
     */
    cleanUrl(url) {
        if (!url) return null;
        
        // Remove prefixo duplicado do TikWM
        url = url.replace(/^https?:\/\/www\.tikwm\.com(https?:\/\/)/, '$1');
        
        // Garante que começa com http:// ou https://
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        return url;
    }

    /**
     * Baixa o arquivo de vídeo da URL fornecida
     */
    async downloadFile(url, extension = 'mp4') {
        const timestamp = Date.now();
        const outputPath = path.join(this.tempDir, `tiktok_${timestamp}_${Math.random().toString(36).slice(2)}.${extension}`);

        try {
            // ✅ LIMPA A URL ANTES DE USAR
            const cleanedUrl = this.cleanUrl(url);
            
            console.log('🔗 URL original:', url);
            console.log('✅ URL limpa:', cleanedUrl);

            const response = await axios({
                method: 'GET',
                url: cleanedUrl,
                responseType: 'stream',
                timeout: 120000 // 2 minutos
            });

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(outputPath));
                writer.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Erro ao baixar arquivo:', error.message);
            throw new Error('Falha ao baixar arquivo de vídeo');
        }
    }

    async sendVideo(jid, videoPath, videoInfo) {
        try {
            const videoBuffer = await fs.promises.readFile(videoPath);

            await this.sock.sendMessage(jid, {
                video: videoBuffer,
                caption: `🎬 *${videoInfo.title || 'TikTok Video'}*\n\n` +
                        `👤 @${videoInfo.author?.username || 'Unknown'}\n` +
                        `❤️ ${this.formatNumber(videoInfo.stats?.likes || 0)} curtidas\n` +
                        `💬 ${this.formatNumber(videoInfo.stats?.comments || 0)} comentários\n` +
                        `🔄 ${this.formatNumber(videoInfo.stats?.shares || 0)} compartilhamentos\n\n` +
                        `⚡ *Via Alauda API* • 🤖 *Tina Bot*`,
                mimetype: 'video/mp4'
            });
        } catch (error) {
            console.error('❌ Erro ao enviar vídeo:', error);
            throw new Error('Falha ao enviar vídeo');
        }
    }

    /**
     * Envia prévia com informações do vídeo
     */
    async sendVideoPreview(jid, videoInfo, pushName) {
        try {
            // Pega hora do dia para saudação
            const hora = new Date().getHours();
            let saudacao = 'Bom dia';
            if (hora >= 12 && hora < 18) {
                saudacao = 'Boa tarde';
            } else if (hora >= 18) {
                saudacao = 'Boa noite';
            }

            // Formata valores com fallback
            const titulo = videoInfo.title || 'N/A';
            const autor = videoInfo.author?.nickname || videoInfo.author?.username || 'N/A';
            const username = videoInfo.author?.username || 'N/A';
            const duracao = videoInfo.duration ? this.formatDuration(videoInfo.duration) : 'N/A';
            const plays = this.formatNumber(videoInfo.stats?.plays || 0);
            const likes = this.formatNumber(videoInfo.stats?.likes || 0);
            const comments = this.formatNumber(videoInfo.stats?.comments || 0);
            const shares = this.formatNumber(videoInfo.stats?.shares || 0);
            const musicTitle = videoInfo.music?.title || 'N/A';
            const musicAuthor = videoInfo.music?.author || 'N/A';

            const textMsg =
`╔═════ஜ۩🎬۩ஜ═════╗
  Ｂｅｍ Ｖｉｎｄｏ(ａ)!!
╚═════ஜ۩🎬۩ஜ═════╝

*꧁- 𝚅í𝚍𝚎𝚘 𝚍𝚘 𝚃𝚒𝚔𝚃𝚘𝚔 𝚎𝚗𝚌𝚘𝚗𝚝𝚛𝚊𝚍𝚘! -꧂*

━━━━━━━━ • ✤ • ━━━━━━━━

° 🎬 *Tɪᴛᴜʟᴏ:* ${titulo}
° 👤 *Aᴜᴛᴏʀ:* ${autor} (@${username})
° ⏱️ *Dᴜʀᴀçãᴏ:* ${duracao}
° 🎵 *Música:* ${musicTitle}
° 🎤 *Aʀᴛɪsᴛᴀ:* ${musicAuthor}

━━━━━━━━ • 📊 • ━━━━━━━━

° 👁️ *Vɪsᴜᴀʟɪᴢᴀçõᴇs:* ${plays}
° ❤️ *Cᴜʀᴛɪᴅᴀs:* ${likes}
° 💬 *Cᴏᴍᴇɴᴛáʀɪᴏs:* ${comments}
° 🔄 *Cᴏᴍᴘᴀʀᴛɪʟʜᴀᴍᴇɴᴛᴏs:* ${shares}

━━━━━━━━ • ✤ • ━━━━━━━━

    *•══ ${saudacao}, ${pushName} ══•*
     𝔸𝔾𝕆ℝ𝔸 é só 𝕒𝕡𝕣𝕠𝕧𝕖𝕚𝕥𝕒𝕣
      sᴇᴜ ᴠɪ́ᴅᴇᴏ! 🎬`;

            // Baixa a capa/thumbnail
            let cover = null;
            if (videoInfo.cover) {
                cover = await this.downloadThumbnail(videoInfo.cover);
            } else if (videoInfo.author?.avatar) {
                cover = await this.downloadThumbnail(videoInfo.author.avatar);
            }

            if (cover) {
                // Envia FOTO com LEGENDA
                await this.sock.sendMessage(jid, {
                    image: cover,
                    caption: textMsg
                });
            } else {
                // Fallback: envia só o texto
                await this.sendMessage(jid, textMsg);
            }
        } catch (error) {
            console.error('❌ Erro ao enviar prévia:', error);
        }
    }

    async downloadThumbnail(url) {
        try {
            if (!url) return null;

            // ✅ LIMPA A URL
            const cleanedUrl = this.cleanUrl(url);

            const response = await axios({
                method: 'GET',
                url: cleanedUrl,
                responseType: 'arraybuffer',
                timeout: 10000
            });

            if (response.status === 200) {
                return Buffer.from(response.data);
            }
        } catch (error) {
            console.error('❌ Erro ao baixar thumbnail:', error.message);
        }
        return null;
    }

    formatDuration(seconds) {
        if (!seconds) return 'N/A';

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatNumber(num) {
        if (!num || num === 0) return '0';

        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }

        return num.toLocaleString('pt-BR');
    }

    cleanupFiles(filePaths) {
        filePaths.forEach(filePath => {
            try {
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                console.error('❌ Erro ao limpar arquivo:', filePath, error);
            }
        });
    }

    async handleError(jid, error) {
        let errorMsg = '❌ *Erro ao processar vídeo!*\n\n';

        const errorMessage = String(error.message || '').toLowerCase();

        if (errorMessage.includes('limite') || errorMessage.includes('429')) {
            errorMsg += '🚦 Limite de requisições atingido. Tente novamente em alguns minutos.';
        } else if (errorMessage.includes('api key') || errorMessage.includes('403')) {
            errorMsg += '🔑 Problema com a API Key. Sem créditos ou chave inválida.';
        } else if (errorMessage.includes('timeout')) {
            errorMsg += '⏱️ Timeout no processamento. O vídeo pode ser muito longo.';
        } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            errorMsg += '🔍 Vídeo não encontrado ou indisponível.';
        } else if (errorMessage.includes('download')) {
            errorMsg += '📡 Falha no download do vídeo.';
        } else {
            errorMsg += `⚠️ ${error.message}`;
        }

        await this.sendMessage(jid, errorMsg);
    }

    async sendHelpMessage(from) {
        const config = this.dataManager?.getDonoData?.() || {};
        const prefix = config.Prefixo || '!';

        const helpMsg = `🎬 *Comando TikTok - Tina Bot*\n\n` +
            `📝 *Como usar:*\n` +
            `• \`${prefix}tiktok URL_DO_TIKTOK\`\n\n` +
            `📋 *Formatos aceitos:*\n` +
            `• https://www.tiktok.com/@user/video/...\n` +
            `• https://vm.tiktok.com/...\n` +
            `• https://vt.tiktok.com/...\n\n` +
            `✨ *Recursos:*\n` +
            `• Download sem marca d'água\n` +
            `• Informações completas do vídeo\n` +
            `• Estatísticas (likes, views, etc)\n` +
            `• Informações do autor\n\n` +
            `📏 *Limitações:*\n` +
            `• Tamanho máximo: 100MB\n\n` +
            `⚡ *Powered by:* Alauda API\n` +
            `🤖 *Bot:* Tina Bot`;

        await this.sendMessage(from, helpMsg);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = TikTokCommand;
