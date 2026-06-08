import { Controller, Get, Post, Body, Param, Req, Headers, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentProviderType } from '@prisma/client';
import { Public } from '../common/decorators';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/payments.dto';

@ApiTags('payments')
@Controller('v1/payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get('providers')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  @ApiOperation({ summary: 'List payment providers' })
  listProviders() {
    return this.payments.listProviders();
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  @ApiOperation({ summary: 'Payment history for organization' })
  history(@CurrentTenant() tenant: TenantContext) {
    return this.payments.listPayments(tenant.organizationId);
  }

  @Post('invoices/:invoiceId/pay')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  @ApiOperation({ summary: 'Initiate payment for open invoice' })
  payInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payments.initiatePayment(tenant.organizationId, invoiceId, dto.provider);
  }

  @Post(':paymentId/mock-complete')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  @ApiOperation({ summary: 'Complete mock payment (dev/test only)' })
  mockComplete(@CurrentTenant() tenant: TenantContext, @Param('paymentId') paymentId: string) {
    return this.payments.completeMockPayment(paymentId, tenant.organizationId);
  }

  @Public()
  @Post('webhook/yookassa')
  @ApiOperation({ summary: 'YooKassa payment webhook' })
  yookassaWebhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    return this.payments.handleWebhook(PaymentProviderType.YOOKASSA, headers, body);
  }

  @Public()
  @Post('webhook/mock')
  @ApiOperation({ summary: 'Mock payment webhook (test)' })
  mockWebhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    return this.payments.handleWebhook(
      PaymentProviderType.YOOKASSA,
      { ...headers, 'x-mock-payment': 'true' },
      body,
    );
  }
}
