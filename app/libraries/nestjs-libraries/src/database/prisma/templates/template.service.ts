import { Injectable } from '@nestjs/common';
import { TemplateRepository } from '@gitroom/nestjs-libraries/database/prisma/templates/template.repository';

@Injectable()
export class TemplateService {
  constructor(private _templateRepository: TemplateRepository) {}

  create(org: string, name: string, json: string, preview?: string, width?: number, height?: number) {
    return this._templateRepository.create(org, name, json, preview, width, height);
  }

  async getTemplates(org: string, page: number, search?: string) {
    const [total, results] = await this._templateRepository.getTemplates(org, page, search);
    const pages = Math.ceil(total / 18);
    return { pages, results };
  }

  deleteTemplate(org: string, id: string) {
    return this._templateRepository.deleteTemplate(org, id);
  }
}
