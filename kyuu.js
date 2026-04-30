require("./settings");
const fs = require('fs');
const util = require('util');
const os = require('os');
const FileType = require('file-type');
const axios = require('axios');
const chalk = require('chalk');
const { runtime, formatp, tanggal, sleep, fetchJson } = require('./lib/func');
const gh = require('./lib/github');
const { exec } = require("child_process");
const {
    generateWAMessageFromContent,
    proto,
    generateWAMessageContent,
    prepareWAMessageMedia,
    downloadContentFromMessage,
    areJidsSameUser,
    getContentType
} = require("@whiskeysockets/baileys");

let _ownerCache = null;
let _premiumCache = null;

function getOwnerDb() {
    if (!_ownerCache) _ownerCache = JSON.parse(fs.readFileSync("./database/owner.json"));
    return _ownerCache;
}

function getPremiumDb() {
    if (!_premiumCache) _premiumCache = JSON.parse(fs.readFileSync("./database/premium.json"));
    return _premiumCache;
}

function saveOwnerDb() {
    fs.writeFileSync("./database/owner.json", JSON.stringify(_ownerCache, null, 2));
    _ownerCache = null;
}

function savePremiumDb() {
    fs.writeFileSync("./database/premium.json", JSON.stringify(_premiumCache, null, 2));
    _premiumCache = null;
}

const ppCache = new Map();
const PP_TTL = 10 * 60 * 1000;

async function getCachedPP(kyu, jid) {
    const now = Date.now();
    const hit = ppCache.get(jid);
    if (hit && now < hit.expiresAt) return hit.url;
    try {
        const url = await kyu.profilePictureUrl(jid, 'image');
        ppCache.set(jid, { url, expiresAt: now + PP_TTL });
        return url;
    } catch {
        const fallback = 'https://files.catbox.moe/2lw5hm.jpg';
        ppCache.set(jid, { url: fallback, expiresAt: now + PP_TTL });
        return fallback;
    }
}

const groupMetaCache = new Map();
const GROUP_TTL = 5 * 60 * 1000;

async function getCachedGroupMeta(kyu, jid) {
    const now = Date.now();
    const hit = groupMetaCache.get(jid);
    if (hit && now < hit.expiresAt) return hit.data;
    const data = await kyu.groupMetadata(jid).catch(() => ({}));
    groupMetaCache.set(jid, { data, expiresAt: now + GROUP_TTL });
    return data;
}

let cecanCache = null;
const CECAN_TTL = 30 * 60 * 1000;
let lastCecanFetch = 0;

async function getCecanDb() {
    const now = Date.now();
    if (cecanCache && (now - lastCecanFetch) < CECAN_TTL) return cecanCache;
    try {
        const res = await axios.get('https://pastebin.com/raw/j9Hrx7V4', { timeout: 10000 });
        cecanCache = res.data;
        lastCecanFetch = now;
        return cecanCache;
    } catch (e) {
        console.error('[CECAN] Gagal fetch pastebin:', e.message);
        return cecanCache || {};
    }
}

const menuThumb = fs.readFileSync('./lib/menu.jpg');

