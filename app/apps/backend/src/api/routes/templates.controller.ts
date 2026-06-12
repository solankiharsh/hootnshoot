import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { TemplateService } from '@gitroom/nestjs-libraries/database/prisma/templates/template.service';
import { TemplateDecomposeService } from '@gitroom/nestjs-libraries/templates/template-decompose.service';
import { DecomposeStrategies } from '@gitroom/nestjs-libraries/templates/templates.types';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import {
  decodeBase64Image,
  MAX_BASE64_IMAGE_BYTES,
} from '@gitroom/nestjs-libraries/media/media-input.validation';

interface DecomposeBody {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  strategies?: DecomposeStrategies;
}

const ALLOWED_DECOMPOSE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

@ApiTags('Templates')
@Controller('/templates')
export class TemplatesController {
  constructor(
    private readonly _templateService: TemplateService,
    private readonly _decompose: TemplateDecomposeService
  ) {}

  @Post('/')
  createTemplate(
    @GetOrgFromRequest() org: Organization,
    @Body('name') name: string,
    @Body('json') json: string,
    @Body('preview') preview?: string,
    @Body('width') width?: number,
    @Body('height') height?: number
  ) {
    return this._templateService.create(org.id, name, json, preview, width, height);
  }

  @Get('/')
  getTemplates(
    @GetOrgFromRequest() org: Organization,
    @Query('page') page: number = 1,
    @Query('search') search?: string
  ) {
    return this._templateService.getTemplates(org.id, page, search);
  }

  @Delete('/:id')
  deleteTemplate(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._templateService.deleteTemplate(org.id, id);
  }

  @Post('/decompose')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async decompose(
    @GetOrgFromRequest() _org: Organization,
    @Body() body: DecomposeBody
  ) {
    if (!body.imageUrl && !body.imageBase64) {
      throw new BadRequestException('Either imageUrl or imageBase64 is required');
    }

    if (body.imageUrl) {
      if (!(await isSafePublicHttpsUrl(body.imageUrl))) {
        throw new BadRequestException('imageUrl must be a safe public HTTPS URL');
      }
    }

    if (body.imageBase64) {
      const buf = decodeBase64Image(
        body.imageBase64.startsWith('data:')
          ? body.imageBase64
          : `data:${body.imageMimeType ?? 'image/png'};base64,${body.imageBase64}`
      );
      if (buf.length > MAX_BASE64_IMAGE_BYTES) {
        throw new BadRequestException('imageBase64 exceeds size limit');
      }
      const mime = (body.imageMimeType ?? 'image/png').toLowerCase();
      if (!ALLOWED_DECOMPOSE_MIME.has(mime)) {
        throw new BadRequestException('Unsupported image MIME type');
      }
    }

    return this._decompose.decompose({
      imageUrl: body.imageUrl,
      imageBase64: body.imageBase64,
      imageMimeType: body.imageMimeType,
      strategies: body.strategies,
    });
  }
}
