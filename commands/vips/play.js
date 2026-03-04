const fs = require('fs');
const path = require('path');
const axios = require('axios');
const playdl = require('play-dl');

// Fetch compatível com Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class PlayCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.tempDir = path.join(__dirname, '../../temp');
        this.maxDuration = 600; // 10 minutos
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        
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

            const query = args.join(' ');
            const isYouTubeUrl = this.isValidYouTubeUrl(query);
            
            // Pega o nome do usuário
            const pushName = msg.pushName || sender.split('@')[0];

            if (!isYouTubeUrl && query.includes('http')) {
                await this.sendMessage(from, '❌ *URL não suportada!*\n\n🔗 Apenas URLs do YouTube são aceitas.');
                return;
            }

            await this.sendMessage(from, '⏳ *Processando música...*\n\n🔍 Buscando informações no YouTube...');

            let videoUrl;
            let videoInfo;

            if (isYouTubeUrl) {
                videoUrl = query;
            } else {
                // Busca no YouTube usando play-dl
                try {
                    const searchResults = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
                    
                    if (!searchResults || !searchResults[0]) {
                        await this.sendMessage(from, `❌ *Música não encontrada!*\n\n🔍 Não foi possível encontrar: "${query}"`);
                        return;
                    }
                    
                    videoUrl = searchResults[0].url;
                } catch (searchError) {
                    console.error('❌ Erro na busca:', searchError.message);
                    await this.sendMessage(from, `❌ *Erro na busca!*\n\n⚠️ ${searchError.message}`);
                    return;
                }
            }

            // Tenta pegar informações detalhadas via play-dl
            videoInfo = await this.getVideoInfoFromPlayDL(videoUrl);
            
            // Se play-dl falhar, pega infos básicas direto da busca
            if (!videoInfo && !isYouTubeUrl) {
                try {
                    const searchResults = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
                    if (searchResults && searchResults[0]) {
                        const result = searchResults[0];
                        videoInfo = {
                            id: result.id || 'unknown',
                            title: result.title || query,
                            thumbnail: result.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${result.id}/maxresdefault.jpg`,
                            url: videoUrl,
                            duration: result.durationInSec || 0,
                            channel: result.channel?.name || 'Desconhecido',
                            channelUrl: result.channel?.url || '',
                            views: result.views || 0,
                            uploadDate: 'N/A',
                            description: 'Informações limitadas disponíveis'
                        };
                    }
                } catch (err) {
                    console.error('❌ Erro ao pegar info da busca:', err.message);
                }
            }

            // Se ainda não tem info, usa fallback básico
            if (!videoInfo) {
                const videoId = this.extractVideoId(videoUrl);
                videoInfo = {
                    id: videoId,
                    title: query,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    url: videoUrl,
                    duration: 0,
                    channel: 'YouTube',
                    channelUrl: '',
                    views: 0,
                    uploadDate: 'N/A',
                    description: 'Processando via Alauda API...'
                };
            }

            // Verifica duração
            if (videoInfo.duration && videoInfo.duration > this.maxDuration) {
                await this.sendMessage(from, 
                    `❌ *Música muito longa!*\n\n` +
                    `⏱️ Duração: ${this.formatDuration(videoInfo.duration)}\n` +
                    `📏 Limite máximo: ${this.formatDuration(this.maxDuration)}`
                );
                return;
            }

            // Envia prévia com FOTO + LEGENDA
            await this.sendVideoPreview(from, videoInfo, query, pushName);

            // Download do áudio via Alauda API
            await this.sendMessage(from, '⬇️ *Iniciando download via Alauda API...*\n\n⏳ Aguarde...');
            const downloadResult = await this.downloadAudioFromAlauda(videoUrl);

            if (!downloadResult.success || !downloadResult.downloadUrl) {
                await this.sendMessage(from, 
                    `❌ *Erro no download!*\n\n` +
                    `⚠️ ${downloadResult.error || 'Não foi possível baixar o áudio.'}\n\n` +
                    `💰 Créditos restantes: ${downloadResult.creditsRemaining || 'N/A'}`
                );
                return;
            }

            // Baixa o arquivo de áudio
            await this.sendMessage(from, '📥 *Baixando arquivo do servidor...*');
            const audioPath = await this.downloadFile(downloadResult.downloadUrl);

            // Verifica tamanho do arquivo
            const fileStats = fs.statSync(audioPath);
            if (fileStats.size > this.maxFileSize) {
                this.cleanupFiles([audioPath]);
                await this.sendMessage(from, 
                    `❌ *Arquivo muito grande!*\n\n` +
                    `📊 Tamanho: ${(fileStats.size / 1024 / 1024).toFixed(1)}MB\n` +
                    `📏 Limite: ${this.maxFileSize / 1024 / 1024}MB`
                );
                return;
            }

            // Envia o áudio
            await this.sendMessage(from, `🎵 *Enviando música...*\n\n💰 Créditos restantes na API: ${downloadResult.creditsRemaining || 'N/A'}`);
            await this.sendAudio(from, audioPath, videoInfo);
            
            this.cleanupFiles([audioPath]);
            console.log(`🎵 Música enviada: ${videoInfo.title} para ${sender.replace('@s.whatsapp.net', '')}`);
            console.log(`💰 Créditos restantes: ${downloadResult.creditsRemaining}`);

        } catch (error) {
            console.error('❌ Erro no comando play:', error);
            await this.handleError(from, error);
        }
    }

    isValidYouTubeUrl(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com|youtube\.com\/shorts)\/.+$/;
        return youtubeRegex.test(url);
    }

    /**
     * Extrai o ID do vídeo da URL do YouTube
     */
    extractVideoId(url) {
        try {
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\?\/]+)/,
                /youtube\.com\/embed\/([^&\?\/]+)/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Obtém TODAS as informações do vídeo via play-dl
     * Com fallback para erro de verificação do YouTube
     */
    async getVideoInfoFromPlayDL(url) {
        try {
            const videoDetails = await playdl.video_info(url);
            const basic = videoDetails.video_details;
            
            // Formata a data de postagem
            let uploadDate = 'N/A';
            if (basic.uploadedAt) {
                uploadDate = basic.uploadedAt;
            }
            
            return {
                id: basic.id,
                title: basic.title || 'Sem título',
                thumbnail: `https://img.youtube.com/vi/${basic.id}/maxresdefault.jpg`,
                url: url,
                duration: Number(basic.durationInSec || 0),
                channel: basic.channel?.name || 'Desconhecido',
                channelUrl: basic.channel?.url || '',
                views: basic.views || 0,
                uploadDate: uploadDate,
                description: (basic.description || 'Sem descrição').slice(0, 100)
            };
        } catch (error) {
            console.error('❌ Erro ao obter info via play-dl:', error.message);
            
            // Se for erro de "Sign in" ou "bot", retorna null para usar fallback
            if (error.message.includes('Sign in') || error.message.includes('bot')) {
                console.log('⚠️ YouTube pediu verificação, usando fallback...');
            }
            
            return null;
        }
    }

    /**
     * Faz download do áudio via Alauda API (APENAS DOWNLOAD)
     */
    async downloadAudioFromAlauda(url) {
        try {
            const response = await axios.post(
                `${this.alaudaApiUrl}/api/youtube/download`,
                {
                    url: url,
                    format: 'mp3',
                    quality: '128'
                },
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
                
                // Retorna o download URL principal
                if (data.download && data.download.url) {
                    return {
                        success: true,
                        downloadUrl: data.download.url,
                        creditsRemaining: data.credits_remaining,
                        alternativeUrls: data.download.alternative_urls || []
                    };
                }

                // Tenta URLs alternativas
                if (data.download && data.download.alternative_urls && data.download.alternative_urls.length > 0) {
                    const altUrl = data.download.alternative_urls[0].url;
                    return {
                        success: true,
                        downloadUrl: altUrl,
                        creditsRemaining: data.credits_remaining,
                        alternativeUrls: data.download.alternative_urls
                    };
                }

                return {
                    success: false,
                    error: 'Nenhuma URL de download disponível',
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
     * Baixa o arquivo de áudio da URL fornecida
     */
    async downloadFile(url) {
        const timestamp = Date.now();
        const outputPath = path.join(this.tempDir, `audio_${timestamp}_${Math.random().toString(36).slice(2)}.mp3`);

        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 60000
            });

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(outputPath));
                writer.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Erro ao baixar arquivo:', error.message);
            throw new Error('Falha ao baixar arquivo de áudio');
        }
    }

    async sendAudio(jid, audioPath, videoInfo) {
        try {
            const audioBuffer = await fs.promises.readFile(audioPath);

            await this.sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                contextInfo: {
                    externalAdReply: {
                        title: videoInfo.title,
                        body: `⏱️ ${this.formatDuration(videoInfo.duration)} • 🎵 Tina Bot`,
                        thumbnail: await this.downloadThumbnail(videoInfo.thumbnail),
                        sourceUrl: videoInfo.url,
                        mediaType: 2,
                        mediaUrl: videoInfo.url
                    }
                }
            });
        } catch (error) {
            console.error('❌ Erro ao enviar áudio:', error);
            throw new Error('Falha ao enviar áudio');
        }
    }

    /**
     * Envia FOTO (thumbnail) com LEGENDA estilizada
     */
    async sendVideoPreview(jid, videoInfo, query, pushName) {
        try {
            // Pega hora do dia para saudação
            const hora = new Date().getHours();
            let saudacao = 'Bom dia';
            if (hora >= 12 && hora < 18) {
                saudacao = 'Boa tarde';
            } else if (hora >= 18) {
                saudacao = 'Boa noite';
            }

            // Formata valores com fallback para "N/A"
            const titulo = videoInfo.title || 'N/A';
            const autor = videoInfo.channel || 'N/A';
            const canalUrl = videoInfo.channelUrl || 'N/A';
            const postado = videoInfo.uploadDate || 'N/A';
            const duracao = videoInfo.duration ? this.formatDuration(videoInfo.duration) : 'N/A';
            const views = videoInfo.views ? videoInfo.views.toLocaleString('pt-BR') : 'N/A';
            const url = videoInfo.url || 'N/A';
            const descricao = videoInfo.description || 'N/A';

            const textMsg = 
`╔═════ஜ۩📖۩ஜ═════╗
  Ｂｅｍ Ｖｉｎｄｏ(ａ)!!
╚═════ஜ۩📖۩ஜ═════╝

*꧁- 𝙰𝚚𝚞𝚒 𝚎𝚜𝚝ã𝚘 𝚘𝚜 𝚛𝚎𝚜𝚞𝚕𝚝𝚊𝚍𝚘𝚜 𝚙𝚊𝚛𝚊:* 
      *『 ${query} 』-꧂*
                         
━━━━━━━━ • ✤ • ━━━━━━━━

° 🎧 *Tɪᴛᴜʟᴏ:* ${titulo}
° 👤 *Aᴜᴛʜᴏʀ:* ${autor}
° 🌐 *Cᴀɴᴀʟ:* ${canalUrl}
° 🗓️ *Pᴏsᴛᴀᴅᴏ:* ${postado}
° ⏳ *Dᴜʀᴀçãᴏ:* ${duracao}
° 👁️‍🗨️ *Vɪsᴜᴀʟɪᴢᴀçõᴇs:* ${views}
° 🔮 *Uʀʟ:* ${url}
° 📝 *Dᴇsᴄʀɪçãᴏ:* ${descricao}

━━━━━━━━ • ✤ • ━━━━━━━━

    *•══ ${saudacao}, ${pushName} ══•*
     𝔸𝔾𝕆ℝ𝔸 é só 𝕒𝕡𝕣𝕠𝕧𝕖𝕚𝕥𝕒𝕣 
      sᴜᴀ ᴍᴜ́Sɪᴄᴀ! 🎶`;

            // Baixa a thumbnail
            const thumbnail = await this.downloadThumbnail(videoInfo.thumbnail);

            if (thumbnail) {
                // Envia FOTO com LEGENDA (caption)
                await this.sock.sendMessage(jid, { 
                    image: thumbnail, 
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
            
            const response = await axios({
                method: 'GET',
                url: url,
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
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        let errorMsg = '❌ *Erro ao processar música!*\n\n';
        
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
            errorMsg += '📡 Falha no download do áudio.';
        } else {
            errorMsg += `⚠️ ${error.message}`;
        }
        
        await this.sendMessage(jid, errorMsg);
    }

    async sendHelpMessage(from) {
        const config = this.dataManager?.getDonoData?.() || {};
        const prefix = config.Prefixo || '!';

        const helpMsg = `🎵 *Comando Play - Tina Bot*\n\n` +
            `📝 *Como usar:*\n` +
            `• \`${prefix}play nome da música\`\n` +
            `• \`${prefix}play URL do YouTube\`\n\n` +
            `📋 *Limitações:*\n` +
            `• Duração máxima: 10 minutos\n` +
            `• Tamanho máximo: 50MB\n` +
            `• Apenas YouTube suportado\n\n` +
            `⚡ *Powered by:*\n` +
            `• Alauda API (Download)\n` +
            `• play-dl (Informações)\n\n` +
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

module.exports = PlayCommand;
