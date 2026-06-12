import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isComplianceEnabled } from '@gitroom/nestjs-libraries/compliance/compliance.config';

@Injectable()
export class ComplianceFeatureGuard implements CanActivate {
  canActivate(): boolean {
    if (!isComplianceEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
