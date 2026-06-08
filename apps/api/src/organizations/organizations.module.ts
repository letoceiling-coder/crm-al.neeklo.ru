import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationsController } from './organizations.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMembersService],
  exports: [OrganizationsService, OrganizationMembersService],
})
export class OrganizationsModule {}
