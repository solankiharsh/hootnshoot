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

export const selectGif = async ({ src, droppedPos, targetElement, store }: Props): Promise<void> => {
  const { width, height } = await getImageSize(src);
  const placement = fitAndCenterOnPage(store, width, height, droppedPos);
  store.activePage?.addElement({ type: 'gif', src, ...placement });
};