module.exports = async (kyu, m, chatUpdate, store) => {
    try {
        const from = m.key.remoteJid;
        const quoted = m.quoted ? m.quoted : m;
        const body = m.body
            || m.text
            || (m.mtype === 'interactiveResponseMessage'
                ? (() => { try { return JSON.parse(m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson)?.id; } catch { return ''; } })()
                : '')
            || '';

        const budy = (typeof m.text == 'string' ? m.text : '.');
        const prefix = /^[°zZ#$@+,.?=''():√%!¢£¥€π¤ΠΦ&><`™©®Δ^βα¦|/\\©^]/.test(body) ? body.match(/^[°zZ#$@+,.?=''():√%¢£¥€π¤ΠΦ&><!`™©®Δ^βα¦|/\\©^]/gi) : '.';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const mime = (quoted.msg || quoted).mimetype || '';
        let q;
        const text = q = args.join(" ");
        const isPc = from.endsWith('@s.whatsapp.net');
        const isCh = from.endsWith('@newsletter');
        const isGroup = from.endsWith('@g.us');
        const botNumber = await kyu.decodeJid(kyu.user.id);

        const sender = m.key.fromMe
            ? (kyu.user.id.split(':')[0] + '@s.whatsapp.net' || kyu.user.id)
            : (m.key.participant || m.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const pushname = m.pushName || `${senderNumber}`;
        const botNumberClean = botNumber.split('@')[0];
        const isBot = senderNumber === botNumberClean || senderNumber === (global.nomerBot || '').replace(/[^0-9]/g, '');

        const ownerNumber = getOwnerDb();
        const isCreator = ownerNumber.includes(senderNumber) || isBot || senderNumber === (global.owner || '').replace(/[^0-9]/g, '');

        const groupMetadata = isGroup ? await getCachedGroupMeta(kyu, from) : {};
        const groupName = groupMetadata.subject || '';
        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter(v => v.admin).map(v => v.id);
        const groupOwner = groupMetadata.owner || '';
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber) : false;
        const isGroupAdmins = isGroup ? groupAdmins.includes(sender) : false;
        const isAdmins = isGroupAdmins;

        const premium = getPremiumDb();
        const isPremium = premium.includes(sender);

        if (!kyu.public && !isCreator && !isBot) {
            return;
        }

        const qlive = {
            key: {
                participant: '0@s.whatsapp.net',
                ...(m.chat ? { remoteJid: `status@broadcast` } : {})
            },
            message: {
                documentMessage: {
                    title: '𝗞𝘆𝘂𝘂 𝗫 𝗡𝗮𝗻𝗮',
                    jpegThumbnail: "",
                    mimetype: 'application/pdf',
                    fileLength: 9999999999999,
                    pageCount: 999999,
                    fileName: '𝗞𝘆𝘂𝘂 𝗫 𝗡𝗮𝗻𝗮',
                    caption: `𝙆𝙮𝙪 𝗫 444 ☣︎`
                }
            }
        };

        const reply = (teks) => kyu.sendMessage(from, { text: teks }, { quoted: m });

        kyu.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
            const quotedMsg = message.msg ? message.msg : message;
            const mimeType = (message.msg || message).mimetype || '';
            const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mimeType.split('/')[0];
            const stream = await downloadContentFromMessage(quotedMsg, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            const type = await FileType.fromBuffer(buffer);
            const trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
            fs.writeFileSync(trueFileName, buffer);
            return trueFileName;
        };

        if (m.message && m.text && m.text.startsWith(prefix)) {
            const line = chalk.cyan('══════════════════════════════════════════');
            console.log(
                '\n' + line + '\n' +
                chalk.bgGreen.black(' ▶  MESSAGE ') + chalk.greenBright(' │ ' + m.text) + '\n' +
                chalk.bgYellow.black(' ▶  SENDER  ') + chalk.yellowBright(' │ ' + sender) + '\n' +
                chalk.bgGreen.black(' ▶  TYPE    ') + chalk.greenBright(' │ ' + m.mtype) + '\n' +
                chalk.bgYellow.black(' ▶  CHAT    ') + (isGroup ? chalk.yellowBright(' │ GROUP CHAT') : chalk.yellowBright(' │ PRIVATE CHAT')) + '\n' +
                line + '\n'
            );
        }

        const ppuser = await getCachedPP(kyu, sender);

        switch (command) {

        // ==================== MENU ====================
        case "menu": {
    const uptime = runtime(process.uptime());
    const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    const teks = `╭───❖ *𝙃𝙚𝙡𝙡𝙤 ${pushname}* ❖
│
│ 𝗣𝗲𝗿𝗸𝗲𝗻𝗮𝗹𝗸𝗮𝗻 𝗮𝗸𝘂 *𝗡𝗮𝗻𝗮 𝗠𝗗*, 𝗯𝗼𝘁 𝗪𝗵𝗮𝘁𝘀𝗮𝗽𝗽 𝘆𝗮𝗻𝗴 𝗱𝗶𝗸𝗲𝗺𝗯𝗮𝗻𝗴𝗸𝗮𝗻 𝗼𝗹𝗲𝗵 𝙆𝙮𝙪
│
└─❖ 𝗜𝗡𝗙𝗢 𝗕𝗢𝗧 ❖
   ◦ 𝗢𝘄𝗻𝗲𝗿 : ${global.ownername}
   ◦ 𝗡𝗮𝗺𝗲 : ${global.namabot}
   ◦ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
   ◦ 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗣𝘂𝗯𝗹𝗶𝗰' : '𝗦𝗲𝗹𝗳'}
   ◦ 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 9999999999999,
        pageCount: 99999999,
        fileName: `${global.namabot}`,
        caption: teks,
        footer: `${global.namabot} · ${timeNow} ᴡɪʙ`,
        buttons: [
            {
                buttonId: ".owner",
                buttonText: {
                    displayText: "👤 ᴏᴡɴᴇʀ"
                },
                type: 1
            },
            {
                buttonId: "menu_select",
                buttonText: {
                    displayText: "📂 ʙᴜᴋᴀ ᴍᴇɴᴜ"
                },
                type: 4,
                nativeFlowInfo: {
                    name: "single_select",
                    paramsJson: JSON.stringify({
                        title: "✨ ᴘɪʟɪʜ ᴍᴇɴᴜ",
                        sections: [
                            {
                                title: "🔰 ɪɴꜰᴏ ʙᴏᴛ",
                                rows: [
                                    {
                                        title: "📊 ɪɴꜰᴏ ʙᴏᴛ",
                                        description: "Lihat informasi lengkap bot",
                                        id: ".infobot"
                                    }
                                ]
                            },
                            {
                                title: "📁 ᴋᴀᴛᴇɢᴏʀɪ ᴄᴏᴍᴍᴀɴᴅ",
                                rows: [
                                    {
                                        title: "📜 ᴀʟʟ ᴍᴇɴᴜ",
                                        description: "Lihat semua daftar command",
                                        id: ".allmenu"
                                    },
                                    {
                                        title: "👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ",
                                        description: "Kelola owner & premium user",
                                        id: ".ownermenu"
                                    },
                                    {
                                        title: "🏠 ᴍᴀɪɴ ᴍᴇɴᴜ",
                                        description: "Menu navigasi utama bot",
                                        id: ".mainmenu"
                                    },
                                    {
                                        title: "🐙 ɢɪᴛʜᴜʙ ᴛᴏᴏʟs",
                                        description: "Tools untuk manage repository",
                                        id: ".ghmenu"
                                    },
                                    {
                                        title: "🌸 ᴄᴇᴄᴀɴ ᴍᴇɴᴜ",
                                        description: "Random cewek cantik negara tertentu",
                                        id: ".cecanmenu"
                                    },
                                    {
                                        title: "🎲 ʀᴀɴᴅᴏᴍ ᴍᴇɴᴜ",
                                        description: "Random gambar anime & lainnya",
                                        id: ".randommenu"
                                    }
                                ]
                            }
                        ],
                    }),
                },
            }
        ],
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;

        case 'allmenu': {
    const uptime = runtime(process.uptime());
    const a = `▣───⬣〔 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧 〕⬣───▣
- 𝗡𝗮𝗺𝗲 𝗕𝗼𝘁 : ${global.namabot}
- 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗽𝘂𝗯𝗹𝗶𝗰' : '𝘀𝗲𝗹𝗳'}
- 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
- 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}

▣────⬣〔 𝙊𝙬𝙣𝙚𝙧 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐬𝐞𝐥𝐟
> 𝐩𝐮𝐛𝐥𝐢𝐜
> 𝐚𝐝𝐝𝐨𝐰𝐧𝐞𝐫
> 𝐝𝐞𝐥𝐨𝐰𝐧𝐞𝐫
> 𝐥𝐢𝐬𝐭𝐨𝐰𝐧𝐞𝐫
> 𝐚𝐝𝐝𝐩𝐫𝐞𝐦
> 𝐝𝐞𝐥𝐩𝐫𝐞𝐦
> 𝐥𝐢𝐬𝐭𝐩𝐫𝐞𝐦
> 𝐠𝐞𝐭
> 𝐢𝐧𝐬𝐭𝐚𝐥𝐥

▣────⬣〔 𝙈𝙖𝙞𝙣 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐨𝐰𝐧𝐞𝐫
> 𝐦𝐞𝐧𝐮
> 𝐚𝐥𝐥𝐦𝐞𝐧𝐮

▣────⬣〔 𝙂𝙞𝙩𝙝𝙪𝙗 𝙏𝙤𝙤𝙡𝙨 〕⬣────▣
> 𝐠𝐡𝐫𝐞𝐩𝐨
> 𝐠𝐡𝐝𝐞𝐥𝐞𝐭𝐞
> 𝐠𝐡𝐥𝐢𝐬𝐭
> 𝐠𝐡𝐢𝐧𝐟𝐨
> 𝐠𝐡𝐫𝐞𝐥𝐞𝐚𝐬𝐞
> 𝐠𝐡𝐮𝐩𝐥𝐨𝐚𝐝
> 𝐠𝐡𝐩𝐮𝐬𝐡

▣────⬣〔 𝘾𝙚𝙘𝙖𝙣 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐢𝐧𝐝𝐨𝐧𝐞𝐬𝐢𝐚
> 𝐜𝐡𝐢𝐧𝐚
> 𝐯𝐢𝐞𝐭𝐧𝐚𝐦
> 𝐭𝐡𝐚𝐢𝐥𝐚𝐧𝐝
> 𝐤𝐨𝐫𝐞𝐚
> 𝐣𝐚𝐩𝐚𝐧
> 𝐦𝐚𝐥𝐚𝐲𝐬𝐢𝐚
> 𝐣𝐮𝐬𝐭𝐢𝐧𝐚𝐱𝐢𝐞
> 𝐣𝐞𝐧𝐢
> 𝐣𝐢𝐬𝐨
> 𝐫𝐲𝐮𝐣𝐢𝐧
> 𝐫𝐨𝐬𝐞
> 𝐡𝐢𝐣𝐚𝐛𝐞𝐫

▣────⬣〔 𝙍𝙖𝙣𝙙𝙤𝙢 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐛𝐥𝐮𝐞𝐚𝐫𝐜𝐡𝐢𝐯𝐞
> 𝐥𝐨𝐥𝐢
> 𝐩𝐩𝐜𝐨𝐮𝐩𝐥𝐞
> 𝐩𝐚𝐩𝐚𝐲𝐚𝐧𝐠
> 𝐚𝐬𝐮𝐩𝐚𝐧

▣───────────▣`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 99999,
        pageCount: 100,
        fileName: `${global.namabot} - All Menu`,
        caption: a,
        footer: '𝙆𝙮𝙪 𝗫 444 ☣︎',
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;
case 'ownermenu': {
    const uptime = runtime(process.uptime());
    const a = `▣───⬣〔 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧 〕⬣───▣
- 𝗡𝗮𝗺𝗲 𝗕𝗼𝘁 : ${global.namabot}
- 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗽𝘂𝗯𝗹𝗶𝗰' : '𝘀𝗲𝗹𝗳'}
- 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
- 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}

▣────⬣〔 𝙊𝙬𝙣𝙚𝙧 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐬𝐞𝐥𝐟
> 𝐩𝐮𝐛𝐥𝐢𝐜
> 𝐚𝐝𝐝𝐨𝐰𝐧𝐞𝐫
> 𝐝𝐞𝐥𝐨𝐰𝐧𝐞𝐫
> 𝐥𝐢𝐬𝐭𝐨𝐰𝐧𝐞𝐫
> 𝐚𝐝𝐝𝐩𝐫𝐞𝐦
> 𝐝𝐞𝐥𝐩𝐫𝐞𝐦
> 𝐥𝐢𝐬𝐭𝐩𝐫𝐞𝐦
> 𝐠𝐞𝐭
> 𝐢𝐧𝐬𝐭𝐚𝐥𝐥

▣───────────▣`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 99999,
        pageCount: 100,
        fileName: `${global.namabot} - Owner Menu`,
        caption: a,
        footer: '𝙆𝙮𝙪 𝗫 444 ☣︎',
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;

case 'mainmenu': {
    const uptime = runtime(process.uptime());
    const a = `▣───⬣〔 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧 〕⬣───▣
- 𝗡𝗮𝗺𝗲 𝗕𝗼𝘁 : ${global.namabot}
- 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗽𝘂𝗯𝗹𝗶𝗰' : '𝘀𝗲𝗹𝗳'}
- 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
- 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}

▣────⬣〔 𝙈𝙖𝙞𝙣 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐨𝐰𝐧𝐞𝐫
> 𝐦𝐞𝐧𝐮
> 𝐚𝐥𝐥𝐦𝐞𝐧𝐮

▣───────────▣`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 99999,
        pageCount: 100,
        fileName: `${global.namabot} - Main Menu`,
        caption: a,
        footer: '𝙆𝙮𝙪 𝗫 444 ☣︎',
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;

case 'githubmenu': case 'ghmenu': {
    const uptime = runtime(process.uptime());
    const a = `▣───⬣〔 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧 〕⬣───▣
- 𝗡𝗮𝗺𝗲 𝗕𝗼𝘁 : ${global.namabot}
- 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗽𝘂𝗯𝗹𝗶𝗰' : '𝘀𝗲𝗹𝗳'}
- 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
- 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}

▣────⬣〔 𝙂𝙞𝙩𝙝𝙪𝙗 𝙏𝙤𝙤𝙡𝙨 〕⬣────▣
> 𝐠𝐡𝐫𝐞𝐩𝐨
> 𝐠𝐡𝐝𝐞𝐥𝐞𝐭𝐞
> 𝐠𝐡𝐥𝐢𝐬𝐭
> 𝐠𝐡𝐢𝐧𝐟𝐨
> 𝐠𝐡𝐫𝐞𝐥𝐞𝐚𝐬𝐞
> 𝐠𝐡𝐮𝐩𝐥𝐨𝐚𝐝
> 𝐠𝐡𝐩𝐮𝐬𝐡

▣───────────▣`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 99999,
        pageCount: 100,
        fileName: `${global.namabot} - Github Menu`,
        caption: a,
        footer: '𝙆𝙮𝙪 𝗫 444 ☣︎',
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;

case 'cecanmenu': {
    const uptime = runtime(process.uptime());
    const a = `▣───⬣〔 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧 〕⬣───▣
- 𝗡𝗮𝗺𝗲 𝗕𝗼𝘁 : ${global.namabot}
- 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗽𝘂𝗯𝗹𝗶𝗰' : '𝘀𝗲𝗹𝗳'}
- 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
- 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}

