import { IsBoolean, IsOptional } from 'class-validator';

export class EmailNotificationsDto {
  @IsBoolean()
  sendSuccessEmails: boolean;

  @IsBoolean()
  sendFailureEmails: boolean;

  @IsBoolean()
  sendStreakEmails: boolean;

  @IsOptional()
  @IsBoolean()
  sendComplianceDigestEmails?: boolean;
}

