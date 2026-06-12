'use client';

/*
 * TODO(ContentCop): Before "Generate Language Variants" / multi-language translation,
 * require latestComplianceJob?.decision === 'Approved' on the English source post; if not
 * approved, block with a message. Create-post flow (Gener8) does not use ManageModal.
 */

import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AddEditModalProps } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PicksSocialsComponent } from '@gitroom/frontend/components/new-launch/picks.socials.component';
import { EditorWrapper } from '@gitroom/frontend/components/new-launch/editor';
import { SelectCurrent } from '@gitroom/frontend/components/new-launch/select.current';
import { ShowAllProviders } from '@gitroom/frontend/components/new-launch/providers/show.all.providers';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { DatePicker } from '@gitroom/frontend/components/launches/helpers/date.picker';
import { useShallow } from 'zustand/react/shallow';
import { RepeatComponent } from '@gitroom/frontend/components/launches/repeat.component';
import { TagsComponent } from '@gitroom/frontend/components/launches/tags.component';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { weightedLength } from '@gitroom/helpers/utils/count.length';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { capitalize } from 'lodash';
import { SelectCustomer } from '@gitroom/frontend/components/launches/select.customer';
import { DummyCodeComponent } from '@gitroom/frontend/components/new-launch/dummy.code.component';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import {
  SettingsIcon,
  ChevronDownIcon,
  CloseIcon,
  TrashIcon,
  DropdownArrowSmallIcon,
} from '@gitroom/frontend/components/ui/icons';
import { useHasScroll } from '@gitroom/frontend/components/ui/is.scroll.hook';
import { useShortlinkPreference } from '@gitroom/frontend/components/settings/shortlink-preference.component';
import dayjs from 'dayjs';
import { Button } from '@gitroom/react/form/button';
import {
  getComplianceEditorActions,
  type ComplianceEditorSaveType,
} from '@gitroom/frontend/components/compliance/compliance-editor-actions';

function countCharacters(text: string, type: string): number {
  if (type !== 'x') {
    return text.length;
  }
  return weightedLength(text);
}

function parseViolations(
  raw: unknown
): Array<{ severity: string; rule: string; excerpt: string; checkType: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => ({
    severity: String((v as Record<string, unknown>)?.severity ?? ''),
    rule: String((v as Record<string, unknown>)?.rule ?? ''),
    excerpt: String((v as Record<string, unknown>)?.excerpt ?? ''),
    checkType: String((v as Record<string, unknown>)?.check_type ?? ''),
  }));
}

function parseSuggestedEdits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
}

