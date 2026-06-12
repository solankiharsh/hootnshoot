# Hootnshoot Node.js SDK

This package exposes the public API client for **Hootnshoot** (self-hosted scheduling).

```bash
npm install @hootnshoot/node
```

## Usage

```typescript
import Hootnshoot from '@hootnshoot/node';

const client = new Hootnshoot('your-api-key', 'https://hootnshoot.example.com');
```

Available methods mirror the upstream API: posting, listing posts, uploads, integrations, and deletes. Point `baseUrl` at your deployed instance.
