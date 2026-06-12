import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  ORG_API_KEYS,
  ORG_API_KEY_IDENTIFIERS,
  OrgApiKeyIdentifier,
  isOrgApiKeyIdentifier,
} from '@gitroom/nestjs-libraries/org-api-keys/org-api-key.constants';
import {
  registerOrgApiKeyFetcher,
  invalidateOrgApiKeyCache,
  resolveOrgApiKey,
} from '@gitroom/nestjs-libraries/org-api-keys/org-api-key.store';

export interface OrgApiKeySlot {
  identifier: string;
  label: string;
  description: string;
  docsUrl: string;
  configured: boolean; // org has its own key
  hasServerDefault: boolean; // env var present as fallback
  maskedKey: string | null;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

@Injectable()
export class OrgApiKeyService implements OnModuleInit {
  constructor(private _thirdParty: PrismaRepository<'thirdParty'>) {}

  onModuleInit() {
    // Bridge DB lookups into the non-DI store used by plain provider classes
    registerOrgApiKeyFetcher(async (organizationId, identifier) => {
      const row = await this._thirdParty.model.thirdParty.findFirst({
        where: {
          organizationId,
          identifier,
          internalId: identifier,
          deletedAt: null,
        },
        select: { apiKey: true },
      });
      return row?.apiKey ?? null;
    });
  }

  private getRow(organizationId: string, identifier: string) {
    return this._thirdParty.model.thirdParty.findFirst({
      where: {
        organizationId,
        identifier,
        internalId: identifier,
        deletedAt: null,
      },
    });
  }

  async list(organizationId: string): Promise<OrgApiKeySlot[]> {
    const rows = await this._thirdParty.model.thirdParty.findMany({
      where: {
        organizationId,
        identifier: { in: ORG_API_KEY_IDENTIFIERS },
        deletedAt: null,
      },
      select: { identifier: true, apiKey: true },
    });
    const byIdentifier = new Map(rows.map((r) => [r.identifier, r]));

    return ORG_API_KEY_IDENTIFIERS.map((identifier) => {
      const meta = ORG_API_KEYS[identifier];
      const row = byIdentifier.get(identifier);
      let maskedKey: string | null = null;
      if (row) {
        try {
          maskedKey = maskKey(AuthService.fixedDecryption(row.apiKey));
        } catch {
          maskedKey = '••••••••';
        }
      }
      return {
        identifier,
        label: meta.label,
        description: meta.description,
        docsUrl: meta.docsUrl,
        configured: !!row,
        hasServerDefault: meta.envVars.some((v) => !!process.env[v]?.trim()),
        maskedKey,
      };
    });
  }

  async save(
    organizationId: string,
    identifier: OrgApiKeyIdentifier,
    apiKey: string
  ) {
    const valid = await this.validateKey(identifier, apiKey);
    if (!valid) {
      return { valid: false as const };
    }
    await this._thirdParty.model.thirdParty.upsert({
      where: {
        organizationId_internalId: {
          organizationId,
          internalId: identifier,
        },
      },
      create: {
        organizationId,
        identifier,
        internalId: identifier,
        name: ORG_API_KEYS[identifier].label,
        apiKey: AuthService.fixedEncryption(apiKey),
        deletedAt: null,
      },
      update: {
        identifier,
        name: ORG_API_KEYS[identifier].label,
        apiKey: AuthService.fixedEncryption(apiKey),
        deletedAt: null,
      },
    });
    await invalidateOrgApiKeyCache(organizationId, identifier);
    return { valid: true as const };
  }

  async remove(organizationId: string, identifier: string) {
    const row = await this.getRow(organizationId, identifier);
    if (row) {
      await this._thirdParty.model.thirdParty.update({
        where: { id: row.id },
        data: { deletedAt: new Date() },
      });
    }
    await invalidateOrgApiKeyCache(organizationId, identifier);
    return { removed: !!row };
  }

  /** Test whatever key currently resolves for the org (own key or server default). */
  async test(organizationId: string, identifier: OrgApiKeyIdentifier) {
    const key = await resolveOrgApiKey(identifier, organizationId);
    if (!key) return { configured: false, valid: false };
    return { configured: true, valid: await this.validateKey(identifier, key) };
  }

  async validateKey(
    identifier: OrgApiKeyIdentifier,
    apiKey: string
  ): Promise<boolean> {
    if (!isOrgApiKeyIdentifier(identifier) || !apiKey?.trim()) return false;
    try {
      switch (identifier) {
        case 'late-api': {
          const base =
            process.env.LATE_API_URL?.trim() || 'https://getlate.dev/api/v1';
          const res = await fetch(`${base}/profiles`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          return res.ok;
        }
        case 'openai': {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          return res.ok;
        }
        case 'gemini': {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
          );
          return res.ok;
        }
        case 'replicate': {
          const res = await fetch('https://api.replicate.com/v1/account', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          return res.ok;
        }
        default:
          return false;
      }
    } catch (err) {
      console.error(`[OrgApiKey] validation request failed for ${identifier}`, err);
      return false;
    }
  }
}
