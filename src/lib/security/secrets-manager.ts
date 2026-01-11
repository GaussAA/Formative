/**
 * Secrets Manager
 *
 * Provides unified secret management with support for multiple sources:
 * - Development: Environment variables
 * - Production: Vault, AWS Secrets Manager, Azure Key Vault, etc.
 */

import logger from '@/lib/logger';

/**
 * Secret source types
 */
export enum SecretSource {
  ENV = 'env',
  VAULT = 'vault',
  AWS_SECRETS_MANAGER = 'aws_secrets_manager',
  AZURE_KEY_VAULT = 'azure_key_vault',
  GCP_SECRET_MANAGER = 'gcp_secret_manager',
}

/**
 * Secret rotation configuration
 */
export interface SecretRotationConfig {
  /** Enable automatic rotation */
  enabled: boolean;
  /** Rotation interval in seconds */
  interval: number;
  /** Rotation callback function */
  onRotate?: (key: string, newValue: string) => Promise<void>;
}

/**
 * Secrets Manager class
 */
export class SecretsManager {
  private source: SecretSource;
  private cache: Map<string, { value: string; expiresAt: number }>;
  private rotationTimers: Map<string, NodeJS.Timeout>;

  constructor(source?: SecretSource) {
    this.source = source || this.detectSource();
    this.cache = new Map();
    this.rotationTimers = new Map();

    logger.info('SecretsManager initialized', { source: this.source });
  }

  /**
   * Detect secret source from environment
   */
  private detectSource(): SecretSource {
    if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN) {
      return SecretSource.VAULT;
    }
    if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID) {
      return SecretSource.AWS_SECRETS_MANAGER;
    }
    if (process.env.AZURE_KEY_VAULT_URI && process.env.AZURE_CLIENT_ID) {
      return SecretSource.AZURE_KEY_VAULT;
    }
    if (process.env.GCP_PROJECT_ID && process.env.GCP_CREDENTIALS) {
      return SecretSource.GCP_SECRET_MANAGER;
    }
    return SecretSource.ENV;
  }

  /**
   * Get secret value
   * @param key - Secret key name
   * @param useCache - Use cached value if available (default: true)
   * @returns Secret value
   */
  async getSecret(key: string, useCache: boolean = true): Promise<string> {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    // Fetch from source
    const value = await this.fetchSecret(key);

    // Cache for 5 minutes
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + 300000,
    });

    return value;
  }

  /**
   * Fetch secret from source
   */
  private async fetchSecret(key: string): Promise<string> {
    try {
      switch (this.source) {
        case SecretSource.VAULT:
          return await this.getFromVault(key);

        case SecretSource.AWS_SECRETS_MANAGER:
          return await this.getFromAWS(key);

        case SecretSource.AZURE_KEY_VAULT:
          return await this.getFromAzure(key);

        case SecretSource.GCP_SECRET_MANAGER:
          return await this.getFromGCP(key);

        case SecretSource.ENV:
        default:
          // Development: use environment variables
          const value = process.env[key];
          if (!value) {
            throw new Error(`Missing required secret: ${key}`);
          }
          return value;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch secret', { key, error: errorMessage });
      throw new Error(`Failed to fetch secret ${key}: ${errorMessage}`);
    }
  }

  /**
   * Get secret from HashiCorp Vault
   */
  private async getFromVault(key: string): Promise<string> {
    const vaultAddr = process.env.VAULT_ADDR!;
    const vaultToken = process.env.VAULT_TOKEN!;
    const vaultPath = process.env.VAULT_SECRET_PATH || 'secret';

    const response = await fetch(`${vaultAddr}/v1/${vaultPath}/${key}`, {
      headers: {
        'X-Vault-Token': vaultToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Vault request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.value;
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getFromAWS(key: string): Promise<string> {
    // Dynamic import for AWS SDK (only when needed)
    // @ts-expect-error - Optional dependency for production use
    const aws = await import('@aws-sdk/client-secrets-manager');

    const client = new aws.SecretsManagerClient({
      region: process.env.AWS_REGION,
    });

    const command = new aws.GetSecretValueCommand({
      SecretId: key,
    });

    const response = await client.send(command);
    return response.SecretString || '';
  }

  /**
   * Get secret from Azure Key Vault
   */
  private async getFromAzure(key: string): Promise<string> {
    // @ts-expect-error - Optional dependency for production use
    const azure = await import('@azure/keyvault-secrets');
    // @ts-expect-error - Optional dependency for production use
    const azureIdentity = await import('@azure/identity');

    const keyVaultUri = process.env.AZURE_KEY_VAULT_URI!;
    const credential = new azureIdentity.DefaultAzureCredential();
    const client = new azure.SecretClient(keyVaultUri, credential);

    const secret = await client.getSecret(key);
    return secret.value || '';
  }

  /**
   * Get secret from GCP Secret Manager
   */
  private async getFromGCP(key: string): Promise<string> {
    // @ts-expect-error - Optional dependency for production use
    const gcp = await import('@google-cloud/secret-manager');

    const client = new gcp.SecretManagerServiceClient();
    const projectId = process.env.GCP_PROJECT_ID!;
    const name = `projects/${projectId}/secrets/${key}/versions/latest`;

    const [version] = await client.accessSecretVersion({ name });
    return version.payload?.data?.toString() || '';
  }

  /**
   * Setup automatic secret rotation
   */
  setupRotation(key: string, config: SecretRotationConfig): void {
    if (!config.enabled) return;

    const existingTimer = this.rotationTimers.get(key);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(async () => {
      try {
        const newValue = await this.fetchSecret(key);
        this.cache.set(key, {
          value: newValue,
          expiresAt: Date.now() + 300000,
        });

        if (config.onRotate) {
          await config.onRotate(key, newValue);
        }

        logger.info('Secret rotated successfully', { key });
      } catch (error) {
        logger.error('Failed to rotate secret', { key, error });
      }
    }, config.interval * 1000);

    this.rotationTimers.set(key, timer);
    logger.info('Secret rotation configured', { key, interval: config.interval });
  }

  /**
   * Invalidate cached secret
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    logger.debug('Secret cache invalidated', { key });
  }

  /**
   * Clear all cached secrets
   */
  clear(): void {
    this.cache.clear();
    logger.debug('All secret caches cleared');
  }

  /**
   * Cleanup timers on shutdown
   */
  destroy(): void {
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();
    this.cache.clear();
  }

  /**
   * Get current secret source
   */
  getSource(): SecretSource {
    return this.source;
  }
}

// Singleton instance
let secretsManagerInstance: SecretsManager | null = null;

/**
 * Get SecretsManager singleton instance
 */
export function getSecretsManager(): SecretsManager {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManager();
  }
  return secretsManagerInstance;
}

// Export default instance
export default getSecretsManager();
