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
import { isServer, type JSX } from '@solidjs/web';
import { createSignal, omit, onSettled, Show } from 'solid-js';

import './responsive-image.css';

import type { Component } from 'solid-js';

export interface ResponsiveImageArgs {
  src: ImageData;
  size?: number;
  sizes?: string;
  width?: number;
  height?: number;
}

const responsiveImageArgs = [
  'class',
  'src',
  'size',
  'sizes',
  'width',
  'height',
] as const;

export type ResponsiveImageProps = Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  'src'
> &
  ResponsiveImageArgs;

export const ResponsiveImage: Component<ResponsiveImageProps> = (props) => {
  const [loadedSrc, setLoaded] = createSignal<ImageData | undefined>(undefined);
  const attributes = omit(props, ...responsiveImageArgs);
  const isLoaded = () => loadedSrc() === props.src;

  const responsive = () => isResponsiveLayout(props.width, props.height);

  const width = () =>
    resolveWidth({
      width: props.width,
      height: props.height,
      aspectRatio: props.src.aspectRatio,
      deviceWidths: env.deviceWidths,
      responsive: responsive(),
    });

  const height = () =>
    resolveHeight({
      height: props.height,
      aspectRatio: props.src.aspectRatio,
      width: width(),
    });

  const imgSrc = () => resolveSrc({ src: props.src, width: width() });

  const sources = () =>
    resolveSources({
      src: props.src,
      width: width(),
      sizes: props.sizes,
      size: props.size,
      deviceWidths: env.deviceWidths,
      responsive: responsive(),
    });

  const sourcesSorted = () => sortSources(sources());

  const classNames = () =>
    resolveClassNames({
      src: props.src,
      isLoaded: isLoaded(),
      responsive: responsive(),
      customClass: props['class'] as string,
    });

  const styles = () => resolveStyles(props.src, isLoaded(), isServer);

  // check if src is already loaded (SSR) and update state so LQIP options are removed
  // eslint-disable-next-line no-unassigned-vars --  false positive
  let imgEl: HTMLImageElement | undefined;
  onSettled(() => {
    if (imgEl?.complete) {
      setLoaded(props.src);
    }
  });

  const img = (
    // When LQIP is used, the key is our src, so when src changes, the img element is recreated to re-apply LQIP styles without having
    // the previous src visible (<img> is a stateful element!). Without LQIP, reuse existing DOM.
    // See also https://github.com/simonihmig/responsive-image/issues/1583#issuecomment-3315142391
    <Show when={props.src} keyed={!!props.src.lqip as false}>
      <img
        width={width()}
        height={height()}
        class={classNames().join(' ')}
        loading="lazy"
        decoding="async"
        srcset={
          props.src.imageTypes === 'auto'
            ? // auto format assumes only one entry in sources
              sources()[0]?.srcset
            : undefined
        }
        src={imgSrc()}
        {...attributes}
        data-ri-lqip={props.src.lqip?.attribute}
        style={styles()}
        ref={imgEl}
        // Solid v2: on:load → onLoad (native listener for non-delegated load event)
        onLoad={() => setLoaded(props.src)}
      />
    </Show>
  );

  if (props.src.imageTypes === 'auto') {
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
