import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';
import { HttpException, HttpStatus } from '@nestjs/common';

function oidcEndpointsFromIssuer(issuer: string): {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
} {
  if (/\/oauth2\//i.test(issuer)) {
    return {
      authUrl: `${issuer}/v1/authorize`,
      tokenUrl: `${issuer}/v1/token`,
      userInfoUrl: `${issuer}/v1/userinfo`,
    };
  }
  const base = `${issuer}/oauth2/v1`;
  return {
    authUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
    userInfoUrl: `${base}/userinfo`,
  };
}

@AuthProvider({ provider: 'GENERIC' })
export class OauthProvider extends AuthProviderAbstract {
  private getConfig() {
    const {
      HOOTNSHOOT_OAUTH_AUTH_URL,
      HOOTNSHOOT_OAUTH_CLIENT_ID,
      HOOTNSHOOT_OAUTH_CLIENT_SECRET,
      HOOTNSHOOT_OAUTH_TOKEN_URL,
      HOOTNSHOOT_OAUTH_USERINFO_URL,
      OKTA_ISSUER,
      FRONTEND_URL,
    } = process.env;

    const issuer = (OKTA_ISSUER || '').trim().replace(/\/+$/, '');
    const useOktaIssuer =
      !!issuer &&
      !!HOOTNSHOOT_OAUTH_CLIENT_ID &&
      !!HOOTNSHOOT_OAUTH_CLIENT_SECRET;

    const derived = useOktaIssuer ? oidcEndpointsFromIssuer(issuer) : null;

    const authUrl =
      HOOTNSHOOT_OAUTH_AUTH_URL || (derived ? derived.authUrl : '');
    const tokenUrl =
      HOOTNSHOOT_OAUTH_TOKEN_URL || (derived ? derived.tokenUrl : '');
    const userInfoUrl =
      HOOTNSHOOT_OAUTH_USERINFO_URL || (derived ? derived.userInfoUrl : '');
    const clientId = HOOTNSHOOT_OAUTH_CLIENT_ID || '';
    const clientSecret = HOOTNSHOOT_OAUTH_CLIENT_SECRET || '';

    if (
      !userInfoUrl ||
      !tokenUrl ||
      !clientId ||
      !clientSecret ||
      !authUrl ||
      !FRONTEND_URL
    ) {
      throw new HttpException(
        'Generic OAuth is not configured. Set HOOTNSHOOT_OAUTH_CLIENT_ID and HOOTNSHOOT_OAUTH_CLIENT_SECRET, OKTA_ISSUER (optional bare org URL, e.g. https://deriv.okta.com), and FRONTEND_URL; or set HOOTNSHOOT_OAUTH_AUTH_URL, HOOTNSHOOT_OAUTH_TOKEN_URL, and HOOTNSHOOT_OAUTH_USERINFO_URL explicitly (those override issuer-derived URLs).',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return {
      authUrl,
      clientId,
      clientSecret,
      tokenUrl,
      userInfoUrl,
      frontendUrl: FRONTEND_URL,
    };
  }

  generateLink(query?: { state?: string }): string {
    const { authUrl, clientId, frontendUrl } = this.getConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'openid profile email',
      response_type: 'code',
      redirect_uri: `${frontendUrl}/settings`,
    });
    if (query?.state) {
      params.set('state', query.state);
    }

    return `${authUrl}?${params.toString()}`;
  }

  async getToken(code: string, _redirectUri?: string): Promise<string> {
    const { tokenUrl, clientId, clientSecret, frontendUrl } = this.getConfig();
    const response = await fetch(`${tokenUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${frontendUrl}/settings`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token request failed: ${error}`);
    }

    const { access_token } = await response.json();
    return access_token;
  }

  async getUser(access_token: string): Promise<{ email: string; id: string }> {
    const { userInfoUrl } = this.getConfig();
    const response = await fetch(`${userInfoUrl}`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`User info request failed: ${error}`);
    }

    const { email, sub: id } = await response.json();
    return { email, id };
  }
}
