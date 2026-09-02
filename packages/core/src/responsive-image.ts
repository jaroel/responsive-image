import { getValueOrCallback } from './utils.ts';

import type { ImageData, ImageUrlForType } from './types.ts';

export interface ImageSource {
  srcset: string;
  type: ImageUrlForType;
  mimeType: string | undefined;
  sizes?: string | undefined;
}

export const PIXEL_DENSITIES = [1, 2] as const;

const typeScore = new Map<ImageUrlForType, number>([
  ['png', 1],
  ['jpeg', 1],
  ['webp', 2],
  ['avif', 3],
]);

export function isResponsiveLayout(width?: number, height?: number): boolean {
  return width === undefined && height === undefined;
}

export function resolveWidth(input: {
  width: number | undefined;
  height: number | undefined;
  aspectRatio: number | undefined;
  deviceWidths: number[];
  responsive: boolean;
}): number | undefined {
  if (input.responsive) {
    // With responsive layout, the width attribute does not really matter, as we scale to 100%.
    // We just need to set width and height with the correct aspect ratio to prevent layout shift.
    return input.deviceWidths.at(-1);
  }

  if (input.width) {
    return input.width;
  }

  const ar = input.aspectRatio;
  if (ar !== undefined && ar !== 0 && input.height !== undefined) {
    return input.height * ar;
  }

  return undefined;
}

export function resolveHeight(input: {
  height: number | undefined;
  aspectRatio: number | undefined;
  width: number | undefined;
}): number | undefined {
  if (input.height) {
    return input.height;
  }

  const ar = input.aspectRatio;
  if (ar !== undefined && ar !== 0 && input.width !== undefined) {
    return Math.round(input.width / ar);
  }

  return undefined;
}

export function resolveSrc(input: {
  src: ImageData;
  width: number | undefined;
}): string | undefined {
  const format = input.src.imageTypes === 'auto' ? 'auto' : undefined;
  return input.src.imageUrlFor(input.width ?? 640, format);
}

export function resolveSources(input: {
  src: ImageData;
  width: number | undefined;
  sizes: string | undefined;
  size: number | undefined;
  deviceWidths: number[];
  responsive: boolean;
}): ImageSource[] {
  const { src } = input;
  const imageTypes = Array.isArray(src.imageTypes)
    ? src.imageTypes
    : [src.imageTypes];

  if (input.responsive) {
    return imageTypes.map((type) => {
      let widths = src.availableWidths;
      if (!widths) {
        widths = input.deviceWidths;
      }
      const sources: string[] = widths.map((width) => {
        const url = src.imageUrlFor(width, type);
        return `${url} ${width}w`;
      });

      return {
        srcset: sources.join(', '),
        sizes: input.sizes ?? (input.size ? `${input.size}vw` : undefined),
        type,
        mimeType: type != 'auto' ? `image/${type}` : undefined,
      };
    });
  }

  const w = input.width;
  if (w === undefined) {
    return [];
  }

  return imageTypes.map((type) => {
    const sources: string[] = PIXEL_DENSITIES.map((density) => {
      const url = src.imageUrlFor(w * density, type)!;
      return `${url} ${density}x`;
    }).filter((source) => source !== undefined);

    return {
      srcset: sources.join(', '),
      type,
      mimeType: type != 'auto' ? `image/${type}` : undefined,
    };
  });
}

export function sourcesSorted(sources: ImageSource[]): ImageSource[] {
  return [...sources].sort(
    (a, b) => (typeScore.get(b.type) ?? 0) - (typeScore.get(a.type) ?? 0),
  );
}

export function resolveClassNames(input: {
  src: ImageData;
  isLoaded: boolean;
  responsive: boolean;
  customClass: string | undefined;
}): string[] {
  const classNames = [
    'ri-img',
    `ri-${input.responsive ? 'responsive' : 'fixed'}`,
  ];

  const lqipClass = input.src.lqip?.class;
  if (lqipClass && !input.isLoaded) {
    classNames.push(getValueOrCallback(lqipClass));
  }
  if (input.customClass) {
    classNames.push(input.customClass);
  }

  return classNames;
}

export function resolveStyles(
  src: ImageData,
  isLoaded: boolean,
  isServer: boolean,
): Record<string, string | undefined> | undefined {
  if (isLoaded || isServer) {
    return undefined;
  }

  return getValueOrCallback(src.lqip?.inlineStyles);
}
