import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { skipTake, paginate } from '../common/utils/pagination.util';
import { AuditAction } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private organizations: OrganizationsService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take } = skipTake(query);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          theme: true,
          isActive: true,
          twoFaEnabled: true,
          createdAt: true,
          _count: { select: { apiKeys: true } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        theme: true,
        isActive: true,
        twoFaEnabled: true,
        createdAt: true,
        apiKeys: {
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, adminId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role ?? 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await this.audit.log(AuditAction.USER_CREATED, adminId, { userId: user.id, email: user.email });
    await this.organizations.ensurePersonalOrganization(user.id, user.email, user.name);
    return user;
  }

  async update(id: string, dto: UpdateUserDto, adminId: string) {
    await this.findOne(id);
    const { password, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        theme: true,
      },
    });
    const auditChanges: Record<string, unknown> = { ...rest };
    if (password) auditChanges.passwordChanged = true;
    await this.audit.log(AuditAction.USER_UPDATED, adminId, {
      userId: id,
      changes: auditChanges,
    });
    return user;
  }

  async remove(id: string, adminId: string) {
    if (id === adminId) {
      throw new ConflictException('Нельзя удалить свою учётную запись');
    }
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    await this.audit.log(AuditAction.USER_DELETED, adminId, { userId: id });
    return { deleted: true };
  }
}
