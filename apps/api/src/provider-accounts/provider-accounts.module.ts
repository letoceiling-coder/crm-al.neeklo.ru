import { Module } from '@nestjs/common';
import { ProviderAccountsService } from './provider-accounts.service';
import { ProviderAccountsController } from './provider-accounts.controller';
import { SecretsModule } from '../secrets/secrets.module';

@Module({
  imports: [SecretsModule],
  controllers: [ProviderAccountsController],
  providers: [ProviderAccountsService],
  exports: [ProviderAccountsService],
})
export class ProviderAccountsModule {}
