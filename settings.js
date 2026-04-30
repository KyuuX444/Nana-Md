const fs = require('fs');
const chalk = require('chalk');

global.owner = "6285881530884";
global.nomerBot = "62895429174872";
global.ownername = '𝗞𝘆𝘂 ☣︎';
global.namabot = '𝗞𝘆𝘂 𝗫 𝗡𝗮𝗻𝗮';
global.version = "𝟭.𝟬.𝟬";
global.githubToken = ''; // token GitHub kamu
global.linkSaluran = "https://whatsapp.com/channel/0029Vb7gcbuLdQelWzrTzD3D";
global.idSaluran = "120363407145383686@newsletter";
global.namaSaluran = "𝗙𝗼𝗹𝗹𝗼𝘄 𝗠𝘆 𝗖𝗵𝗮𝗻𝗻𝗲𝗹";
global.custompairing = "kyuunana";
global.Apocalypse = {
    apis: "kyujir"
}

global.pay = {
    qris: "https://img2.pixhost.to/images/7553/720613210_xlyy-sera-assistant.jpg",
    dana: "6283150850721",
    gopay: "6283150850721",
    ovo: "6283150850721"
};

global.imagethumb = "https://tmpfiles.org/dl/29673652/tmp.jpg";

const file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});
