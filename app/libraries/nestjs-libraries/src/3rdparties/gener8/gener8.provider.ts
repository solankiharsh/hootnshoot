import {
  ThirdParty,
  ThirdPartyAbstract,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import {
  ImageService,
  type ImageBrief,
} from '@gitroom/nestjs-libraries/image/image.service.interface';

/** Same shape as Create Post → image step → POST /image/generate body. */
export type Gener8SendPayload = {
  inputText: string;
  aspectRatio: string;
  resolution?: '1K' | '2K' | '4K';
  personas: string[];
  onBrand: boolean;
  disclaimer: boolean;
  logo?: string;
};

export function gener8SendPayloadToImageBrief(data: Gener8SendPayload): ImageBrief {
  return {
    inputText: data.inputText.trim(),
    aspectRatio: data.aspectRatio,
    resolution: data.resolution,
    personas:
      Array.isArray(data.personas) && data.personas.length > 0
        ? data.personas
        : undefined,
    onBrand: data.onBrand,
    disclaimer: data.disclaimer,
    logo: data.logo?.trim() ? data.logo : undefined,
  };
}

@ThirdParty({
  identifier: 'gener8',
  title: 'Gener8',
  description: 'Generate branded images using Gener8 AI.',
  position: 'media',
  fields: [],
})
export class Gener8Provider extends ThirdPartyAbstract<Gener8SendPayload> {
  constructor(private readonly _imageService: ImageService) {
    super();
  }

  async checkConnection(
    _apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    const key = process.env.GENER8_API_KEY?.trim();
    if (!key) {
      return false;
    }
    return {
      name: 'Gener8',
      username: 'gener8',
      id: 'gener8-builtin',
    };
  }

  async sendData(
    _apiKey: string,
    data: Gener8SendPayload
  ): Promise<string> {
    if (!process.env.GENER8_API_KEY?.trim()) {
      throw new Error('GENER8_API_KEY not configured');
    }

    const result = await this._imageService.generate(
      gener8SendPayloadToImageBrief(data)
    );

    const url = result.images?.[0];
    if (!url || typeof url !== 'string') {
      throw new Error('Gener8 returned no image URL');
    }

    return url;
  }
}
