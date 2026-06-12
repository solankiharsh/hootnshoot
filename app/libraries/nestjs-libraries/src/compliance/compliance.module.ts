import { Module } from '@nestjs/common';
import { ComplianceService } from '@gitroom/nestjs-libraries/compliance/compliance.service';

@Module({
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
