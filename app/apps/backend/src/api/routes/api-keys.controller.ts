import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { OrgApiKeyService } from '@gitroom/nestjs-libraries/org-api-keys/org-api-key.service';
import { isOrgApiKeyIdentifier } from '@gitroom/nestjs-libraries/org-api-keys/org-api-key.constants';

@ApiTags('API Keys')
@Controller('/settings/api-keys')
export class ApiKeysController {
  constructor(private _orgApiKeyService: OrgApiKeyService) {}

  private assertIdentifier(identifier: string) {
    if (!isOrgApiKeyIdentifier(identifier)) {
      throw new HttpException('Unknown API key identifier', 400);
    }
    return identifier;
  }

  @Get('/')
  list(@GetOrgFromRequest() organization: Organization) {
    return this._orgApiKeyService.list(organization.id);
  }

  @Post('/:identifier')
  async save(
    @GetOrgFromRequest() organization: Organization,
    @Param('identifier') identifier: string,
    @Body('api') api: string
  ) {
    const id = this.assertIdentifier(identifier);
    if (!api?.trim()) {
      throw new HttpException('API key is required', 400);
    }
    const result = await this._orgApiKeyService.save(
      organization.id,
      id,
      api.trim()
    );
    if (!result.valid) {
      throw new HttpException('Invalid API key', 400);
    }
    return { saved: true };
  }

  @Post('/:identifier/test')
  test(
    @GetOrgFromRequest() organization: Organization,
    @Param('identifier') identifier: string
  ) {
    return this._orgApiKeyService.test(
      organization.id,
      this.assertIdentifier(identifier)
    );
  }

  @Delete('/:identifier')
  remove(
    @GetOrgFromRequest() organization: Organization,
    @Param('identifier') identifier: string
  ) {
    this.assertIdentifier(identifier);
    return this._orgApiKeyService.remove(organization.id, identifier);
  }
}
