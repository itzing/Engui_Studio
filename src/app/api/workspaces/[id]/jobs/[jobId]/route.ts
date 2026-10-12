import { NextResponse } from 'next/server';
const unavailable = async () => NextResponse.json({ error: 'Moving or unassigning jobs is not supported.' }, { status: 410 });
export { unavailable as POST, unavailable as PUT, unavailable as DELETE };
