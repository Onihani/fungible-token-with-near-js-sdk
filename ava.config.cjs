require('util').inspect.defaultOptions.depth = 5; // Increase AVA's printing depth

module.exports = {
  timeout: '30000', // 30 seconds (default is 10 seconds)
  files: ['sandbox-ts/*.ava.ts'],
  failWithoutAssertions: false,
  extensions: {
		js: true,
		ts: 'module'
	},
  require: ['ts-node/register', 'near-workspaces'],
  "nodeArguments": [
		"--import=tsimp"
	]
};