import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import {
  ThirdPartyAbstract,
  ThirdPartyParams,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { ModuleRef } from '@nestjs/core';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';
import { HeygenProvider } from '@gitroom/nestjs-libraries/3rdparties/heygen/heygen.provider';
import { Gener8Provider } from '@gitroom/nestjs-libraries/3rdparties/gener8/gener8.provider';
import { AuroraProvider } from '@gitroom/nestjs-libraries/3rdparties/aurora/aurora.provider';

type ThirdPartyRegistryEntry = ThirdPartyParams & {
  target: Type<ThirdPartyAbstract>;
};

const STATIC_THIRD_PARTY_PROVIDERS: ThirdPartyRegistryEntry[] = [
  {
    identifier: 'heygen',
    title: 'HeyGen',
    description:
      'HeyGen is a platform for creating AI-generated avatars videos.',
    position: 'media',
    fields: [],
    target: HeygenProvider,
  },
  {
    identifier: 'gener8',
    title: 'Gener8',
    description: 'Generate branded images using Gener8 AI.',
    position: 'media',
    fields: [],
    target: Gener8Provider,
  },
  {
    identifier: 'aurora',
    title: 'Aurora',
    description: 'Generate campaign and lifestyle images using Aurora AI.',
    position: 'media',
    fields: [],
    target: AuroraProvider,
  },
];

function isRemovedThirdPartyIdentifier(identifier: string | undefined): boolean {
  if (!identifier) {
    return false;
  }
  const normalized = identifier.toLowerCase().replace(/[.\-_]/g, '');
  return normalized === 'reelfarm';
}

/** DB rows may use wrong casing or confuse internalId with identifier for builtins. */
function canonicalThirdPartyIdentifier(raw: string | undefined): string {
  if (!raw) {
    return '';
  }
  const t = raw.trim().toLowerCase().replace(/[.\-_]/g, '');
  if (t === 'gener8builtin') {
    return 'gener8';
  }
  if (t === 'aurorabuiltin') {
    return 'aurora';
  }
  return raw.trim().toLowerCase();
}

function activeThirdPartyMetadata(): any[] {
  const byCanon = new Map<string, any>();
  for (const entry of STATIC_THIRD_PARTY_PROVIDERS) {
    if (!isRemovedThirdPartyIdentifier(entry.identifier)) {
      byCanon.set(canonicalThirdPartyIdentifier(entry.identifier), entry);
    }
  }
  const reflectRaw =
    Reflect.getMetadata('third:party', ThirdPartyAbstract) || [];
  for (const p of reflectRaw) {
    if (isRemovedThirdPartyIdentifier(p?.identifier)) {
      continue;
    }
    const k = canonicalThirdPartyIdentifier(p?.identifier);
    if (!byCanon.has(k)) {
      byCanon.set(k, p);
    }
  }
  return Array.from(byCanon.values());
}

@Injectable()
export class ThirdPartyManager implements OnModuleInit {
  constructor(
    private _moduleRef: ModuleRef,
    private _thirdPartyService: ThirdPartyService
  ) {}

  async onModuleInit() {
    await this._thirdPartyService.softDeleteByIdentifiers([
      'reelfarm',
      'reel-farm',
      'reel.farm',
      'ReelFarm',
    ]);
  }

  getAllThirdParties(): any[] {
    return activeThirdPartyMetadata().map((p: any) => ({
      identifier: p.identifier,
      title: p.title,
      description: p.description,
      fields: p.fields || [],
    }));
  }

  getSupportedThirdPartyIdentifiers(): string[] {
    return activeThirdPartyMetadata()
      .map((p: { identifier?: string }) => p.identifier)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  getThirdPartyByName(
    identifier: string
  ): (ThirdPartyParams & { instance: ThirdPartyAbstract }) | undefined {
    if (isRemovedThirdPartyIdentifier(identifier)) {
      return undefined;
    }

    const canon = canonicalThirdPartyIdentifier(identifier);
    const thirdParty = activeThirdPartyMetadata().find(
      (p: any) => canonicalThirdPartyIdentifier(p.identifier) === canon
    );

    if (!thirdParty) {
      return undefined;
    }

    return { ...thirdParty, instance: this._moduleRef.get(thirdParty.target) };
  }

  deleteIntegration(org: string, id: string) {
    return this._thirdPartyService.deleteIntegration(org, id);
  }

  getIntegrationById(org: string, id: string) {
    return this._thirdPartyService.getIntegrationById(org, id);
  }

  getAllThirdPartiesByOrganization(org: string) {
    return this._thirdPartyService.getAllThirdPartiesByOrganization(org);
  }

  async ensureGener8IntegrationIfConfigured(organizationId: string): Promise<void> {
    if (!process.env.GENER8_API_KEY?.trim()) {
      return;
    }
    await this.saveIntegration(organizationId, 'gener8', 'gener8-builtin', {
      name: 'Gener8',
      username: 'gener8',
      id: 'gener8-builtin',
    });
  }

  async ensureAuroraIntegrationIfConfigured(organizationId: string): Promise<void> {
    if (!process.env.AURORA_API_KEY?.trim() && !process.env.VIDEO_CLUSTER_API_KEY?.trim()) {
      return;
    }
    await this.saveIntegration(organizationId, 'aurora', 'aurora-builtin', {
      name: 'Aurora',
      username: 'aurora',
      id: 'aurora-builtin',
    });
  }

  saveIntegration(
    org: string,
    identifier: string,
    apiKey: string,
    data: { name: string; username: string; id: string }
  ) {
    return this._thirdPartyService.saveIntegration(
      org,
      identifier,
      apiKey,
      data
    );
  }
}
