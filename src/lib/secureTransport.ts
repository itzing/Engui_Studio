import crypto from 'crypto';
import S3Service from './s3Service';

export type SecureDirection = 'engui_to_endpoint' | 'endpoint_to_engui';
export type SecureMediaKind = 'image' | 'video';
export type SecureMediaRole = 'source_image' | 'secondary_image' | 'condition_image' | 'end_image' | 'source_video' | 'result';

export interface StructuredBinding {
  job_id: string;
  model_id: string;
  attempt_id: string;
  direction: SecureDirection;
}

export interface MediaBinding extends StructuredBinding {
  role: SecureMediaRole;
  kind: SecureMediaKind;
}

export interface StructuredEnvelope {
  v: 1;
  wrapped_key: string;
  nonce: string;
  ciphertext: string;
  binding: StructuredBinding;
}

export interface MediaEnvelope {
  v: 1;
  wrapped_key: string;
  nonce: string;
  binding: MediaBinding;
}

export interface MediaInputDescriptor {
  role: SecureMediaRole;
  kind: SecureMediaKind;
  mime: string;
  storage_path: string;
  envelope: MediaEnvelope;
}

export interface TransportRequest {
  output_dir: string;
}

export interface SecureTransportResult {
  status: 'completed' | 'failed';
  result_media?: {
    kind: SecureMediaKind;
    mime: string;
    storage_path: string;
    envelope: MediaEnvelope;
  };
  error?: {
    code: string;
    message: string;
  };
}

const WRAPPED_KEY_PREFIX = 'v1:';
const SECURE_NAMESPACE_ROOT = '/runpod-volume/secure-jobs';

function splitStoragePathForUpload(storagePath: string): { uploadPath: string; fileName: string } {
  const key = storagePathToS3Key(storagePath);
  const lastSlash = key.lastIndexOf('/');
  if (lastSlash === -1) {
    return { uploadPath: '', fileName: key };
  }

  return {
    uploadPath: key.slice(0, lastSlash),
    fileName: key.slice(lastSlash + 1),
  };
}

export class SecureTransportError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SecureTransportError';
    this.code = code;
  }
}

function toBase64(input: Buffer): string {
  return input.toString('base64');
}

function fromBase64(input: string, code: string, label: string): Buffer {
  try {
    return Buffer.from(input, 'base64');
  } catch (error: any) {
    throw new SecureTransportError(code, `${label} must be valid base64: ${error.message}`);
  }
}

export function decodeMasterKey(keyBase64?: string | null): Buffer {
  if (!keyBase64 || keyBase64.trim() === '') {
    throw new SecureTransportError('KEY_NOT_CONFIGURED', 'Global field encryption key is not configured');
  }

  const key = fromBase64(keyBase64, 'KEY_INVALID', 'Global field encryption key');
  if (key.length !== 32) {
    throw new SecureTransportError('KEY_INVALID', `Global field encryption key must decode to 32 bytes, got ${key.length}`);
  }

  return key;
}

function serializeBinding(binding: StructuredBinding | MediaBinding): Buffer {
  const canonical = Object.keys(binding)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = (binding as Record<string, unknown>)[key];
      return accumulator;
    }, {});

  return Buffer.from(JSON.stringify(canonical), 'utf8');
}

function randomDek(): Buffer {
  return crypto.randomBytes(32);
}

