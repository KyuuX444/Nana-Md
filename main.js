const chalk = require('chalk');
const fs = require('fs');
const { startSesi } = require('./lib/connect');

startSesi().catch((err) => {
    console.error(chalk.red('[FATAL]'), err);
    process.exit(1);
});

const file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});
