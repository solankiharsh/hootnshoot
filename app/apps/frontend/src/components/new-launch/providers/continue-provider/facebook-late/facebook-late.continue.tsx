'use client';

import { withContinueProvider } from '../with-continue-provider';

interface FacebookLatePage {
  id: string;
  name: string;
  username: string;
}

export const FacebookLateContinue = withContinueProvider<FacebookLatePage, string>({
  endpoint: 'pages',
  swrKey: 'load-facebook-late-pages',
  titleKey: 'select_page',
  titleDefault: 'Select Page:',
  emptyStateMessages: [
    {
      key: 'we_couldn_t_find_any_facebook_pages',
      text: "We couldn't find any Facebook Pages connected to this account.",
    },
    {
      key: 'please_close_and_reconnect',
      text: 'Please close this dialog and reconnect your Facebook account.',
    },
  ],
  getItemId: (item) => item.id,
  getSelectionValue: (item) => item.id,
  transformSaveData: (selection) => ({ page: selection }),
  isSelected: (item, selection) => selection === item.id,
  renderItem: (item) => (
    <>
      <div className="w-[40px] h-[40px] mx-auto rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[16px]">
        {item.name.charAt(0).toUpperCase()}
      </div>
      <div className="text-[13px] truncate">{item.name}</div>
      {item.username && (
        <div className="text-[11px] text-gray-400">@{item.username}</div>
      )}
    </>
  ),
});
