import {
  env,
  isResponsiveLayout,
  resolveClassNames,
  resolveHeight,
  resolveSources,
  resolveSrc,
  resolveStyles,
  resolveWidth,
  sourcesSorted,
  type ImageData,
} from '@responsive-image/core';
import React, { useState, useRef, useEffect } from 'react';

export type ResponsiveImageLayout = 'responsive' | 'fixed';

interface ResponsiveImageArgs {
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

export type ResponsiveImageProps = Omit<
  React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  >,
  'src'
> &
  ResponsiveImageArgs;

function camelCase(kebabCase: string): string {
  return kebabCase.replace(/(-.)/g, (dashChar) =>
    dashChar.charAt(1).toUpperCase(),
  );
}

function getStyles(src: ImageData, isLoaded: boolean) {
  const styles = resolveStyles(src, isLoaded, false);
  if (!styles) {
    return undefined;
  }
  const reactStyles: Record<string, string | undefined> = {};
  for (const [property, value] of Object.entries(styles)) {
    reactStyles[camelCase(property)] = value;
  }
  return reactStyles;
}

let keyCounter = 0;
const keyMap = new WeakMap<ImageData, number>();

export function ResponsiveImage(props: ResponsiveImageProps) {
  const [loadedSrc, setLoaded] = useState<ImageData | undefined>(undefined);

  const { src, size, sizes, width, height, className, ...htmlAttributes } =
    props;
  const riProps: ResponsiveImageArgs = {
    src,
    size,
    sizes,
    width,
    height,
  };
  const isLoaded = loadedSrc === src;

  const layout = isResponsiveLayout(riProps.width, riProps.height);
  const imgWidth = resolveWidth({
    width: riProps.width,
    height: riProps.height,
    aspectRatio: riProps.src.aspectRatio,
    deviceWidths: env.deviceWidths,
    responsive: layout,
  });
  const imgHeight = resolveHeight({
    height: riProps.height,
    aspectRatio: riProps.src.aspectRatio,
    width: imgWidth,
  });
  const imgSrc = resolveSrc({ src: riProps.src, width: imgWidth });
  const sources = resolveSources({
    src: riProps.src,
    width: imgWidth,
    sizes: riProps.sizes,
    size: riProps.size,
    deviceWidths: env.deviceWidths,
    responsive: layout,
  });
  const sortedSources = sourcesSorted(sources);

  let key: number | undefined;

  // When LQIP is used, we need to use a key, so when src changes, the img element is recreated to re-apply LQIP styles without having
  // the previous src visible (<img> is a stateful element!). Without LQIP, reuse existing DOM.
  // See also https://github.com/simonihmig/responsive-image/issues/1583#issuecomment-3315142391
  // Ideally, we would just use src as the key, but React only allows for simple values (numbers or strings) as key, so we need to use
  // a mapping of src to generated primitive keys, that ensures that we get the same key for the same src
  if (src.lqip) {
    key = keyMap.get(src);

    if (key === undefined) {
      key = keyCounter++;
      keyMap.set(src, key);
    }
  }

  // check if src is already loaded (SSR) and loaded update state so LQIP options are removed
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(src);
    }
  });

  const classNames = resolveClassNames({
    src,
    isLoaded,
    responsive: layout,
    customClass: className,
  }).join(' ');

  const img = (
    <img
      key={key}
      className={classNames}
      loading={htmlAttributes.loading || 'lazy'}
      decoding={htmlAttributes.decoding || 'async'}
      width={imgWidth}
      height={imgHeight}
      srcSet={
        src.imageTypes === 'auto'
          ? // auto format assumes only one entry in sources
            sources[0]?.srcset
          : undefined
      }
      src={imgSrc}
      {...htmlAttributes}
      data-ri-lqip={riProps.src.lqip?.attribute}
      style={getStyles(riProps.src, isLoaded)}
      onLoad={() => setLoaded(src)}
      ref={imgRef}
    />
  );

  if (src.imageTypes === 'auto') {
    return img;
  }

  return (
    <picture>
      {sortedSources.map((s) => (
        <source
          key={s.mimeType}
          srcSet={s.srcset}
          type={s.mimeType}
          sizes={s.sizes}
        />
      ))}
      {img}
    </picture>
  );
}
