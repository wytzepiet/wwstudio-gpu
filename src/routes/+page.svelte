<script>
	import WebGlCanvas from '$lib/components/webGLCanvas.svelte';
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { SplitText } from 'gsap/dist/SplitText';
	import ScrollTrigger from 'gsap/dist/ScrollTrigger';
	import { query } from '$lib/utils/generalUtils';
	import PortfolioItem from '$lib/components/portfolioItem.svelte';

	import Luca from '../lib/images/luca.png?enhanced';
	import Suiker from '$lib/images/suiker.jpg?enhanced';
	import Podwalk from '$lib/images/podwalk.jpg?enhanced';
	import Prins from '$lib/images/prins.png?enhanced';
	import CatchControl from '$lib/images/catchcontrol.webp?enhanced';

	onMount(() => {
		gsap.registerPlugin(SplitText, ScrollTrigger);

		ScrollTrigger.create({
			trigger: '.canvas',
			start: 'top top',
			end: document.body.scrollHeight,
			pin: true
		});

		gsap.to('.home-title', {
			scale: 2,
			opacity: 0,
			pointerEvents: 'none',
			ease: 'linear',
			scrollTrigger: { trigger: '.home-title-wrapper', end: '300px', pin: true, scrub: 0 }
		});
		gsap.from('.home-title h1', { duration: 5, delay: 1.5, ease: 'power4.out', scale: 0.7 });
		gsap.from('.home-title h1', { duration: 5, delay: 1.5, opacity: 0 });

		const ScrollTlItems = query('.scroll-timeline .item');
		const ScrollTl = gsap.timeline({
			scrollTrigger: {
				trigger: '.scroll-timeline',
				start: 'center center',
				end: `+=${ScrollTlItems.length * 400}px`,
				pin: true,
				scrub: 0
			}
		});
		ScrollTlItems.forEach((item, i) => {
			ScrollTl.from(item, { duration: 1, translateZ: -60, ease: 'linear' });
			ScrollTl.from(item, { duration: 0.5, opacity: 0, ease: 'linear' }, '<');
			if (i === ScrollTlItems.length - 1) return;
			ScrollTl.to(item, { duration: 1, translateZ: 60, ease: 'linear' })
				.to(item, { duration: 0.5, opacity: 0, ease: 'linear' }, '<+0.5')
				.to(item, { duration: 0.0001, pointerEvents: 'none' });
		});
	});
</script>

<div class="pointer-events-none">
	<div class="canvas absolute top-0 z-20">
		<WebGlCanvas delay={500} />
	</div>
</div>

<div class="home-title-wrapper h-screen w-full top-0 z-30">
	<div
		class="home-title absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/75 via-transparent"
	>
		<h1 class="text-7xl h-full flex flex-col justify-end">
			<div>Dream it,</div>
			<div>I'll build it.</div>
		</h1>
	</div>
</div>

<div class="h-[200px]"></div>
<div
	class="scroll-timeline relative w-full h-screen"
	style="perspective: 100px; transform-style: preserve-3d;"
>
	<div class="item absolute inset-0 text-xl text-center flex flex-col items-center justify-center">
		<enhanced:img src="$lib/images/me.jpeg?w=500" alt="" class="w-32" />
		<br />
		<p>Hey there! I'm Wytze.</p>
		<p>A freelance computer nerd</p>
		<p>with an eye for design. I love</p>
		<p>to make an idea come to life.</p>
		<!-- <p>Send me an email.</p>
		<p>I'll be friendly!</p>
		<a href="/" class="underline">info@wytze.dev</a> -->
	</div>

	<div class="item absolute inset-0 flex items-center justify-center">
		<h1 class="text-9xl uppercase grid grid-cols-2 text-center">
			<div class="m-[-0.8rem]">w</div>
			<div class="m-[-0.8rem]">o</div>
			<div class="m-[-0.8rem]">r</div>
			<div class="m-[-0.8rem]">k</div>
		</h1>
	</div>

	<PortfolioItem
		image={Luca}
		title="Snakken naar Tichelaar"
		description="A rebellious exhibition about ceramics"
		tags={['Graphic design']}
	/>
	<PortfolioItem
		image={Suiker}
		title="Nationaal Suikerbietenarchief"
		description="An arhcive website about the history of Dutch sugar industry"
		tags={['Web design']}
	/>
	<PortfolioItem
		image={Podwalk}
		title="Podwalk"
		description="A historical GPS guided audiotour"
		tags={['Web design', 'App design']}
	/>
	<PortfolioItem
		image={Prins}
		title="Café de Prins"
		description="Revamping an iconic café and hotel"
		tags={['Web design', 'Graphic design']}
	/>
	<PortfolioItem
		image={CatchControl}
		title="Catch Control"
		description="A monitoring app for nature enthousiasts"
		tags={['App design']}
	/>
</div>

<style>
</style>
