import {godotBinary,run} from './runtime.mjs';
await run(godotBinary(),['--headless','--path','godot','--editor','--import','--quit']);
await run(godotBinary(),['--path','godot','--script','res://tests/gallery.gd','--',...process.argv.slice(2)]);
