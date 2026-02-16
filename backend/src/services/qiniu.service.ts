/**
 * Qiniu Cloud Object Storage Service
 * 
 * Uses the Qiniu REST API directly (no SDK needed).
 * Configure via environment variables:
 *   QINIU_ACCESS_KEY, QINIU_SECRET_KEY, QINIU_BUCKET, QINIU_DOMAIN
 */

import crypto from 'crypto';
import https from 'https';

// ── Config ──

function getConfig() {
    return {
        accessKey: process.env.QINIU_ACCESS_KEY || '',
        secretKey: process.env.QINIU_SECRET_KEY || '',
        bucket: process.env.QINIU_BUCKET || '',
        domain: process.env.QINIU_DOMAIN || '',   // e.g. "https://cdn.example.com"
        region: process.env.QINIU_REGION || 'z2'
    };
}

export function isQiniuConfigured(): boolean {
    const c = getConfig();
    return !!(c.accessKey && c.secretKey && c.bucket && c.domain);
}

// ── Token Generation (HMAC-SHA1) ──

function urlSafeBase64Encode(str: string | Buffer): string {
    const buf = typeof str === 'string' ? Buffer.from(str) : str;
    return buf.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function hmacSha1(key: string, data: string): string {
    return crypto.createHmac('sha1', key).update(data).digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Generate an upload token for client-side direct upload.
 * @param keyPrefix Optional key prefix for the uploaded file
 * @param expiresSeconds Token validity (default 3600)
 */
export function generateUploadToken(keyPrefix?: string, expiresSeconds = 3600): {
    token: string;
    domain: string;
    bucket: string;
    key?: string;
} {
    const config = getConfig();
    if (!isQiniuConfigured()) {
        throw new Error('Qiniu is not configured');
    }

    const deadline = Math.floor(Date.now() / 1000) + expiresSeconds;
    const key = keyPrefix
        ? `${keyPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        : undefined;

    const putPolicy: Record<string, any> = {
        scope: key ? `${config.bucket}:${key}` : config.bucket,
        deadline,
        returnBody: '{"key":"$(key)","hash":"$(etag)","url":"' + config.domain + '/$(key)"}'
    };

    const encodedPolicy = urlSafeBase64Encode(JSON.stringify(putPolicy));
    const sign = hmacSha1(config.secretKey, encodedPolicy);
    const token = `${config.accessKey}:${sign}:${encodedPolicy}`;

    return { token, domain: config.domain, bucket: config.bucket, key };
}

/**
 * Upload a buffer to Qiniu from the server side using the form upload API.
 * @returns The full public URL of the uploaded file
 */
export function uploadBuffer(buffer: Buffer, fileName: string, mime: string): Promise<{ url: string; key: string }> {
    const config = getConfig();
    if (!isQiniuConfigured()) {
        return Promise.reject(new Error('Qiniu is not configured'));
    }

    const key = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${fileName}`;
    const regionHostMap: Record<string, string> = {
        z0: 'up-z0.qiniup.com',
        z1: 'up-z1.qiniup.com',
        z2: 'up-z2.qiniup.com',
        na0: 'up-na0.qiniup.com',
        as0: 'up-as0.qiniup.com'
    };
    const uploadHost = regionHostMap[String(config.region || 'z2')] || 'up-z2.qiniup.com';

    // Generate token scoped to this key
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const putPolicy = {
        scope: `${config.bucket}:${key}`,
        deadline,
    };
    const encodedPolicy = urlSafeBase64Encode(JSON.stringify(putPolicy));
    const sign = hmacSha1(config.secretKey, encodedPolicy);
    const token = `${config.accessKey}:${sign}:${encodedPolicy}`;

    // Build multipart/form-data
    const boundary = `----QiniuBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // token field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${token}\r\n`));
    // key field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\n${key}\r\n`));
    // file field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: uploadHost,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve({
                            url: `${config.domain}/${parsed.key || key}`,
                            key: parsed.key || key
                        });
                    } else {
                        reject(new Error(`Qiniu upload failed: ${data}`));
                    }
                } catch {
                    reject(new Error(`Qiniu response parse error: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
