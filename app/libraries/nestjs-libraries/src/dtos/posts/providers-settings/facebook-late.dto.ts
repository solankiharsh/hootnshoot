import { IsIn, IsOptional, IsString } from 'class-validator';

export class FacebookLateDto {
  @IsOptional()
  @IsIn(['story', 'reel'])
  contentType?: 'story' | 'reel';

  @IsOptional()
  @IsString()
  firstComment?: string;
}
