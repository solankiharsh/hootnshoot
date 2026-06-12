// @ts-nocheck
import { getCrop } from '../utils/image';
import { fitAndCenterOnPage } from '../utils/image';
import { StoreType } from '../model/store';
import { NodeType } from '../model/node-model';

type Props = {
  store: StoreType;
  src: string;
  droppedPos?: { x: number; y: number };
  targetElement?: NodeType;
  attrs?: any;
};

export const selectVideo = async ({ src, droppedPos, targetElement, store, attrs = {} }: Props) => {
  let width = attrs.width || 300;
  let height = attrs.height || 200;

  if (targetElement && targetElement.type === 'video' && (targetElement as any).contentEditable) {
    const crop = getCrop(targetElement as any, { width, height });
    (targetElement as any).set(Object.assign({ src }, crop));
    return;
  }

  const placement = fitAndCenterOnPage(store, width, height, droppedPos, {
    scaleFactor: 0.8,
  });

  return store.activePage?.addElement({ type: 'video', src, ...placement });
};
