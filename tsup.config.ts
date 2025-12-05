// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'], // The entry point of the library.
	format: ['cjs', 'esm'], // The formats to build.
	dts: true, // Generates .d.ts declaration files for TypeScript support.
	splitting: false, // Prevents tsup from splitting up the library code into multiple chunks.
	sourcemap: true, // Easier debugging
	clean: true, // Cleans the output directory before each build
});
