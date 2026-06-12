import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateRepository {
  constructor(private _template: PrismaRepository<'template'>) {}

  create(org: string, name: string, json: string, preview?: string, width?: number, height?: number) {
    return this._template.model.template.create({
      data: {
        organization: { connect: { id: org } },
        name,
        json,
        preview: preview || null,
        width: width || null,
        height: height || null,
      },
      select: { id: true, name: true, preview: true, json: true, width: true, height: true, createdAt: true },
    });
  }

  getTemplates(org: string, page: number, search?: string) {
    const pageNum = (page || 1) - 1;
    const trimmedSearch = search?.trim();
    const searchFilter = trimmedSearch
      ? { name: { contains: trimmedSearch, mode: 'insensitive' as const } }
      : {};
    const query = {
      where: { organization: { id: org }, deletedAt: null, ...searchFilter },
    };
    const count = this._template.model.template.count(query);
    const results = this._template.model.template.findMany({
      where: { organizationId: org, deletedAt: null, ...searchFilter },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, preview: true, json: true, width: true, height: true, createdAt: true },
      skip: pageNum * 18,
      take: 18,
    });
    return Promise.all([count, results]);
  }

  deleteTemplate(org: string, id: string) {
    return this._template.model.template.update({
      where: { id, organizationId: org },
      data: { deletedAt: new Date() },
    });
  }
}
