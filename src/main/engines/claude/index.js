// @ts-check
// Claude engine: public surface (QC-1). Getters keep it lazy, so importing limits doesn't load the Agent SDK.
module.exports = {
  get ClaudeCodeEngine() { return require('./session').ClaudeCodeEngine; },
  get claudeExe() { return require('./find-exe').claudeExe; },
  get recheckClaude() { return require('./find-exe').recheckClaude; },
  get askJson() { return require('./oneshot').askJson; },
  get fetchClaudeLimits() { return require('./limits').fetchClaudeLimits; },
  get fromRateLimitEvent() { return require('./limits').fromRateLimitEvent; },
  get claudeProvider() { return require('./provider').claudeProvider; },
};
