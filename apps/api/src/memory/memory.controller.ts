import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { MemoryProfileService } from './memory-profile.service';
import { MemoryEntryService } from './memory-entry.service';
import { MemorySearchService } from './memory-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryQueueService } from './memory-queue.service';
import {
  CreateMemoryProfileDto,
  UpdateMemoryProfileDto,
  CreateMemoryEntryDto,
  MemorySearchDto,
  SummarizeMemoryDto,
  GetOrCreateProfileDto,
  ListMemoryProfilesQueryDto,
  ListMemoryEntriesQueryDto,
} from './dto/memory.dto';

@ApiTags('Memory')
@ApiBearerAuth()
@Controller('v1/memory')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class MemoryController {
  constructor(
    private profiles: MemoryProfileService,
    private entries: MemoryEntryService,
    private search: MemorySearchService,
    private queue: MemoryQueueService,
    private prisma: PrismaService,
  ) {}

  @Get('profiles')
  @ApiOperation({ summary: 'List memory profiles' })
  listProfiles(@CurrentTenant() tenant: TenantContext, @Query() query: ListMemoryProfilesQueryDto) {
    return this.profiles.list(tenant, query.entityType);
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Create memory profile' })
  createProfile(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateMemoryProfileDto) {
    return this.profiles.create(tenant, dto);
  }

  @Post('profiles/get-or-create')
  @ApiOperation({ summary: 'Get or create memory profile' })
  getOrCreate(@CurrentTenant() tenant: TenantContext, @Body() dto: GetOrCreateProfileDto) {
    return this.profiles.getOrCreate(tenant, dto);
  }

  @Get('profiles/:id')
  @ApiOperation({ summary: 'Get memory profile' })
  getProfile(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.profiles.findOne(tenant, id);
  }

  @Patch('profiles/:id')
  @ApiOperation({ summary: 'Update memory profile' })
  updateProfile(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateMemoryProfileDto,
  ) {
    return this.profiles.update(tenant, id, dto);
  }

  @Delete('profiles/:id')
  @ApiOperation({ summary: 'Delete memory profile' })
  deleteProfile(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.profiles.remove(tenant, id);
  }

  @Get('profiles/:id/entries')
  @ApiOperation({ summary: 'List memory entries' })
  listEntries(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') profileId: string,
    @Query() query: ListMemoryEntriesQueryDto,
  ) {
    return this.entries.list(tenant, profileId, query.entryType, query.limit);
  }

  @Post('profiles/:id/entries')
  @ApiOperation({ summary: 'Create memory entry' })
  createEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') profileId: string,
    @Body() dto: CreateMemoryEntryDto,
  ) {
    return this.entries.create(tenant, profileId, dto);
  }

  @Delete('profiles/:profileId/entries/:entryId')
  @ApiOperation({ summary: 'Delete memory entry' })
  deleteEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('profileId') profileId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.entries.remove(tenant, profileId, entryId);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search memory (keyword / vector / hybrid)' })
  searchMemory(@CurrentTenant() tenant: TenantContext, @Body() dto: MemorySearchDto) {
    return this.search.search(tenant, dto);
  }

  @Post('profiles/:id/summarize')
  @ApiOperation({ summary: 'Enqueue memory summarization' })
  async summarize(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') profileId: string,
    @Body() dto: SummarizeMemoryDto,
  ) {
    await this.profiles.assertOwned(profileId, tenant.organizationId);
    const job = await this.queue.enqueueSummarize({
      profileId,
      organizationId: tenant.organizationId,
      period: dto.period,
      maxEntries: dto.maxEntries,
    });
    return { queued: true, jobId: job.id };
  }

  @Get('search-logs')
  @ApiOperation({ summary: 'Recent memory search logs' })
  searchLogs(@CurrentTenant() tenant: TenantContext, @Query('profileId') profileId?: string) {
    return this.prisma.memorySearchLog.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(profileId ? { profileId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
