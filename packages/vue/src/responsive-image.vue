<script setup lang="ts">
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
} from '@responsive-image/core';
import { computed, onMounted, ref, shallowRef, useTemplateRef } from 'vue';

import type { ImgHTMLAttributes } from 'vue';

interface ResponsiveImageArgs extends /* @vue-ignore */ Omit<
  ImgHTMLAttributes,
  'src'
> {
  src: ImageData;
  /**
   * The [sizes attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#sizes) for `img`.
   */
  sizes?: string | undefined;
  /**
   * The [height attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#height) for `img`.
   */
  height?: number | undefined;
  /**
   * The [width attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#width) for `img`.
   */
  width?: number | undefined;
  /**
   * Number of vw units to use for responsive layout.
   */
  size?: number | undefined;
}

const args = defineProps<ResponsiveImageArgs>();
defineOptions({
  inheritAttrs: false,
});

const loadedSrc = shallowRef<ImageData | undefined>();

const isLoaded = () => loadedSrc.value === args.src;

const isResponsiveLayout = () =>
  isResponsiveLayoutCore(args.width, args.height);

const width = () =>
  resolveWidth({
    width: args.width,
    height: args.height,
    aspectRatio: args.src.aspectRatio,
    deviceWidths: env.deviceWidths,
    responsive: isResponsiveLayout(),
  });

const height = () =>
  resolveHeight({
    height: args.height,
    aspectRatio: args.src.aspectRatio,
    width: width(),
  });

const src = () => resolveSrc({ src: args.src, width: width() });

const sources = () =>
  resolveSources({
    src: args.src,
    width: width(),
    sizes: args.sizes,
    size: args.size,
    deviceWidths: env.deviceWidths,
    responsive: isResponsiveLayout(),
  });

const sourcesSorted = () => sortSources(sources());

const classNames = () =>
  resolveClassNames({
    src: args.src,
    isLoaded: isLoaded(),
    responsive: isResponsiveLayout(),
    customClass: undefined,
  });

const styles = computed(() =>
  resolveStyles(
    args.src,
    isLoaded(),
    !mounted.value || typeof document === 'undefined',
  ),
);

let keyCounter = 0;
const keyMap = new WeakMap<ImageData, number>();

// When LQIP is used, we need to use a key, so when src changes, the img element is recreated to re-apply LQIP styles without having
// the previous src visible (<img> is a stateful element!). Without LQIP, reuse existing DOM.
// See also https://github.com/simonihmig/responsive-image/issues/1583#issuecomment-3315142391
// Ideally, we would just use src as the key, but Vue only allows for simple values (numbers or strings) as key, so we need to use
// a mapping of src to generated primitive keys, that ensures that we get the same key for the same src
const key = () => {
  let key: number | undefined;

  if (args.src.lqip) {
    key = keyMap.get(args.src);

    if (key === undefined) {
      key = keyCounter++;
      keyMap.set(args.src, key);
    }
  }
  return key;
};

const imgEl = useTemplateRef<HTMLImageElement>('imgEl');
const mounted = ref(false);
onMounted(() => {
  if (imgEl.value?.complete) {
    loadedSrc.value = args.src;
  }
  // Triggering mounted will render inline LQIP styles which we don't want in SSR output.
  // Need to delay this here to not cause Vue SSR mismatch errors.
  setTimeout(() => (mounted.value = true), 0);
});
</script>
<template>
  <img
    v-if="args.src.imageTypes === 'auto'"
    :key="key()"
    ref="imgEl"
    :width="width()"
    :height="height()"
    :class="classNames()"
    loading="lazy"
    decoding="async"
    :srcSet="args.src.imageTypes === 'auto' ? sources()[0]?.srcset : undefined"
    :src="src()"
    :data-ri-lqip="args.src.lqip?.attribute"
    :style="styles"
    v-bind="$attrs"
    @load="loadedSrc = args.src"
  />
  <picture v-else>
    <source
      v-for="{ srcset, mimeType, sizes } in sourcesSorted()"
      :key="mimeType"
      :srcset="srcset"
      :type="mimeType"
      :sizes="sizes"
    />
    <img
      :key="key()"
      ref="imgEl"
      :width="width()"
      :height="height()"
      :class="classNames()"
      loading="lazy"
      decoding="async"
      :srcSet="
        typeof args.src.imageTypes === 'string' &&
        args.src.imageTypes === 'auto'
          ? sources()[0]?.srcset
          : undefined
      "
      :src="src()"
      :data-ri-lqip="args.src.lqip?.attribute"
      :style="styles"
      v-bind="$attrs"
      @load="loadedSrc = args.src"
    />
  </picture>
</template>

<style scoped>
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
