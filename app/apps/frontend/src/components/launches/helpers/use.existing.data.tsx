import { createContext, FC, ReactNode, useContext } from 'react';
import { Post } from '@prisma/client';
export type ExistingDataComplianceJob = {
  id: string;
  status: string;
  decision?: string | null;
  score?: number | null;
  externalJobId?: string | null;
  platform?: string | null;
  violations?: unknown;
  suggestedEdits?: unknown;
} | null;

const ExistingDataContext = createContext({
  integration: '',
  group: undefined as undefined | string,
  posts: [] as Post[],
  settings: {} as any,
  complianceJob: null as ExistingDataComplianceJob,
});
export const ExistingDataContextProvider: FC<{
  children: ReactNode;
  value: any;
}> = ({ children, value }) => {
  return (
    <ExistingDataContext.Provider value={value}>
      {children}
    </ExistingDataContext.Provider>
  );
};
export const useExistingData = () => useContext(ExistingDataContext);
