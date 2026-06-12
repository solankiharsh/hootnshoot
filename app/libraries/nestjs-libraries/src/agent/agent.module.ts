import { Global, Module } from '@nestjs/common';
import { AgentGraphService } from '@gitroom/nestjs-libraries/agent/agent.graph.service';
import { AgentGraphInsertService } from '@gitroom/nestjs-libraries/agent/agent.graph.insert.service';
import { ImageModule } from '@gitroom/nestjs-libraries/image/image.module';
import { TemplateDecomposeModule } from '@gitroom/nestjs-libraries/templates/template-decompose.module';

@Global()
@Module({
  imports: [ImageModule, TemplateDecomposeModule],
  providers: [AgentGraphService, AgentGraphInsertService],
  get exports() {
    return this.providers;
  },
})
export class AgentModule {}