function wrapDek(masterKey: Buffer, dek: Buffer): string {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  const aad = Buffer.from('engui:wrapped-key:v1', 'utf8');
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${WRAPPED_KEY_PREFIX}${toBase64(Buffer.concat([nonce, encrypted, tag]))}`;
}

function unwrapDek(masterKey: Buffer, wrappedKey: string): Buffer {
  if (!wrappedKey.startsWith(WRAPPED_KEY_PREFIX)) {
    throw new SecureTransportError('TRANSPORT_RESULT_INVALID', 'Wrapped key prefix is invalid');
  }

  const payload = fromBase64(wrappedKey.slice(WRAPPED_KEY_PREFIX.length), 'TRANSPORT_RESULT_INVALID', 'Wrapped key');
  if (payload.length <= 28) {
    throw new SecureTransportError('TRANSPORT_RESULT_INVALID', 'Wrapped key payload is too short');
  }

  const nonce = payload.subarray(0, 12);
  const ciphertextWithTag = payload.subarray(12);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
    decipher.setAAD(Buffer.from('engui:wrapped-key:v1', 'utf8'));
    decipher.setAuthTag(tag);
    const dek = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (dek.length !== 32) {
      throw new Error(`Expected 32-byte DEK, got ${dek.length}`);
    }
    return dek;
  } catch (error: any) {
    throw new SecureTransportError('TRANSPORT_RESULT_DECRYPT_FAILED', `Failed to unwrap DEK: ${error.message}`);
  }
}

function buildAttemptPrefix(jobId: string, attemptId: string): string {
  return `${jobId}__${attemptId}`;
}

export function buildAttemptPaths(jobId: string, attemptId: string) {
  const prefix = buildAttemptPrefix(jobId, attemptId);
  return {
    baseDir: SECURE_NAMESPACE_ROOT,
    inputsDir: SECURE_NAMESPACE_ROOT,
    outputsDir: SECURE_NAMESPACE_ROOT,
    inputPrefix: `${SECURE_NAMESPACE_ROOT}/${prefix}__input__`,
    outputPrefix: `${SECURE_NAMESPACE_ROOT}/${prefix}__output__`,
  };
}

export function buildInputStoragePath(jobId: string, attemptId: string, fileName: string): string {
  return `${buildAttemptPaths(jobId, attemptId).inputPrefix}${fileName}`;
}

export function buildOutputStoragePath(jobId: string, attemptId: string, fileName: string): string {
  return `${buildAttemptPaths(jobId, attemptId).outputPrefix}${fileName}`;
}

export function storagePathToS3Key(storagePath: string): string {
  return storagePath
    .replace(/^\/+/, '')
    .replace(/^runpod-volume\//, '');
}

export function createStructuredEnvelope(masterKey: Buffer, binding: StructuredBinding, payload: unknown): StructuredEnvelope {
  const dek = randomDek();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce);
  cipher.setAAD(serializeBinding(binding));
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    wrapped_key: wrapDek(masterKey, dek),
    nonce: toBase64(nonce),
    ciphertext: toBase64(Buffer.concat([encrypted, tag])),
    binding,
  };
}

export function decryptStructuredEnvelope<T>(masterKey: Buffer, envelope: StructuredEnvelope, expectedBinding: StructuredBinding): T {
  assertStructuredBinding(envelope.binding, expectedBinding);
  const dek = unwrapDek(masterKey, envelope.wrapped_key);
  const nonce = fromBase64(envelope.nonce, 'TRANSPORT_RESULT_INVALID', 'Structured envelope nonce');
  const payload = fromBase64(envelope.ciphertext, 'TRANSPORT_RESULT_INVALID', 'Structured envelope ciphertext');

  if (payload.length <= 16) {
    throw new SecureTransportError('TRANSPORT_RESULT_INVALID', 'Structured envelope ciphertext is too short');
  }

  const ciphertext = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, nonce);
    decipher.setAAD(serializeBinding(expectedBinding));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch (error: any) {
    throw new SecureTransportError('TRANSPORT_RESULT_DECRYPT_FAILED', `Failed to decrypt structured envelope: ${error.message}`);
  }
}

export function createMediaEnvelope(masterKey: Buffer, binding: MediaBinding, ciphertext: Buffer): { envelope: MediaEnvelope; ciphertext: Buffer } {
  const dek = randomDek();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce);
  cipher.setAAD(serializeBinding(binding));
  const encrypted = Buffer.concat([cipher.update(ciphertext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    envelope: {
      v: 1,
      wrapped_key: wrapDek(masterKey, dek),
      nonce: toBase64(nonce),
      binding,
    },
    ciphertext: Buffer.concat([encrypted, tag]),
  };
}

export function decryptMediaCiphertext(masterKey: Buffer, envelope: MediaEnvelope, expectedBinding: MediaBinding, ciphertextWithTag: Buffer): Buffer {
  assertMediaBinding(envelope.binding, expectedBinding);
  const dek = unwrapDek(masterKey, envelope.wrapped_key);
  const nonce = fromBase64(envelope.nonce, 'RESULT_MEDIA_DECRYPT_FAILED', 'Media envelope nonce');

  if (ciphertextWithTag.length <= 16) {
    throw new SecureTransportError('RESULT_MEDIA_DECRYPT_FAILED', 'Media ciphertext is too short');
  }

  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, nonce);
    decipher.setAAD(serializeBinding(expectedBinding));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error: any) {
    throw new SecureTransportError('RESULT_MEDIA_DECRYPT_FAILED', `Failed to decrypt media ciphertext: ${error.message}`);
  }
}

export async function uploadEncryptedMediaInput(params: {
  s3: S3Service;
  masterKey: Buffer;
  jobId: string;
  modelId: string;
  attemptId: string;
  role: SecureMediaRole;
  kind: SecureMediaKind;
  mime: string;
  plaintext: Buffer;
  fileName: string;
  storagePath?: string;
}): Promise<MediaInputDescriptor> {
  const storagePath = params.storagePath || buildInputStoragePath(params.jobId, params.attemptId, params.fileName);
  const binding: MediaBinding = {
    job_id: params.jobId,
    model_id: params.modelId,
    attempt_id: params.attemptId,
    direction: 'engui_to_endpoint',
    role: params.role,
    kind: params.kind,
  };

  const { envelope, ciphertext } = createMediaEnvelope(params.masterKey, binding, params.plaintext);
  const uploadTarget = splitStoragePathForUpload(storagePath);
  const uploadResult = await params.s3.uploadFile(ciphertext, uploadTarget.fileName, 'application/octet-stream', uploadTarget.uploadPath);

  return {
    role: params.role,
    kind: params.kind,
    mime: params.mime,
    storage_path: uploadResult.filePath || storagePath,
    envelope,
  };
}

export async function downloadAndDecryptResultMedia(params: {
  s3: S3Service;
  masterKey: Buffer;
  jobId: string;
  modelId: string;
  attemptId: string;
  media: SecureTransportResult['result_media'];
}): Promise<Buffer> {
  if (!params.media) {
    throw new SecureTransportError('RESULT_MEDIA_MISSING', 'Successful transport result is missing result_media');
  }

  const ciphertext = await params.s3.downloadFile(storagePathToS3Key(params.media.storage_path));
  const expectedBinding: MediaBinding = {
    job_id: params.jobId,
    model_id: params.modelId,
    attempt_id: params.attemptId,
    direction: 'endpoint_to_engui',
    role: 'result',
    kind: params.media.kind,
  };

  return decryptMediaCiphertext(params.masterKey, params.media.envelope, expectedBinding, ciphertext);
}

export function createSecureStateSkeleton(params: {
  attemptId: string;
  runpodJobId?: string | null;
  outputDir: string;
  secureBlockPresent: boolean;
  mediaInputs: Array<Pick<MediaInputDescriptor, 'role' | 'kind' | 'mime' | 'storage_path'>>;
}) {
  return {
    v: 1,
    phase: 'submitting',
    activeAttempt: {
      attemptId: params.attemptId,
      runpodJobId: params.runpodJobId || null,
      outputDir: params.outputDir,
      request: {
        secureBlockPresent: params.secureBlockPresent,
        mediaInputs: params.mediaInputs.map(media => ({
          role: media.role,
          kind: media.kind,
          mime: media.mime,
          storagePath: media.storage_path,
        })),
        submittedAt: new Date().toISOString(),
      },
      response: {
        transportResultSecureReceived: false,
        transportResultStatus: null,
      },
      finalization: {
        status: 'pending',
        localResultPath: null,
        localResultUrl: null,
        completedAt: null,
      },
    },
    attemptHistory: [],
    failure: null,
    cleanup: {
      transportStatus: 'pending',
      warning: null,
    },
  };
}

export function assertStructuredBinding(actual: StructuredBinding, expected: StructuredBinding) {
  const actualJson = serializeBinding(actual).toString('utf8');
  const expectedJson = serializeBinding(expected).toString('utf8');
  if (actualJson !== expectedJson) {
    throw new SecureTransportError('SECURE_BINDING_MISMATCH', `Structured binding mismatch: expected ${expectedJson}, got ${actualJson}`);
  }
}

export function assertMediaBinding(actual: MediaBinding, expected: MediaBinding) {
  const actualJson = serializeBinding(actual).toString('utf8');
  const expectedJson = serializeBinding(expected).toString('utf8');
  if (actualJson !== expectedJson) {
    throw new SecureTransportError('MEDIA_INPUT_ENVELOPE_INVALID', `Media binding mismatch: expected ${expectedJson}, got ${actualJson}`);
  }
}
