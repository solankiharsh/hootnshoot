import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ImageService } from '@gitroom/nestjs-libraries/image/image.service.interface';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

const GENER8_BASE_URL = (process.env.GENER8_BASE_URL || '').replace(/\/+$/, '');
const IMAGE_JOB_TOKEN_TTL_MS = 15 * 60 * 1000;

interface ImageJobTokenPayload {
  type: 'image-generation-job';
  jobId: string;
  userId: string;
  expiresAt: number;
}

@ApiTags('Image')
@Controller('/image')
export class ImageController {
  constructor(private _imageService: ImageService) {}

  @Post('/generate')
  async generate(
    @GetUserFromRequest() _user: User,
    @Body() body: {
      inputText: string;
      aspectRatio?: string;
      resolution?: string;
      personas?: string[];
      onBrand?: boolean;
      disclaimer?: boolean;
      logo?: string;
    }
  ) {
    return this._imageService.generate({
      inputText: body.inputText,
      aspectRatio: body.aspectRatio,
      resolution: body.resolution as '1K' | '2K' | '4K' | undefined,
      personas: Array.isArray(body.personas) ? body.personas : undefined,
      onBrand: body.onBrand,
      disclaimer: body.disclaimer,
      logo: body.logo,
    });
  }

  @Get('/personas')
  async getPersonas() {
    const apiKey = process.env.GENER8_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('GENER8_API_KEY is not set');
    }

    const response = await fetch(`${GENER8_BASE_URL}/v1/personas`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new ConflictException('Failed to fetch personas from Gener8');
    }

    return response.json();
  }

  @Get('/generate/status')
  async getStatus(
    @GetUserFromRequest() user: User,
    @Query('jobToken') jobToken: string
  ) {
    const { jobId } = this.decodeJobToken(jobToken, user);
    const status = await this._imageService.getStatus(jobId);

    return {
      status: status.status,
      progress: status.progress,
      message: status.message ?? null,
      error: status.error ?? null,
    };
  }

  @Get('/generate/result')
  async getResult(
    @GetUserFromRequest() user: User,
    @Query('jobToken') jobToken: string
  ) {
    const { jobId } = this.decodeJobToken(jobToken, user);
    const status = await this._imageService.getStatus(jobId);

    if (status.status === 'failed') {
      throw new ConflictException(status.error || 'Image generation failed');
    }

    if (status.status !== 'completed') {
      throw new ConflictException('Image generation is still in progress');
    }

    return this._imageService.getResult(jobId);
  }

  private signJobToken(jobId: string, userId: string): string {
    return AuthService.signJWT({
      type: 'image-generation-job',
      jobId,
      userId,
      expiresAt: Date.now() + IMAGE_JOB_TOKEN_TTL_MS,
    } satisfies ImageJobTokenPayload);
  }

  private decodeJobToken(jobToken: string | undefined, user: User): ImageJobTokenPayload {
    if (!jobToken) {
      throw new BadRequestException('jobToken is required');
    }

    let payload: unknown;
    try {
      payload = AuthService.verifyJWT(jobToken);
    } catch {
      throw new UnauthorizedException('Invalid image job token');
    }

    const parsed = payload as Partial<ImageJobTokenPayload>;
    if (
      parsed?.type !== 'image-generation-job' ||
      typeof parsed.jobId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      throw new UnauthorizedException('Invalid image job token');
    }

    if (parsed.userId !== user.id) {
      throw new UnauthorizedException('Image job does not belong to the current user');
    }

    if (Date.now() > parsed.expiresAt) {
      throw new UnauthorizedException('Image job token expired');
    }

    return parsed as ImageJobTokenPayload;
  }
}
