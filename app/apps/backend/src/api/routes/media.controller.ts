import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ApiTags } from '@nestjs/swagger';
import handleR2Upload from '@gitroom/nestjs-libraries/upload/r2.uploader';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomFileValidationPipe } from '@gitroom/nestjs-libraries/upload/custom.upload.validation';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { VideoFunctionDto } from '@gitroom/nestjs-libraries/dtos/videos/video.function.dto';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { decodeBase64Image } from '@gitroom/nestjs-libraries/media/media-input.validation';
import { validatePolotnoJson } from '@gitroom/nestjs-libraries/media/polotno-json.validator';

const LANGUAGE_NAMES: Record<string, string> = {
  EN: 'English', PT: 'Portuguese', RU: 'Russian',
  ES: 'Spanish', FR: 'French', AR: 'Arabic',
};

@ApiTags('Media')
@Controller('/media')
export class MediaController {
  private storage = UploadFactory.createStorage();
  constructor(
    private _mediaService: MediaService,
    private _subscriptionService: SubscriptionService,
    private _openAi: OpenaiService
  ) {}

  @Delete('/:id')
  deleteMedia(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._mediaService.deleteMedia(org.id, id);
  }

  @Post('/generate-video')
  generateVideo(
    @GetOrgFromRequest() org: Organization,
    @Body() body: VideoDto
  ) {
    console.log('hello');
    return this._mediaService.generateVideo(org, body);
  }

  @Post('/generate-image')
  async generateImage(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Body('prompt') prompt: string,
    isPicturePrompt = false
  ) {
    if (!prompt?.trim()) {
      throw new BadRequestException('prompt is required');
    }

    const total = await this._subscriptionService.checkCredits(org);
    if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
      throw new BadRequestException('No AI image credits remaining');
    }

