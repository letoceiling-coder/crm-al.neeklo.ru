import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../common/utils/secret-encryption.util';

@Injectable()
export class SecretEncryptionService {
  constructor(private prisma: PrismaService) {}

  async storeSecret(params: {
    organizationId: string;
    key: string;
    plainValue: string;
    toolInstanceId?: string;
  }) {
    const { ciphertext, iv, tag } = encryptSecret(params.plainValue);

    return this.prisma.encryptedSecret.create({
      data: {
        organizationId: params.organizationId,
        key: params.key,
        ciphertext,
        iv,
        tag,
        toolInstanceId: params.toolInstanceId,
      },
    });
  }

  async updateSecret(secretId: string, organizationId: string, plainValue: string) {
    const row = await this.prisma.encryptedSecret.findFirst({
      where: { id: secretId, organizationId },
    });
    if (!row) throw new NotFoundException('Secret not found');

    const { ciphertext, iv, tag } = encryptSecret(plainValue);
    return this.prisma.encryptedSecret.update({
      where: { id: secretId },
      data: { ciphertext, iv, tag, rotatedAt: new Date() },
    });
  }

  async getSecret(secretId: string, organizationId: string): Promise<string> {
    const row = await this.prisma.encryptedSecret.findFirst({
      where: { id: secretId, organizationId },
    });
    if (!row) throw new NotFoundException('Secret not found');
    return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag });
  }

  async getSecretByProviderAccount(providerAccountId: string, organizationId?: string): Promise<string | null> {
    const account = await this.prisma.providerAccount.findUnique({
      where: { id: providerAccountId },
      include: { apiKeySecret: true },
    });
    if (!account?.apiKeySecret) return null;
    if (
      organizationId &&
      account.organizationId &&
      account.organizationId !== organizationId
    ) {
      throw new NotFoundException('Secret not found');
    }
    const row = account.apiKeySecret;
    return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag });
  }

  async deleteSecret(secretId: string, organizationId: string) {
    const row = await this.prisma.encryptedSecret.findFirst({
      where: { id: secretId, organizationId },
    });
    if (!row) throw new NotFoundException('Secret not found');
    await this.prisma.encryptedSecret.delete({ where: { id: secretId } });
    return { deleted: true };
  }

  async findByKey(organizationId: string, key: string): Promise<string | null> {
    const row = await this.prisma.encryptedSecret.findFirst({
      where: { organizationId, key },
    });
    if (!row) return null;
    return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag });
  }

  async upsertByKey(organizationId: string, key: string, plainValue: string) {
    const existing = await this.prisma.encryptedSecret.findFirst({
      where: { organizationId, key },
    });
    if (existing) {
      await this.updateSecret(existing.id, organizationId, plainValue);
      return existing.id;
    }
    const created = await this.storeSecret({ organizationId, key, plainValue });
    return created.id;
  }
}
