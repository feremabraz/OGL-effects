import { NextResponse } from 'next/server';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const effectsDir = join(process.cwd(), 'app', 'effects');
  let effectFolders: string[] = [];
  try {
    effectFolders = readdirSync(effectsDir).filter((name) =>
      statSync(join(effectsDir, name)).isDirectory()
    );
  } catch (e) {
    return NextResponse.json(
      { error: 'Could not read effects directory', details: String(e) },
      { status: 500 }
    );
  }
  return NextResponse.json(effectFolders);
}