▣────⬣〔 𝘾𝙚𝙘𝙖𝙣 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐢𝐧𝐝𝐨𝐧𝐞𝐬𝐢𝐚
> 𝐜𝐡𝐢𝐧𝐚
> 𝐯𝐢𝐞𝐭𝐧𝐚𝐦
> 𝐭𝐡𝐚𝐢𝐥𝐚𝐧𝐝
> 𝐤𝐨𝐫𝐞𝐚
> 𝐣𝐚𝐩𝐚𝐧
> 𝐦𝐚𝐥𝐚𝐲𝐬𝐢𝐚
> 𝐣𝐮𝐬𝐭𝐢𝐧𝐚𝐱𝐢𝐞
> 𝐣𝐞𝐧𝐢
> 𝐣𝐢𝐬𝐨
> 𝐫𝐲𝐮𝐣𝐢𝐧
> 𝐫𝐨𝐬𝐞
> 𝐡𝐢𝐣𝐚𝐛𝐞𝐫

▣───────────▣`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 99999,
        pageCount: 100,
        fileName: `${global.namabot} - Cecan Menu`,
        caption: a,
        footer: '𝙆𝙮𝙪 𝗫 444 ☣︎',
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;

case 'randommenu': {
    const uptime = runtime(process.uptime());
    const a = `▣───⬣〔 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧 〕⬣───▣
