import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';

@Injectable()
export class MediaRepository {
  constructor(private _media: PrismaRepository<'media'>) {}

  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._media.model.media.create({
      data: {
        organization: {
          connect: {
            id: org,
          },
        },
        name: fileName,
        path: filePath,
        originalName: originalName || null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
      },
    });
  }

  getMediaById(id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
      },
    });
  }

  deleteMedia(org: string, id: string) {
    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  getPolotnoJson(org: string, id: string) {
    return this._media.model.media.findFirst({
      where: { id, organizationId: org, deletedAt: null },
      select: { id: true, polotnoJson: true, decomposeStatus: true },
    });
  }

  attachPolotnoJson(id: string, polotnoJson: unknown) {
    return this._media.model.media.update({
      where: { id },
      data: {
        polotnoJson: polotnoJson as never,
        decomposeStatus: 'ready',
      },
      select: { id: true, decomposeStatus: true },
    });
  }

  setDecomposeStatus(id: string, status: 'pending' | 'ready' | 'failed') {
    return this._media.model.media.update({
      where: { id },
      data: { decomposeStatus: status },
      select: { id: true, decomposeStatus: true },
    });
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._media.model.media.update({
      where: {
        id: data.id,
        organizationId: org,
      },
      data: {
        alt: data.alt,
        thumbnail: data.thumbnail,
        thumbnailTimestamp: data.thumbnailTimestamp,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
      },
    });
  }

  async getMedia(org: string, page: number, search?: string, filterMode?: 'all' | 'layers' | 'raw') {
    const pageNum = (page || 1) - 1;
    const trimmedSearch = search?.trim();
    const searchFilter = trimmedSearch
      ? {
          originalName: {
            contains: trimmedSearch,
            mode: 'insensitive' as const,
          },
        }
      : {};
    const layerFilter =
      filterMode === 'layers'
        ? { NOT: { polotnoJson: Prisma.DbNull } }
        : filterMode === 'raw'
        ? { polotnoJson: Prisma.DbNull }
        : {};
    const query = {
      where: {
        organization: {
          id: org,
        },
        deletedAt: null,
        ...searchFilter,
        ...layerFilter,
      },
    };
    const pages = Math.ceil((await this._media.model.media.count(query)) / 18);
    const results = await this._media.model.media.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        ...searchFilter,
        ...layerFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        decomposeStatus: true,
      },
      skip: pageNum * 18,
      take: 18,
    });

    return {
      pages,
      results,
    };
  }
}
