// @ts-nocheck
import { getImageSize } from '../utils/image';
import { fitAndCenterOnPage } from '../utils/image';
import { StoreType } from '../model/store';
import { NodeType } from '../model/node-model';

type Props = {
  store: StoreType;
  src: string;
  droppedPos?: { x: number; y: number };
  targetElement?: NodeType;
};

export const selectSvg = async ({ src, droppedPos, targetElement, store }: Props): Promise<void> => {
  if (targetElement && targetElement.type === 'image' && (targetElement as any).contentEditable) {
    (targetElement as any).set({ clipSrc: src });
    return;
  }
  if (targetElement && targetElement.type === 'video' && (targetElement as any).contentEditable) {
    (targetElement as any).set({ clipSrc: src });
    return;
  }
  const { width, height } = await getImageSize(src);
  const placement = fitAndCenterOnPage(store, width, height, droppedPos);
  store.activePage?.addElement({ type: 'svg', src, ...placement });
};
