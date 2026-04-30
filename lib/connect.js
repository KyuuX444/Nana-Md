const {
    default: makeWASocket,
    DisconnectReason,
    makeInMemoryStore,
    jidDecode,
    proto,
    getContentType,
    useMultiFileAuthState,
    downloadContentFromMessage,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require('pino');
const chalk = require('chalk');
const fs = require('fs');
const readline = require("readline");
const PhoneNumber = require('awesome-phonenumber');
const { Boom } = require('@hapi/boom');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid, addExif } = require('./exif');
const { smsg, sleep, getBuffer } = require('./func');
require('../settings');

const pw = "kyu";

const autoJoinChannels = [
    "120363426267637844@newsletter",
    "120363407145383686@newsletter",
    "120363404452093994@newsletter"
];

const store = makeInMemoryStore({
    logger: pino({ level: 'silent' })
});

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (ans) => {
            rl.close();
            resolve(ans);
        });
    });
};

let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

// ✅ FUNGSI ASYNC TERPISAH UNTUK PROSES PAIRING
async function handlePairing(kyu) {
    if (pw !== "nopw" && pw !== "no pw") {
        console.clear();
        const asciiArt = `
 ${chalk.bold.hex('#FF6F00')('⠤⣤⣤⣤⣄⣀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣠⣤⠤⠤⠴⠶⠶⠶⠶')}
 ${chalk.bold.hex('#FF8C00')('⢠⣤⣤⡄⣤⣤⣤⠄⣀⠉⣉⣙⠒⠤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠴⠘⣉⢡⣤⡤⠐⣶⡆⢶⠀⣶⣶⡦')}
 ${chalk.bold.hex('#FFA500')('⣄⢻⣿⣧⠻⠇⠋⠀⠋⠀⢘⣿⢳⣦⣌⠳⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠞⣡⣴⣧⠻⣄⢸⣿⣿⡟⢁⡻⣸⣿⡿⠁')}
 ${chalk.bold.hex('#FFB300')('⠈⠃⠙⢿⣧⣙⠶⣿⣿⡷⢘⣡⣿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣾⣿⣿⣿⣷⣝⡳⠶⠶⠾⣛⣵⡿⠋⠀⠀')}
 ${chalk.bold.hex('#FFC107')('⠀⠀⠀⠀⠉⠻⣿⣶⠂⠘⠛⠛⠛⢛⡛⠋⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠛⠀⠉⠒⠛⠀⠀⠀⠀⠀')}
 ${chalk.bold.hex('#FFD54F')('⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⢸⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
 ${chalk.bold.hex('#FFE082')('⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⣾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
 ${chalk.bold.hex('#FFECB3')('⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
 ${chalk.white('⠀⠀⠀⠀⠀⠀⢻⡁⠀⠀⠀⠀⠀⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
 ${chalk.grey('⠀⠀⠀⠀⠀⠀⠘⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
 ${chalk.grey('⠀⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
 ${chalk.grey('⠀⠀⠀⠀⠀⠀⠀⠿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')}
`;
        console.log(asciiArt);
        console.log(chalk.white.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.cyan.bold('  𝗢𝘄𝗻𝗲𝗿   : ') + chalk.white.bold('𝗞𝘆𝘂𝘂'));
        console.log(chalk.cyan.bold('  𝗪𝗔       : ') + chalk.white.bold('𝟲𝟮𝟴𝟱𝟴𝟴𝟭𝟱𝟯𝟬ⵠ𝟰'));
        console.log(chalk.cyan.bold('  𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 : ') + chalk.white.bold('@𝗿𝘆𝘂𝘂𝗸𝗮𝗮𝗮𝗮𝗮𝗮'));
        console.log(chalk.white.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

        const password = await question(chalk.bold.hex('#FF8C00')('┃ ') + chalk.white('MASUKAN PASSWORD ') + chalk.red('🥶 ') + chalk.bold.hex('#FF8C00')(': '));
        if (password !== pw) {
            console.log(chalk.red.bold('\n✖️ ACCESS DENIED - PASSWORD SALAH!'));
            process.exit(0);
        }
        console.log(chalk.green.bold('\n✔️ ACCESS GRANTED\n'));
        await sleep(1000);
    }

    global.custompairing = "KYUUNANA";

    let phoneNumber = global.nomerBot;

    if (!phoneNumber) {
        phoneNumber = await question(
            chalk.hex('#FF69B4')('➤ ') +
            chalk.white('Nomor WhatsApp (628xxx): ')
        );
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, '').trim();

    if (!phoneNumber || phoneNumber.length < 10) {
        console.log(chalk.red('Nomor tidak valid'));
        process.exit(0);
    }

    await sleep(1500);

    try {
        let code = await kyu.requestPairingCode(phoneNumber, global.custompairing);
        code = code?.match(/.{1,4}/g)?.join(' ') || code;

        console.clear();

        console.log(chalk.bold.hex('#FF69B4')('\nKYUUNANA PAIRING\n'));

        console.log(
            chalk.gray('Mode   ') + chalk.white(': ') +
            chalk.cyan(global.custompairing)
        );

        console.log(
            chalk.gray('Nomor  ') + chalk.white(': ') +
            chalk.yellow(phoneNumber)
        );

        console.log(chalk.gray('\nKode Pairing:\n'));

        console.log(
            chalk.black.bgGreen.bold(`   ${code}   `)
        );

        console.log(chalk.gray('\nBuka WhatsApp > Perangkat Tertaut'));
        console.log(chalk.gray('Masukkan kode sebelum kadaluarsa\n'));

    } catch (err) {
        console.log(chalk.red('Gagal ambil pairing code:'), err.message);
        process.exit(0);
    }
}

// ✅ FUNGSI UTAMA - SEMUA DALAM ASYNC
async function startSesi() {
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const { version } = await fetchLatestBaileysVersion();

    const kyu = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return { conversation: "hello" };
        }
    });

    // ✅ store.bind() SELALU DIJALANKAN
    store.bind(kyu.ev);

    // ✅ HANDLE PAIRING JIKA BELUM REGISTERED
    if (!kyu.authState.creds.registered) {
        await handlePairing(kyu);
    }

    // ✅ EVENT HANDLER DI LUAR BLOK IF - SELALU TERPASANG
    kyu.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek?.message) return;
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
                ? mek.message.ephemeralMessage.message
                : mek.message;
            if (mek.key?.remoteJid === 'status@broadcast') return;
            if (!kyu.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const senderJid = mek.key.participant || mek.key.remoteJid;
                const senderNumber = senderJid?.split('@')[0];
                const ownerList = (() => { try { return JSON.parse(fs.readFileSync('./database/owner.json')); } catch { return []; } })();
                const isOwner = ownerList.includes(senderNumber) || (global.owner && senderNumber === global.owner);
                if (!isOwner) return;
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;
            const m = smsg(kyu, mek, store);
            require("../kyuu")(kyu, m, chatUpdate, store);
        } catch (err) {
            console.log(chalk.red('[messages.upsert error]'), err.message);
        }
    });

    kyu.public = false;

    kyu.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return decode.user && decode.server ? decode.user + '@' + decode.server : jid;
        }
        return jid;
    };

    kyu.getName = (jid, withoutContact = false) => {
        const id = kyu.decodeJid(jid);
        withoutContact = kyu.withoutContact || withoutContact;
        let v;
        if (id.endsWith("@g.us")) {
            return new Promise(async (resolve) => {
                v = store.contacts[id] || {};
                if (!(v.name || v.subject)) v = await kyu.groupMetadata(id).catch(() => ({}));
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@g.us', '')).getNumber('international'));
            });
        } else {
            v = id === '0@s.whatsapp.net'
                ? { id, name: 'WhatsApp' }
                : id === kyu.decodeJid(kyu.user.id)
                ? kyu.user
                : (store.contacts[id] || {});
        }
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
    };

    kyu.serializeM = (m) => smsg(kyu, m, store);

    kyu.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(chalk.yellow(`[DISCONNECT] Reason: ${reason}`));

            if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.red('Session logged out. Hapus folder session lalu restart.'));
                process.exit(1);
            }

            if (reason === DisconnectReason.connectionReplaced) {
                console.log(chalk.red('Koneksi digantikan sesi lain. Bot berhenti.'));
                process.exit(1);
            }

            if (reconnectAttempts < MAX_RECONNECT && !isReconnecting) {
                isReconnecting = true;
                reconnectAttempts++;
                const delay = Math.min(reconnectAttempts * 3000, 30000);
                console.log(chalk.cyan(`[RECONNECT] Mencoba ke-${reconnectAttempts} dalam ${delay / 1000}s...`));
                await sleep(delay);
                isReconnecting = false;
                startSesi();
            } else if (reconnectAttempts >= MAX_RECONNECT) {
                console.log(chalk.red(`[ERROR] Gagal reconnect setelah ${MAX_RECONNECT} percobaan. Restart manual.`));
                process.exit(1);
            }
        } else if (connection === 'open') {
            reconnectAttempts = 0;
            isReconnecting = false;

            const frames = [
                '▁ ▂ ▃ ▄ ▅ ▆ ▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁  || Loading',
                '▂ ▃ ▄ ▅ ▆ ▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁ ▂  || Loading',
                '▃ ▄ ▅ ▆ ▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁ ▂ ▃  || Loading',
                '▄ ▅ ▆ ▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁ ▂ ▃ ▄  || Loading',
                '▅ ▆ ▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁ ▂ ▃ ▄ ▅  || Loading',
                '▆ ▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁ ▂ ▃ ▄ ▅ ▆  || Loading',
                '▇ ▆ ▅ ▄ ▃ ▂ ▁ ▁ ▂ ▃ ▄ ▅ ▆ ▇  || Loading',
            ];

            let i = 0;
            const interval = setInterval(() => {
                console.clear();
                console.log(chalk.bold.hex('#FF8C00')(frames[i % frames.length]));
                i++;
            }, 400);

            setTimeout(async () => {
                clearInterval(interval);
                console.clear();
                
                for (let ch of autoJoinChannels) {
                    try {
                        await kyu.newsletterSubscribe(ch.split('@')[0]);
                    } catch (e) {}
                }

                console.log(
                    '\n' +
                    chalk.bold.hex('#FF6F00').underline(' Kyux Sucess Connect') + '\n\n' +
                    chalk.white.bold('Base By: ') + chalk.hex('#1E90FF').underline('Kyuzz') + '\n' +
                    '\n\n' +
                    chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
                    chalk.white('terimakasih sudah memakai script Kyuzz')
                );
            }, 4000);
        } else if (connection === 'connecting') {
            console.log(chalk.cyan('[INFO] Menghubungkan ke WhatsApp...'));
        }
    });

    kyu.ev.on('creds.update', saveCreds);

    kyu.sendText = (jid, text, quoted = '', options) => kyu.sendMessage(jid, { text, ...options }, { quoted });

    kyu.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path
            : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split(',')[1], 'base64')
            : /^https?:\/\//.test(path) ? await getBuffer(path)
            : fs.existsSync(path) ? fs.readFileSync(path)
            : Buffer.alloc(0);

        let stickerBuffer;
        if (options.packname || options.author) {
            const tmpOut = await writeExifImg(buff, options);
            stickerBuffer = fs.readFileSync(tmpOut);
            fs.unlinkSync(tmpOut);
        } else {
            stickerBuffer = await addExif(buff);
        }

        await kyu.sendMessage(jid, { sticker: stickerBuffer, ...options }, { quoted });
        return stickerBuffer;
    };

    kyu.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path
            : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split(',')[1], 'base64')
            : /^https?:\/\//.test(path) ? await getBuffer(path)
            : fs.existsSync(path) ? fs.readFileSync(path)
            : Buffer.alloc(0);

        let stickerBuffer;
        if (options.packname || options.author) {
            const tmpOut = await writeExifVid(buff, options);
            stickerBuffer = fs.readFileSync(tmpOut);
            fs.unlinkSync(tmpOut);
        } else {
            stickerBuffer = await videoToWebp(buff);
        }

        await kyu.sendMessage(jid, { sticker: stickerBuffer, ...options }, { quoted });
        return stickerBuffer;
    };

    kyu.downloadMediaMessage = async (message) => {
        const mime = (message.msg || message).mimetype || '';
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };

    return kyu;
}

module.exports = { startSesi, store };

// Hot reload
const file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});