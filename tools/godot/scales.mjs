import {godotBinary,run} from './runtime.mjs';
await run(godotBinary(),['--headless','--path','godot','--editor','--import','--quit']);
await run(godotBinary(),[...(process.argv.includes('--headless')?['--headless']:[]),'--path','godot','--script','res://tests/scale_audit.gd','--','--test-mode',...process.argv.slice(2)]);
