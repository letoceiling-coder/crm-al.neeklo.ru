import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from './secret-encryption.service';

@Injectable()
export class SecretRotationService {
  constructor(
    private prisma: PrismaService,
    private encryption: SecretEncryptionService,
  ) {}

  async rotateProviderAccountKey(providerAccountId: string, newPlainKey: string, organizationId?: string) {
    const account = await this.prisma.providerAccount.findUnique({
      where: { id: providerAccountId },
      include: { apiKeySecret: true },
    });
    if (!account) throw new NotFoundException('Provider account not found');
    if (organizationId && account.organizationId && account.organizationId !== organizationId) {
      throw new NotFoundException('Provider account not found');
    }

    const orgId = account.organizationId ?? organizationId;
    if (!orgId) {
      throw new NotFoundException('Organization context required for secret rotation');
    }

    let secretId = account.apiKeySecretId;
    if (secretId) {
      await this.encryption.updateSecret(secretId, orgId, newPlainKey);
    } else {
      const secret = await this.encryption.storeSecret({
        organizationId: orgId,
        key: 'api_key',
        plainValue: newPlainKey,
      });
      secretId = secret.id;
      await this.prisma.providerAccount.update({
        where: { id: account.id },
        data: { apiKeySecretId: secretId },
      });
    }

    const secret = await this.prisma.encryptedSecret.findUnique({ where: { id: secretId! } });
    return { rotated: true, secretId, rotatedAt: secret?.rotatedAt };
  }

  async rotateSecretById(secretId: string, organizationId: string, newPlainValue: string) {
    return this.encryption.updateSecret(secretId, organizationId, newPlainValue);
  }
}
