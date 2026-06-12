export type ComplianceEditorSaveType =
  | 'draft'
  | 'schedule'
  | 'update'
  | 'post_now';

export type ComplianceEditorBanner =
  | 'none'
  | 'fix'
  | 'needs_revision'
  | 'in_review'
  | 'manual_review';

export type ComplianceEditorJob = {
  status: string;
  decision?: string | null;
} | null;

export interface ComplianceEditorActions {
  showSaveAsDraft: boolean;
  showPostNowHover: boolean;
  primarySaveType: ComplianceEditorSaveType;
  primaryLabelKey: string;
  primaryLabelDefault: string;
  banner: ComplianceEditorBanner;
  bannerMessageKey: string;
  bannerMessageDefault: string;
}

export function getComplianceEditorActions(input: {
  complianceFixMode?: boolean;
  complianceJob: ComplianceEditorJob | undefined;
  isNewPost: boolean;
  isDraft: boolean;
  dummy?: boolean;
  addEditSets?: boolean;
}): ComplianceEditorActions {
  const defaultPrimary = input.isNewPost
    ? {
        primarySaveType: 'schedule' as const,
        primaryLabelKey: 'add_to_calendar',
        primaryLabelDefault: 'Add to calendar',
      }
    : input.isDraft
      ? {
          primarySaveType: 'schedule' as const,
          primaryLabelKey: 'schedule',
          primaryLabelDefault: 'Schedule',
        }
      : {
          primarySaveType: 'schedule' as const,
          primaryLabelKey: 'update',
          primaryLabelDefault: 'Update',
        };

  const fullDefault: ComplianceEditorActions = {
    showSaveAsDraft: true,
    showPostNowHover: !input.dummy,
    banner: 'none',
    bannerMessageKey: '',
    bannerMessageDefault: '',
    ...defaultPrimary,
  };

  if (input.dummy || input.addEditSets) {
    return {
      ...fullDefault,
      showPostNowHover: !input.dummy,
    };
  }

  const job = input.complianceJob;
  const status = job?.status;
  const decision = job?.decision;
  const inReview = status === 'pending' || status === 'running';
  const manualReview =
    status === 'completed' && decision === 'Needs Compliance Review';
  const needsRevision =
    input.complianceFixMode ||
    (status === 'completed' && decision === 'Rejected') ||
    status === 'failed' ||
    status === 'timeout' ||
    status === 'cancelled' ||
    manualReview;

  if (!input.isNewPost && needsRevision) {
    return {
      showSaveAsDraft: false,
      showPostNowHover: false,
      primarySaveType: 'update',
      primaryLabelKey: 'save_and_recheck',
      primaryLabelDefault: 'Save & recheck',
      banner: input.complianceFixMode
        ? 'fix'
        : manualReview
          ? 'manual_review'
          : 'needs_revision',
      bannerMessageKey: input.complianceFixMode
        ? 'compliance_fix_banner'
        : manualReview
          ? 'compliance_manual_review_banner'
          : 'compliance_needs_revision_banner',
      bannerMessageDefault: input.complianceFixMode
        ? 'Fix the content below, then save to run Content Cop again.'
        : manualReview
          ? 'This post is under compliance review. Save changes to send an updated version for recheck.'
          : 'Content Cop flagged issues. Update your post and save to run another check.',
    };
  }

  if (!input.isNewPost && inReview) {
    return {
      ...fullDefault,
      showPostNowHover: false,
      primarySaveType: 'update',
      primaryLabelKey: 'update',
      primaryLabelDefault: 'Update',
      banner: 'in_review',
      bannerMessageKey: 'compliance_in_review_banner',
      bannerMessageDefault:
        'Content Cop is reviewing this post. You can save edits; a new check runs after the current one finishes.',
    };
  }

  return fullDefault;
}