- 𝗡𝗮𝗺𝗲 𝗕𝗼𝘁 : ${global.namabot}
- 𝗠𝗼𝗱𝗲 : ${kyu.public ? '𝗽𝘂𝗯𝗹𝗶𝗰' : '𝘀𝗲𝗹𝗳'}
- 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${global.version}
- 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptime}

▣────⬣〔 𝙍𝙖𝙣𝙙𝙤𝙢 𝙈𝙚𝙣𝙪 〕⬣────▣
> 𝐛𝐥𝐮𝐞𝐚𝐫𝐜𝐡𝐢𝐯𝐞
> 𝐥𝐨𝐥𝐢
> 𝐩𝐩𝐜𝐨𝐮𝐩𝐥𝐞
> 𝐩𝐚𝐩𝐚𝐲𝐚𝐧𝐠
> 𝐚𝐬𝐮𝐩𝐚𝐧

▣───────────▣`;

    await kyu.sendMessage(from, {
        document: menuThumb,
        mimetype: 'application/pdf',
        fileLength: 99999,
        pageCount: 100,
        fileName: `${global.namabot} - Random Menu`,
        caption: a,
        footer: '𝙆𝙮𝙪 𝗫 444 ☣︎',
        contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                serverMessageId: -1
            },
            externalAdReply: {
                showAdAttribution: true,
                title: global.namabot,
                body: `Nanaa Multi device`,
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnail: menuThumb,
                sourceUrl: global.linkSaluran
            }
        }
    }, { quoted: m });
}
break;

        case 'infobot': {
            const uptime = runtime(process.uptime());
            const used = process.memoryUsage();
            const teks = `╔══〔 ℹ️ *INFO BOT* 〕══╗

┣ 🤖 Nama Bot : ${global.namabot}
┣ 👑 Owner    : ${global.ownername}
┣ 🌐 Mode     : ${kyu.public ? 'Public' : 'Self'}
┣ 🔢 Versi    : ${global.version}
┣ ⏱️ Uptime   : ${uptime}
┗ 💾 RAM      : ${(used.heapUsed / 1024 / 1024).toFixed(1)} MB / ${(used.heapTotal / 1024 / 1024).toFixed(1)} MB

