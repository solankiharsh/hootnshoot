import {
  Body,
  Controller,
  Get,
  HttpException,
  Logger,
  Param,
  Post,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ImportMediaDto } from '@gitroom/nestjs-libraries/dtos/third-party/import-media.dto';
import { ImageService } from '@gitroom/nestjs-libraries/image/image.service.interface';
import {
  gener8SendPayloadToImageBrief,
  type Gener8SendPayload,
} from '@gitroom/nestjs-libraries/3rdparties/gener8/gener8.provider';
import {
  signGener8JobToken,
  verifyGener8JobToken,
} from '@gitroom/nestjs-libraries/3rdparties/gener8/gener8-job-token';
import { PostUploadDecomposeService } from '@gitroom/nestjs-libraries/templates/post-upload-decompose.service';

@ApiTags('Third Party')
@Controller('/third-party')
export class ThirdPartyController {
  private readonly logger = new Logger(ThirdPartyController.name);
  private storage = UploadFactory.createStorage();

  constructor(
    private _thirdPartyManager: ThirdPartyManager,
    private _mediaService: MediaService,
    private _imageService: ImageService,
    private _postUploadDecompose: PostUploadDecomposeService
  ) {}

  private rejectUnknownThirdPartyPlugin(
    context: string,
    integrationId: string | undefined,
    identifierFromDb: string
  ): never {
    const supported =
      this._thirdPartyManager.getSupportedThirdPartyIdentifiers().join(', ');
    this.logger.warn(
      `third_party.invalid_plugin context=${context} integrationId=${integrationId ?? 'n/a'} identifierFromDb=${JSON.stringify(identifierFromDb)} supportedPlugins=${supported}`
    );
    throw new HttpException('Invalid identifier', 400);
  }

  @Get('/list')
  async getThirdPartyList() {
    return this._thirdPartyManager
      .getAllThirdParties()
      .filter(
        (p: { identifier: string }) =>
          p.identifier !== 'gener8' && p.identifier !== 'aurora'
      );
  }

  @Get('/')
  async getSavedThirdParty(@GetOrgFromRequest() organization: Organization) {
    await this._thirdPartyManager.ensureGener8IntegrationIfConfigured(
      organization.id
    );
    await this._thirdPartyManager.ensureAuroraIntegrationIfConfigured(
      organization.id
    );
    const mapped = await Promise.all(
      (
        await this._thirdPartyManager.getAllThirdPartiesByOrganization(
          organization.id
        )
      ).map((thirdParty) => {
        const registered = this._thirdPartyManager.getThirdPartyByName(
          thirdParty.identifier
        );
        if (!registered) {
          return {
            id: thirdParty.id,
            name: thirdParty.name,
            identifier: thirdParty.identifier,
            title: thirdParty.name,
            description:
              'This integration is no longer available. Remove it from the menu.',
            position: 'webhook' as const,
            fields: [],
          };
        }
        const { description, fields, position, title, identifier: pluginId } =
          registered;
        return {
          id: thirdParty.id,
          name: thirdParty.name,
          identifier: pluginId,
          title,
          position,
          fields,
          description,
        };
      })
    );
    const missingId = mapped.filter(
      (row: { id?: string }) => !row?.id || String(row.id).trim() === ''
    );
    if (missingId.length > 0) {
      this.logger.error(
        `event=third_party.list status=invalid_payload orgId=${organization.id} missingIdCount=${missingId.length} identifiers=${missingId.map((r: { identifier?: string }) => r.identifier ?? 'n/a').join(',')}`
      );
    }
    return mapped;
  }

  @Delete('/:id')
  deleteById(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    return this._thirdPartyManager.deleteIntegration(organization.id, id);
  }

  private parseGener8AsyncBody(data: unknown): Gener8SendPayload {
    if (!data || typeof data !== 'object') {
      throw new HttpException('Invalid body', 400);
    }
    const o = data as Record<string, unknown>;
    if (typeof o.inputText !== 'string' || !o.inputText.trim()) {
      throw new HttpException('inputText is required', 400);
    }
    if (typeof o.aspectRatio !== 'string' || !o.aspectRatio.trim()) {
      throw new HttpException('aspectRatio is required', 400);
    }
    if (!Array.isArray(o.personas) || o.personas.length === 0) {
      throw new HttpException('personas must be a non-empty array', 400);
    }
    if (typeof o.onBrand !== 'boolean' || typeof o.disclaimer !== 'boolean') {
      throw new HttpException('onBrand and disclaimer are required', 400);
    }
    const personas = o.personas.filter((p): p is string => typeof p === 'string');
    if (!personas.length) {
      throw new HttpException('personas must contain strings', 400);
    }
    const resolution = o.resolution;
    return {
      inputText: o.inputText,
      aspectRatio: o.aspectRatio,
      resolution:
        resolution === '1K' || resolution === '2K' || resolution === '4K'
          ? resolution
          : undefined,
      personas,
      onBrand: o.onBrand,
      disclaimer: o.disclaimer,
      logo: typeof o.logo === 'string' ? o.logo : undefined,
    };
  }

