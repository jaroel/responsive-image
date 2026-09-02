<script lang="ts">
	import {
		env,
		isResponsiveLayout as isResponsiveLayoutCore,
		resolveClassNames,
		resolveHeight,
		resolveSources,
		resolveSrc,
		resolveStyles,
		resolveWidth,
		sourcesSorted as sortSources,
		type ImageData,
		type ImageSource
	} from '@responsive-image/core';

	import type { HTMLImgAttributes } from 'svelte/elements';

	const {
		src: srcProp,
		size: sizeProp,
		sizes: sizesProp,
		width: widthProp,
		height: heightProp,
		class: classProp,
		...htmlAttributes
	}: ResponsiveImageProps = $props();

	interface ResponsiveImageArgs {
		src: ImageData;
		size?: number;
		sizes?: string;
		width?: number;
		height?: number;
	}

	type ResponsiveImageProps = Omit<HTMLImgAttributes, 'src'> & ResponsiveImageArgs;

	let loadedSrc = $state<ImageData | undefined>(undefined);
	const isLoaded = $derived(loadedSrc === srcProp);

	const isResponsiveLayout = $derived(isResponsiveLayoutCore(widthProp, heightProp));

	const width: number | undefined = $derived.by(() =>
		resolveWidth({
			width: widthProp,
			height: heightProp,
			aspectRatio: srcProp.aspectRatio,
			deviceWidths: env.deviceWidths,
			responsive: isResponsiveLayout
		})
	);

	const height: number | undefined = $derived.by(() =>
		resolveHeight({
			height: heightProp,
			aspectRatio: srcProp.aspectRatio,
			width
		})
	);

	const src = $derived.by(() => resolveSrc({ src: srcProp, width }));

	const sources: ImageSource[] = $derived.by(() =>
		resolveSources({
			src: srcProp,
			width,
			sizes: sizesProp,
			size: sizeProp,
			deviceWidths: env.deviceWidths,
			responsive: isResponsiveLayout
		})
	);

	const sourcesSorted = $derived(sortSources(sources));

	const classNames = $derived.by(() =>
		resolveClassNames({
			src: srcProp,
			isLoaded,
			responsive: isResponsiveLayout,
			customClass: classProp as string
		})
	);

	const styles = $derived.by(
		() => resolveStyles(srcProp, isLoaded, typeof document === 'undefined') ?? {}
	);

	const checkAlreadyLoaded = (el: HTMLImageElement) => {
		if (el.complete) {
			loadedSrc = srcProp;
		}
	};

	// Geez, no primitive in Svelte for applying styles from an object! See https://github.com/sveltejs/svelte/issues/7311
	const applyStyles = (el: HTMLImageElement) => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const existingStyles: Set<string> = new Set();

		$effect(() => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const rulesToRemove: Set<string> = new Set(existingStyles);
			existingStyles.clear();
			for (const [cssProperty, value] of Object.entries(styles)) {
				if (value !== undefined) {
					el.style.setProperty(cssProperty, value);
					rulesToRemove.delete(cssProperty);
					existingStyles.add(cssProperty);
				}
			}

			rulesToRemove.forEach((rule) => el.style.removeProperty(rule));
		});
	};
</script>

{#if srcProp.imageTypes === 'auto'}
	{#key srcProp.lqip && srcProp}
		<img
			{width}
			{height}
			loading="lazy"
			decoding="async"
			srcset={sourcesSorted[0]?.srcset}
			{src}
			alt=""
			class={classNames.join(' ')}
			{...htmlAttributes}
			data-ri-lqip={srcProp.lqip?.attribute}
			use:checkAlreadyLoaded
			use:applyStyles
			onload={() => (loadedSrc = srcProp)}
		/>
	{/key}
{:else}
	<picture>
		{#each sourcesSorted as s (s.mimeType)}
			<source srcset={s.srcset} type={s.mimeType} sizes={s.sizes} />
		{/each}
		{#key srcProp.lqip && srcProp}
			<img
				{width}
				{height}
				loading="lazy"
				decoding="async"
				{src}
				alt=""
				class={classNames.join(' ')}
				{...htmlAttributes}
				data-ri-lqip={srcProp.lqip?.attribute}
				use:checkAlreadyLoaded
				use:applyStyles
				onload={() => (loadedSrc = srcProp)}
			/>
		{/key}
	</picture>
{/if}

<style>
	.ri-img {
		background-size: cover;
	}

	.ri-responsive {
		width: 100%;
		height: auto;
	}

	.ri-fixed,
	.ri-responsive {
		content-visibility: auto;
	}
</style>
