'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

export interface OrgApiKeySlot {
  identifier: string;
  label: string;
  description: string;
  docsUrl: string;
  configured: boolean;
  hasServerDefault: boolean;
  maskedKey: string | null;
}

export const ApiKeyModal: FC<{
  slot: OrgApiKeySlot;
  update: () => void;
}> = ({ slot, update }) => {
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const methods = useForm({ mode: 'onChange' });

  const submit = useCallback(
    async (data: FieldValues) => {
      setLoading(true);
      const save = await fetch(`/settings/api-keys/${slot.identifier}`, {
        method: 'POST',
        body: JSON.stringify({ api: data.api }),
      });
      if (save.ok) {
        toaster.show(
          t('api_key_saved', `${slot.label} API key saved`),
          'success'
        );
        modal.closeAll();
        update();
        return;
      }
      methods.setError('api', {
        message: t(
          'api_key_invalid',
          'This key was rejected by the provider — check it and try again'
        ),
      });
      setLoading(false);
    },
    [slot, update]
  );

  return (
    <div className="relative">
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="text-[14px] text-customColor18">
            {slot.description}{' '}
            <a
              href={slot.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="underline hover:font-bold"
            >
              {t('get_a_key', 'Get a key')}
            </a>
          </div>
          <div className="pt-[10px]">
            <Input
              label={`${slot.label} API Key`}
              name="api"
              autoComplete="off"
            />
          </div>
          <div>
            <Button loading={loading} type="submit">
              {t('save_and_validate', 'Save & Validate')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export const ApiKeysComponent: FC = () => {
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const t = useT();
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    return (await fetch('/settings/api-keys')).json();
  }, []);

  const { data, mutate } = useSWR<OrgApiKeySlot[]>('org-api-keys', load);

  const openModal = useCallback(
    (slot: OrgApiKeySlot) => {
      modal.openModal({
        title: `${slot.configured ? t('update', 'Update') : t('add', 'Add')} ${slot.label} ${t('api_key', 'API key')}`,
        withCloseButton: true,
        children: <ApiKeyModal slot={slot} update={mutate} />,
      });
    },
    [modal, mutate, t]
  );

  const testKey = useCallback(
    async (slot: OrgApiKeySlot) => {
      setTesting(slot.identifier);
      try {
        const res = await (
          await fetch(`/settings/api-keys/${slot.identifier}/test`, {
            method: 'POST',
          })
        ).json();
        if (!res.configured) {
          toaster.show(
            t('api_key_not_configured', 'No key configured to test'),
            'warning'
          );
        } else if (res.valid) {
          toaster.show(t('api_key_valid', 'Key is valid'), 'success');
        } else {
          toaster.show(
            t('api_key_test_failed', 'Key was rejected by the provider'),
            'warning'
          );
        }
      } finally {
        setTesting(null);
      }
    },
    [toaster, t]
  );

  const removeKey = useCallback(
    async (slot: OrgApiKeySlot) => {
      if (
        !(await deleteDialog(
          t(
            'remove_api_key_confirm',
            `Remove the ${slot.label} key from this workspace?`
          )
        ))
      ) {
        return;
      }
      await fetch(`/settings/api-keys/${slot.identifier}`, {
        method: 'DELETE',
      });
      toaster.show(t('api_key_removed', 'API key removed'), 'success');
      mutate();
    },
    [mutate, toaster, t]
  );

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col">
        <h3 className="text-[20px]">{t('api_keys', 'API Keys')}</h3>
        <div className="text-customColor18 mt-[4px] text-[14px]">
          {t(
            'api_keys_description',
            'Bring your own keys: each workspace uses its own API keys for managed social channels and AI features. Keys are encrypted and never shared with other workspaces.'
          )}
        </div>
      </div>
      <div className="flex flex-col gap-[12px]">
        {(data || []).map((slot) => (
          <div
            key={slot.identifier}
            className="border border-customColor6 rounded-[8px] p-[16px] flex items-center gap-[16px] bg-newBgColorInner"
          >
            <div className="flex-1 flex flex-col gap-[4px]">
              <div className="flex items-center gap-[8px]">
                <span className="text-[16px] font-[600]">{slot.label}</span>
                {slot.configured ? (
                  <span className="text-[12px] px-[8px] py-[2px] rounded-[4px] bg-green-500/20 text-green-400">
                    {slot.maskedKey}
                  </span>
                ) : slot.hasServerDefault ? (
                  <span className="text-[12px] px-[8px] py-[2px] rounded-[4px] bg-blue-500/20 text-blue-400">
                    {t('using_server_default', 'Using server default')}
                  </span>
                ) : (
                  <span className="text-[12px] px-[8px] py-[2px] rounded-[4px] bg-customColor6 text-customColor18">
                    {t('not_set', 'Not set')}
                  </span>
                )}
              </div>
              <div className="text-[13px] text-customColor18">
                {slot.description}
              </div>
            </div>
            <div className="flex gap-[8px]">
              {(slot.configured || slot.hasServerDefault) && (
                <Button
                  secondary={true}
                  loading={testing === slot.identifier}
                  onClick={() => testKey(slot)}
                >
                  {t('test', 'Test')}
                </Button>
              )}
              <Button onClick={() => openModal(slot)}>
                {slot.configured ? t('update', 'Update') : t('add_key', 'Add key')}
              </Button>
              {slot.configured && (
                <Button secondary={true} onClick={() => removeKey(slot)}>
                  {t('remove', 'Remove')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
