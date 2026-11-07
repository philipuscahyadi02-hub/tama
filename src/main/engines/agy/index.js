// @ts-check
// agy (Antigravity CLI) engine: public surface (QC-1).
module.exports = {
  get AgyEngine() { return require('./session').AgyEngine; },
  get findAgyExecutable() { return require('./setup').findAgyExecutable; },
  get CHAT_ALLOW() { return require('./setup').CHAT_ALLOW; },
  get DENY_ALL() { return require('./setup').DENY_ALL; },
  get CLI_DIR_NAME() { return require('./setup').CLI_DIR_NAME; },
  get agyProvider() { return require('./provider').agyProvider; },
};
