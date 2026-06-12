import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class InstagramLateDto {
  @IsOptional()
  @IsIn(['story', 'reels'])
  contentType?: 'story' | 'reels';

  @IsOptional()
  @IsBoolean()
  shareToFeed?: boolean;
}
