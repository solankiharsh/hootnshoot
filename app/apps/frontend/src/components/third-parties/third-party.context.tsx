'use client';

import React, { createContext, useContext } from 'react';

const defaultThirdPartyContext = {
  id: '',
  name: '',
  title: '',
  identifier: '',
  description: '',
  close: () => {},
  onChange: (_data: unknown) => {},
  fields: [] as unknown[],
  data: [
    {
      content: '',
      id: '',
      image: [
        {
          id: '',
          path: '',
        },
      ],
    },
  ],
};

export const ThirdPartyContext = createContext(defaultThirdPartyContext);

export const useThirdParty = () => useContext(ThirdPartyContext);
