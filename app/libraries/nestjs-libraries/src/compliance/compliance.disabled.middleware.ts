import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { isComplianceEnabled } from '@gitroom/nestjs-libraries/compliance/compliance.config';

@Injectable()
export class ComplianceDisabledMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    if (!isComplianceEnabled()) {
      throw new NotFoundException();
    }
    next();
  }
}
