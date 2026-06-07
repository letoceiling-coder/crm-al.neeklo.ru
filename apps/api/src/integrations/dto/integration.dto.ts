import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';
import {
  IntegrationProviderType,
  IntegrationAccountStatus,
  ConversationStatus,
  ConversationChannel,
} from '@prisma/client';

export class CreateIntegrationAccountDto {
  @IsEnum(IntegrationProviderType)
  provider!: IntegrationProviderType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret?: string;
}

export class UpdateIntegrationAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(IntegrationAccountStatus)
  status?: IntegrationAccountStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret?: string;
}

export class BindAssistantChannelDto {
  @IsString()
  integrationAccountId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class SendMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}

export class ListConversationsQueryDto {
  @IsOptional()
  @IsEnum(ConversationChannel)
  channel?: ConversationChannel;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsString()
  assistantId?: string;
}

export class OutboundWebhookDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;
}