  private async requireGener8Integration(
    organization: Organization,
    integrationId: string
  ) {
    await this._thirdPartyManager.ensureGener8IntegrationIfConfigured(
      organization.id
    );
    const thirdParty = await this._thirdPartyManager.getIntegrationById(
      organization.id,
      integrationId
    );
    if (!thirdParty) {
      throw new HttpException('Integration not found', 404);
    }
    const registered = this._thirdPartyManager.getThirdPartyByName(
      thirdParty.identifier
    );
    if (!registered || registered.identifier !== 'gener8') {
      throw new HttpException('Not a Gener8 integration', 400);
    }
    if (!process.env.GENER8_API_KEY?.trim()) {
      throw new HttpException('GENER8 not configured', 503);
    }
    return thirdParty;
  }

  private verifyGener8JobTokenForIntegration(
    jobToken: string,
    organizationId: string,
    integrationId: string
  ) {
    let payload: ReturnType<typeof verifyGener8JobToken>;
    try {
      payload = verifyGener8JobToken(jobToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid job token';
      throw new HttpException(msg, 400);
    }
    if (
      payload.organizationId !== organizationId ||
      payload.integrationId !== integrationId
    ) {
      throw new HttpException('Forbidden', 403);
    }
    return payload;
  }

  @Post('/:id/gener8/submit-async')
  async gener8SubmitAsync(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') integrationId: string,
    @Body() data: unknown
  ) {
    await this.requireGener8Integration(organization, integrationId);
    const payload = this.parseGener8AsyncBody(data);
    const brief = gener8SendPayloadToImageBrief(payload);
    const { jobId } = await this._imageService.submit(brief);
    const jobToken = signGener8JobToken({
      jobId,
      integrationId,
      organizationId: organization.id,
    });
    return { jobToken };
  }

  @Post('/:id/gener8/job-status')
  async gener8JobStatus(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') integrationId: string,
    @Body() body: { jobToken?: string }
  ) {
    await this.requireGener8Integration(organization, integrationId);
    const jobToken =
      typeof body?.jobToken === 'string' ? body.jobToken.trim() : '';
    if (!jobToken) {
      throw new HttpException('jobToken is required', 400);
    }
    const { jobId } = this.verifyGener8JobTokenForIntegration(
      jobToken,
      organization.id,
      integrationId
    );
    return this._imageService.getStatus(jobId);
  }

  @Post('/:id/gener8/complete')
  async gener8Complete(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') integrationId: string,
    @Body() body: { jobToken?: string }
  ) {
    await this.requireGener8Integration(organization, integrationId);
    const jobToken =
      typeof body?.jobToken === 'string' ? body.jobToken.trim() : '';
    if (!jobToken) {
      throw new HttpException('jobToken is required', 400);
    }
    const { jobId } = this.verifyGener8JobTokenForIntegration(
      jobToken,
      organization.id,
      integrationId
    );
    const status = await this._imageService.getStatus(jobId);
    if (status.status !== 'completed') {
      throw new HttpException('Job is not completed yet', 409);
    }
    const result = await this._imageService.getResult(jobId);
    const url = result.images?.[0];
    if (!url || typeof url !== 'string') {
      throw new HttpException('Gener8 returned no image URL', 502);
    }
    const file = await this.storage.uploadSimple(url);
    const saved = await this._mediaService.saveFile(
      organization.id,
      file.split('/').pop(),
      file
    );
    if (saved?.id) {
      void this._postUploadDecompose.decomposeAndAttach({
        mediaId: saved.id,
        imageUrl: file,
      });
    }
    return saved;
  }

  @Post('/:id/submit')
  async generate(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Body() data: any
  ) {
    await this._thirdPartyManager.ensureGener8IntegrationIfConfigured(
      organization.id
    );
    await this._thirdPartyManager.ensureAuroraIntegrationIfConfigured(
      organization.id
    );
    const thirdParty = await this._thirdPartyManager.getIntegrationById(
      organization.id,
      id
    );

    if (!thirdParty) {
      this.logger.warn(
        `event=third_party.submit status=not_found orgId=${organization.id} integrationId=${id}`
      );
      throw new HttpException('Integration not found', 404);
    }

    this.logger.log(
      `event=third_party.submit status=started orgId=${organization.id} integrationId=${id} identifier=${thirdParty.identifier}`
    );

    const thirdPartyInstance = this._thirdPartyManager.getThirdPartyByName(
      thirdParty.identifier
    );

    if (!thirdPartyInstance) {
      this.rejectUnknownThirdPartyPlugin('submit', id, thirdParty.identifier);
    }

    const loadedData = await thirdPartyInstance?.instance?.sendData(
      AuthService.fixedDecryption(thirdParty.apiKey),
      data
    );

    const file = await this.storage.uploadSimple(loadedData);
    return this._mediaService.saveFile(organization.id, file.split('/').pop(), file);
  }

  @Post('/function/:id/:functionName')
  async callFunction(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Param('functionName') functionName: string,
    @Body() data: any
  ) {
    await this._thirdPartyManager.ensureGener8IntegrationIfConfigured(
      organization.id
    );
    await this._thirdPartyManager.ensureAuroraIntegrationIfConfigured(
      organization.id
    );
    const thirdParty = await this._thirdPartyManager.getIntegrationById(
      organization.id,
      id
    );

    if (!thirdParty) {
      throw new HttpException('Integration not found', 404);
    }

    const thirdPartyInstance = this._thirdPartyManager.getThirdPartyByName(
      thirdParty.identifier
    );

    if (!thirdPartyInstance) {
      this.rejectUnknownThirdPartyPlugin('function', id, thirdParty.identifier);
    }

    return thirdPartyInstance?.instance?.[functionName](
      AuthService.fixedDecryption(thirdParty.apiKey),
      data
    );
  }

  @Post('/:id/import')
  async importMedia(
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Body() body: ImportMediaDto
  ) {
    await this._thirdPartyManager.ensureGener8IntegrationIfConfigured(
      organization.id
    );
    await this._thirdPartyManager.ensureAuroraIntegrationIfConfigured(
      organization.id
    );
    const thirdParty = await this._thirdPartyManager.getIntegrationById(
      organization.id,
      id
    );

    if (!thirdParty) {
      throw new HttpException('Integration not found', 404);
    }

    const thirdPartyInstance = this._thirdPartyManager.getThirdPartyByName(
      thirdParty.identifier
    );

    if (!thirdPartyInstance) {
      this.rejectUnknownThirdPartyPlugin('import', id, thirdParty.identifier);
    }

    const downloadUrls = await thirdPartyInstance?.instance?.['importMedia']?.(
      AuthService.fixedDecryption(thirdParty.apiKey),
      body.items
    );

    if (!downloadUrls || !Array.isArray(downloadUrls)) {
      throw new HttpException('Import not supported', 400);
    }

    const results = [];
    for (const item of downloadUrls) {
      const file = await this.storage.uploadSimple(item.url);
      const saved = await this._mediaService.saveFile(
        organization.id,
        item.name || file.split('/').pop(),
        file
      );
      results.push(saved);
    }

    return results;
  }

  @Post('/:identifier')
  async addApiKey(
    @GetOrgFromRequest() organization: Organization,
    @Param('identifier') identifier: string,
    @Body('api') api: string
  ) {
    const thirdParty = this._thirdPartyManager.getThirdPartyByName(identifier);
    if (!thirdParty) {
      const supported =
        this._thirdPartyManager.getSupportedThirdPartyIdentifiers().join(', ');
      this.logger.warn(
        `third_party.invalid_plugin context=add_api_key routeIdentifier=${JSON.stringify(identifier)} supportedPlugins=${supported}`
      );
      throw new HttpException('Invalid identifier', 400);
    }

    const connect = await thirdParty.instance.checkConnection(api);
    if (!connect) {
      throw new HttpException('Invalid API key', 400);
    }

    try {
      const save = await this._thirdPartyManager.saveIntegration(
        organization.id,
        identifier,
        api,
        {
          name: connect.name,
          username: connect.username,
          id: connect.id,
        }
      );

      return {
        id: save.id,
      };
    } catch (e) {
      console.log(e);
      throw new HttpException('Integration Already Exists', 400);
    }
  }
}
