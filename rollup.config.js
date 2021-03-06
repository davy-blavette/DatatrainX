import resolve from '@rollup/plugin-node-resolve';
import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';

import { terser } from 'rollup-plugin-terser';
import rollup_start_dev from './rollup_start_dev';
import replace from '@rollup/plugin-replace';
import json from "@rollup/plugin-json";
import css from "rollup-plugin-css-only";

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'public/bundle.js'
	},
	plugins: [
		json(),
		css({ output: 'bundle.css' }),
		svelte({}),

        replace({
			preventAssignment: true,
			PUBLIC_URL: production ? '' : ''}),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/rollup-plugin-commonjs
		resolve({
			browser: true,
			dedupe: importee => importee === 'svelte' || importee.startsWith('svelte/')
		}),
		commonjs(),

		// In dev mode, call `npm run start:dev` once
		// the bundle has been generated
		!production && rollup_start_dev,

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		//!production && livereload('public'),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser()
	],
	watch: {
		clearScreen: false
	}
};
