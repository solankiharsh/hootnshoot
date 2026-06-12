// openpolotno vendored deps that lack bundled TypeScript type declarations
declare module 'quill';
declare module 'mensch';
declare module 'react-window';
// @meronex/icons ships types for the root import only; subpath imports (e.g.
// @meronex/icons/ai/AiOutlineFacebook) have no .d.ts — declare them all.
declare module '@meronex/icons/*';
declare module '@meronex/icons/*/*';

declare module 'openpolotno' {
  import { FC } from 'react';
  export const RaeditorContainer: FC<any>;
  export const SidePanelWrap: FC<any>;
  export const WorkspaceWrap: FC<any>;
}

declare module 'openpolotno/model/store' {
  export function createStore(opts?: { key?: string; showCredit?: boolean }): any;
}

declare module 'openpolotno/canvas/workspace' {
  const Workspace: any;
  export default Workspace;
  export { Workspace };
}

declare module 'openpolotno/side-panel' {
  export const SidePanel: any;
  export const DEFAULT_SECTIONS: any[];
  export const SectionTab: any;
}

declare module 'openpolotno/toolbar/toolbar' {
  const Toolbar: any;
  export default Toolbar;
  export { Toolbar };
}

declare module 'openpolotno/toolbar/zoom-buttons' {
  const ZoomButtons: any;
  export default ZoomButtons;
  export { ZoomButtons };
}

declare module 'openpolotno/side-panel/images-grid' {
  export const ImagesGrid: any;
}

declare module 'openpolotno/utils/image' {
  export function getImageSize(src: string): Promise<{ width: number; height: number }>;
  export function loadImage(src: string): Promise<HTMLImageElement>;
  export function cropImage(
    src: string,
    opts: {
      type?: string;
      width: number;
      height: number;
      cropX: number;
      cropY: number;
      cropWidth: number;
      cropHeight: number;
    }
  ): Promise<string>;
  export function getCrop(
    imageSize: { width: number; height: number },
    canvasSize: { width: number; height: number }
  ): { cropX: number; cropY: number; cropWidth: number; cropHeight: number };
  export function getActivePageDimensions(store: any): { width: number; height: number };
  export function fitAndCenterOnPage(
    store: any,
    naturalWidth: number,
    naturalHeight: number,
    droppedPos?: { x?: number; y?: number },
    options?: { scaleFactor?: number; maxScale?: number }
  ): { x: number; y: number; width: number; height: number };
}

declare module 'openpolotno/utils/api' {
  export function setAPI(
    name: string,
    fn: (...args: unknown[]) => string
  ): void;
}
