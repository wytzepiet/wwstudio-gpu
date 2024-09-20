/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				hero: ['Hero', 'sans-serif'],
				archive: ['Archive', 'sans-serif'],
				stannum: ['Stannum', 'sans-serif'],
				moneta: ['Moneta', 'sans-serif']
			}
		}
	},
	plugins: []
};
