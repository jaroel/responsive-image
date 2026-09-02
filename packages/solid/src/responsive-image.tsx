import {
  env,
  isResponsiveLayout,
  resolveClassNames,
  resolveHeight,
  resolveSources,
  resolveSrc,
  resolveStyles,
  resolveWidth,
  sourcesSorted as sortSources,
  type ImageData,
} from '@responsive-image/core';
import { createSignal, type JSX, onMount, Show, splitProps } from 'solid-js';
import { isServer } from 'solid-js/web';

import './responsive-image.css';

import type { Component } from 'solid-js';

export interface ResponsiveImageArgs {
  src: ImageData;
  size?: number;
  sizes?: string;
  width?: number;
  height?: number;
}

const responsiveImageArgs: Array<keyof ResponsiveImageArgs | 'class'> = [
  'class',
  'src',
  'size',
  'sizes',
  'width',
  'height',
];

export type ResponsiveImageProps = Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  'src'
> &
  ResponsiveImageArgs;

export const ResponsiveImage: Component<ResponsiveImageProps> = (props) => {
  const [loadedSrc, setLoaded] = createSignal<ImageData | undefined>(undefined);
  const [args, attributes] = splitProps(props, responsiveImageArgs);
  const isLoaded = () => loadedSrc() === args.src;

  const responsive = () => isResponsiveLayout(args.width, args.height);

  const width = () =>
    resolveWidth({
      width: args.width,
      height: args.height,
      aspectRatio: args.src.aspectRatio,
      deviceWidths: env.deviceWidths,
      responsive: responsive(),
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
      responsive: responsive(),
    });

  const sourcesSorted = () => sortSources(sources());

  const classNames = () =>
    resolveClassNames({
      src: args.src,
      isLoaded: isLoaded(),
      responsive: responsive(),
      customClass: args.class,
    });

  const styles = () => resolveStyles(args.src, isLoaded(), isServer);

  // check if src is already loaded (SSR) and update state so LQIP options are removed
  // eslint-disable-next-line no-unassigned-vars --  false positive
  let imgEl: HTMLImageElement | undefined;
  onMount(() => {
    if (imgEl?.complete) {
      setLoaded(args.src);
    }
  });

  const img = (
    // When LQIP is used, the key is our src, so when src changes, the img element is recreated to re-apply LQIP styles without having
    // the previous src visible (<img> is a stateful element!). Without LQIP, reuse existing DOM.
    // See also https://github.com/simonihmig/responsive-image/issues/1583#issuecomment-3315142391
    <Show when={args.src} keyed={!!args.src.lqip as false}>
      <img
        width={width()}
        height={height()}
        class={classNames().join(' ')}
        loading="lazy"
        decoding="async"
        srcSet={
          args.src.imageTypes === 'auto'
            ? // auto format assumes only one entry in sources
              sources()[0]?.srcset
            : undefined
        }
        src={src()}
        {...attributes}
        data-ri-lqip={args.src.lqip?.attribute}
        style={styles()}
        ref={imgEl}
        on:load={() => setLoaded(args.src)}
      />
    </Show>
  );

  if (args.src.imageTypes === 'auto') {
    return img;
  }

  return (
    <picture>
      {sourcesSorted().map((s) => (
        <source srcset={s.srcset} type={s.mimeType} sizes={s.sizes} />
      ))}
      {img}
    </picture>
  );
};