╚══════════════════╝`;
            reply(teks);
        }
        break;

        // ==================== OWNER MENU ====================
        case 'self': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            kyu.public = false;
            reply(`✅ Mode berhasil diubah ke *Self*\n\nSekarang hanya *Owner & Bot* yang bisa menggunakan bot, termasuk di grup.`);
        }
        break;

        case 'public': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            kyu.public = true;
            reply(`✅ Mode berhasil diubah ke *Public*\n\nSekarang semua orang bisa menggunakan bot.`);
        }
        break;

        case 'owner': {
            try {
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${global.ownername}\nTEL;type=CELL;type=VOICE;waid=${global.owner}:+${global.owner}\nEND:VCARD`;
                const quotedMsg = {
                    key: {
                        participant: '0@s.whatsapp.net',
                        ...(m.chat ? { remoteJid: `status@broadcast` } : {})
                    },
                    message: { locationMessage: { name: `𝙆𝙮𝙪 𝗡𝗲𝘃𝗲𝗿 𝗗𝗶𝗲`, jpegThumbnail: "" } }
                };
                await kyu.sendMessage(from, { contacts: { displayName: global.ownername, contacts: [{ vcard }] } }, { quoted: quotedMsg });
            } catch (e) {
                console.error("[owner error]", e.message);
            }
        }
        break;

        case "addprem": {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!args[0]) return reply(`❌ Format: *.addprem 62xxx*`);
            const nomPrem = q.replace(/[^0-9]/g, '') + `@s.whatsapp.net`;
            const cek = await kyu.onWhatsApp(nomPrem);
            if (!cek.length) return reply(`⚠️ Nomor tidak terdaftar di WhatsApp!`);
            if (premium.includes(nomPrem)) return reply(`⚠️ Nomor sudah premium!`);
            premium.push(nomPrem);
            savePremiumDb();
            reply(`✅ Berhasil menambahkan *${nomPrem.split('@')[0]}* sebagai premium`);
        }
        break;

        case "delprem": {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!args[0]) return reply(`❌ Format: *.delprem 62xxx*`);
            const nomDel = q.replace(/[^0-9]/g, '') + `@s.whatsapp.net`;
            const unp = premium.indexOf(nomDel);
            if (unp === -1) return reply(`⚠️ Nomor tidak ada di daftar premium!`);
            premium.splice(unp, 1);
            savePremiumDb();
            reply(`✅ Berhasil menghapus *${nomDel.split('@')[0]}* dari premium`);
        }
        break;

        case "listprem": {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            const premList = getPremiumDb();
            if (!premList.length) return reply(`📋 Belum ada user premium`);
            let listTeks = `╔══〔 💎 *DAFTAR PREMIUM* 〕══╗\n\n`;
            premList.forEach((p, i) => {
                listTeks += `${i + 1}. @${p.split('@')[0]}\n`;
            });
            listTeks += `\n╚══════════════════╝`;
            kyu.sendMessage(from, { text: listTeks, mentions: premList }, { quoted: qlive });
        }
        break;

        case "addowner": {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            let nomor;
            if (m.quoted && m.quoted.sender) {
                nomor = m.quoted.sender.split("@")[0];
            } else if (args[0]) {
                nomor = args[0].replace(/[^0-9]/g, "");
            } else {
                return reply(`❌ Format: *.addowner 62xxx*`);
            }
            const cek = await kyu.onWhatsApp(nomor + "@s.whatsapp.net");
            if (!cek.length) return reply(`⚠️ Nomor tidak terdaftar di WhatsApp`);
            const ownerList = getOwnerDb();
            if (ownerList.includes(nomor)) return reply(`⚠️ Nomor sudah menjadi owner!`);
            ownerList.push(nomor);
            saveOwnerDb();
            reply(`✅ Berhasil menambahkan *${nomor}* sebagai owner`);
        }
        break;

        case "delowner": {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            let nomor;
            if (m.quoted && m.quoted.sender) {
                nomor = m.quoted.sender.split("@")[0];
            } else if (args[0]) {
                nomor = args[0].replace(/[^0-9]/g, "");
            } else {
                return reply(`❌ Format: *.delowner 62xxx*`);
            }
            const ownerList = getOwnerDb();
            if (!ownerList.includes(nomor)) return reply(`⚠️ Nomor tidak ditemukan di database owner`);
            ownerList.splice(ownerList.indexOf(nomor), 1);
            saveOwnerDb();
            reply(`✅ Berhasil menghapus *${nomor}* dari daftar owner`);
        }
        break;

        case "listowner": {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            const ownerList = getOwnerDb();
            if (!ownerList.length) return reply(`📋 Belum ada owner yang terdaftar`);
            let listTeks = `╔══〔 👑 *DAFTAR OWNER* 〕══╗\n\n`;
            ownerList.forEach((o, i) => {
                listTeks += `${i + 1}. @${o}\n`;
            });
            listTeks += `\n╚══════════════════╝`;
            kyu.sendMessage(from, { text: listTeks, mentions: ownerList.map(v => v + "@s.whatsapp.net") }, { quoted: qlive });
        }
        break;

        case 'get': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!text) return reply(`❌ Format: *.get <url>*\n\nContoh:\n.get https://example.com/image.jpg\n.get https://example.com (source HTML)`);
            const targetUrl = text.trim();
            if (!/^https?:\/\//i.test(targetUrl)) return reply(`❌ URL tidak valid! Harus diawali https:// atau http://`);
            reply(`⏳ Mengambil data dari:\n${targetUrl}`);
            try {
                const res = await axios.get(targetUrl, {
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const contentType = res.headers['content-type'] || '';
                if (contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('application/json')) {
                    const responseText = Buffer.from(res.data).toString('utf-8');
                    const trimmed = responseText.length > 3000 ? responseText.slice(0, 3000) + '\n...(terpotong)' : responseText;
                    reply(`📄 *Source dari:* ${targetUrl}\n\n\`\`\`\n${trimmed}\n\`\`\``);
                } else {
                    const buffer = Buffer.from(res.data);
                    const detectedType = await FileType.fromBuffer(buffer);
                    const mimeType = detectedType?.mime || contentType.split(';')[0].trim();
                    const ext = detectedType?.ext || 'bin';
                    if (mimeType.startsWith('image/')) {
                        await kyu.sendMessage(from, { image: buffer }, { quoted: m });
                    } else if (mimeType.startsWith('video/')) {
                        await kyu.sendMessage(from, { video: buffer }, { quoted: m });
                    } else if (mimeType.startsWith('audio/')) {
                        await kyu.sendMessage(from, { audio: buffer, mimetype: mimeType }, { quoted: m });
                    } else {
                        await kyu.sendMessage(from, {
                            document: buffer,
                            mimetype: mimeType,
                            fileName: `file.${ext}`
                        }, { quoted: m });
                    }
                }
            } catch (e) {
                reply(`❌ *Gagal fetch!*\n\n${e.message}`);
            }
        }
        break;

        case 'install': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!text) return reply(`❌ Format: *.install <package>*\n\nContoh:\n.install axios\n.install axios cheerio`);
            const packages = text.trim().split(/\s+/);
            reply(`⏳ Menginstall: *${packages.join(', ')}*\n\nMohon tunggu...`);
            exec(`npm install ${packages.join(' ')} --save`, { timeout: 120000 }, (err, stdout, stderr) => {
                if (err) return reply(`❌ *Install gagal!*\n\n\`\`\`\n${err.message}\n\`\`\``);
                const out = (stdout || stderr || '').trim();
                const lines = out.split('\n').slice(-10).join('\n');
                reply(`✅ *Install selesai!*\n\nPackage: *${packages.join(', ')}*\n\n\`\`\`\n${lines}\n\`\`\``);
            });
        }
        break;

        // ==================== CECAN MENU ====================
        case 'indonesia':
        case 'china':
        case 'vietnam':
        case 'thailand':
        case 'korea':
        case 'japan':
        case 'malaysia':
        case 'justinaxie':
        case 'jeni':
        case 'jiso':
        case 'ryujin':
        case 'rose':
        case 'hijaber': {
            if (!isPremium && !isCreator) return reply(`❌ Fitur ini khusus *Premium!*\n\nHubungi owner: wa.me/${global.owner}`);
            const cecan = await getCecanDb();
            const list = cecan[command];
            if (!list || !Array.isArray(list)) return reply(`❌ Data untuk *${command}* tidak ditemukan di database.`);
            const url = list[Math.floor(Math.random() * list.length)];
            const labelMap = {
                indonesia: '🇮🇩 Indonesian Girl', china: '🇨🇳 Chinese Girl', vietnam: '🇻🇳 Vietnam Girl',
                thailand: '🇹🇭 Thailand Girl', korea: '🇰🇷 Korean Girl', japan: '🇯🇵 Japanese Girl',
                malaysia: '🇲🇾 Malaysian Girl', justinaxie: '✨ Justina Xie', jeni: '🖤 Jennie',
                jiso: '🌸 Jisoo', ryujin: '🔥 Ryujin', rose: '🌹 Rosé', hijaber: '🧕 Hijaber Girl'
            };
            const label = labelMap[command] || command;
            await kyu.sendMessage(from, {
                image: { url },
                caption: `👑 *${label}*\n\n> Khusus Member Premium 💎`,
                contextInfo: {
                    externalAdReply: {
                        showAdAttribution: true,
                        title: label,
                        body: global.namabot,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        thumbnail: menuThumb,
                        sourceUrl: global.linkSaluran
                    }
                }
            }, { quoted: m });
        }
        break;

        // ==================== RANDOM MENU ====================
        case 'bluearchive': {
            try {
                const res = await axios.get(`https://api.apocalypse.web.id/image/bluearchive?apikey=${global.Apocalypse?.apis || 'kyujir'}`);
                if (res.data && res.data.url) {
                    const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
                    await kyu.sendMessage(from, { image: Buffer.from(imgRes.data) }, { quoted: m });
                } else {
                    reply(`❌ Gagal mengambil gambar, coba lagi nanti.`);
                }
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'loli': {
            try {
                const res = await axios.get(`https://api.apocalypse.web.id/image/loli?apikey=${global.Apocalypse?.apis || 'kyujir'}`);
                if (res.data && res.data.url) {
                    const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
                    await kyu.sendMessage(from, { image: Buffer.from(imgRes.data) }, { quoted: m });
                } else {
                    reply(`❌ Gagal mengambil gambar, coba lagi nanti.`);
                }
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ppcouple': {
            try {
                const res = await axios.get(`https://api.deline.web.id/random/ppcouple`);
                if (res.data && res.data.status && res.data.result) {
                    const { cowo, cewe } = res.data.result;
                    const imgCowo = await axios.get(cowo, { responseType: 'arraybuffer' });
                    await kyu.sendMessage(from, { image: Buffer.from(imgCowo.data) }, { quoted: m });
                    const imgCewe = await axios.get(cewe, { responseType: 'arraybuffer' });
                    await kyu.sendMessage(from, { image: Buffer.from(imgCewe.data) }, { quoted: m });
                } else {
                    reply(`❌ Gagal mengambil PP Couple, coba lagi nanti.`);
                }
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'papayang': {
            try {
                const res = await axios.get(`https://api.kyuuimut.my.id/random/pap-ayang`);
                if (res.data && res.data.url) {
                    const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
                    await kyu.sendMessage(from, { image: Buffer.from(imgRes.data) }, { quoted: m });
                } else {
                    reply(`❌ Gagal mengambil PAP Ayang, coba lagi nanti.`);
                }
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'asupan': {
            try {
                const res = await axios.get(`https://api.kyuuimut.my.id/random/asupan`);
                if (res.data && res.data.url) {
                    const videoRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
                    await kyu.sendMessage(from, { video: Buffer.from(videoRes.data) }, { quoted: m });
                } else {
                    reply(`❌ Gagal mengambil video asupan, coba lagi nanti.`);
                }
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        // ==================== PAYMENT ====================
        case 'pay':
        case 'payment': {
            let media = await prepareWAMessageMedia({ image: { url: global.pay.qris } }, { upload: kyu.waUploadToServer });
            let msg = {
                interactiveMessage: {
                    header: {
                        title: "───「 PAYMENT 」───",
                        hasMediaAttachment: true,
                        imageMessage: media.imageMessage
                    },
                    body: {
                        text: `Silahkan pilih metode pembayaran di bawah ini.\n\n*E-Wallet:*\n• DANA  : ${global.pay.dana}\n• GOPAY : ${global.pay.gopay}\n• OVO   : ${global.pay.ovo}\n\n_Klik tombol untuk menyalin nomor._`
                    },
                    footer: {
                        text: `${global.namabot}`
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "cta_copy",
                                buttonParamsJson: JSON.stringify({ display_text: "Salin DANA", copy_code: global.pay.dana })
                            },
                            {
                                name: "cta_copy",
                                buttonParamsJson: JSON.stringify({ display_text: "Salin GOPAY", copy_code: global.pay.gopay })
                            },
                            {
                                name: "cta_copy",
                                buttonParamsJson: JSON.stringify({ display_text: "Salin OVO", copy_code: global.pay.ovo })
                            }
                        ]
                    }
                }
            };
            let message = generateWAMessageFromContent(from, {
                viewOnceMessage: { message: msg }
            }, { userJid: kyu.user.id, quoted: m });
            await kyu.relayMessage(from, message.message, { messageId: message.key.id });
        }
        break;

        // ==================== GITHUB TOOLS ====================
        case 'ghrepo':
        case 'gitrepo': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset di settings.js!`);
            const usage = `❓ *Format:*\n*.ghrepo <namaRepo> [private/public] [deskripsi]*\n\nContoh:\n.ghrepo my-bot private Bot WhatsApp keren\n.ghrepo my-project public`;
            if (!text) return reply(usage);

            const parts = text.split(' ');
            const repoName = parts[0];
            const visibility = parts[1]?.toLowerCase() === 'private' ? true : false;
            const desc = parts.slice(2).join(' ') || '';

            reply(`⏳ Membuat repo *${repoName}*...`);
            try {
                const username = await gh.getUsername(global.githubToken);
                const result = await gh.createRepo(global.githubToken, repoName, visibility, desc);
                if (!result.success) return reply(`❌ Gagal buat repo!\n\n${result.error}`);
                const d = result.data;
                reply(
                    `✅ *Repo berhasil dibuat!*\n\n` +
                    `📦 Nama   : ${d.name}\n` +
                    `👤 Owner  : ${d.owner.login}\n` +
                    `🔒 Visibel: ${d.private ? 'Private' : 'Public'}\n` +
                    `🌿 Branch : ${d.default_branch}\n` +
                    `🔗 URL    : ${d.html_url}`
                );
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ghdelete':
        case 'gitdelete': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset di settings.js!`);
            if (!text) return reply(`❓ *Format:*\n*.ghdelete <namaRepo>*\n\nContoh:\n.ghdelete my-bot`);

            const repoName = text.trim().split(' ')[0];
            reply(`⏳ Menghapus repo *${repoName}*...`);
            try {
                const username = await gh.getUsername(global.githubToken);
                const result = await gh.deleteRepo(global.githubToken, username, repoName);
                if (!result.success) return reply(`❌ Gagal hapus repo!\n\n${result.error}`);
                reply(`✅ Repo *${repoName}* berhasil dihapus!`);
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ghlist':
        case 'gitlist': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset di settings.js!`);

            const page = parseInt(args[0]) || 1;
            reply(`⏳ Mengambil daftar repo (hal. ${page})...`);
            try {
                const username = await gh.getUsername(global.githubToken);
                const result = await gh.listRepos(global.githubToken, username, page);
                if (!result.success) return reply(`❌ ${result.error}`);
                if (!result.data.length) return reply(`📋 Tidak ada repo di halaman ${page}.`);

                let teks = `╔══〔 📦 *GITHUB REPOS* 〕══╗\n`;
                teks += `👤 *${username}* | Hal. ${page}\n\n`;
                result.data.forEach((r, i) => {
                    const no = (page - 1) * 20 + i + 1;
                    teks += `${no}. *${r.name}*\n`;
                    teks += `   ${r.private ? '🔒 Private' : '🌐 Public'} | ⭐ ${r.stargazers_count} | 🍴 ${r.forks_count}\n`;
                    if (r.description) teks += `   📝 ${r.description.slice(0, 50)}${r.description.length > 50 ? '...' : ''}\n`;
                    teks += '\n';
                });
                teks += `╚══════════════════╝\n`;
                teks += `_Hal. berikutnya: *.ghlist ${page + 1}*_`;
                reply(teks);
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ghinfo':
        case 'gitinfo': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset di settings.js!`);
            if (!text) return reply(`❓ *Format:*\n*.ghinfo <namaRepo>*\n\nContoh:\n.ghinfo my-bot`);

            const repoName = text.trim().split(' ')[0];
            reply(`⏳ Mengambil info repo *${repoName}*...`);
            try {
                const username = await gh.getUsername(global.githubToken);
                const result = await gh.getRepoInfo(global.githubToken, username, repoName);
                if (!result.success) return reply(`❌ ${result.error}`);
                const d = result.data;
                const updatedAt = new Date(d.updated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                const createdAt = new Date(d.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                reply(
                    `╔══〔 📦 *REPO INFO* 〕══╗\n\n` +
                    `📛 Nama       : ${d.name}\n` +
                    `👤 Owner      : ${d.owner.login}\n` +
                    `🔒 Visibel    : ${d.private ? 'Private' : 'Public'}\n` +
                    `📝 Deskripsi  : ${d.description || '-'}\n` +
                    `💻 Bahasa     : ${d.language || '-'}\n` +
                    `⭐ Stars      : ${d.stargazers_count}\n` +
                    `🍴 Forks      : ${d.forks_count}\n` +
                    `👁️ Watchers   : ${d.watchers_count}\n` +
                    `🔗 Issues     : ${d.open_issues_count}\n` +
                    `🌿 Branch     : ${d.default_branch}\n` +
                    `📅 Dibuat     : ${createdAt}\n` +
                    `🔄 Diupdate   : ${updatedAt}\n` +
                    `🔗 URL        : ${d.html_url}\n\n` +
                    `╚══════════════════╝`
                );
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ghrelease':
        case 'gitrelease': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset di settings.js!`);
            const usage = `❓ *Format:*\n*.ghrelease <repo> <tag> <nama release> [deskripsi]*\n\nContoh:\n.ghrelease my-bot v1.0.0 Release Pertama Ini rilis pertama bot`;
            if (!text) return reply(usage);

            const parts = text.split(' ');
            if (parts.length < 3) return reply(usage);
            const [repoName, tagName, ...rest] = parts;
            const releaseName = rest[0] ? rest.slice(0, 2).join(' ') : tagName;
            const releaseBody = rest.slice(2).join(' ') || '';

            reply(`⏳ Membuat release *${tagName}* di *${repoName}*...`);
            try {
                const username = await gh.getUsername(global.githubToken);
                const result = await gh.createRelease(global.githubToken, username, repoName, tagName, releaseName, releaseBody);
                if (!result.success) return reply(`❌ Gagal buat release!\n\n${result.error}`);
                const d = result.data;
                reply(
                    `✅ *Release berhasil dibuat!*\n\n` +
                    `📦 Repo    : ${repoName}\n` +
                    `🏷️ Tag     : ${d.tag_name}\n` +
                    `📝 Nama    : ${d.name}\n` +
                    `🔗 URL     : ${d.html_url}\n\n` +
                    `_Untuk upload asset ke release ini:_\n` +
                    `*.ghupload ${repoName} ${d.id} <kirim file>*`
                );
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ghupload':
        case 'gitupload': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset!`);

            const usage = `❓ *Format:*\n*.ghupload <repo>*\n\nContoh: .ghupload my-bot`;
            if (!text) return reply(usage);

            const repoName = text.trim();
            const quoted = m.quoted ? m.quoted : m;
            if (!m.quoted) return reply(`❌ Quote file ZIP yang mau diupload!`);

            const fileName = quoted.filename || quoted.msg?.filename || `file_${Date.now()}.zip`;
            
            try {
                const username = await gh.getUsername(global.githubToken);
                const tmpPath = `./tmp_${Date.now()}.zip`;
                const savedPath = await kyu.downloadAndSaveMediaMessage(quoted, tmpPath);

                if (!fileName.endsWith('.zip')) {
                    reply(`⏳ Mengunggah file tunggal ke *${repoName}*...`);
                    await gh.pushFileToRepo(global.githubToken, username, repoName, savedPath, `Upload: ${fileName}`, fileName, 'main');
                    if (fs.existsSync(savedPath)) fs.unlinkSync(savedPath);
                    return reply(`✅ Berhasil upload file tunggal.`);
                }

                reply(`⏳ Mengekstrak ZIP & Mengunggah source code ke *${repoName}*...`);
                const unzipper = require('unzipper');
                
                const directory = await unzipper.Open.file(savedPath);
                
                for (const file of directory.files) {
                    if (file.type === 'File') {
                        const content = await file.buffer();
                        const tempFile = `./tmp_file_${Date.now()}`;
                        fs.writeFileSync(tempFile, content);

                        await gh.pushFileToRepo(
                            global.githubToken,
                            username,
                            repoName,
                            tempFile,
                            `Auto extract: ${file.path}`,
                            file.path,
                            'main'
                        );
                        
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    }
                }

                if (fs.existsSync(savedPath)) fs.unlinkSync(savedPath);

                reply(`✅ *Source Berhasil Diekstrak ke GitHub!*\n\n📂 *Repo:* https://github.com/${username}/${repoName}\n🚀 Semua file ZIP sudah masuk sebagai folder/file.`);

            } catch (e) {
                console.error(e);
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        case 'ghpush':
        case 'gitpush': {
            if (!isCreator) return reply(`❌ Kamu bukan owner!`);
            if (!global.githubToken) return reply(`❌ *githubToken* belum diset di settings.js!`);
            const usage = `❓ *Format:*\n*.ghpush <repo> <pathTarget> [pesan commit]*\n_(Quote file yang mau di-push)_\n\nContoh:\n.ghpush my-bot plugins/fun.js update fun plugin\n.ghpush my-bot backup/bot.zip Upload backup`;
            if (!text) return reply(usage);

            const parts = text.split(' ');
            if (parts.length < 2) return reply(usage);
            const repoName = parts[0];
            const targetPath = parts[1];
            const commitMsg = parts.slice(2).join(' ') || `Upload ${targetPath} via KyuuBot`;

            if (!m.quoted || !m.quoted.msg) return reply(`❌ Quote file/dokumen dulu yang mau di-push!\n\n${usage}`);

            reply(`⏳ Mendownload file...`);
            try {
                const username = await gh.getUsername(global.githubToken);
                const tmpPath = `./tmp_ghpush_${Date.now()}`;
                const savedPath = await kyu.downloadAndSaveMediaMessage(m.quoted, tmpPath);

                reply(`⏳ Push file ke *${username}/${repoName}/${targetPath}*...`);
                const result = await gh.pushFileToRepo(global.githubToken, username, repoName, savedPath, commitMsg, targetPath);
                fs.unlinkSync(savedPath);

                if (!result.success) return reply(`❌ Gagal push file!\n\n${result.error}`);
                reply(
                    `✅ *File berhasil di-push!*\n\n` +
                    `📦 Repo   : ${repoName}\n` +
                    `📁 Path   : ${targetPath}\n` +
                    `💬 Commit : ${commitMsg}\n` +
                    `🔗 URL    : https://github.com/${username}/${repoName}/blob/main/${targetPath}`
                );
            } catch (e) {
                reply(`❌ Error: ${e.message}`);
            }
        }
        break;

        default: {
            if (["tes", "bot"].includes(budy)) {
                reply(`𝙆𝙮𝙪𝙪 𝗫 𝗕𝗼𝘁𝘇 🚀`);
            }
            if (["Assalamualaikum", "assalamualaikum", "Assalamu'alaikum"].includes(budy)) {
                reply(`𝘄𝗮𝗮𝗹𝗮𝗶𝗸𝘂𝗺 𝘀𝗮𝗹𝗮𝗺 ${pushname}`);
            }
            if (budy.startsWith('=>')) {
                if (!isCreator) return;
                try {
                    const hasil = await eval(`(async () => { return ${budy.slice(3)} })()`);
                    reply(util.inspect(hasil, { depth: 4 }));
                } catch (e) {
                    reply(`❌ ${String(e)}`);
                }
            }
            if (budy.startsWith('>')) {
                if (!isCreator) return;
                try {
                    let evaled = await eval(budy.slice(2));
                    reply(util.inspect(evaled, { depth: 4 }));
                } catch (err) {
                    reply(`❌ ${String(err)}`);
                }
            }
            if (budy.startsWith('$')) {
                if (!isCreator) return;
                const cmd = budy.slice(1).trim();
                exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
                    if (err) return reply(`❌ *Error*\n\n${err.message}`);
                    const out = (stdout || stderr || '(no output)').trim();
                    reply(`\`\`\`\n${out}\n\`\`\``);
                });
            }
        }
        }
    } catch (err) {
        console.log(chalk.red('[case.js error]'), util.format(err));
    }
};

const file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});