    try {
      const image = await this._mediaService.generateImage(
        prompt.trim(),
        org,
        isPicturePrompt
      );
      if (!image) {
        throw new BadRequestException('Image generation returned no output');
      }
      return {
        output:
          (isPicturePrompt ? '' : 'data:image/png;base64,') + image,
      };
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      const message =
        err?.message ||
        err?.error?.message ||
        'Image generation failed';
      throw new BadRequestException(message);
    }
  }

  @Post('/generate-image-with-prompt')
  async generateImageFromText(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Body('prompt') prompt: string
  ) {
    const image = await this.generateImage(org, req, prompt, true);
    if (!image?.output) {
      return false;
    }

    const buf = decodeBase64Image(String(image.output));
    const fakeFile = {
      buffer: buf,
      originalname: `ai-${Date.now()}.png`,
      mimetype: 'image/png',
      size: buf.length,
    } as Express.Multer.File;
    const uploaded = await this.storage.uploadFile(fakeFile);
    return this._mediaService.saveFile(
      org.id,
      uploaded.originalname,
      uploaded.path
    );
  }

  @Post('/upload-server')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new CustomFileValidationPipe())
  async uploadServer(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile() file: Express.Multer.File
  ) {
    const originalName = file?.originalname || '';
    const uploadedFile = await this.storage.uploadFile(file);
    return this._mediaService.saveFile(
      org.id,
      uploadedFile.originalname,
      uploadedFile.path,
      originalName
    );
  }

  @Post('/save-media')
  async saveMedia(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Body('name') name: string,
    @Body('originalName') originalName: string
  ) {
    if (!name) {
      return false;
    }
    return this._mediaService.saveFile(
      org.id,
      name,
      process.env.CLOUDFLARE_BUCKET_URL + '/' + name,
      originalName || undefined
    );
  }

  @Post('/upload-from-url')
  async uploadFromUrl(
    @GetOrgFromRequest() org: Organization,
    @Body('url') url: string,
    @Body('originalName') originalName?: string
  ) {
    if (!url || typeof url !== 'string') {
      throw new BadRequestException('url is required');
    }

    const uploadedPath = await this.storage.uploadSimple(url);
    const fileName = uploadedPath.split('/').pop();
    if (!fileName) {
      throw new BadRequestException('Failed to resolve uploaded filename');
    }

    return this._mediaService.saveFile(
      org.id,
      fileName,
      uploadedPath,
      originalName || undefined
    );
  }

  @Post('/information')
  saveMediaInformation(
    @GetOrgFromRequest() org: Organization,
    @Body() body: SaveMediaInformationDto
  ) {
    return this._mediaService.saveMediaInformation(org.id, body);
  }

  @Post('/upload-simple')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new CustomFileValidationPipe())
  async uploadSimple(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile('file') file: Express.Multer.File,
    @Body('preventSave') preventSave: string = 'false'
  ) {
    const originalName = file.originalname;
    const getFile = await this.storage.uploadFile(file);

    if (preventSave === 'true') {
      const { path } = getFile;
      return { path };
    }

    return this._mediaService.saveFile(
      org.id,
      getFile.originalname,
      getFile.path,
      originalName
    );
  }

  @Post('/edit-image')
  async editImage(
    @GetOrgFromRequest() org: Organization,
    @Body('imageDataUrl') imageDataUrl: string,
    @Body('prompt') prompt: string
  ) {
    return this._mediaService.editImage(imageDataUrl, prompt, org.id);
  }

  @Post('/erase-image')
  async eraseImage(
    @GetOrgFromRequest() org: Organization,
    @Body('image') image: string,
    @Body('mask') mask: string
  ) {
    return this._mediaService.eraseImage(image, mask, org.id);
  }

  @Post('/save-template')
  async saveTemplate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: {
      polotnoJson: unknown;
      thumbnailBase64: string;
      originalName?: string;
    }
  ) {
    if (!body.polotnoJson || !body.thumbnailBase64) {
      throw new BadRequestException('polotnoJson and thumbnailBase64 are required');
    }
    const validatedJson = validatePolotnoJson(body.polotnoJson);
    const buf = decodeBase64Image(body.thumbnailBase64);
    const fakeFile = {
      buffer: buf,
      originalname: body.originalName ?? `template-${Date.now()}.png`,
      mimetype: 'image/png',
      size: buf.length,
    } as Express.Multer.File;
    const getFile = await this.storage.uploadFile(fakeFile);
    const saved = await this._mediaService.saveFile(
      org.id,
      getFile.originalname,
      getFile.path,
      body.originalName
    );
    if (saved?.id) {
      await this._mediaService.attachPolotnoJson(saved.id, validatedJson);
    }
    return { ...saved, decomposeStatus: 'ready' };
  }

  @Post('/translate-text')
  async translateText(
    @GetOrgFromRequest() org: Organization,
    @Body('text') text: string,
    @Body('targetLanguage') targetLanguage: string
  ) {
    if (!text || !targetLanguage) {
      throw new BadRequestException('text and targetLanguage are required');
    }
    const languageName = LANGUAGE_NAMES[targetLanguage.toUpperCase()] ?? targetLanguage;
    const response = await this._openAi.translateText(text, languageName, org.id);
    return { response };
  }

  @Get('/')
  getMedia(
    @GetOrgFromRequest() org: Organization,
    @Query('page') page: number,
    @Query('search') search?: string,
    @Query('filterMode') filterMode?: 'all' | 'layers' | 'raw'
  ) {
    return this._mediaService.getMedia(org.id, page, search, filterMode);
  }

  @Get('/video-options')
  getVideos() {
    return this._mediaService.getVideoOptions();
  }

  @Get('/:id/polotno-json')
  async getPolotnoJson(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const row = await this._mediaService.getPolotnoJson(org.id, id);
    if (!row) {
      return { id, polotnoJson: null, decomposeStatus: null };
    }
    return {
      id: row.id,
      polotnoJson: row.polotnoJson ?? null,
      decomposeStatus: row.decomposeStatus ?? null,
    };
  }

  @Post('/video/function')
  videoFunction(
    @Body() body: VideoFunctionDto
  ) {
    return this._mediaService.videoFunction(body.identifier, body.functionName, body.params);
  }

  @Get('/generate-video/:type/allowed')
  generateVideoAllowed(
    @GetOrgFromRequest() org: Organization,
    @Param('type') type: string
  ) {
    return this._mediaService.generateVideoAllowed(org, type);
  }

  @Post('/:endpoint')
  async uploadFile(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Res() res: Response,
    @Param('endpoint') endpoint: string
  ) {
    const upload = await handleR2Upload(endpoint, req, res);
    if (endpoint !== 'complete-multipart-upload') {
      return upload;
    }

    // @ts-ignore
    const name = upload.Location.split('/').pop();
    const originalName = req.body?.file?.name;

    const saveFile = await this._mediaService.saveFile(
      org.id,
      name,
      // @ts-ignore
      upload.Location,
      originalName || undefined
    );

    res.status(200).json({ ...upload, saved: saveFile });
  }
}
