import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { isAbsolute, join, resolve, sep } from 'path';
// @ts-ignore
import mime from 'mime';
async function* nodeStreamToIterator(stream: any) {
  for await (const chunk of stream) {
    yield chunk;
  }
}
function iteratorToStream(iterator: any) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(new Uint8Array(value));
      }
    },
  });
}
export const GET = async (
  request: NextRequest,
  context: {
    params: Promise<{
      path?: string[];
    }>;
  }
) => {
  const { path: pathParts } = await context.params;
  const uploadDirectory = process.env.UPLOAD_DIRECTORY || './.local/uploads';
  const uploadBaseDirectory = isAbsolute(uploadDirectory)
    ? uploadDirectory
    : resolve(process.cwd(), '../..', uploadDirectory);

  const filePath = resolve(uploadBaseDirectory, ...(pathParts || []));
  const normalizedBase = uploadBaseDirectory.endsWith(sep)
    ? uploadBaseDirectory
    : uploadBaseDirectory + sep;

  if (filePath !== uploadBaseDirectory && !filePath.startsWith(normalizedBase)) {
    return NextResponse.json({ message: 'Invalid file path' }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ message: 'File not found' }, { status: 404 });
  }

  const response = createReadStream(filePath);
  const fileStats = statSync(filePath);
  const contentType = mime.getType(filePath) || 'application/octet-stream';
  const iterator = nodeStreamToIterator(response);
  const webStream = iteratorToStream(iterator);
  return new Response(webStream, {
    headers: {
      'Content-Type': contentType,
      // Set the appropriate content-type header
      'Content-Length': fileStats.size.toString(),
      // Set the content-length header
      'Last-Modified': fileStats.mtime.toUTCString(),
      // Set the last-modified header
      'Cache-Control': 'public, max-age=31536000, immutable', // Example cache-control header
    },
  });
};
