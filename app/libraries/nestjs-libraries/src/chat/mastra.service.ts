import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { pStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
import { Injectable } from '@nestjs/common';
import { LoadToolsService } from '@gitroom/nestjs-libraries/chat/load.tools.service';

@Injectable()
export class MastraService {
  static mastra: Mastra;
  constructor(private _loadToolsService: LoadToolsService) {}
  async mastra() {
    if (!MastraService.mastra) {
      const hootnshootAgent = await this._loadToolsService.agent();

      MastraService.mastra = new Mastra({
        storage: pStore,
        agents: {
          hootnshoot: hootnshootAgent,
        },
        logger: new ConsoleLogger({
          level: 'info',
        }),
      });
    }

    return MastraService.mastra;
  }
}
