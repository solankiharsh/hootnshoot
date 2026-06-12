'use client';

import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { GithubProvider } from '@gitroom/frontend/components/auth/providers/github.provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { GoogleProvider } from '@gitroom/frontend/components/auth/providers/google.provider';
import { OauthProvider } from '@gitroom/frontend/components/auth/providers/oauth.provider';
import { useFireEvents } from '@gitroom/helpers/utils/use.fire.events';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useTrack } from '@gitroom/react/helpers/use.track';
import { TrackEnum } from '@gitroom/nestjs-libraries/user/track.enum';
import { FarcasterProvider } from '@gitroom/frontend/components/auth/providers/farcaster.provider';
import dynamic from 'next/dynamic';
import { WalletUiProvider } from '@gitroom/frontend/components/auth/providers/placeholder/wallet.ui.provider';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import useCookie from 'react-use-cookie';
const WalletProvider = dynamic(
  () => import('@gitroom/frontend/components/auth/providers/wallet.provider'),
  {
    ssr: false,
    loading: () => <WalletUiProvider />,
  }
);
type Inputs = {
  email: string;
  password: string;
  providerToken: string;
  provider: string;
};
export function Register() {
  const searchParams = useSearchParams();
  const fetch = useFetch();
  const provider = searchParams.get('provider')?.toUpperCase() ?? '';
  const authCode = searchParams.get('code') ?? '';
  const oauthState = searchParams.get('state') ?? '';
  const googleError = searchParams.get('error');
  const googleErrorDescription = searchParams.get('error_description');
  const [oauthSettled, setOauthSettled] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const oauthExchangeStarted = useRef(false);
  const [datafast_visitor_id] = useCookie('datafast_visitor_id');

  useEffect(() => {
    if (!provider || !authCode || oauthExchangeStarted.current) {
      return;
    }
    oauthExchangeStarted.current = true;
    const redirect_uri =
      provider === 'GENERIC'
        ? `${window.location.origin}/settings`
        : `${window.location.origin}/auth?provider=${provider}`;
    void (async () => {
      try {
        const res = await fetch(`/auth/oauth/${provider}/exists`, {
          method: 'POST',
          body: JSON.stringify({
            code: authCode,
            redirect_uri,
            state: oauthState,
            datafast_visitor_id: datafast_visitor_id || '',
          }),
        });
        const raw = await res.text();
        const data = (() => {
          try {
            return JSON.parse(raw) as {
              login?: boolean;
              message?: string;
            };
          } catch {
            return {} as { login?: boolean; message?: string };
          }
        })();
        setOauthSettled(true);
        if (!res.ok) {
          setOauthError(
            data.message ||
              raw ||
              'Sign-in with Google failed. Try again or contact support.'
          );
          oauthExchangeStarted.current = false;
          return;
        }
        if (data.login) {
          if (res.headers.get('onboarding')) {
            window.location.assign('/auth/onboarding');
          } else if (!res.headers.get('reload')) {
            window.location.assign('/launches');
          }
          return;
        }
        setOauthError('Unexpected response from the server.');
        oauthExchangeStarted.current = false;
      } catch {
        setOauthSettled(true);
        setOauthError('Could not reach the server to finish Google sign-in.');
        oauthExchangeStarted.current = false;
      }
    })();
  }, [provider, authCode, oauthState, fetch, datafast_visitor_id]);

  if (googleError) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-md">
        <p className="text-red-400 text-sm">
          {(() => {
            const msg = googleErrorDescription || googleError;
            try {
              return decodeURIComponent(msg.replace(/\+/g, ' '));
            } catch {
              return msg;
            }
          })()}
        </p>
        <Link href="/auth" className="underline text-sm">
          Back to sign up
        </Link>
      </div>
    );
  }

  if (!authCode && !provider) {
    return <RegisterAfter token="" provider="LOCAL" />;
  }

  if (provider && !authCode) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-md">
        <p className="text-amber-400 text-sm">
          Missing authorization code. Start sign-in from the sign up page again.
        </p>
        <Link href="/auth" className="underline text-sm">
          Back to sign up
        </Link>
      </div>
    );
  }
  if (oauthError) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-md">
        <p className="text-red-400 text-sm">{oauthError}</p>
        <Link href="/auth" className="underline text-sm">
          Back to sign up
        </Link>
      </div>
    );
  }
  if (provider && authCode && !oauthSettled) {
    return <LoadingComponent />;
  }
  if (provider && authCode && oauthSettled && !oauthError) {
    return null;
  }
  return <RegisterAfter token="" provider="LOCAL" />;
}
function getHelpfulReasonForRegistrationFailure(httpCode: number) {
  switch (httpCode) {
    case 400:
      return 'Email already exists';
    case 404:
      return 'Your browser got a 404 when trying to contact the API, the most likely reasons for this are the NEXT_PUBLIC_BACKEND_URL is set incorrectly, or the backend is not running.';
  }
  return 'Unhandled error: ' + httpCode;
}
export function RegisterAfter({
  token,
  provider,
}: {
  token: string;
  provider: string;
}) {
  const t = useT();
  const { isGeneral, genericOauth, neynarClientId, billingEnabled } =
    useVariables();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fireEvents = useFireEvents();
  const track = useTrack();
  const [datafast_visitor_id] = useCookie('datafast_visitor_id');
  const isAfterProvider = useMemo(() => {
    return !!token && !!provider;
  }, [token, provider]);
  const resolver = useMemo(() => {
    return classValidatorResolver(CreateOrgUserDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    defaultValues: {
      providerToken: token,
      provider: provider,
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    await fetchData('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        datafast_visitor_id,
      }),
    })
      .then(async (response) => {
        setLoading(false);
        if (response.status === 200) {
          fireEvents('register');
          return track(TrackEnum.CompleteRegistration).then(() => {
            if (response.headers.get('activate') === 'true') {
              router.push('/auth/activate');
            } else {
              router.push('/auth/login');
            }
          });
        } else {
          form.setError('email', {
            message: await response.text(),
          });
        }
      })
      .catch((e) => {
        form.setError('email', {
          message:
            'General error: ' +
            e.toString() +
            '. Please check your browser console.',
        });
      });
  };
  return (
    <FormProvider {...form}>
      <form className="w-full" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col">
          <div className="mb-[32px]" style={{ textAlign: 'center' }}>
            <h1
              className="text-[40px] font-[700] text-[#1A1A1A] mb-[8px]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-1px' }}
            >
              {t('sign_up', 'Join Hootnshoot')}
            </h1>
            <p className="text-[14px]" style={{ color: '#888480' }}>
              Start scheduling smarter today
            </p>
          </div>
          <div className="flex flex-col">
            {!isAfterProvider &&
              (!isGeneral ? (
                <GithubProvider />
              ) : (
                <div className="flex flex-col gap-[12px]">
                  {genericOauth && isGeneral ? (
                    <OauthProvider />
                  ) : (
                    <GoogleProvider />
                  )}
                  {!!neynarClientId && <FarcasterProvider />}
                  {billingEnabled && <WalletProvider />}
                </div>
              ))}
            {/* SSO-only: email/password and below hidden
            {!isAfterProvider && (
              <div className="h-[20px] mb-[24px] mt-[24px] relative">
                <div className="absolute w-full h-[1px] bg-fifth top-[50%] -translate-y-[50%]" />
                <div
                  className={`absolute z-[1] justify-center items-center w-full start-0 -top-[4px] flex`}
                >
                  <div className="px-[16px]">{t('or', 'or')}</div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-[12px]">
              <div className="text-textColor">
                {!isAfterProvider && (
                  <>
                    <Input
                      label="Email"
                      translationKey="label_email"
                      {...form.register('email')}
                      type="email"
                      placeholder={t('email_address', 'Email Address')}
                    />
                    <Input
                      label="Password"
                      translationKey="label_password"
                      {...form.register('password')}
                      autoComplete="off"
                      type="password"
                      placeholder={t('label_password', 'Password')}
                    />
                  </>
                )}
              </div>
              <div className={clsx('text-[12px]')}>
                {t(
                  'by_registering_you_agree_to_our',
                  'By registering you agree to our'
                )}
                &nbsp;
                <a
                  href={`https://hootnshoot.app/terms`}
                  className="underline hover:font-bold"
                  rel="nofollow"
                >
                  {t('terms_of_service', 'Terms of Service')}
                </a>
                &nbsp;
                {t('and', 'and')}&nbsp;
                <a
                  href={`https://hootnshoot.app/privacy`}
                  rel="nofollow"
                  className="underline hover:font-bold"
                >
                  {t('privacy_policy', 'Privacy Policy')}
                </a>
                &nbsp;
              </div>
              <div className="text-center mt-6">
                <div className="w-full flex">
                  <Button
                    type="submit"
                    className="flex-1 rounded-[10px] !h-[52px]"
                    loading={loading}
                  >
                    {t('create_account', 'Create Account')}
                  </Button>
                </div>
                <p className="mt-4 text-sm">
                  {t('already_have_an_account', 'Already Have An Account?')}
                  &nbsp;
                  <Link
                    href="/auth/login"
                    className="underline  cursor-pointer"
                  >
                    {t('sign_in', 'Sign In')}
                  </Link>
                </p>
              </div>
            </div>
            */}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
