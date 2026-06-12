'use client';

import { createContext, FC, ReactNode, useContext, useMemo } from 'react';
import { customFetch, Params } from './custom.fetch.func';

const FetchProvider = createContext(
  customFetch(
    // @ts-ignore
    {
      baseUrl: '',
      beforeRequest: () => {},
      afterRequest: () => {
        return true;
      },
    } as Params
  )
);

export const FetchWrapperComponent: FC<Params & { children: ReactNode }> = (
  props
) => {
  const { children, ...params } = props;
  const client = useMemo(
    () => customFetch(params),
    [params.baseUrl, params.beforeRequest, params.afterRequest]
  );
  return (
    // @ts-ignore
    <FetchProvider.Provider value={client}>
      {children}
    </FetchProvider.Provider>
  );
};

export const useFetch = () => {
  return useContext(FetchProvider);
};
