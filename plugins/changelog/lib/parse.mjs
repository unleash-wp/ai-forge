// The WordPress commit parser moved to Core (src/lib/wp-parse.mjs) so every plugin
// shares one implementation. Re-exported here so this plugin's imports are unchanged.
export { parseCommit } from '../../../src/lib/wp-parse.mjs';
