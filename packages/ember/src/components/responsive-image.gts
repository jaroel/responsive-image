import { assert } from '@ember/debug';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { cached, tracked } from '@glimmer/tracking';
import {
  env,
  isResponsiveLayout,
  resolveClassNames,
  resolveSources,
  resolveSrc,
  resolveStyles,
  resolveWidth,
  sourcesSorted as sortSources,
  type ImageSource,
} from '@responsive-image/core';
import { modifier } from 'ember-modifier';
import style from 'ember-style-modifier';

import type Owner from '@ember/owner';
import type { ImageData } from '@responsive-image/core';

import './responsive-image.css';

export interface ResponsiveImageComponentSignature {
  Element: HTMLImageElement;
  Args: {
    src: ImageData;
    size?: number;
    sizes?: string;
    width?: number;
    height?: number;
  };
}

export default class ResponsiveImageComponent extends Component<ResponsiveImageComponentSignature> {
  @tracked
  loadedSrc?: ImageData;

  constructor(owner: Owner, args: ResponsiveImageComponentSignature['Args']) {
    super(owner, args);
    assert('No @src argument supplied for <ResponsiveImage>', args.src);
    assert(
      'Image paths as @src argument for <ResponsiveImage> are not supported anymore.',
      typeof args.src !== 'string',
    );
  }

  get isLoaded(): boolean {
    return this.loadedSrc === this.args.src;
  }

  get autoFormat(): boolean {
    return this.args.src.imageTypes === 'auto';
  }

  get responsive(): boolean {
    return isResponsiveLayout(this.args.width, this.args.height);
  }

  get sources(): ImageSource[] {
    return resolveSources({
      src: this.args.src,
      width: this.width,
      sizes: this.args.sizes,
      size: this.args.size,
      deviceWidths: env.deviceWidths,
      responsive: this.responsive,
    });
  }

  get sourcesSorted(): ImageSource[] {
    return sortSources(this.sources);
  }

  get imgSrcset(): string | undefined {
    return this.sources[0]?.srcset;
  }

  /**
   * the image source which fits at best for the size and screen
   */
  get src(): string | undefined {
    return resolveSrc({ src: this.args.src, width: this.width });
  }

  @cached
  get width(): number | undefined {
    return resolveWidth({
      width: this.args.width,
      height: this.args.height,
      aspectRatio: this.args.src.aspectRatio,
      deviceWidths: env.deviceWidths,
      responsive: this.responsive,
    });
  }

  get height(): number | undefined {
    if (this.args.height) {
      return this.args.height;
    }

    const ar = this.args.src.aspectRatio;
    if (ar !== undefined && ar !== 0 && this.width !== undefined) {
      return this.width / ar;
    }

    return undefined;
  }

  get classNames(): string {
    return resolveClassNames({
      src: this.args.src,
      isLoaded: this.isLoaded,
      responsive: this.responsive,
      customClass: undefined,
    }).join(' ');
  }

  get styles(): Record<string, string | undefined> {
    return resolveStyles(this.args.src, this.isLoaded, false) ?? {};
  }

  get keyedSrcArray(): [unknown] {
    // Ember only supports "keying" (to force DOM recreation) with the each helper, so we create an artificial length=1 array
    // When LQIP is used, the key is our src, so when src changes, the img element is recreated to re-apply LQIP styles without having
    // the previous src visible (<img> is a stateful element!). Without LQIP, reuse existing DOM.
    // See also https://github.com/simonihmig/responsive-image/issues/1583#issuecomment-3315142391
    return [this.args.src.lqip ? this.args.src : null];
  }

  @action
  onLoad(): void {
    this.loadedSrc = this.args.src;
  }

  checkAlreadyLoaded = modifier((el: HTMLImageElement) => {
    if (el.complete) {
      this.loadedSrc = this.args.src;
    }
  });

  <template>
    {{#if this.autoFormat}}
      {{#each this.keyedSrcArray}}
        <img
          {{! set loading before src, otherwise FF will always load eagerly! }}
          loading="lazy"
          srcset={{this.imgSrcset}}
          src={{this.src}}
          width={{this.width}}
          height={{this.height}}
          class={{this.classNames}}
          decoding="async"
          ...attributes
          data-ri-lqip={{@src.lqip.attribute}}
          {{style this.styles}}
          {{this.checkAlreadyLoaded}}
          {{on "load" this.onLoad}}
        />
      {{/each}}
    {{else}}
      <picture>
        {{#each this.sourcesSorted as |s|}}
          <source srcset={{s.srcset}} type={{s.mimeType}} sizes={{s.sizes}} />
        {{/each}}
        {{#each this.keyedSrcArray}}
          <img
            {{! set loading before src, otherwise FF will always load eagerly! }}
            loading="lazy"
            src={{this.src}}
            width={{this.width}}
            height={{this.height}}
            class={{this.classNames}}
            decoding="async"
            ...attributes
            data-ri-lqip={{@src.lqip.attribute}}
            {{style this.styles}}
            {{this.checkAlreadyLoaded}}
            {{on "load" this.onLoad}}
          />
        {{/each}}
      </picture>
    {{/if}}
  </template>
}
