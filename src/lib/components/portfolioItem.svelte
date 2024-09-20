<script lang="ts">
	import { type Picture } from 'imagetools-core';

	const props: {
		image: Picture;
		title: string;
		description: string;
		tags: string[];
	} = $props();
</script>

<div class="item absolute inset-0 flex flex-col items-center justify-center">
	<enhanced:img src={props.image} alt="" class="w-[400px]" sizes="1000px" />
	<br />
	<h2 class="text-5xl">{props.title}</h2>
	<p>{props.description}</p>
	<div class="flex gap-2">
		{#each props.tags as tag}
			<div class="border px-1 leading-4">{tag}</div>
		{/each}
	</div>
</div>
