const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { pipeline } = require('stream');

module.exports = {
    permission: 1, // STAFF only
    data: new SlashCommandBuilder()
        .setName('record')
        .setDescription('Record voice channel audio')
        .addSubcommand(s => s.setName('start').setDescription('Start recording'))
        .addSubcommand(s => s.setName('stop').setDescription('Stop recording and upload')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const member = interaction.member;
        const guild = interaction.guild;

        if (sub === 'start') {
            if (!member.voice.channel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

            const connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            // Debug Connection
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('✅ Bot connected to voice channel!');
            });

            // Clean up previous recordings
            const recPath = path.join(__dirname, '..', '..', '..', 'recordings');
            if (!fs.existsSync(recPath)) fs.mkdirSync(recPath, { recursive: true });

            // Map to store active write streams/pipelines per user to prevent duplicate listeners
            const activeRecordings = new Set();

            connection.receiver.speaking.on('start', (userId) => {
                if (activeRecordings.has(userId)) return;

                console.log(`🗣️ User ${userId} started speaking.`);

                // Subscribe to the audio stream
                const opusStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 1000,
                    },
                });

                activeRecordings.add(userId);

                const rawStream = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
                const filename = path.join(recPath, `${userId}-${Date.now()}.pcm`);
                const out = fs.createWriteStream(filename);

                console.log(`🎙️ Recording to ${filename}`);

                pipeline(opusStream, rawStream, out, (err) => {
                    activeRecordings.delete(userId); // Mark as finished so we can record next utterance
                    if (err) {
                        if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                            // Expected when stopping recording forcefully
                            console.log(`✅ Recording stopped for ${userId}`);
                        } else {
                            console.error(`❌ Error recording ${userId}:`, err);
                        }
                    } else {
                        console.log(`✅ Segment saved: ${filename}`);
                    }
                });
            });

            connection.receiver.speaking.on('end', (userId) => {
                // Just log it. The stream handles the actual end via EndBehavior.
                console.log(`🤫 User ${userId} stopped speaking (or paused).`);
            });

            return interaction.reply({ content: `🎙️ Started recording in <#${member.voice.channel.id}>. \n**Note:** If you see DAVE protocol errors in console, please reinstall dependencies.` });

        } else if (sub === 'stop') {
            const connection = getVoiceConnection(guild.id);
            if (!connection) return interaction.reply({ content: '❌ Not recording!', ephemeral: true });

            await interaction.reply({ content: '✅ Stopping recording... processing files.' });

            // Give streams a moment to close flushing data
            await new Promise(r => setTimeout(r, 1000));

            const recPath = path.join(__dirname, '..', '..', '..', 'recordings');
            connection.destroy();

            // Wait another moment for file locks to release
            await new Promise(r => setTimeout(r, 500));

            try {
                if (!fs.existsSync(recPath)) return interaction.followUp('No recordings found.');

                const files = fs.readdirSync(recPath).filter(f => f.endsWith('.pcm'));
                if (files.length === 0) return interaction.followUp('No audio captured.');

                const uploadedFiles = [];

                for (const file of files) {
                    const pcmPath = path.join(recPath, file);
                    const wavPath = pcmPath.replace('.pcm', '.wav');

                    try {
                        // Convert PCM to WAV (add header)
                        const pcmData = fs.readFileSync(pcmPath);
                        if (pcmData.length === 0) {
                            fs.unlinkSync(pcmPath);
                            continue;
                        }

                        const wavHeader = getWavHeader(pcmData.length, 48000, 2, 16);
                        const wavData = Buffer.concat([wavHeader, pcmData]);
                        fs.writeFileSync(wavPath, wavData);

                        uploadedFiles.push(wavPath);

                        // Delete raw PCM
                        fs.unlinkSync(pcmPath);
                    } catch (err) {
                        console.error(`Error processing ${file}:`, err);
                    }
                }

                // Upload files
                if (uploadedFiles.length > 0) {
                    await interaction.channel.send({
                        content: `📁 **Voice Recordings** (${uploadedFiles.length})`,
                        files: uploadedFiles
                    });

                    // Cleanup WAVs after upload (wait a bit to ensure upload read them)
                    // Actually discord.js reads into memory or streams, so deleting immediately is risky if async?
                    // But we used file path, so it's a stream. Usually safe to delete AFTER the promise resolves.
                    // The send is awaited above.

                    uploadedFiles.forEach(f => {
                        try { fs.unlinkSync(f); } catch (e) { console.error('Cleanup error', e); }
                    });
                } else {
                    interaction.followUp('Failed to process recordings (empty files?).');
                }

            } catch (e) {
                console.error(e);
                interaction.followUp('❌ Error uploading files.');
            }
        }
    }
};

// Helper: Create WAV Header
function getWavHeader(dataLength, sampleRate, channels, bitDepth) {
    const blockAlign = (channels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}
