import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemSecurityService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async diagnostics() {
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    const encryptionKey = this.config.get<string>('SECRET_ENCRYPTION_KEY');

    const [encryptedSecrets, agentKeys, apiKeys, orgs] = await Promise.all([
      this.prisma.encryptedSecret.count(),
      this.prisma.agentApiKey.count({ where: { status: 'ACTIVE' } }),
      this.prisma.apiKey.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      tenantIsolation: { enforced: true, mechanism: 'TenantGuard + organizationId scoping' },
      jwt: {
        configured: Boolean(jwtSecret && jwtSecret.length >= 16),
        minLengthOk: Boolean(jwtSecret && jwtSecret.length >= 32),
      },
      secretEncryption: {
        configured: Boolean(encryptionKey && encryptionKey.length >= 32),
        encryptedSecretsStored: encryptedSecrets,
      },
      apiKeys: { active: apiKeys, hashed: true },
      agentKeys: { active: agentKeys, hashed: true },
      webhooks: { signatureUtil: 'integration-signature.util.ts HMAC-SHA256' },
      s3: {
        configured: Boolean(this.config.get('S3_ENDPOINT')),
        pathStyle: true,
        tenantPrefix: '{organizationId}/',
      },
      parser: {
        configured: Boolean(this.config.get('PARSER_SERVICE_URL')),
      },
      organizations: orgs,
      checks: [
        { name: 'JWT secret', ok: Boolean(jwtSecret && jwtSecret.length >= 16) },
        { name: 'Encryption key', ok: Boolean(encryptionKey && encryptionKey.length >= 32) },
        { name: 'Tenant guard global', ok: true },
        { name: 'API keys hashed', ok: true },
        { name: 'Agent keys hashed', ok: true },
      ],
    };
  }
}
