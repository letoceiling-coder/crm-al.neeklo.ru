import { IsEnum, IsOptional } from 'class-validator';
import { PaymentProviderType } from '@prisma/client';

export class InitiatePaymentDto {
  @IsOptional()
  @IsEnum(PaymentProviderType)
  provider?: PaymentProviderType;
}

export class MockWebhookDto {
  object!: { id: string; status: string };
}