const SEVERITY_STYLES: Record<string, { badge: string; border: string; dot: string }> = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', border: 'border-red-500/20', dot: 'bg-red-500' },
  major:    { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  minor:    { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', border: 'border-yellow-500/20', dot: 'bg-yellow-400' },
};

const ComplianceReportPanel: FC<{ job: any }> = ({ job }) => {
  const violations = parseViolations(job?.violations);
  const suggestedEdits = parseSuggestedEdits(job?.suggestedEdits);
  const [editsOpen, setEditsOpen] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const score: number = job?.score ?? 0;
  const decision: string = job?.decision ?? '';
  const isRejected = decision === 'Rejected';
  const isManual = decision === 'Needs Compliance Review';

  const scoreColor = score >= 90 ? 'text-green-400' : score >= 70 ? 'text-orange-400' : 'text-red-400';
  const scoreBg = score >= 90 ? 'bg-green-500/10 border-green-500/30' : score >= 70 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-red-500/10 border-red-500/30';

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Score + decision header */}
      <div className={clsx('mx-[20px] mt-[16px] rounded-[10px] border px-[16px] py-[12px] flex items-center gap-[14px]', scoreBg)}>
        <div className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full border-2 border-current shrink-0" style={{ borderColor: 'currentColor' }}>
          <span className={clsx('text-[18px] font-[700] leading-none', scoreColor)}>{score}</span>
          <span className={clsx('text-[10px] font-[500]', scoreColor)}>/100</span>
        </div>
        <div className="flex flex-col gap-[3px]">
          <span className={clsx('text-[14px] font-[700]', scoreColor)}>
            {isRejected ? 'Rejected' : isManual ? 'Needs Review' : decision}
          </span>
          <span className="text-[12px] text-textItemBlur">
            {violations.length} violation{violations.length !== 1 ? 's' : ''} found
            {isRejected ? ' — edit and recheck to approve' : isManual ? ' — awaiting manual review' : ''}
          </span>
        </div>
      </div>

      {/* Scrollable violations + edits */}
      <div className="flex-1 overflow-y-auto px-[20px] py-[14px] flex flex-col gap-[10px] scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner">

        {violations.length > 0 && (
          <div className="flex flex-col gap-[8px]">
            <div className="text-[11px] font-[700] uppercase tracking-widest text-textItemBlur">Violations</div>
            {violations.map((v, i) => {
              const style = SEVERITY_STYLES[v.severity.toLowerCase()] ?? SEVERITY_STYLES.minor;
              const isOpen = expanded === i;
              const excerptClean = v.excerpt.replace(/^###.*\n/, '').replace(/\*\*/g, '').trim();
              return (
                <div key={i} className={clsx('rounded-[8px] border overflow-hidden', style.border)}>
                  <button
                    type="button"
                    className="w-full flex items-start gap-[10px] px-[12px] py-[10px] text-left hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    <span className={clsx('mt-[3px] w-[7px] h-[7px] rounded-full shrink-0', style.dot)} />
                    <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                      <div className="flex items-center gap-[6px] flex-wrap">
                        <span className={clsx('text-[10px] font-[700] uppercase tracking-wide px-[6px] py-[2px] rounded-[4px] border', style.badge)}>
                          {v.severity}
                        </span>
                        <span className="text-[11px] font-[600] text-textColor capitalize">{v.rule}</span>
                        {v.checkType && (
                          <span className="text-[10px] px-[5px] py-[1px] rounded-[4px] bg-white/8 border border-white/10 text-textItemBlur font-[500]">
                            {v.checkType}
                          </span>
                        )}
                      </div>
                      <p className={clsx('text-[12px] text-textItemBlur leading-snug', !isOpen && 'line-clamp-2')}>
                        {excerptClean}
                      </p>
                    </div>
                    <span className={clsx('text-textItemBlur mt-[2px] shrink-0 transition-transform text-[10px]', isOpen ? 'rotate-180' : '')}>▾</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {suggestedEdits.length > 0 && (
          <div className="flex flex-col gap-[8px]">
            <button
              type="button"
              className="flex items-center gap-[6px] text-[11px] font-[700] uppercase tracking-widest text-textItemBlur hover:text-newTextColor transition-colors cursor-pointer"
              onClick={() => setEditsOpen((o) => !o)}
            >
              <span className={clsx('transition-transform text-[10px]', editsOpen ? 'rotate-180' : '')}>▾</span>
              Suggested edits ({suggestedEdits.length})
            </button>
            {editsOpen && (
              <ol className="flex flex-col gap-[8px] ps-[4px]">
                {suggestedEdits.map((s, i) => (
                  <li key={i} className="flex gap-[10px] text-[12px] text-textColor leading-snug">
                    <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-[10px] font-[700] text-textItemBlur mt-[1px]">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ManageModal: FC<AddEditModalProps> = (props) => {
  const t = useT();
  const fetch = useFetch();
  const ref = useRef(null);
  const existingData = useExistingData();
  const [loading, setLoading] = useState(false);
  const toaster = useToaster();
  const modal = useModals();
  const [showSettings, setShowSettings] = useState(false);
  const [suggestedEditsOpen, setSuggestedEditsOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<'preview' | 'compliance'>('compliance');
  const { data: shortlinkPreferenceData } = useShortlinkPreference();

  const { addEditSets, mutate, customClose, dummy, complianceFixMode } = props;

  const editorActions = useMemo(
    () =>
      getComplianceEditorActions({
        complianceFixMode,
        complianceJob: existingData.complianceJob,
        isNewPost: !existingData.integration,
        isDraft: existingData?.posts?.[0]?.state === 'DRAFT',
        dummy,
        addEditSets: !!addEditSets,
      }),
    [
      complianceFixMode,
      existingData.complianceJob,
      existingData.integration,
      existingData?.posts,
      dummy,
      !!addEditSets,
    ]
  );

  const {
    selectedIntegrations,
    hide,
    date,
    setDate,
    repeater,
    setRepeater,
    tags,
    setTags,
    integrations,
    setSelectedIntegrations,
    locked,
    current,
    activateExitButton,
    setHide,
  } = useLaunchStore(
    useShallow((state) => ({
      hide: state.hide,
      setHide: state.setHide,
      date: state.date,
      setDate: state.setDate,
      current: state.current,
      repeater: state.repeater,
      setRepeater: state.setRepeater,
      tags: state.tags,
      setTags: state.setTags,
      selectedIntegrations: state.selectedIntegrations,
      integrations: state.integrations,
      setSelectedIntegrations: state.setSelectedIntegrations,
      locked: state.locked,
      activateExitButton: state.activateExitButton,
    }))
  );

  useEffect(() => {
    if (hide) {
      setHide(false);
    }
  }, [hide]);

  useEffect(() => {
    if (!complianceFixMode) return;
    const handler = () => setRightPanel('compliance');
    window.addEventListener('media:design-saved', handler);
    return () => window.removeEventListener('media:design-saved', handler);
  }, [complianceFixMode]);

  const currentIntegrationText = useMemo(() => {
    if (current === 'global') {
      return (
        <div className="flex items-center gap-[10px]">
          <div className="relative">
            <SettingsIcon size={15} className="text-white" />
          </div>
          <div>Settings</div>
        </div>
      );
    }

    const currentIntegration = integrations.find((p) => p.id === current)!;

    return (
      <div className="flex items-center gap-[10px]">
        <div className="relative">
          <img
            src={`/icons/platforms/${currentIntegration.identifier}.png`}
            className="w-[20px] h-[20px] rounded-[4px]"
            alt={currentIntegration.identifier}
          />
          <SettingsIcon
            size={15}
            className="text-white absolute -end-[5px] -bottom-[5px]"
          />
        </div>
        <div>
          {currentIntegration.name} {t('channel_settings', 'Settings')}
        </div>
      </div>
    );
  }, [current]);

  const changeCustomer = useCallback(
    (customer: string) => {
      const neededIntegrations = integrations.filter(
        (p) => p?.customer?.id === customer
      );
      setSelectedIntegrations(
        neededIntegrations.map((p) => ({
          settings: {},
          selectedIntegrations: p,
        }))
      );
    },
    [integrations]
  );

  const askClose = useCallback(async () => {
    if (!activateExitButton || dummy) {
      return;
    }

    if (
      await deleteDialog(
        t(
          'are_you_sure_you_want_to_close_this_modal_all_data_will_be_lost',
          'Are you sure you want to close this modal? (all data will be lost)'
        ),
        t('yes_close_it', 'Yes, close it!')
      )
    ) {
      if (customClose) {
        customClose();
        return;
      }
      modal.closeAll();
    }
  }, [activateExitButton, dummy]);

  const deletePost = useCallback(async () => {
    setLoading(true);
    if (
      !(await deleteDialog(
        t(
          'are_you_sure_you_want_to_delete_post',
          'Are you sure you want to delete this post?'
        ),
        t('yes_delete_it', 'Yes, delete it!')
      ))
    ) {
      setLoading(false);
      return;
    }
    await fetch(`/posts/${existingData.group}`, {
      method: 'DELETE',
    });
    mutate();
    modal.closeAll();
    return;
  }, [existingData, mutate, modal, fetch]);

  const proceedWithSave = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      if (addEditSets) {
        addEditSets(data);
        return true;
      }
      try {
        const res = await fetch('/posts', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => `HTTP ${res.status}`);
          toaster.show(msg || `HTTP ${res.status}`, 'warning');
          return false;
        }
        mutate();
        if (customClose) {
          setTimeout(() => {
            customClose();
          }, 2000);
        }
        modal.closeAll();
        return true;
      } catch {
        toaster.show(
          t('post_failed', 'Failed to save post. Please try again.'),
          'warning'
        );
        return false;
      }
    },
    [
      addEditSets,
      fetch,
      mutate,
      toaster,
      t,
      customClose,
      modal,
    ]
  );

  const schedule = useCallback(
    (type: 'draft' | 'now' | 'schedule' | 'update' | 'post_now') => async () => {
      if (
        (type === 'now' || type === 'schedule' || type === 'post_now') &&
        (existingData?.posts?.[0]?.state === 'PUBLISHED' ||
          (existingData?.posts?.[0]?.state === 'QUEUE' &&
            dayjs().isAfter(date.utc())))
      ) {
        const whatToDo = await new Promise((resolve) => {
          modal.openModal({
            title: 'What do you want to do?',
            children: (
              <div className="flex flex-col">
                <div className="text-[20px] mb-[20px]">
                  This post was already published, what do you want to do?
                </div>
                <div className="flex w-full gap-[10px]">
                  <div className="flex-1 flex">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => resolve('update')}
                    >
                      Just update the post details
                    </Button>
                  </div>
                  <div className="flex-1 flex">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => resolve('republish')}
                    >
                      Republish the post
                    </Button>
                  </div>
                </div>
              </div>
            ),
          });
        });

        if (whatToDo === 'update') {
          type = 'update';
        }
      }

      setLoading(true);
      const checkAllValid = (await ref.current.checkAllValid()).filter(Boolean);

      const notEnoughChars = checkAllValid.filter((p: any) => {
        return p.values.some((a: any) => {
          return (
            countCharacters(
              stripHtmlValidation('normal', a.content, true),
              p?.integration?.identifier || ''
            ) === 0 && a.media?.length === 0
          );
        });
      });

      for (const item of notEnoughChars) {
        toaster.show(
          `${capitalize(item.integration.identifier.split('-')[0])} (${
            item.integration.name
          }):` +
            ' ' +
            t(
              'post_needs_content_or_image',
              'Your post should have at least one character or one image.'
            ),
          'warning'
        );
        setLoading(false);
        item.preview();
        return;
      }

      if (type !== 'draft') {
        for (const item of checkAllValid) {
          if (item.valid === false) {
            toaster.show(
              `${capitalize(item.integration.identifier.split('-')[0])} (${
                item.integration.name
              }): ${t('please_fix_your_settings', 'Please fix your settings')}`,
              'warning'
            );
            item.fix();
            setLoading(false);
            setShowSettings(true);
            return;
          }

          if (item.errors !== true) {
            toaster.show(
              `${capitalize(item.integration.identifier.split('-')[0])} (${
                item.integration.name
              }): ${item.errors}`,
              'warning'
            );
            item.preview();
            setLoading(false);
            setShowSettings(false);
            return;
          }
        }

        const sliceNeeded = checkAllValid.filter((p: any) => {
          return p.values.some((a: any) => {
            const strip = stripHtmlValidation('normal', a.content, true);
            const weightedLength = countCharacters(
              strip,
              p?.integration?.identifier || ''
            );
            const totalCharacters =
              weightedLength > strip.length ? weightedLength : strip.length;

            return totalCharacters > (p.maximumCharacters || 1000000);
          });
        });

        for (const item of sliceNeeded) {
          toaster.show(
            `${item?.integration?.name} (${item?.integration?.identifier}) ${t(
              'post_is_too_long',
              'post is too long, please fix it'
            )}`,
            'warning'
          );
          item.preview();
          setLoading(false);
          return;
        }
      }

      const shortlinkPreference = shortlinkPreferenceData?.shortlink || 'ASK';

      let shortLink = false;

      if (!dummy && shortlinkPreference !== 'NO') {
        const shortLinkUrl = await (
          await fetch('/posts/should-shortlink', {
            method: 'POST',
            body: JSON.stringify({
              messages: checkAllValid.flatMap((p: any) =>
                p.values.flatMap((a: any) => a.content)
              ),
            }),
          })
        ).json();

        if (shortLinkUrl.ask) {
          if (shortlinkPreference === 'YES') {
            // Automatically shortlink without asking
            shortLink = true;
          } else {
            // ASK: Show the dialog
            shortLink = await deleteDialog(
              t(
                'shortlink_urls_question',
                'Do you want to shortlink the URLs? it will let you get statistics over clicks'
              ),
              t('yes_shortlink_it', 'Yes, shortlink it!')
            );
          }
        }
      }

      const group = existingData.group || makeId(10);
      const apiType = type === 'post_now' ? 'schedule' : type;
      const data = {
        type: apiType,
        ...(type === 'post_now' ? { publishWhenApproved: true } : {}),
        ...(repeater ? { inter: repeater } : {}),
        tags,
        shortLink,
        date:
          type === 'post_now'
            ? dayjs().utc().format('YYYY-MM-DDTHH:mm:ss')
            : date.utc().format('YYYY-MM-DDTHH:mm:ss'),
        posts: checkAllValid.map((post: any) => ({
          integration: {
            id: post.integration.id,
          },
          group,
          settings: { ...(post.settings || {}) },
          value: post.values.map((value: any) => ({
            ...(value.id ? { id: value.id } : {}),
            content: value.content,
            delay: value.delay || 0,
            image:
              (value?.media || []).map(
                ({ id, path, alt, thumbnail, thumbnailTimestamp }: any) => ({
                  id,
                  path,
                  alt,
                  thumbnail,
                  thumbnailTimestamp,
                })
              ) || [],
          })),
        })),
      };

      if (dummy) {
        modal.openModal({
          title: '',
          children: <DummyCodeComponent code={data} />,
          classNames: {
            modal: 'w-[100%] bg-transparent text-textColor',
          },
          size: '100%',
          withCloseButton: false,
          closeOnEscape: true,
          closeOnClickOutside: true,
        });

        setLoading(false);
        return;
      }

      const saved = await proceedWithSave(data);
      if (!saved) {
        setLoading(false);
        return;
      }

      if (type !== 'draft' && !addEditSets) {
        if (type === 'update' && editorActions.banner !== 'none') {
          toaster.show(
            t(
              'compliance_recheck_toast',
              'Saved — Content Cop is rechecking your post.'
            ),
            'success'
          );
        } else if (type === 'post_now') {
          toaster.show(
            t(
              'post_now_compliance_toast',
              'Post added to calendar — publishing as soon as Content Cop approves.'
            ),
            'success'
          );
        } else {
          toaster.show(
            t(
              'post_calendar_compliance_background',
              'Post added to calendar — running compliance check in background.'
            ),
            'success'
          );
        }
      } else if (!addEditSets) {
        toaster.show(
          !existingData.integration
            ? t('added_successfully', 'Added successfully')
            : t('updated_successfully', 'Updated successfully')
        );
      }
      setLoading(false);
    },
    [
      ref,
      repeater,
      tags,
      date,
      addEditSets,
      dummy,
      shortlinkPreferenceData,
      fetch,
      existingData,
      editorActions.banner,
      toaster,
      t,
      modal,
      proceedWithSave,
    ]
  );

  const primarySave = useCallback(
    () => schedule(editorActions.primarySaveType as ComplianceEditorSaveType)(),
    [schedule, editorActions.primarySaveType]
  );

  return (
    <div className="w-full h-full flex-1 p-[40px] flex relative">
      <div className="flex flex-1 bg-newBgColorInner rounded-[20px] flex-col">
        <div className="flex-1 flex">
            <div className="flex flex-1 min-h-0 min-w-0 flex-row">
          <div className="flex flex-col flex-1 border-e border-newBorder">
            <div className="bg-newBgColor h-[65px] rounded-s-[20px] !rounded-b-[0] flex items-center px-[20px] text-[20px] font-[600]">
              {complianceFixMode
                ? t('compliance_fix_post_title', 'Fix post for compliance')
                : t('create_post_title', 'Create Post')}
            </div>
            <div className="flex-1 flex flex-col gap-[16px]">
              <div
                className={clsx('flex-1 relative', showSettings && 'hidden')}
              >
                <div
                  id="social-content"
                  className="gap-[32px] flex flex-col pe-[8px] pt-[20px] ps-[20px] absolute top-0 left-0 w-full h-full overflow-x-hidden overflow-y-scroll scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner"
                >
                  <div className="flex w-full">
                    <div className="flex flex-1">
                      <PicksSocialsComponent toolTip={true} />
                    </div>
                    <div>
                      {!dummy && (
                        <SelectCustomer
                          onChange={changeCustomer}
                          integrations={integrations}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 gap-[6px] flex-col">
                    <div>{!existingData.integration && <SelectCurrent />}</div>
                    <div className="flex-1 flex">
                      {!hide && <EditorWrapper totalPosts={1} value="" />}
                    </div>
                    <div
                      id="social-empty"
                      className={clsx(
                        'pb-[16px]'
                        // current !== 'global' && 'hidden'
                      )}
                    />
                  </div>
                </div>
              </div>
              <div
                id="wrapper-settings"
                className={clsx(
                  'pb-[20px] px-[20px] select-none',
                  showSettings && 'flex-1 flex pt-[20px]',
                  current === 'global' && 'hidden'
                )}
              >
                <div className="flex-1 flex flex-col rounded-[12px] gap-[12px] overflow-hidden bg-newSettings">
                  <div
                    onClick={() => setShowSettings(!showSettings)}
                    className={clsx(
                      'bg-[#612BD3] rounded-[12px] flex items-center gap-[8px] cursor-pointer p-[12px]',
                      showSettings ? '!rounded-b-none' : ''
                    )}
                  >
                    <div className="flex-1 text-[14px] font-[600] text-white">
                      {currentIntegrationText}
                    </div>
                    <div>
                      <ChevronDownIcon
                        rotated={showSettings}
                        className="text-white"
                      />
                    </div>
                  </div>
                  <div
                    className={clsx(
                      !showSettings ? 'hidden' : 'flex-1',
                      'text-[14px] text-textColor font-[500] relative'
                    )}
                  >
                    <div className="absolute left-0 top-0 w-full h-full flex flex-col overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-newBgColorInner scrollbar-track-newColColor">
                      <div
                        id="social-settings"
                        className="flex flex-col gap-[20px] bg-newBgColor"
                      />
                    </div>
                  </div>
                  <style>
                    {`#social-settings [data-id="${current}"] {display: block !important;}`}
                  </style>
                </div>
              </div>
            </div>
          </div>
          <div className="w-[580px] flex flex-col">
            <div className="bg-newBgColor h-[65px] rounded-e-[20px] !rounded-b-[0] flex items-center px-[20px] gap-[8px]">
              {complianceFixMode ? (
                <>
                  <div className="flex gap-[2px] rounded-[8px] bg-newBgColorInner p-[3px] border border-newTableBorder">
                    <button
                      type="button"
                      onClick={() => setRightPanel('compliance')}
                      className={clsx(
                        'px-[10px] py-[4px] rounded-[6px] text-[13px] font-[600] transition-all cursor-pointer',
                        rightPanel === 'compliance' ? 'bg-[#612BD3] text-white' : 'text-textItemBlur hover:text-newTextColor'
                      )}
                    >
                      Compliance Report
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanel('preview')}
                      className={clsx(
                        'px-[10px] py-[4px] rounded-[6px] text-[13px] font-[600] transition-all cursor-pointer',
                        rightPanel === 'preview' ? 'bg-[#612BD3] text-white' : 'text-textItemBlur hover:text-newTextColor'
                      )}
                    >
                      Preview
                    </button>
                  </div>
                  <div className="flex-1" />
                </>
              ) : (
                <div className="flex-1 text-[20px] font-[600]">{t('post_preview', 'Post Preview')}</div>
              )}
              <div className="cursor-pointer">
                <CloseIcon onClick={askClose} className="text-[#A3A3A3]" />
              </div>
            </div>
            <div className="flex-1 relative overflow-hidden min-h-0">
              {complianceFixMode && rightPanel === 'compliance' ? (
                <ComplianceReportPanel job={existingData.complianceJob} />
              ) : (
                <Scrollable
                  scrollClasses="!pe-[20px]"
                  className="absolute top-0 p-[20px] pe-[8px] left-0 w-full h-full overflow-x-hidden overflow-y-scroll scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner"
                >
                  <ShowAllProviders ref={ref} />
                </Scrollable>
              )}
            </div>
          </div>
        </div>
        </div>
        {editorActions.banner !== 'none' && !complianceFixMode && (
          <div
            className={clsx(
              'mx-[20px] mt-[12px] rounded-[8px] px-[16px] py-[12px] text-[14px] leading-snug border',
              editorActions.banner === 'fix' ||
                editorActions.banner === 'needs_revision'
                ? 'bg-red-500/10 border-red-500/30 text-textColor'
                : editorActions.banner === 'manual_review'
                  ? 'bg-amber-500/10 border-amber-500/30 text-textColor'
                  : 'bg-[#6b7280]/10 border-[#6b7280]/30 text-textColor'
            )}
          >
            {t(
              editorActions.bannerMessageKey,
              editorActions.bannerMessageDefault
            )}
          </div>
        )}
        <div className="select-none h-[84px] py-[20px] border-t border-newBorder flex items-center">
          <div className="flex-1 flex ps-[20px] gap-[8px]">
            {!dummy && (
              <TagsComponent
                name="tags"
                label={t('tags', 'Tags')}
                initial={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                }}
              />
            )}

            {!dummy && (
              <RepeatComponent repeat={repeater} onChange={setRepeater} />
            )}
          </div>
          <div className="pe-[20px] flex items-center justify-end gap-[8px]">
            {existingData?.integration && (
              <button
                onClick={deletePost}
                className="cursor-pointer flex text-[#FF3F3F] gap-[8px] items-center text-[15px] font-[600]"
              >
                <div>
                  <TrashIcon />
                </div>
                <div>{t('delete_post', 'Delete Post')}</div>
              </button>
            )}
            <DatePicker onChange={setDate} date={date} />
            {!addEditSets && editorActions.showSaveAsDraft && (
              <button
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
                className="relative cursor-pointer disabled:cursor-not-allowed px-[20px] h-[44px] bg-btnSimple justify-center items-center flex rounded-[8px] text-[15px] font-[600]"
              >
                {loading && (
                  <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
                    <div className="animate-spin h-[20px] w-[20px] border-4 border-textColor border-t-transparent rounded-full" />
                  </div>
                )}
                <div className={clsx(loading && 'invisible')}>
                  {t('save_as_draft', 'Save as Draft')}
                </div>
              </button>
            )}
            {addEditSets && (
              <button
                className="text-white text-[15px] font-[600] min-w-[180px] btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[44px] rounded-[8px] bg-[#612BD3] ps-[20px] pe-[16px]"
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
              >
                Save Set
              </button>
            )}
            {!addEditSets && (
              <div
                className={clsx(
                  editorActions.showPostNowHover && 'group cursor-pointer relative'
                )}
              >
                <button
                  disabled={
                    selectedIntegrations.length === 0 || loading || locked
                  }
                  onClick={primarySave}
                  className="text-white relative min-w-[180px] btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[44px] rounded-[8px] bg-[#612BD3] ps-[20px] pe-[16px]"
                >
                  {loading && (
                    <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
                      <div className="animate-spin h-[20px] w-[20px] border-4 border-white border-t-transparent rounded-full" />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'text-[15px] font-[600]',
                      loading && 'invisible'
                    )}
                  >
                    {selectedIntegrations.length === 0
                      ? t('check_circles_above', 'Check the circles above')
                      : dummy
                      ? t('create_output', 'Create output')
                      : t(
                          editorActions.primaryLabelKey,
                          editorActions.primaryLabelDefault
                        )}
                  </div>
                  {!dummy && editorActions.showPostNowHover && (
                    <div className="flex justify-center items-center h-[20px] w-[20px] pt-[4px] arrow-change">
                      <DropdownArrowSmallIcon className="group-hover:rotate-180 text-white" />
                    </div>
                  )}
                </button>

                {!dummy && editorActions.showPostNowHover && (
                  <button
                    type="button"
                    onClick={schedule('post_now')}
                    disabled={
                      selectedIntegrations.length === 0 || loading || locked
                    }
                    className="rounded-[8px] z-[300] disabled:cursor-not-allowed disabled:opacity-80 hidden group-hover:flex absolute bottom-[calc(100%+4px)] -left-[12px] p-[12px] w-[206px] bg-newBgColorInner"
                  >
                    <div className="text-white text-[15px] font-[600] rounded-[8px] bg-[#D82D7E] h-[44px] w-full flex justify-center items-center post-now">
                      {t('post_now', 'Post now')}
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Scrollable: FC<{
  className: string;
  scrollClasses: string;
  children: ReactNode;
}> = ({ className, scrollClasses, children }) => {
  const ref = useRef(undefined);
  const hasScroll = useHasScroll(ref);
  return (
    <div className={clsx(className, hasScroll && scrollClasses)} ref={ref}>
      {children}
    </div>
  );
};
