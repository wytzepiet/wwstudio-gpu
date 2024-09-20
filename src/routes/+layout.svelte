<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	import { initScrollSmooth } from '$lib/utils/scrollSmooth';
	import gsap from 'gsap';
	import SplitText from 'gsap/dist/SplitText';
	import { queryFirst, timeout } from '$lib/utils/generalUtils';

	const props = $props();

	onMount(() => {
		window.scrollTo(0, 0);
		document.body.style.overflow = 'hidden';
		timeout(2000).then(() => (document.body.style.overflow = 'auto'));
		initScrollSmooth();

		queryFirst('#smooth-content')!.style.opacity = '1';

		gsap.registerPlugin(SplitText);

		gsap.from(new SplitText('.nav', { type: 'chars' }).chars, {
			duration: 1,
			delay: 2,
			y: '100%',
			clipPath: 'inset(0 0 100% 0)',
			ease: 'power4.out',
			stagger: { each: 0.01 }
		});
	});
</script>

<nav
	class="nav fixed z-30 w-full flex justify-between p-4 text-sm uppercase text-white tracking-widest"
>
	<h2 class="">Wytze Sligting</h2>
	<div>
		<p>+ Home</p>
		<p>Projects</p>
		<p>About</p>
	</div>
	<h2 class="">Let's talk</h2>
</nav>
<div id="smooth-wrapper">
	<div id="smooth-content" class="opacity-0">
		{@render props.children()}
	</div>
</div>
